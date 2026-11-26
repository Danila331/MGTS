package usecase

import (
	"context"

	"mgts/backend/internal/modules/core/domain"
)

func (s *Service) DeleteSurvey(ctx context.Context, actorID, id string) (domain.Survey, error) {
	var result domain.Survey
	err := s.store.Update(ctx, func(state *domain.State) error {
		actor, err := s.actor(state, actorID)
		if err != nil {
			return err
		}
		if actor.Role != domain.RoleHR {
			return domain.ErrForbidden
		}
		survey, ok := state.Surveys[id]
		if !ok {
			return domain.ErrNotFound
		}
		if survey.Status != "draft" {
			return domain.ErrConflict
		}
		for assignmentID, assignment := range state.Assignments {
			if assignment.SurveyID == id {
				delete(state.Assignments, assignmentID)
			}
		}
		for responseID, response := range state.Responses {
			if response.SurveyID == id {
				delete(state.Responses, responseID)
			}
		}
		delete(state.Surveys, id)
		state.Touch()
		result = survey
		return nil
	})
	return result, err
}
