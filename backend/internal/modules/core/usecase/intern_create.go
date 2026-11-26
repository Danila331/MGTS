package usecase

import (
	"context"
	"fmt"
	"strings"
	"unicode/utf8"

	"mgts/backend/internal/modules/core/domain"
)

type NewIntern struct {
	Name            string `json:"name"`
	TeamID          string `json:"team_id"`
	MentorID        string `json:"mentor_id"`
	IdentitySubject string `json:"identity_subject"`
}

func (s *Service) InternOptions(ctx context.Context, actorID string) (map[string]any, error) {
	state, err := s.store.Snapshot(ctx)
	if err != nil {
		return nil, err
	}
	if err := s.requireSurveyHR(state, actorID); err != nil {
		return nil, err
	}
	teams := make([]domain.Team, 0, len(state.Teams))
	for _, id := range domain.SortedKeys(state.Teams) {
		teams = append(teams, state.Teams[id])
	}
	mentors := []domain.Actor{}
	for _, id := range domain.SortedKeys(state.Actors) {
		if actor := state.Actors[id]; actor.Role == domain.RoleMentor {
			mentors = append(mentors, actor)
		}
	}
	return map[string]any{"teams": teams, "mentors": mentors}, nil
}

func (s *Service) CreateIntern(ctx context.Context, actorID string, input NewIntern) (domain.Internship, error) {
	var result domain.Internship
	err := s.store.Update(ctx, func(state *domain.State) error {
		if err := s.requireSurveyHR(state, actorID); err != nil {
			return err
		}
		subject := strings.TrimSpace(input.IdentitySubject)
		if len(subject) > 255 {
			return invalid("SSO subject превышает 255 символов")
		}
		if subject != "" && state.IdentitySubjects[subject] != "" {
			return domain.ErrAlreadyExists
		}
		words := strings.Fields(input.Name)
		name := strings.Join(words, " ")
		if len(words) < 2 || utf8.RuneCountInString(name) > 100 {
			return invalid("Укажите имя и фамилию стажёра, до 100 символов")
		}
		team, ok := state.Teams[input.TeamID]
		if !ok {
			return invalid("Выберите существующий блок")
		}
		mentor, ok := state.Actors[input.MentorID]
		if !ok || mentor.Role != domain.RoleMentor {
			return invalid("Выберите наставника")
		}
		for _, internship := range state.Internships {
			if internship.TeamID == team.ID && strings.EqualFold(internship.Intern.Name, name) {
				return fmt.Errorf("%w: стажёр с таким именем уже есть в этом блоке", domain.ErrAlreadyExists)
			}
		}
		var cohort domain.Cohort
		for _, id := range domain.SortedKeys(state.Cohorts) {
			if candidate := state.Cohorts[id]; cohort.ID == "" || candidate.StartedAt > cohort.StartedAt {
				cohort = candidate
			}
		}
		if cohort.ID == "" {
			return invalid("Сначала создайте поток стажировки")
		}
		var manager domain.Actor
		for _, id := range domain.SortedKeys(state.Actors) {
			if candidate := state.Actors[id]; candidate.Role == domain.RoleManager {
				manager = candidate
				break
			}
		}
		first, _ := utf8.DecodeRuneInString(words[0])
		last, _ := utf8.DecodeRuneInString(words[len(words)-1])
		intern := domain.Person{ID: state.NextID("intern"), Name: name, Initials: strings.ToUpper(string([]rune{first, last}))}
		now := s.now()
		result = domain.Internship{
			ID: state.NextID("internship"), Intern: intern, Program: cohort.Program, CohortID: cohort.ID, Cohort: cohort.Name,
			TeamID: team.ID, Team: team.Name, Stage: "Месяц 1", ManagerID: manager.ID, Manager: manager.Name,
			MentorID: mentor.ID, Mentor: mentor.Name, StartedAt: &now, LastActivity: now,
		}
		state.Actors[intern.ID] = domain.Actor{ID: intern.ID, Name: name, Role: domain.RoleIntern, TeamID: team.ID, InternshipID: result.ID, Initials: intern.Initials}
		state.Internships[result.ID] = result
		if subject != "" {
			state.IdentitySubjects[subject] = intern.ID
		}
		openPulseWave(state, result, 1, addControlMonth(now, 1))
		state.Touch()
		return nil
	})
	return result, err
}
