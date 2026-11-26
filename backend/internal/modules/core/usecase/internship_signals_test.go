package usecase_test

import (
	"context"
	"testing"

	"mgts/backend/internal/modules/core/domain"
	"mgts/backend/internal/modules/core/usecase"
	"mgts/backend/internal/storage/memory"
)

func TestInternshipHRSignalsFollowSubmittedSurveyEvidence(t *testing.T) {
	ctx := context.Background()
	state := memory.Seed()
	service := usecase.New(memory.New(state))
	profile, err := service.CreateIntern(ctx, "actor-hr", usecase.NewIntern{Name: "Тестовый Стажёр", TeamID: "department-02", MentorID: "Н-002"})
	if err != nil {
		t.Fatal(err)
	}
	survey := state.Surveys["survey-intern-1"]
	answersFor := func(score float64, comment string) map[string]any {
		answers := map[string]any{}
		for _, question := range survey.Questions {
			if question.Type == "scale" {
				answers[question.ID] = score
			} else {
				answers[question.ID] = comment
			}
		}
		return answers
	}
	load := func(actor string) map[string]any {
		t.Helper()
		card, err := service.Internship(ctx, actor, profile.ID)
		if err != nil {
			t.Fatal(err)
		}
		return card
	}
	const quote = "Мне нужна помощь с приоритетами по задачам."
	assertEvidence := func(responseID string) {
		t.Helper()
		card := load("actor-hr")
		signals, ok := card["survey_signals"].([]domain.Signal)
		if !ok || len(signals) < 2 || signals[0].Rule != "help_keywords" {
			t.Fatalf("expected priority text signal and low ratings: %#v", card["survey_signals"])
		}
		if len(signals[0].Evidence) != 1 || signals[0].Evidence[0].SourceID != responseID || signals[0].Evidence[0].Quote != quote {
			t.Fatalf("unexpected text signal evidence: %#v", signals[0].Evidence)
		}
	}
	assertEmpty := func() {
		t.Helper()
		if signals := load("actor-hr")["survey_signals"].([]domain.Signal); len(signals) != 0 {
			t.Fatalf("edited or superseded evidence remains visible: %#v", signals)
		}
	}
	assertEmpty()
	imported, duplicate, err := service.ImportExternalResponse(ctx, usecase.ExternalResponseInput{
		ExternalID: "test-internship-card-signal", Version: 1, InternshipID: profile.ID, RespondentID: profile.Intern.ID, SurveyID: survey.ID,
		Answers: answersFor(2, quote),
	})
	if err != nil || duplicate {
		t.Fatalf("external response import: duplicate=%v err=%v", duplicate, err)
	}
	assertEvidence(imported.ID)
	for _, actor := range []string{profile.Intern.ID, "Н-002", "actor-manager"} {
		if _, exposed := load(actor)["survey_signals"]; exposed {
			t.Fatalf("HR signal panel exposed to %s", actor)
		}
	}

	submit := func(score float64, comment string) domain.Response {
		t.Helper()
		response, err := service.SubmitSurvey(ctx, profile.Intern.ID, survey.ID, profile.ID, answersFor(score, comment))
		if err != nil {
			t.Fatal(err)
		}
		return response
	}
	firstCorrection := submit(4, "Задачи понятны, обратная связь получена.")
	if firstCorrection.ID == imported.ID {
		t.Fatal("corrected external answer must have a different ID")
	}
	assertEmpty()
	withConcern := submit(2, quote)
	assertEvidence(withConcern.ID)
	corrected := submit(4, "Задачи понятны, обратная связь получена.")
	if corrected.ID != withConcern.ID {
		t.Fatal("built-in correction should keep the previous response ID")
	}
	assertEmpty()
}
