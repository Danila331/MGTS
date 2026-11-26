package usecase_test

import (
	"context"
	"errors"
	"testing"

	"mgts/backend/internal/modules/core/domain"
	"mgts/backend/internal/modules/core/usecase"
	"mgts/backend/internal/storage/memory"
)

func TestMentorOverviewGroupsActualInternFeedback(t *testing.T) {
	ctx := context.Background()
	state := memory.Seed()
	service := usecase.New(memory.New(state))
	const mentorID = "Н-002"
	profile, err := service.CreateIntern(ctx, "actor-hr", usecase.NewIntern{Name: "Тестовый Стажёр", TeamID: "department-02", MentorID: mentorID})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := service.MentorOverview(ctx, mentorID); !errors.Is(err, domain.ErrForbidden) {
		t.Fatalf("mentor can read HR overview: %v", err)
	}
	load := func() usecase.MentorOverviewItem {
		t.Helper()
		view, err := service.MentorOverview(ctx, "actor-hr")
		if err != nil {
			t.Fatal(err)
		}
		if len(view["mentors"]) != 5 {
			t.Fatalf("expected the existing five mentors, got %d", len(view["mentors"]))
		}
		for _, item := range view["mentors"] {
			if item.ID == mentorID {
				return item
			}
		}
		t.Fatal("mentor missing from overview")
		return usecase.MentorOverviewItem{}
	}
	find := func(item usecase.MentorOverviewItem) usecase.MentorFeedback {
		t.Helper()
		count := 0
		var entry usecase.MentorFeedback
		for _, feedback := range item.Feedback {
			if feedback.InternshipID == profile.ID {
				entry, count = feedback, count+1
			}
		}
		if count != 1 || entry.Wave != 1 || entry.Intern != profile.Intern.Name {
			t.Fatalf("expected a single record for the new intern's first month: %+v, count=%d", entry, count)
		}
		return entry
	}
	before := load()
	if before.Interns != 2 || find(before).Submitted {
		t.Fatal("new intern is not shown as pending for the assigned mentor")
	}
	answers := func(surveyID string, score float64, text string) map[string]any {
		result := map[string]any{}
		for _, question := range state.Surveys[surveyID].Questions {
			if question.Type == "scale" {
				result[question.ID] = score
			} else {
				result[question.ID] = text
			}
		}
		return result
	}
	if _, err := service.SubmitSurvey(ctx, mentorID, "survey-mentor-1", profile.ID, answers("survey-mentor-1", 1, "Ответ наставника")); err != nil {
		t.Fatal(err)
	}
	if find(load()).Submitted {
		t.Fatal("a response from the mentor was counted as feedback about the mentor")
	}
	if _, err := service.SubmitSurvey(ctx, profile.Intern.ID, "survey-intern-1", profile.ID, answers("survey-intern-1", 2, "Нужно чаще обсуждать задачи.")); err != nil {
		t.Fatal(err)
	}
	after := find(load())
	if !after.Submitted || after.At == "" || after.Scores["support"] != 2 || len(after.Comments) != 2 || after.Comments[0].Text != "Нужно чаще обсуждать задачи." {
		t.Fatalf("incorrect feedback after submission: %+v", after)
	}
	if _, err := service.SubmitSurvey(ctx, profile.Intern.ID, "survey-intern-1", profile.ID, answers("survey-intern-1", 4, "Поддержки достаточно.")); err != nil {
		t.Fatal(err)
	}
	corrected := find(load())
	if corrected.Scores["support"] != 4 || len(corrected.Comments) != 2 || corrected.Comments[0].Text != "Поддержки достаточно." {
		t.Fatalf("correction must replace the original feedback: %+v", corrected)
	}
}
