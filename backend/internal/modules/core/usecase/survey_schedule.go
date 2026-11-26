package usecase

import (
	"context"
	"errors"
	"time"

	"mgts/backend/internal/modules/core/domain"
)

func addControlMonth(start time.Time, months int) time.Time {
	first := time.Date(start.Year(), start.Month(), 1, start.Hour(), start.Minute(), start.Second(), 0, start.Location()).AddDate(0, months, 0)
	days := first.AddDate(0, 1, -1).Day()
	return first.AddDate(0, 0, min(start.Day(), days)-1)
}

func openPulseWave(state *domain.State, internship domain.Internship, wave int, dueAt time.Time) int {
	created := 0
	for _, table := range pulseTables {
		var survey domain.Survey
		for _, id := range domain.SortedKeys(state.Surveys) {
			candidate := state.Surveys[id]
			if candidate.Status == "published" && isPulseSurvey(table, candidate, wave) &&
				(survey.ID == "" || candidate.UpdatedAt.After(survey.UpdatedAt)) {
				survey = candidate
			}
		}
		if survey.ID == "" {
			continue
		}
		respondent := internship.Intern.ID
		if table.role == domain.RoleMentor {
			respondent = internship.MentorID
		}
		alreadyAssigned := false
		for _, candidate := range state.Assignments {
			if candidate.InternshipID == internship.ID && candidate.RespondentID == respondent &&
				isPulseSurvey(table, state.Surveys[candidate.SurveyID], wave) {
				alreadyAssigned = true
				break
			}
		}
		if alreadyAssigned {
			continue
		}
		assignment := domain.Assignment{ID: state.NextID("assignment"), SurveyID: survey.ID, InternshipID: internship.ID,
			RespondentID: respondent, Status: "assigned", DueAt: dueAt}
		state.Assignments[assignment.ID] = assignment
		created++
	}
	return created
}

var errNoDueSurveyWave = errors.New("no control survey wave to open")

func (s *Service) ProcessSurveyWaves(ctx context.Context) (int, error) {
	var created int
	err := s.store.Update(ctx, func(state *domain.State) error {
		now := s.now()
		for _, id := range domain.SortedKeys(state.Internships) {
			internship := state.Internships[id]
			if internship.StartedAt == nil {
				continue
			}
			start := *internship.StartedAt
			for wave := 1; wave <= 6 && !addControlMonth(start, wave-1).After(now); wave++ {
				created += openPulseWave(state, internship, wave, addControlMonth(start, wave))
			}
		}
		if created == 0 {
			return errNoDueSurveyWave
		}
		state.Touch()
		return nil
	})
	if errors.Is(err, errNoDueSurveyWave) {
		return 0, nil
	}
	return created, err
}
