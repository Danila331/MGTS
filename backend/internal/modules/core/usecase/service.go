package usecase

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"mgts/backend/internal/modules/core/domain"
	"mgts/backend/internal/modules/core/ports"
	identity "mgts/backend/internal/modules/identity/usecase"
)

const DefaultActorID = "actor-hr"

type Service struct {
	store          ports.Store
	now            func() time.Time
	surveyAnalyzer SurveyAnalyzer
}

func New(store ports.Store) *Service              { return &Service{store: store, now: domain.Now} }
func (s *Service) Storage() string                { return s.store.Name() }
func (s *Service) Ping(ctx context.Context) error { return s.store.Ping(ctx) }

func (s *Service) actor(state *domain.State, actorID string) (domain.Actor, error) {
	if actorID == "" {
		actorID = DefaultActorID
	}
	return state.Actor(actorID)
}

func (s *Service) ResolveActor(ctx context.Context, id, subject string) (domain.Actor, error) {
	state, err := s.store.Snapshot(ctx)
	if err != nil {
		return domain.Actor{}, err
	}
	if subject != "" {
		id = state.IdentitySubjects[subject]
	}
	return state.Actor(id)
}

func (s *Service) Actors(ctx context.Context) ([]domain.Actor, error) {
	state, err := s.store.Snapshot(ctx)
	if err != nil {
		return nil, err
	}
	items := make([]domain.Actor, 0, len(state.Actors))
	for _, id := range domain.SortedKeys(state.Actors) {
		items = append(items, state.Actors[id])
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].Role != items[j].Role {
			return items[i].Role < items[j].Role
		}
		return items[i].Name < items[j].Name
	})
	return items, nil
}

func (s *Service) Bootstrap(ctx context.Context, actorID string) (map[string]any, error) {
	state, err := s.store.Snapshot(ctx)
	if err != nil {
		return nil, err
	}
	actor, err := s.actor(state, actorID)
	if err != nil {
		return nil, err
	}
	actors, _ := s.Actors(ctx)
	internships := identity.ScopedInternships(state, actor)
	counts := map[string]int{"interns": len(internships)}
	signals, actions, surveys := 0, 0, 0
	for _, signal := range state.Signals {
		if s.canSignal(state, actor, signal) && signal.Status != "resolved" && signal.Status != "dismissed" {
			signals++
		}
	}
	for _, action := range state.Actions {
		signal := state.Signals[action.SignalID]
		if s.canSignal(state, actor, signal) && action.Status != "done" {
			actions++
		}
	}
	for _, survey := range state.Surveys {
		if s.canSurvey(state, actor, survey) {
			surveys++
		}
	}
	counts["signals"], counts["actions"], counts["surveys"] = signals, actions, surveys
	return map[string]any{"actor": actor, "actors": actors, "settings": state.Settings, "counts": counts}, nil
}

func (s *Service) internship(state *domain.State, actor domain.Actor, id string) (domain.Internship, error) {
	internship, ok := state.Internships[id]
	if !ok {
		return domain.Internship{}, domain.ErrNotFound
	}
	if !identity.CanAccessInternship(actor, internship) {
		return domain.Internship{}, domain.ErrForbidden
	}
	return internship, nil
}

func (s *Service) canSignal(state *domain.State, actor domain.Actor, signal domain.Signal) bool {
	internship, ok := state.Internships[signal.InternshipID]
	return ok && identity.CanAccessInternship(actor, internship)
}

func (s *Service) canSurvey(state *domain.State, actor domain.Actor, survey domain.Survey) bool {
	if actor.Role == domain.RoleHR || actor.Role == domain.RoleManager {
		return true
	}
	for _, assignment := range state.Assignments {
		if assignment.SurveyID != survey.ID {
			continue
		}
		if assignment.RespondentID == actor.ID {
			return true
		}
		if actor.Role == domain.RoleManager {
			if internship, ok := state.Internships[assignment.InternshipID]; ok && identity.CanAccessInternship(actor, internship) {
				return true
			}
		}
	}
	return false
}

func person(actor domain.Actor) *domain.Person {
	return &domain.Person{ID: actor.ID, Name: actor.Name, Initials: actor.Initials}
}

func avg(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	total := 0.0
	for _, value := range values {
		total += value
	}
	return total / float64(len(values))
}

func matches(text, search string) bool {
	return strings.Contains(strings.ToLower(text), strings.ToLower(search))
}

func due(value time.Time) *time.Time {
	if value.IsZero() {
		return nil
	}
	copy := value
	return &copy
}

func invalid(message string) error { return fmt.Errorf("%w: %s", domain.ErrValidation, message) }
