package app

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"

	"mgts/backend/internal/modules/core/domain"
	"mgts/backend/internal/storage/memory"
)

func initialState(production bool, path string) (*domain.State, error) {
	if !production {
		return memory.Seed(), nil
	}
	if path == "" {
		return nil, fmt.Errorf("empty production database requires PULSE_BOOTSTRAP_FILE")
	}
	file, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("open bootstrap file: %w", err)
	}
	defer file.Close()
	var input struct {
		Actors   []domain.Actor    `json:"actors"`
		Subjects map[string]string `json:"subjects"`
		Teams    []domain.Team     `json:"teams"`
		Cohort   domain.Cohort     `json:"cohort"`
	}
	if err := json.NewDecoder(io.LimitReader(file, 1<<20)).Decode(&input); err != nil {
		return nil, fmt.Errorf("read bootstrap file: %w", err)
	}
	state := domain.NewState()
	if input.Cohort.ID == "" || input.Cohort.Name == "" || input.Cohort.Program == "" || len(input.Teams) == 0 {
		return nil, fmt.Errorf("bootstrap requires a cohort and at least one team")
	}
	state.Cohorts[input.Cohort.ID] = input.Cohort
	for _, team := range input.Teams {
		if team.ID == "" || team.Name == "" || state.Teams[team.ID].ID != "" {
			return nil, fmt.Errorf("invalid bootstrap team")
		}
		state.Teams[team.ID] = team
	}
	for _, actor := range input.Actors {
		if actor.ID == "" || actor.Name == "" || state.Actors[actor.ID].ID != "" ||
			(actor.Role != domain.RoleHR && actor.Role != domain.RoleManager && actor.Role != domain.RoleMentor) {
			return nil, fmt.Errorf("invalid bootstrap actor")
		}
		state.Actors[actor.ID] = actor
	}
	hr := false
	for subject, actorID := range input.Subjects {
		actor := state.Actors[actorID]
		if strings.TrimSpace(subject) == "" || actor.ID == "" {
			return nil, fmt.Errorf("invalid bootstrap identity mapping")
		}
		hr = hr || actor.Role == domain.RoleHR
		state.IdentitySubjects[subject] = actorID
	}
	if !hr {
		return nil, fmt.Errorf("bootstrap requires a verified HR identity")
	}
	now := domain.Now()
	for id, survey := range memory.Seed().Surveys {
		survey.DueAt, survey.CreatedAt, survey.UpdatedAt = now.AddDate(0, 6, 0), now, now
		state.Surveys[id] = survey
	}
	state.Touch()
	return state, nil
}
