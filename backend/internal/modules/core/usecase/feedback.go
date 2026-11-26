package usecase

import (
	"context"
	"sort"
	"strings"

	"mgts/backend/internal/modules/core/domain"
	identity "mgts/backend/internal/modules/identity/usecase"
	insights "mgts/backend/internal/modules/insights/usecase"
)

type FeedbackInput struct {
	InternshipID, RecipientID, Relation, Frequency, Sentiment string
	Strengths, Growth, Text, Status                           string
}

type FeedbackPatch struct {
	Relation, Frequency, Sentiment, Strengths, Growth, Text *string
}

func (s *Service) FeedbackList(ctx context.Context, actorID, box string) (map[string]any, error) {
	state, err := s.store.Snapshot(ctx)
	if err != nil {
		return nil, err
	}
	actor, err := s.actor(state, actorID)
	if err != nil {
		return nil, err
	}
	items := []domain.Feedback{}
	for _, id := range domain.SortedKeys(state.Feedback) {
		item := state.Feedback[id]
		internship, ok := state.Internships[item.InternshipID]
		if !ok {
			continue
		}
		if !identity.CanSeeFeedback(actor, item, internship, state.Settings.ShowFeedbackToIntern) {
			continue
		}
		if box == "inbox" && item.RecipientID != actor.ID && actor.Role != domain.RoleHR {
			continue
		}
		if box == "outbox" && item.AuthorID != actor.ID && actor.Role != domain.RoleHR {
			continue
		}
		items = append(items, item)
	}
	sort.Slice(items, func(i, j int) bool { return items[i].UpdatedAt.After(items[j].UpdatedAt) })
	requests := []domain.FeedbackRequest{}
	for _, id := range domain.SortedKeys(state.FeedbackRequests) {
		request := state.FeedbackRequests[id]
		internship, ok := state.Internships[request.InternshipID]
		if !ok || !identity.CanAccessInternship(actor, internship) {
			continue
		}
		if actor.Role != domain.RoleHR && request.RecipientID != actor.ID && request.RequesterID != actor.ID {
			continue
		}
		requests = append(requests, request)
	}
	recommendations := []domain.Actor{}
	seen := map[string]bool{}
	for _, internship := range identity.ScopedInternships(state, actor) {
		for _, id := range []string{internship.ManagerID, internship.MentorID, internship.Intern.ID} {
			if id != actor.ID && !seen[id] {
				if candidate, ok := state.Actors[id]; ok {
					recommendations = append(recommendations, candidate)
					seen[id] = true
				}
			}
		}
	}
	return map[string]any{"items": items, "requests": requests, "recommendations": recommendations}, nil
}

func (s *Service) CreateFeedback(ctx context.Context, actorID string, input FeedbackInput) (domain.Feedback, error) {
	var result domain.Feedback
	err := s.store.Update(ctx, func(state *domain.State) error {
		actor, err := s.actor(state, actorID)
		if err != nil {
			return err
		}
		internship, err := s.internship(state, actor, input.InternshipID)
		if err != nil {
			return err
		}
		if input.RecipientID == "" {
			input.RecipientID = internship.Intern.ID
		}
		recipient, ok := state.Actors[input.RecipientID]
		if !ok {
			return domain.ErrNotFound
		}
		if input.Status == "" {
			input.Status = "draft"
		}
		if input.Status != "draft" && input.Status != "published" {
			return invalid("status must be draft or published")
		}
		if input.Status == "published" && strings.TrimSpace(input.Text) == "" {
			return invalid("text is required for publication")
		}
		now := s.now()
		id := state.NextID("feedback")
		result = domain.Feedback{ID: id, InternshipID: internship.ID, AuthorID: actor.ID, Author: actor.Name,
			RecipientID: recipient.ID, Recipient: recipient.Name, Relation: defaultString(input.Relation, string(actor.Role)),
			Frequency: defaultString(input.Frequency, "weekly"), Sentiment: defaultString(input.Sentiment, "neutral"),
			Strengths: input.Strengths, Growth: input.Growth, Text: input.Text, Status: input.Status, CreatedAt: now, UpdatedAt: now}
		if result.Status == "published" {
			result.PublishedAt = &now
		}
		state.Feedback[id] = result
		state.Touch()
		return nil
	})
	return result, err
}

func (s *Service) UpdateFeedback(ctx context.Context, actorID, id string, patch FeedbackPatch) (domain.Feedback, error) {
	var result domain.Feedback
	err := s.store.Update(ctx, func(state *domain.State) error {
		actor, err := s.actor(state, actorID)
		if err != nil {
			return err
		}
		item, ok := state.Feedback[id]
		if !ok {
			return domain.ErrNotFound
		}
		if actor.Role != domain.RoleHR && item.AuthorID != actor.ID {
			return domain.ErrForbidden
		}
		if item.Status == "published" && actor.Role != domain.RoleHR {
			return domain.ErrConflict
		}
		setString(&item.Relation, patch.Relation)
		setString(&item.Frequency, patch.Frequency)
		setString(&item.Sentiment, patch.Sentiment)
		setString(&item.Strengths, patch.Strengths)
		setString(&item.Growth, patch.Growth)
		setString(&item.Text, patch.Text)
		item.UpdatedAt = s.now()
		state.Feedback[id] = item
		state.Touch()
		result = item
		return nil
	})
	return result, err
}

func (s *Service) PublishFeedback(ctx context.Context, actorID, id string) (domain.Feedback, error) {
	var result domain.Feedback
	err := s.store.Update(ctx, func(state *domain.State) error {
		actor, err := s.actor(state, actorID)
		if err != nil {
			return err
		}
		item, ok := state.Feedback[id]
		if !ok {
			return domain.ErrNotFound
		}
		if actor.Role != domain.RoleHR && item.AuthorID != actor.ID {
			return domain.ErrForbidden
		}
		if strings.TrimSpace(item.Text) == "" {
			return invalid("text is required for publication")
		}
		now := s.now()
		item.Status = "published"
		item.UpdatedAt = now
		item.PublishedAt = &now
		state.Feedback[id] = item
		state.Touch()
		result = item
		return nil
	})
	return result, err
}

func (s *Service) RequestFeedback(ctx context.Context, actorID, internshipID, recipientID, message string) (domain.FeedbackRequest, error) {
	var result domain.FeedbackRequest
	err := s.store.Update(ctx, func(state *domain.State) error {
		actor, err := s.actor(state, actorID)
		if err != nil {
			return err
		}
		if _, err := s.internship(state, actor, internshipID); err != nil {
			return err
		}
		recipient, ok := state.Actors[recipientID]
		if !ok || recipient.ID == actor.ID {
			return domain.ErrValidation
		}
		now := s.now()
		id := state.NextID("feedback-request")
		result = domain.FeedbackRequest{ID: id, InternshipID: internshipID, RequesterID: actor.ID, RecipientID: recipientID, Message: message, Status: "pending", CreatedAt: now}
		state.FeedbackRequests[id] = result
		state.Touch()
		return nil
	})
	return result, err
}

func (s *Service) SummarizeFeedback(ctx context.Context, actorID, id string) (map[string]any, error) {
	state, err := s.store.Snapshot(ctx)
	if err != nil {
		return nil, err
	}
	actor, err := s.actor(state, actorID)
	if err != nil {
		return nil, err
	}
	item, ok := state.Feedback[id]
	if !ok {
		return nil, domain.ErrNotFound
	}
	internship := state.Internships[item.InternshipID]
	if !identity.CanSeeFeedback(actor, item, internship, state.Settings.ShowFeedbackToIntern) {
		return nil, domain.ErrForbidden
	}
	return insights.SummarizeFeedback(item), nil
}

func setString(target *string, value *string) {
	if value != nil {
		*target = *value
	}
}
func defaultString(value, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}
