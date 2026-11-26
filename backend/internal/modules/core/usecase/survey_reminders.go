package usecase

import (
	"context"
	"errors"
	"sort"
	"strings"
	"time"

	"mgts/backend/internal/modules/core/domain"
)

type SurveyReminder struct {
	SurveyID     string    `json:"survey_id"`
	InternshipID string    `json:"internship_id"`
	SurveyTitle  string    `json:"survey_title"`
	InternName   string    `json:"intern_name"`
	DueAt        time.Time `json:"due_at"`
}

const reminderPrefix = "reminder:"

func reminderEligible(state *domain.State, assignment domain.Assignment) bool {
	survey := state.Surveys[assignment.SurveyID]
	role := state.Actors[assignment.RespondentID].Role
	if (assignment.Status != "assigned" && assignment.Status != "draft") ||
		survey.Status != "published" || (role != domain.RoleIntern && role != domain.RoleMentor) || survey.Audience != role {
		return false
	}
	_, _, submitted := activeResponse(state, assignment.ID)
	return !submitted
}

func queueReminder(state *domain.State, assignment domain.Assignment, now time.Time) bool {
	kind := reminderPrefix + assignment.ID
	for _, notification := range state.Notifications {
		if notification.ActorID == assignment.RespondentID && notification.Kind == kind {
			return false
		}
	}
	id := state.NextID("notification")
	state.Notifications[id] = domain.Notification{ID: id, ActorID: assignment.RespondentID, Kind: kind,
		Message: state.Surveys[assignment.SurveyID].Title, Status: "sent", CreatedAt: now}
	return true
}

func (s *Service) SurveyReminders(ctx context.Context, actorID string) ([]SurveyReminder, error) {
	state, err := s.store.Snapshot(ctx)
	if err != nil {
		return nil, err
	}
	actor, err := s.actor(state, actorID)
	if err != nil {
		return nil, err
	}
	items := []SurveyReminder{}
	seen := map[string]bool{}
	for _, notification := range state.Notifications {
		if notification.ActorID != actor.ID || !strings.HasPrefix(notification.Kind, reminderPrefix) {
			continue
		}
		assignment, ok := state.Assignments[strings.TrimPrefix(notification.Kind, reminderPrefix)]
		if !ok || seen[assignment.ID] || assignment.RespondentID != actor.ID || !reminderEligible(state, assignment) {
			continue
		}
		seen[assignment.ID] = true
		items = append(items, SurveyReminder{SurveyID: assignment.SurveyID, InternshipID: assignment.InternshipID,
			SurveyTitle: state.Surveys[assignment.SurveyID].Title, InternName: state.Internships[assignment.InternshipID].Intern.Name,
			DueAt: assignment.DueAt})
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].DueAt.Equal(items[j].DueAt) {
			if items[i].SurveyID == items[j].SurveyID {
				return items[i].InternshipID < items[j].InternshipID
			}
			return items[i].SurveyID < items[j].SurveyID
		}
		return items[i].DueAt.Before(items[j].DueAt)
	})
	return items, nil
}

var errNoNotificationChange = errors.New("notifications unchanged")

func (s *Service) RemindSurvey(ctx context.Context, actorID, internshipID string, wave int) (int, error) {
	if wave < 1 || wave > 6 {
		return 0, invalid("контрольный период от 1 до 6")
	}
	sent := 0
	err := s.store.Update(ctx, func(state *domain.State) error {
		if err := s.requireSurveyHR(state, actorID); err != nil {
			return err
		}
		if _, ok := state.Internships[internshipID]; !ok {
			return domain.ErrNotFound
		}
		for _, id := range domain.SortedKeys(state.Assignments) {
			item := state.Assignments[id]
			if item.InternshipID == internshipID && state.Surveys[item.SurveyID].Wave == wave && reminderEligible(state, item) &&
				queueReminder(state, item, s.now()) {
				sent++
			}
		}
		if sent == 0 {
			return errNoNotificationChange
		}
		state.Touch()
		return nil
	})
	if errors.Is(err, errNoNotificationChange) {
		return 0, nil
	}
	return sent, err
}
