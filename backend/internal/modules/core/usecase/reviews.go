package usecase

import (
	"context"
	"sort"
	"strings"
	"time"

	"mgts/backend/internal/modules/core/domain"
	identity "mgts/backend/internal/modules/identity/usecase"
	insights "mgts/backend/internal/modules/insights/usecase"
)

type ReviewInput struct {
	InternshipID, Kind, Text, ManagerReasoning, RecommendedLevel string
	Score                                                        float64
}
type ReviewPatch struct {
	Text, ManagerReasoning, RecommendedLevel *string
	Score                                    *float64
	Status                                   *string
}

func (s *Service) Reviews(ctx context.Context, actorID string) (map[string]any, error) {
	state, err := s.store.Snapshot(ctx)
	if err != nil {
		return nil, err
	}
	actor, err := s.actor(state, actorID)
	if err != nil {
		return nil, err
	}
	items := []domain.Review{}
	distribution := map[string]int{}
	for _, id := range domain.SortedKeys(state.Reviews) {
		review := state.Reviews[id]
		internship, ok := state.Internships[review.InternshipID]
		if !ok || !identity.CanAccessInternship(actor, internship) {
			continue
		}
		if !canReadReview(actor, review) {
			continue
		}
		review = visibleReview(actor, review)
		items = append(items, review)
		level := review.CalibratedLevel
		if review.FinalLevel != "" {
			level = review.FinalLevel
		}
		if level != "" {
			distribution[level]++
		}
	}
	return map[string]any{"items": items, "distribution": distribution}, nil
}

func (s *Service) Review(ctx context.Context, actorID, id string) (domain.Review, error) {
	state, err := s.store.Snapshot(ctx)
	if err != nil {
		return domain.Review{}, err
	}
	actor, err := s.actor(state, actorID)
	if err != nil {
		return domain.Review{}, err
	}
	review, ok := state.Reviews[id]
	if !ok {
		return domain.Review{}, domain.ErrNotFound
	}
	internship := state.Internships[review.InternshipID]
	if !identity.CanAccessInternship(actor, internship) {
		return domain.Review{}, domain.ErrForbidden
	}
	if !canReadReview(actor, review) {
		return domain.Review{}, domain.ErrForbidden
	}
	return visibleReview(actor, review), nil
}

func (s *Service) CreateReview(ctx context.Context, actorID string, input ReviewInput) (domain.Review, error) {
	var result domain.Review
	err := s.store.Update(ctx, func(state *domain.State) error {
		actor, err := s.actor(state, actorID)
		if err != nil {
			return err
		}
		internship, err := s.internship(state, actor, input.InternshipID)
		if err != nil {
			return err
		}
		if input.Kind == "" {
			input.Kind = "self_feedback"
		}
		if !contains([]string{"self_feedback", "manager_reasoning", "final_feedback"}, input.Kind) {
			return invalid("invalid review kind")
		}
		if input.Kind == "self_feedback" && (actor.Role != domain.RoleIntern || internship.Intern.ID != actor.ID) {
			return domain.ErrForbidden
		}
		if input.Kind != "self_feedback" && actor.Role != domain.RoleHR && actor.Role != domain.RoleManager {
			return domain.ErrForbidden
		}
		if strings.TrimSpace(input.Text) == "" && input.Kind != "manager_reasoning" {
			return invalid("text is required")
		}
		now := s.now()
		id := state.NextID("review")
		result = domain.Review{ID: id, InternshipID: input.InternshipID, Kind: input.Kind, AuthorID: actor.ID, Text: input.Text,
			ManagerReasoning: input.ManagerReasoning, Score: input.Score, RecommendedLevel: input.RecommendedLevel, Status: "draft", CreatedAt: now, UpdatedAt: now}
		state.Reviews[id] = result
		state.Touch()
		return nil
	})
	return result, err
}

func (s *Service) UpdateReview(ctx context.Context, actorID, id string, patch ReviewPatch) (domain.Review, error) {
	var result domain.Review
	err := s.store.Update(ctx, func(state *domain.State) error {
		actor, err := s.actor(state, actorID)
		if err != nil {
			return err
		}
		review, ok := state.Reviews[id]
		if !ok {
			return domain.ErrNotFound
		}
		internship := state.Internships[review.InternshipID]
		if review.Status == "announced" {
			return domain.ErrConflict
		}
		if actor.Role != domain.RoleHR && review.AuthorID != actor.ID {
			return domain.ErrForbidden
		}
		if !identity.CanAccessInternship(actor, internship) {
			return domain.ErrForbidden
		}
		setString(&review.Text, patch.Text)
		setString(&review.ManagerReasoning, patch.ManagerReasoning)
		setString(&review.RecommendedLevel, patch.RecommendedLevel)
		if patch.Score != nil {
			if *patch.Score < 0 || *patch.Score > 5 {
				return invalid("score must be 0..5")
			}
			review.Score = *patch.Score
		}
		if patch.Status != nil {
			if !contains([]string{"draft", "submitted", "calibrated"}, *patch.Status) {
				return invalid("invalid status transition")
			}
			review.Status = *patch.Status
		}
		review.UpdatedAt = s.now()
		state.Reviews[id] = review
		state.Touch()
		result = review
		return nil
	})
	return result, err
}

func (s *Service) AnalyzeReview(ctx context.Context, actorID, id string) (domain.Review, error) {
	var result domain.Review
	err := s.store.Update(ctx, func(state *domain.State) error {
		actor, err := s.actor(state, actorID)
		if err != nil {
			return err
		}
		review, ok := state.Reviews[id]
		if !ok {
			return domain.ErrNotFound
		}
		internship := state.Internships[review.InternshipID]
		if !identity.CanAccessInternship(actor, internship) || (actor.Role != domain.RoleHR && review.AuthorID != actor.ID) {
			return domain.ErrForbidden
		}
		text := review.Text
		if review.Kind == "manager_reasoning" && review.ManagerReasoning != "" {
			text = review.ManagerReasoning
		}
		review.Analysis = insights.Analyze(review.Kind, text)
		review.UpdatedAt = s.now()
		state.Reviews[id] = review
		logID := state.NextID("ai-log")
		state.AILogs[logID] = domain.AILog{ID: logID, ActorID: actor.ID, Kind: review.Kind, Model: insights.Model, Prompt: insights.PromptVersion, ContextID: id, CreatedAt: review.UpdatedAt}
		state.Touch()
		result = review
		return nil
	})
	return result, err
}

func (s *Service) CalibrateReview(ctx context.Context, actorID, id, level string, score *float64) (domain.Review, error) {
	var result domain.Review
	err := s.store.Update(ctx, func(state *domain.State) error {
		actor, err := s.actor(state, actorID)
		if err != nil {
			return err
		}
		if actor.Role != domain.RoleHR && actor.Role != domain.RoleManager {
			return domain.ErrForbidden
		}
		review, ok := state.Reviews[id]
		if !ok {
			return domain.ErrNotFound
		}
		internship := state.Internships[review.InternshipID]
		if !identity.CanAccessInternship(actor, internship) {
			return domain.ErrForbidden
		}
		if level == "" {
			level = review.RecommendedLevel
		}
		if level == "" {
			return invalid("level is required")
		}
		if score != nil {
			if *score < 0 || *score > 5 {
				return invalid("score must be 0..5")
			}
			review.Score = *score
		}
		review.CalibratedLevel = level
		review.Status = "calibrated"
		review.UpdatedAt = s.now()
		state.Reviews[id] = review
		state.Touch()
		result = review
		return nil
	})
	return result, err
}

func (s *Service) AnnounceReview(ctx context.Context, actorID, id string) (domain.Review, error) {
	var result domain.Review
	err := s.store.Update(ctx, func(state *domain.State) error {
		actor, err := s.actor(state, actorID)
		if err != nil {
			return err
		}
		if actor.Role != domain.RoleHR && actor.Role != domain.RoleManager {
			return domain.ErrForbidden
		}
		review, ok := state.Reviews[id]
		if !ok {
			return domain.ErrNotFound
		}
		internship := state.Internships[review.InternshipID]
		if !identity.CanAccessInternship(actor, internship) {
			return domain.ErrForbidden
		}
		if review.CalibratedLevel == "" {
			return invalid("review must be calibrated before announcement")
		}
		now := s.now()
		review.FinalLevel = review.CalibratedLevel
		review.Status = "announced"
		review.AnnouncedAt = &now
		review.UpdatedAt = now
		state.Reviews[id] = review
		notificationID := state.NextID("notification")
		state.Notifications[notificationID] = domain.Notification{ID: notificationID, ActorID: internship.Intern.ID, Kind: "review_announced", Message: "Итог review опубликован", Status: "pending", CreatedAt: now}
		state.Touch()
		result = review
		return nil
	})
	return result, err
}

func canReadReview(actor domain.Actor, review domain.Review) bool {
	if actor.Role == domain.RoleHR || actor.Role == domain.RoleManager {
		return true
	}
	// Mentors and interns see only announced outcomes, never private working drafts.
	return review.Status == "announced"
}

func visibleReview(actor domain.Actor, review domain.Review) domain.Review {
	if actor.Role == domain.RoleHR || actor.Role == domain.RoleManager {
		return review
	}
	review.ManagerReasoning = ""
	review.Analysis = nil
	if actor.Role == domain.RoleIntern {
		review.Text = ""
	}
	return review
}

func (s *Service) Diagnostics(ctx context.Context, actorID string) (map[string]any, error) {
	state, err := s.store.Snapshot(ctx)
	if err != nil {
		return nil, err
	}
	actor, err := s.actor(state, actorID)
	if err != nil {
		return nil, err
	}
	items := []domain.Diagnostic{}
	for _, id := range domain.SortedKeys(state.Diagnostics) {
		item := state.Diagnostics[id]
		internship := state.Internships[item.InternshipID]
		if identity.CanAccessInternship(actor, internship) {
			items = append(items, item)
		}
	}
	return map[string]any{"items": items, "total": len(items)}, nil
}

func (s *Service) CreateDiagnostic(ctx context.Context, actorID, internshipID string, kind int) (domain.Diagnostic, error) {
	var result domain.Diagnostic
	err := s.store.Update(ctx, func(state *domain.State) error {
		actor, err := s.actor(state, actorID)
		if err != nil {
			return err
		}
		if actor.Role != domain.RoleHR && actor.Role != domain.RoleManager && actor.Role != domain.RoleMentor {
			return domain.ErrForbidden
		}
		if _, err := s.internship(state, actor, internshipID); err != nil {
			return err
		}
		required, ok := diagnosticRoles(kind)
		if !ok {
			return invalid("kind must be 180, 270 or 360")
		}
		now := s.now()
		id := state.NextID("diagnostic")
		result = domain.Diagnostic{ID: id, InternshipID: internshipID, Kind: kind, Status: "collecting", Required: required, Completed: map[domain.Role]int{}, CreatedAt: now}
		state.Diagnostics[id] = result
		state.Touch()
		return nil
	})
	return result, err
}

func (s *Service) CompleteDiagnostic(ctx context.Context, actorID, id string, completed map[domain.Role]int, results domain.Map) (domain.Diagnostic, error) {
	var result domain.Diagnostic
	err := s.store.Update(ctx, func(state *domain.State) error {
		actor, err := s.actor(state, actorID)
		if err != nil {
			return err
		}
		item, ok := state.Diagnostics[id]
		if !ok {
			return domain.ErrNotFound
		}
		internship := state.Internships[item.InternshipID]
		if !identity.CanManage(actor, internship) {
			return domain.ErrForbidden
		}
		if completed == nil {
			completed = map[domain.Role]int{}
			for role, count := range item.Required {
				completed[role] = count
			}
		}
		item.Completed = completed
		item.Quorum = true
		for role, required := range item.Required {
			if completed[role] < required {
				item.Quorum = false
			}
		}
		item.Results = results
		if item.Quorum {
			now := s.now()
			item.Status = "completed"
			item.CompletedAt = &now
		} else {
			item.Status = "awaiting_quorum"
			item.CompletedAt = nil
		}
		state.Diagnostics[id] = item
		state.Touch()
		result = item
		return nil
	})
	return result, err
}

func diagnosticRoles(kind int) (map[domain.Role]int, bool) {
	switch kind {
	case 180:
		return map[domain.Role]int{domain.RoleIntern: 1, domain.RoleManager: 1}, true
	case 270:
		return map[domain.Role]int{domain.RoleIntern: 1, domain.RoleManager: 1, domain.RoleMentor: 1}, true
	case 360:
		return map[domain.Role]int{domain.RoleIntern: 1, domain.RoleManager: 1, domain.RoleMentor: 1, domain.RoleHR: 1}, true
	default:
		return nil, false
	}
}

func (s *Service) Development(ctx context.Context, actorID string) (map[string]any, error) {
	state, err := s.store.Snapshot(ctx)
	if err != nil {
		return nil, err
	}
	actor, err := s.actor(state, actorID)
	if err != nil {
		return nil, err
	}
	items := []domain.Goal{}
	for _, id := range domain.SortedKeys(state.Goals) {
		goal := state.Goals[id]
		internship := state.Internships[goal.InternshipID]
		if identity.CanAccessInternship(actor, internship) {
			items = append(items, goal)
		}
	}
	sort.Slice(items, func(i, j int) bool { return items[i].DueAt.Before(items[j].DueAt) })
	return map[string]any{"items": items, "goals": items, "recommendations": []string{"Запланировать повторную диагностику", "Связать цель с измеримым результатом", "Обсудить прогресс с наставником"}}, nil
}

type GoalInput struct {
	InternshipID, Title, Description, OwnerID string
	DueAt                                     time.Time
}
type GoalPatch struct {
	Title, Description, Status, Result *string
	Progress                           *int
	DueAt                              *time.Time
}

func (s *Service) CreateGoal(ctx context.Context, actorID string, input GoalInput) (domain.Goal, error) {
	var result domain.Goal
	err := s.store.Update(ctx, func(state *domain.State) error {
		actor, err := s.actor(state, actorID)
		if err != nil {
			return err
		}
		internship, err := s.internship(state, actor, input.InternshipID)
		if err != nil {
			return err
		}
		if input.Title == "" {
			return invalid("title is required")
		}
		if input.OwnerID == "" {
			input.OwnerID = internship.Intern.ID
		}
		if actor.Role == domain.RoleIntern && input.OwnerID != actor.ID {
			return domain.ErrForbidden
		}
		if _, ok := state.Actors[input.OwnerID]; !ok {
			return domain.ErrNotFound
		}
		if input.DueAt.IsZero() {
			input.DueAt = s.now().Add(30 * 24 * time.Hour)
		}
		now := s.now()
		id := state.NextID("goal")
		result = domain.Goal{ID: id, InternshipID: input.InternshipID, Title: input.Title, Description: input.Description, OwnerID: input.OwnerID, DueAt: input.DueAt, Status: "active", CreatedAt: now, UpdatedAt: now}
		state.Goals[id] = result
		state.Touch()
		return nil
	})
	return result, err
}

func (s *Service) UpdateGoal(ctx context.Context, actorID, id string, patch GoalPatch) (domain.Goal, error) {
	var result domain.Goal
	err := s.store.Update(ctx, func(state *domain.State) error {
		actor, err := s.actor(state, actorID)
		if err != nil {
			return err
		}
		goal, ok := state.Goals[id]
		if !ok {
			return domain.ErrNotFound
		}
		internship := state.Internships[goal.InternshipID]
		if !identity.CanAccessInternship(actor, internship) {
			return domain.ErrForbidden
		}
		if actor.Role == domain.RoleIntern && goal.OwnerID != actor.ID {
			return domain.ErrForbidden
		}
		setString(&goal.Title, patch.Title)
		setString(&goal.Description, patch.Description)
		setString(&goal.Result, patch.Result)
		if patch.Status != nil {
			if !contains([]string{"active", "completed", "cancelled"}, *patch.Status) {
				return invalid("invalid goal status")
			}
			goal.Status = *patch.Status
		}
		if patch.Progress != nil {
			if *patch.Progress < 0 || *patch.Progress > 100 {
				return invalid("progress must be 0..100")
			}
			goal.Progress = *patch.Progress
			if *patch.Progress == 100 {
				goal.Status = "completed"
			}
		}
		if patch.DueAt != nil {
			goal.DueAt = *patch.DueAt
		}
		goal.UpdatedAt = s.now()
		state.Goals[id] = goal
		state.Touch()
		result = goal
		return nil
	})
	return result, err
}
