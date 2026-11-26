package usecase

import (
	"context"

	"mgts/backend/internal/modules/core/domain"
)

// Me returns the personal internship view for an intern. Other roles receive
// their actor identity without being given an implicit personal internship.
func (s *Service) Me(ctx context.Context, actorID string) (map[string]any, error) {
	state, err := s.store.Snapshot(ctx)
	if err != nil {
		return nil, err
	}
	actor, err := s.actor(state, actorID)
	if err != nil {
		return nil, err
	}
	if actor.Role != domain.RoleIntern || actor.InternshipID == "" {
		return map[string]any{"actor": actor}, nil
	}
	result, err := s.Internship(ctx, actor.ID, actor.InternshipID)
	if err != nil {
		return nil, err
	}
	result["actor"] = actor
	return result, nil
}
