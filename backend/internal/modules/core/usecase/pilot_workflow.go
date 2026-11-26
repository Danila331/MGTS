package usecase

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"
	"unicode/utf8"

	analytics "mgts/backend/internal/modules/analytics/usecase"
	"mgts/backend/internal/modules/core/domain"
)

const maxPilotText = 2000

type FinalRecap struct {
	Available bool                    `json:"available"`
	Recap     *domain.InternshipRecap `json:"recap,omitempty"`
}

func (s *Service) FinalRecap(ctx context.Context, actorID, internshipID string) (FinalRecap, error) {
	state, err := s.store.Snapshot(ctx)
	if err != nil {
		return FinalRecap{}, err
	}
	if err := s.requireSurveyHR(state, actorID); err != nil {
		return FinalRecap{}, err
	}
	internship, ok := state.Internships[internshipID]
	if !ok {
		return FinalRecap{}, domain.ErrNotFound
	}
	if saved, ok := state.InternshipRecaps[internshipID]; ok {
		return FinalRecap{Available: true, Recap: &saved}, nil
	}
	history := pulseHistories(state)[internshipID]
	if !finalRecapAvailable(state, internship, history, s.now()) {
		return FinalRecap{}, nil
	}
	recap := finalRecapDraft(state, internship.ID, history)
	return FinalRecap{Available: true, Recap: &recap}, nil
}

func (s *Service) SaveFinalRecap(ctx context.Context, actorID, internshipID string, draft domain.InternshipRecap) (FinalRecap, error) {
	fields := []*string{&draft.Progress, &draft.OpenQuestions, &draft.NextSteps}
	for _, field := range fields {
		*field = strings.TrimSpace(*field)
		if *field == "" || utf8.RuneCountInString(*field) > maxPilotText {
			return FinalRecap{}, invalid("заполните все три раздела итога, до 2000 символов каждый")
		}
	}
	err := s.store.Update(ctx, func(state *domain.State) error {
		if err := s.requireSurveyHR(state, actorID); err != nil {
			return err
		}
		internship, ok := state.Internships[internshipID]
		if !ok {
			return domain.ErrNotFound
		}
		current, saved := state.InternshipRecaps[internshipID]
		now := s.now()
		if !saved && !finalRecapAvailable(state, internship, pulseHistories(state)[internshipID], now) {
			return domain.ErrConflict
		}
		if draft.Version != current.Version {
			return fmt.Errorf("%w: итог уже изменился, обновите страницу", domain.ErrConflict)
		}
		draft.Version++
		draft.SavedAt = &now
		state.InternshipRecaps[internshipID] = draft
		state.Touch()
		return nil
	})
	if err != nil {
		return FinalRecap{}, err
	}
	return FinalRecap{Available: true, Recap: &draft}, nil
}

func finalRecapAvailable(state *domain.State, internship domain.Internship, history analytics.PulseHistory, now time.Time) bool {
	complete := map[domain.Role]bool{}
	for _, answer := range history.Answers {
		if answer.Wave == 6 {
			complete[answer.Role] = true
		}
	}
	if complete[domain.RoleIntern] && complete[domain.RoleMentor] {
		return true
	}
	if internship.StartedAt != nil {
		return !addControlMonth(*internship.StartedAt, 6).After(now)
	}
	// Imported internships may have assignments and deadlines without a recorded start date.
	expired := map[domain.Role]bool{}
	open := map[domain.Role]bool{}
	for _, assignment := range state.Assignments {
		if assignment.InternshipID != internship.ID || (assignment.Status != "assigned" && assignment.Status != "draft" && assignment.Status != "submitted") {
			continue
		}
		survey := state.Surveys[assignment.SurveyID]
		for _, table := range pulseTables {
			if !isPulseSurvey(table, survey, 6) {
				continue
			}
			if survey.Status == "closed" || (!assignment.DueAt.IsZero() && !assignment.DueAt.After(now)) {
				expired[table.role] = true
			} else {
				open[table.role] = true
			}
		}
	}
	return (complete[domain.RoleIntern] || expired[domain.RoleIntern] && !open[domain.RoleIntern]) &&
		(complete[domain.RoleMentor] || expired[domain.RoleMentor] && !open[domain.RoleMentor])
}

func finalRecapDraft(state *domain.State, internshipID string, history analytics.PulseHistory) domain.InternshipRecap {
	progress := []string{fmt.Sprintf("Получено ответов за шесть месяцев: %d из 12.", len(history.Answers))}
	for _, role := range []struct {
		id    domain.Role
		label string
	}{{domain.RoleIntern, "Стажёр"}, {domain.RoleMentor, "Наставник"}} {
		var first, last analytics.PulseAnswer
		for _, answer := range history.Answers {
			if answer.Role == role.id && len(answer.Scores) > 0 {
				if first.ID == "" {
					first = answer
				}
				last = answer
			}
		}
		var before, after []float64
		for _, dimension := range domain.SortedKeys(first.Scores) {
			if score, ok := last.Scores[dimension]; ok {
				before = append(before, first.Scores[dimension])
				after = append(after, score)
			}
		}
		if first.Wave != last.Wave && len(before) > 0 {
			progress = append(progress, fmt.Sprintf("%s, среднее по общим показателям: %.2f в месяце %d → %.2f в месяце %d.",
				role.label, avg(before), first.Wave, avg(after), last.Wave))
		} else {
			progress = append(progress, role.label+": недостаточно сопоставимых ответов для динамики.")
		}
	}
	open := []string{}
	if len(history.Answers) < 12 {
		open = append(open, "Уточнить пропущенные контрольные ответы.")
	}
	for _, finding := range history.Findings {
		open = append(open, fmt.Sprintf("Месяц %d: %s.", finding.Wave, finding.Title))
	}
	if len(open) == 0 {
		open = append(open, "Проверить на финальной встрече, остались ли вопросы.")
	}
	next := "На финальной встрече обсудить динамику и договориться о следующих шагах."
	if step, ok := state.SurveyFollowUps[surveyFollowUpKey(internshipID, history)]; ok && step.Status == "in_progress" {
		next = "Открытый шаг HR: " + step.Note
	}
	return domain.InternshipRecap{Progress: strings.Join(progress, "\n"), OpenQuestions: strings.Join(open, "\n"), NextSteps: next}
}

func (s *Service) ContactHR(ctx context.Context, actorID, surveyID, internshipID, message string) error {
	message = strings.TrimSpace(message)
	if internshipID == "" || surveyID == "" || message == "" || utf8.RuneCountInString(message) > maxPilotText {
		return invalid("выберите анкету и напишите обращение до 2000 символов")
	}
	return s.store.Update(ctx, func(state *domain.State) error {
		actor, err := s.actor(state, actorID)
		if err != nil {
			return err
		}
		survey, assignment, err := s.takeAssignment(state, actor, surveyID, internshipID)
		if err != nil {
			return err
		}
		if survey.Audience != actor.Role || (actor.Role != domain.RoleIntern && actor.Role != domain.RoleMentor) {
			return domain.ErrForbidden
		}
		id := state.NextID("hr-contact")
		state.HRContacts[id] = domain.HRContact{ID: id, InternshipID: assignment.InternshipID,
			SenderID: actor.ID, SenderName: actor.Name, SenderRole: actor.Role, Message: message, CreatedAt: s.now()}
		state.Touch()
		return nil
	})
}

func (s *Service) HRContacts(ctx context.Context, actorID string) ([]domain.HRContact, error) {
	state, err := s.store.Snapshot(ctx)
	if err != nil {
		return nil, err
	}
	if err := s.requireSurveyHR(state, actorID); err != nil {
		return nil, err
	}
	items := make([]domain.HRContact, 0, len(state.HRContacts))
	for _, item := range state.HRContacts {
		items = append(items, item)
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].CreatedAt.Equal(items[j].CreatedAt) {
			return items[i].ID > items[j].ID
		}
		return items[i].CreatedAt.After(items[j].CreatedAt)
	})
	return items, nil
}
