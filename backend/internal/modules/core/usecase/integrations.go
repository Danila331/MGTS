package usecase

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"time"

	analytics "mgts/backend/internal/modules/analytics/usecase"
	"mgts/backend/internal/modules/core/domain"
)

type ExternalResponseInput struct {
	ExternalID, SurveyID, InternshipID, RespondentID string
	AssignmentID                                     string
	Version                                          int
	Answers                                          map[string]any
	SubmittedAt                                      time.Time
}

func (s *Service) Integrations(ctx context.Context, actorID string) (map[string]any, error) {
	state, err := s.store.Snapshot(ctx)
	if err != nil {
		return nil, err
	}
	actor, err := s.actor(state, actorID)
	if err != nil {
		return nil, err
	}
	if actor.Role != domain.RoleHR {
		return nil, domain.ErrForbidden
	}
	items := []domain.Integration{}
	for _, id := range domain.SortedKeys(state.Integrations) {
		items = append(items, state.Integrations[id])
	}
	journal := []domain.JournalEntry{}
	for _, id := range domain.SortedKeys(state.Journal) {
		journal = append(journal, state.Journal[id])
	}
	sort.Slice(journal, func(i, j int) bool {
		if journal[i].CreatedAt.Equal(journal[j].CreatedAt) {
			return journal[i].ID > journal[j].ID
		}
		return journal[i].CreatedAt.After(journal[j].CreatedAt)
	})
	return map[string]any{"items": items, "journal": journal}, nil
}

func (s *Service) SyncIntegration(ctx context.Context, actorID, id string) (domain.Integration, error) {
	var result domain.Integration
	err := s.store.Update(ctx, func(state *domain.State) error {
		actor, err := s.actor(state, actorID)
		if err != nil {
			return err
		}
		if actor.Role != domain.RoleHR {
			return domain.ErrForbidden
		}
		integration, ok := state.Integrations[id]
		if !ok {
			return domain.ErrNotFound
		}
		now := s.now()
		imported := 0
		if integration.Kind == "surveys" {
			for _, assignmentID := range domain.SortedKeys(state.Assignments) {
				assignment := state.Assignments[assignmentID]
				survey := state.Surveys[assignment.SurveyID]
				if survey.Status != "published" {
					continue
				}
				answers := map[string]any{}
				for _, question := range survey.Questions {
					if question.Type == "scale" {
						answers[question.ID] = 4.0
					} else if question.Type == "text" {
						answers[question.ID] = "Синхронизированный ответ mock-провайдера"
					}
				}
				// Stable provider IDs make repeated mock syncs idempotent instead of
				// manufacturing a new response on every button click.
				externalID := "sync-" + assignment.ID
				_, duplicate, err := s.ingestExternal(state, integration.ID, ExternalResponseInput{ExternalID: externalID, SurveyID: survey.ID, InternshipID: assignment.InternshipID, RespondentID: assignment.RespondentID, Version: 1, Answers: answers})
				if err == nil {
					if !duplicate {
						imported = 1
					}
					break
				}
			}
		} else {
			imported = 3
		}
		integration.Status = "connected"
		integration.LastSyncAt = &now
		integration.ItemsSynced += imported
		state.Integrations[id] = integration
		journalID := state.NextID("journal")
		state.Journal[journalID] = domain.JournalEntry{ID: journalID, IntegrationID: id, Event: "manual_sync", Status: "success", Message: "Mock-синхронизация завершена", Items: imported, CreatedAt: now}
		state.Touch()
		result = integration
		return nil
	})
	return result, err
}

func (s *Service) ImportExternalResponse(ctx context.Context, input ExternalResponseInput) (domain.Response, bool, error) {
	var result domain.Response
	duplicate := false
	err := s.store.Update(ctx, func(state *domain.State) error {
		response, existing, err := s.ingestExternal(state, "integration-surveys", input)
		if err != nil {
			return err
		}
		result, duplicate = response, existing
		return nil
	})
	return result, duplicate, err
}

func (s *Service) ingestExternal(state *domain.State, integrationID string, input ExternalResponseInput) (domain.Response, bool, error) {
	if input.ExternalID == "" || input.SurveyID == "" || input.InternshipID == "" || input.RespondentID == "" {
		return domain.Response{}, false, invalid("external_id, survey_id, internship_id and respondent_id are required")
	}
	if input.Version < 1 {
		input.Version = 1
	}
	key := fmt.Sprintf("%s:%d", input.ExternalID, input.Version)
	if responseID, ok := state.Imports[key]; ok {
		return state.Responses[responseID], true, nil
	}
	survey, ok := state.Surveys[input.SurveyID]
	if !ok || survey.Status != "published" {
		return domain.Response{}, false, domain.ErrNotFound
	}
	internship, ok := state.Internships[input.InternshipID]
	if !ok {
		return domain.Response{}, false, domain.ErrNotFound
	}
	respondent, ok := state.Actors[input.RespondentID]
	if !ok {
		return domain.Response{}, false, domain.ErrNotFound
	}
	if err := validateAnswers(survey, input.Answers, true); err != nil {
		return domain.Response{}, false, err
	}
	var assignment domain.Assignment
	for _, candidate := range state.Assignments {
		if (input.AssignmentID == "" || input.AssignmentID == candidate.ID) && candidate.SurveyID == input.SurveyID && candidate.InternshipID == input.InternshipID && candidate.RespondentID == input.RespondentID {
			assignment = candidate
			break
		}
	}
	if assignment.ID == "" && input.AssignmentID != "" {
		return domain.Response{}, false, domain.ErrNotFound
	}
	if assignment.ID == "" {
		assignment.ID = state.NextID("assignment")
		assignment = domain.Assignment{ID: assignment.ID, SurveyID: input.SurveyID, InternshipID: input.InternshipID, RespondentID: input.RespondentID, DueAt: survey.DueAt}
	}
	latestVersion := 0
	var latestExternal domain.Response
	for _, previous := range state.Responses {
		if previous.ExternalID != input.ExternalID {
			continue
		}
		if previous.Version == input.Version {
			state.Imports[key] = previous.ID
			return previous, true, nil
		}
		if previous.Version > latestVersion {
			latestVersion, latestExternal = previous.Version, previous
		}
	}
	if input.Version < latestVersion {
		// A delayed old webhook must not supersede or reweight a newer correction.
		return latestExternal, true, nil
	}
	now := s.now()
	submittedAt := input.SubmittedAt
	if submittedAt.IsZero() {
		submittedAt = now
	}
	supersedeOtherActiveResponses(state, assignment.ID, "", now)
	discardDrafts(state, assignment.ID)
	responseID := state.NextID("response")
	response := domain.Response{ID: responseID, SurveyID: input.SurveyID, AssignmentID: assignment.ID, InternshipID: input.InternshipID,
		RespondentID: input.RespondentID, Respondent: respondent.Name, Role: respondent.Role, Wave: survey.Wave, Answers: cloneAnswers(input.Answers),
		Status: "submitted", ExternalID: input.ExternalID, Version: input.Version, CreatedAt: submittedAt, UpdatedAt: now}
	state.Responses[responseID] = response
	state.Imports[key] = responseID
	assignment.Status = "submitted"
	assignment.SubmittedAt = &submittedAt
	state.Assignments[assignment.ID] = assignment
	internship.LastActivity = now
	state.Internships[internship.ID] = internship
	analytics.Recalculate(state, response)
	journalID := state.NextID("journal")
	state.Journal[journalID] = domain.JournalEntry{ID: journalID, IntegrationID: integrationID, Event: "webhook_import", Status: "success", Message: "Ответ нормализован", Items: 1, CreatedAt: now}
	state.Touch()
	return response, false, nil
}

func (s *Service) Settings(ctx context.Context, actorID string) (domain.Settings, error) {
	state, err := s.store.Snapshot(ctx)
	if err != nil {
		return domain.Settings{}, err
	}
	if _, err := s.actor(state, actorID); err != nil {
		return domain.Settings{}, err
	}
	return state.Settings, nil
}

type SettingsPatch struct {
	ShowFeedbackToIntern *bool
	SignalThresholds     map[string]float64
	ScaleMin, ScaleMax   *int
}

func (s *Service) UpdateSettings(ctx context.Context, actorID string, patch SettingsPatch) (domain.Settings, error) {
	var result domain.Settings
	err := s.store.Update(ctx, func(state *domain.State) error {
		actor, err := s.actor(state, actorID)
		if err != nil {
			return err
		}
		if actor.Role != domain.RoleHR {
			return domain.ErrForbidden
		}
		settings := state.Settings
		if patch.ShowFeedbackToIntern != nil {
			settings.ShowFeedbackToIntern = *patch.ShowFeedbackToIntern
		}
		for key, value := range patch.SignalThresholds {
			if value < 1 || value > 5 {
				return invalid("signal thresholds must be 1..5")
			}
			if settings.SignalThresholds == nil {
				settings.SignalThresholds = map[string]float64{}
			}
			settings.SignalThresholds[key] = value
		}
		if patch.ScaleMin != nil {
			settings.ScaleMin = *patch.ScaleMin
		}
		if patch.ScaleMax != nil {
			settings.ScaleMax = *patch.ScaleMax
		}
		if settings.ScaleMin >= settings.ScaleMax {
			return invalid("scale_min must be less than scale_max")
		}
		settings.UpdatedAt = s.now()
		settings.UpdatedBy = actor.ID
		state.Settings = settings
		state.Touch()
		result = settings
		return nil
	})
	return result, err
}

func (s *Service) ProcessNotifications(ctx context.Context) (int, error) {
	processed := 0
	err := s.store.Update(ctx, func(state *domain.State) error {
		now := s.now()
		for id, notification := range state.Notifications {
			if notification.Status == "pending" {
				notification.Status = "sent"
				state.Notifications[id] = notification
				processed++
			}
		}
		for _, assignment := range state.Assignments {
			if assignment.DueAt.IsZero() || assignment.DueAt.After(now.Add(48*time.Hour)) || !reminderEligible(state, assignment) {
				continue
			}
			if queueReminder(state, assignment, now) {
				processed++
			}
		}
		if processed == 0 {
			return errNoNotificationChange
		}
		state.Touch()
		return nil
	})
	if errors.Is(err, errNoNotificationChange) {
		return 0, nil
	}
	return processed, err
}
