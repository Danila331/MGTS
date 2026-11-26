package usecase

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	analytics "mgts/backend/internal/modules/analytics/usecase"
	"mgts/backend/internal/modules/core/domain"
	insights "mgts/backend/internal/modules/insights/usecase"
)

type SurveyAnalyzer interface {
	Version() string
	Name() string
	Analyze(context.Context, analytics.PulseHistory) (*domain.SurveySummary, error)
}

func (s *Service) SetSurveyAnalyzer(analyzer SurveyAnalyzer) { s.surveyAnalyzer = analyzer }

func pulseHistories(state *domain.State) map[string]analytics.PulseHistory {
	return analytics.PulseHistories(state, func(survey domain.Survey) bool {
		for _, table := range pulseTables {
			if isPulseSurvey(table, survey, survey.Wave) {
				return true
			}
		}
		return false
	})
}

func surveyFollowUpKey(id string, history analytics.PulseHistory) string {
	return id + ":" + surveyFingerprint("follow-up-v1", history)
}

func surveyFingerprint(version string, history analytics.PulseHistory) string {
	encoded, _ := json.Marshal(history)
	return fmt.Sprintf("%x", sha256.Sum256(append([]byte(version+"\n"), encoded...)))
}

func (s *Service) surveyAnalysis(state *domain.State, id string, history analytics.PulseHistory) domain.SurveyAnalysis {
	findings := history.Findings
	if findings == nil {
		findings = []domain.SurveyFinding{}
	}
	result := domain.SurveyAnalysis{Findings: findings, Status: "disabled"}
	reviewKey := surveyFollowUpKey(id, history)
	followUp, ok := state.SurveyFollowUps[reviewKey]
	result.ReviewVersion = reviewVersion(reviewKey, followUp)
	if ok {
		result.FollowUp = &followUp
	}
	if len(history.Answers) == 0 {
		result.Status = "no_data"
		return result
	}
	if s.surveyAnalyzer == nil {
		return result
	}
	result.Status, result.Model = "pending", s.surveyAnalyzer.Name()
	job := state.SurveyAnalysisJobs[id]
	if job.Fingerprint == surveyFingerprint(s.surveyAnalyzer.Version(), history) {
		switch {
		case job.Result != nil:
			result.Status, result.AI = "ready", job.Result
		case job.Attempts >= 4 && !job.LeaseUntil.After(s.now()):
			result.Status = "failed"
		case !job.NextRun.IsZero():
			result.Status = "retrying"
		}
	}
	return result
}

func reviewVersion(key string, current domain.SurveyFollowUp) string {
	encoded, _ := json.Marshal(current)
	return fmt.Sprintf("%x", sha256.Sum256(append([]byte(key), encoded...)))
}

func (s *Service) UpdateSurveyFollowUp(ctx context.Context, actorID, id, status, note, expectedVersion string) (domain.SurveyFollowUp, error) {
	note = strings.TrimSpace(note)
	if (status != "in_progress" && status != "done") || note == "" || len([]rune(note)) > 1500 {
		return domain.SurveyFollowUp{}, invalid("укажите следующий шаг и статус")
	}
	result := domain.SurveyFollowUp{}
	err := s.store.Update(ctx, func(state *domain.State) error {
		if err := s.requireSurveyHR(state, actorID); err != nil {
			return err
		}
		if _, ok := state.Internships[id]; !ok {
			return domain.ErrNotFound
		}
		key := surveyFollowUpKey(id, pulseHistories(state)[id])
		if expectedVersion != "" && expectedVersion != reviewVersion(key, state.SurveyFollowUps[key]) {
			return fmt.Errorf("%w: данные анкеты или следующий шаг изменились", domain.ErrConflict)
		}
		result = domain.SurveyFollowUp{Status: status, Note: note, UpdatedBy: actorID, UpdatedAt: s.now()}
		state.SurveyFollowUps[key] = result
		journalID := state.NextID("journal")
		state.Journal[journalID] = domain.JournalEntry{ID: journalID, Event: "survey_follow_up", Status: status,
			Message: id + " · " + actorID, Items: 1, CreatedAt: result.UpdatedAt}
		state.Touch()
		return nil
	})
	return result, err
}

func (s *Service) ProcessSurveyAnalysis(ctx context.Context) (bool, error) {
	if s.surveyAnalyzer == nil {
		return false, nil
	}
	version := s.surveyAnalyzer.Version()
	state, err := s.store.Snapshot(ctx)
	if err != nil {
		return false, err
	}
	histories := pulseHistories(state)
	now := s.now()
	for _, id := range domain.SortedKeys(histories) {
		input := histories[id]
		fingerprint := surveyFingerprint(version, input)
		if !surveyJobAvailable(state.SurveyAnalysisJobs[id], fingerprint, now) {
			continue
		}
		lease := now.Add(2 * time.Minute)
		var claimed bool
		err = s.store.Update(ctx, func(current *domain.State) error {
			job := current.SurveyAnalysisJobs[id]
			if surveyFingerprint(version, pulseHistories(current)[id]) != fingerprint ||
				!surveyJobAvailable(job, fingerprint, now) {
				return nil
			}
			if job.Fingerprint != fingerprint {
				job = domain.SurveyAnalysisJob{Fingerprint: fingerprint}
			}
			job.LeaseUntil = lease
			job.Attempts++
			current.SurveyAnalysisJobs[id] = job
			current.Touch()
			claimed = true
			return nil
		})
		if err != nil {
			return false, err
		}
		if !claimed {
			continue
		}
		result, modelErr := s.surveyAnalyzer.Analyze(ctx, input)
		if modelErr == nil {
			result, modelErr = insights.ValidatePulseSummary(result, input)
		}
		saveCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
		err = s.store.Update(saveCtx, func(current *domain.State) error {
			job := current.SurveyAnalysisJobs[id]
			if job.Fingerprint != fingerprint || !job.LeaseUntil.Equal(lease) {
				return nil
			}
			job.LeaseUntil = time.Time{}
			if modelErr != nil {
				job.NextRun = s.now().Add(time.Duration(1<<(job.Attempts-1)) * 15 * time.Second)
			} else {
				job.Result, job.NextRun = result, time.Time{}
			}
			current.SurveyAnalysisJobs[id] = job
			current.Touch()
			return nil
		})
		cancel()
		if err != nil {
			return true, err
		}
		if modelErr != nil {
			return true, fmt.Errorf("survey analysis provider failed")
		}
		return true, nil
	}
	return false, nil
}

func (s *Service) RetrySurveyAnalysis(ctx context.Context, actorID, id string) error {
	if s.surveyAnalyzer == nil {
		return domain.ErrUnavailable
	}
	return s.store.Update(ctx, func(state *domain.State) error {
		if err := s.requireSurveyHR(state, actorID); err != nil {
			return err
		}
		if _, ok := state.Internships[id]; !ok {
			return domain.ErrNotFound
		}
		job := state.SurveyAnalysisJobs[id]
		if job.Result == nil && job.Attempts >= 4 && !job.LeaseUntil.After(s.now()) {
			delete(state.SurveyAnalysisJobs, id)
			state.Touch()
		}
		return nil
	})
}

func surveyJobAvailable(job domain.SurveyAnalysisJob, fingerprint string, now time.Time) bool {
	return job.Fingerprint != fingerprint ||
		(job.Result == nil && job.Attempts < 4 && !job.LeaseUntil.After(now) && !job.NextRun.After(now))
}
