package usecase

import (
	"context"
	"fmt"
	"sort"
	"time"

	"mgts/backend/internal/modules/core/domain"
	identity "mgts/backend/internal/modules/identity/usecase"
)

type SignalFilters struct{ Status, Urgency, OwnerID string }
type SignalPatch struct {
	Status, Urgency, OwnerID *string
	DueAt                    *time.Time
}
type ActionInput struct {
	Title, OwnerID string
	DueAt          time.Time
}
type ActionPatch struct{ Status, Result, Comment *string }

func (s *Service) Signals(ctx context.Context, actorID string, filters SignalFilters) (map[string]any, error) {
	state, err := s.store.Snapshot(ctx)
	if err != nil {
		return nil, err
	}
	actor, err := s.actor(state, actorID)
	if err != nil {
		return nil, err
	}
	items := []domain.Signal{}
	for _, id := range domain.SortedKeys(state.Signals) {
		signal := state.Signals[id]
		if !s.canSignal(state, actor, signal) {
			continue
		}
		if filters.Status != "" && signal.Status != filters.Status {
			continue
		}
		if filters.Urgency != "" && signal.Urgency != filters.Urgency {
			continue
		}
		if filters.OwnerID != "" && signal.OwnerID != filters.OwnerID {
			continue
		}
		signal.Actions = s.signalActions(state, id)
		items = append(items, signal)
	}
	sort.Slice(items, func(i, j int) bool {
		if urgencyRank(items[i].Urgency) != urgencyRank(items[j].Urgency) {
			return urgencyRank(items[i].Urgency) > urgencyRank(items[j].Urgency)
		}
		return items[i].UpdatedAt.After(items[j].UpdatedAt)
	})
	return map[string]any{"items": items, "total": len(items)}, nil
}

func (s *Service) Signal(ctx context.Context, actorID, id string) (domain.Signal, error) {
	state, err := s.store.Snapshot(ctx)
	if err != nil {
		return domain.Signal{}, err
	}
	actor, err := s.actor(state, actorID)
	if err != nil {
		return domain.Signal{}, err
	}
	signal, ok := state.Signals[id]
	if !ok {
		return domain.Signal{}, domain.ErrNotFound
	}
	if !s.canSignal(state, actor, signal) {
		return domain.Signal{}, domain.ErrForbidden
	}
	signal.Actions = s.signalActions(state, id)
	return signal, nil
}

func (s *Service) UpdateSignal(ctx context.Context, actorID, id string, patch SignalPatch) (domain.Signal, error) {
	var result domain.Signal
	err := s.store.Update(ctx, func(state *domain.State) error {
		actor, err := s.actor(state, actorID)
		if err != nil {
			return err
		}
		signal, ok := state.Signals[id]
		if !ok {
			return domain.ErrNotFound
		}
		internship := state.Internships[signal.InternshipID]
		if !identity.CanManage(actor, internship) {
			return domain.ErrForbidden
		}
		event := ""
		if patch.Status != nil {
			if !validSignalStatus(*patch.Status) {
				return invalid("invalid signal status")
			}
			if signal.Status != *patch.Status {
				event = "status: " + signal.Status + " → " + *patch.Status
				signal.Status = *patch.Status
			}
		}
		if patch.Urgency != nil {
			if !contains([]string{"low", "medium", "high", "critical"}, *patch.Urgency) {
				return invalid("invalid urgency")
			}
			signal.Urgency = *patch.Urgency
			event = "urgency updated"
		}
		if patch.OwnerID != nil {
			owner, exists := state.Actors[*patch.OwnerID]
			if !exists {
				return domain.ErrNotFound
			}
			signal.OwnerID = owner.ID
			signal.Owner = person(owner)
			event = "owner assigned"
		}
		if patch.DueAt != nil {
			signal.DueAt = due(*patch.DueAt)
			event = "due date updated"
		}
		signal.UpdatedAt = s.now()
		if event != "" {
			signal.History = append(signal.History, domain.History{At: signal.UpdatedAt, ActorID: actor.ID, Event: event})
		}
		state.Signals[id] = signal
		state.Touch()
		signal.Actions = s.signalActions(state, id)
		result = signal
		return nil
	})
	return result, err
}

func (s *Service) CreateAction(ctx context.Context, actorID, signalID string, input ActionInput) (domain.Action, error) {
	var result domain.Action
	err := s.store.Update(ctx, func(state *domain.State) error {
		actor, err := s.actor(state, actorID)
		if err != nil {
			return err
		}
		signal, ok := state.Signals[signalID]
		if !ok {
			return domain.ErrNotFound
		}
		internship := state.Internships[signal.InternshipID]
		if !identity.CanManage(actor, internship) {
			return domain.ErrForbidden
		}
		if signal.Status == "resolved" || signal.Status == "dismissed" {
			return fmt.Errorf("%w: cannot add an action to a closed signal; reopen it explicitly first", domain.ErrConflict)
		}
		if input.Title == "" {
			return invalid("title is required")
		}
		if input.OwnerID == "" {
			input.OwnerID = actor.ID
		}
		owner, ok := state.Actors[input.OwnerID]
		if !ok {
			return domain.ErrNotFound
		}
		now := s.now()
		id := state.NextID("action")
		result = domain.Action{ID: id, SignalID: signalID, Title: input.Title, OwnerID: owner.ID, Owner: owner.Name, Status: "pending", DueAt: input.DueAt, CreatedAt: now}
		state.Actions[id] = result
		signal.Status = "in_progress"
		signal.UpdatedAt = now
		signal.History = append(signal.History, domain.History{At: now, ActorID: actor.ID, Event: "action created: " + id})
		state.Signals[signalID] = signal
		state.Touch()
		return nil
	})
	return result, err
}

func (s *Service) UpdateAction(ctx context.Context, actorID, id string, patch ActionPatch) (domain.Action, error) {
	var result domain.Action
	err := s.store.Update(ctx, func(state *domain.State) error {
		actor, err := s.actor(state, actorID)
		if err != nil {
			return err
		}
		action, ok := state.Actions[id]
		if !ok {
			return domain.ErrNotFound
		}
		signal := state.Signals[action.SignalID]
		internship := state.Internships[signal.InternshipID]
		if action.OwnerID != actor.ID && !identity.CanManage(actor, internship) {
			return domain.ErrForbidden
		}
		if !identity.CanAccessInternship(actor, internship) && actor.Role != domain.RoleHR {
			return domain.ErrForbidden
		}
		if patch.Status != nil {
			if !contains([]string{"pending", "in_progress", "done", "cancelled"}, *patch.Status) {
				return invalid("invalid action status")
			}
			action.Status = *patch.Status
			if *patch.Status == "done" {
				now := s.now()
				action.CompletedAt = &now
			} else {
				action.CompletedAt = nil
			}
		}
		setString(&action.Result, patch.Result)
		setString(&action.Comment, patch.Comment)
		state.Actions[id] = action
		state.Touch()
		result = action
		return nil
	})
	return result, err
}

func (s *Service) signalActions(state *domain.State, signalID string) []domain.Action {
	items := []domain.Action{}
	for _, id := range domain.SortedKeys(state.Actions) {
		if state.Actions[id].SignalID == signalID {
			items = append(items, state.Actions[id])
		}
	}
	return items
}
func validSignalStatus(status string) bool {
	return contains([]string{"new", "confirmed", "in_progress", "resolved", "dismissed"}, status)
}
