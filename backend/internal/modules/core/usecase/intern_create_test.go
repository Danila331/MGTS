package usecase_test

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"mgts/backend/internal/modules/core/domain"
	"mgts/backend/internal/modules/core/usecase"
	"mgts/backend/internal/storage/memory"
)

func TestCreateInternAddsParticipantsAndTracksBothForms(t *testing.T) {
	ctx := context.Background()
	store := memory.New(memory.Seed())
	service := usecase.New(store)
	input := usecase.NewIntern{Name: "Тестовый Участник", TeamID: "department-02", MentorID: "Н-002"}
	if _, err := service.CreateIntern(ctx, "Н-002", input); !errors.Is(err, domain.ErrForbidden) {
		t.Fatalf("mentor can create interns: %v", err)
	}
	internship, err := service.CreateIntern(ctx, "actor-hr", input)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := service.CreateIntern(ctx, "actor-hr", input); !errors.Is(err, domain.ErrAlreadyExists) {
		t.Fatalf("duplicate intern: %v", err)
	}
	for _, test := range []struct{ intern, mentor string }{{"pending", "pending"}, {"submitted", "pending"}, {"pending", "submitted"}, {"submitted", "submitted"}} {
		if err := store.Update(ctx, func(state *domain.State) error {
			if state.Actors[internship.Intern.ID].InternshipID != internship.ID {
				t.Fatal("intern participant is not linked to the new internship")
			}
			for id, assignment := range state.Assignments {
				if assignment.InternshipID != internship.ID {
					continue
				}
				assignment.Status = "assigned"
				if (assignment.RespondentID == internship.Intern.ID && test.intern == "submitted") || (assignment.RespondentID == input.MentorID && test.mentor == "submitted") {
					assignment.Status = "submitted"
				}
				state.Assignments[id] = assignment
			}
			return nil
		}); err != nil {
			t.Fatal(err)
		}
		dashboard, err := service.Dashboard(ctx, "actor-hr")
		if err != nil {
			t.Fatal(err)
		}
		raw, err := json.Marshal(dashboard["survey_participation"])
		if err != nil {
			t.Fatal(err)
		}
		var rows []struct {
			InternshipID string `json:"internship_id"`
			Periods      []struct{ Intern, Mentor string }
		}
		if err := json.Unmarshal(raw, &rows); err != nil {
			t.Fatal(err)
		}
		found := false
		for _, row := range rows {
			if row.InternshipID == internship.ID {
				found = len(row.Periods) == 6 && row.Periods[0].Intern == test.intern && row.Periods[0].Mentor == test.mentor && row.Periods[1].Intern == "" && row.Periods[1].Mentor == ""
			}
		}
		if !found {
			t.Fatalf("month-one participation must be %s/%s and other months remain unassigned", test.intern, test.mentor)
		}
	}
}
