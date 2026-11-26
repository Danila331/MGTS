package usecase

import (
	"context"
	"strings"

	"mgts/backend/internal/modules/core/domain"
	identity "mgts/backend/internal/modules/identity/usecase"
	insights "mgts/backend/internal/modules/insights/usecase"
)

func (s *Service) AIQuery(ctx context.Context, actorID, question, internshipID string) (map[string]any, error) {
	var result map[string]any
	err := s.store.Update(ctx, func(state *domain.State) error {
		actor, err := s.actor(state, actorID)
		if err != nil {
			return err
		}
		if strings.TrimSpace(question) == "" {
			return invalid("question is required")
		}
		internships := identity.ScopedInternships(state, actor)
		allowed := map[string]bool{}
		for _, internship := range internships {
			allowed[internship.ID] = true
		}
		if internshipID != "" {
			if !allowed[internshipID] {
				return domain.ErrForbidden
			}
			allowed = map[string]bool{internshipID: true}
		}
		metrics := map[string]float64{}
		values := map[string][]float64{}
		evidence := []domain.Evidence{}
		for _, point := range state.Metrics {
			if allowed[point.InternshipID] {
				values[point.Dimension] = append(values[point.Dimension], point.Value)
			}
		}
		for dimension, nums := range values {
			metrics[dimension] = avg(nums)
		}
		for _, id := range domain.SortedKeys(state.Responses) {
			response := state.Responses[id]
			if !allowed[response.InternshipID] || response.Status != "submitted" {
				continue
			}
			if actor.Role == domain.RoleIntern && response.RespondentID != actor.ID {
				continue
			}
			quote := ""
			for _, value := range response.Answers {
				if text, ok := value.(string); ok {
					quote = text
					break
				}
			}
			evidence = append(evidence, domain.Evidence{ID: response.ID, Type: "response", SourceID: response.ID, Quote: quote, InternshipID: response.InternshipID})
			if len(evidence) == 5 {
				break
			}
		}
		result = insights.Query(question, metrics, evidence)
		now := s.now()
		logID := state.NextID("ai-log")
		state.AILogs[logID] = domain.AILog{ID: logID, ActorID: actor.ID, Kind: "query", Model: insights.Model, Prompt: insights.PromptVersion, ContextID: internshipID, CreatedAt: now}
		state.Touch()
		return nil
	})
	return result, err
}

func (s *Service) AIAnalyze(ctx context.Context, actorID, kind, text, contextID string) (map[string]any, error) {
	var result map[string]any
	err := s.store.Update(ctx, func(state *domain.State) error {
		actor, err := s.actor(state, actorID)
		if err != nil {
			return err
		}
		if !contains([]string{"self_feedback", "manager_reasoning", "final_feedback"}, kind) {
			return invalid("invalid analysis kind")
		}
		if kind == "manager_reasoning" && actor.Role != domain.RoleHR && actor.Role != domain.RoleManager {
			return domain.ErrForbidden
		}
		if kind == "final_feedback" && actor.Role == domain.RoleIntern {
			return domain.ErrForbidden
		}
		if strings.TrimSpace(text) == "" {
			return invalid("text is required")
		}
		if contextID != "" {
			if review, ok := state.Reviews[contextID]; ok {
				internship := state.Internships[review.InternshipID]
				if !identity.CanAccessInternship(actor, internship) {
					return domain.ErrForbidden
				}
			} else if _, ok := state.Internships[contextID]; ok {
				if _, err := s.internship(state, actor, contextID); err != nil {
					return err
				}
			} else {
				return domain.ErrNotFound
			}
		}
		result = insights.Analyze(kind, text)
		now := s.now()
		id := state.NextID("ai-log")
		state.AILogs[id] = domain.AILog{ID: id, ActorID: actor.ID, Kind: kind, Model: insights.Model, Prompt: insights.PromptVersion, ContextID: contextID, CreatedAt: now}
		state.Touch()
		return nil
	})
	return result, err
}

func (s *Service) AIEdit(ctx context.Context, actorID, text, instruction string) (map[string]any, error) {
	var result map[string]any
	err := s.store.Update(ctx, func(state *domain.State) error {
		actor, err := s.actor(state, actorID)
		if err != nil {
			return err
		}
		if strings.TrimSpace(instruction) == "" {
			return invalid("instruction is required")
		}
		result = map[string]any{"text": insights.Edit(text, instruction), "model": insights.Model}
		id := state.NextID("ai-log")
		state.AILogs[id] = domain.AILog{ID: id, ActorID: actor.ID, Kind: "edit", Model: insights.Model, Prompt: insights.PromptVersion, CreatedAt: s.now()}
		state.Touch()
		return nil
	})
	return result, err
}
