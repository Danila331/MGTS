package usecase

import (
	"context"
	"maps"
	"reflect"
	"testing"

	"mgts/backend/internal/modules/core/domain"
	"mgts/backend/internal/storage/memory"
)

func TestCorrectionDraftKeepsSubmittedAnswerAndCoverage(t *testing.T) {
	const (
		actorID      = "СТ-001"
		surveyID     = "survey-intern-6"
		internshipID = "internship-01"
		responseID   = "response-intern-01-6"
		questionID   = "intern_clarity"
	)
	ctx := context.Background()
	store := memory.New(memory.Seed())
	service := New(store)
	before, err := store.Snapshot(ctx)
	if err != nil {
		t.Fatal(err)
	}
	previous := before.Responses[responseID]
	answers := maps.Clone(previous.Answers)
	answers[questionID] = float64(2)

	draft, err := service.SaveDraft(ctx, actorID, surveyID, internshipID, answers)
	if err != nil {
		t.Fatal(err)
	}
	if draft.ID == previous.ID || draft.Status != "draft" || draft.AssignmentID != previous.AssignmentID {
		t.Fatalf("correction was not saved as a separate draft: %+v", draft)
	}
	answers[questionID] = float64(3)
	updatedDraft, err := service.SaveDraft(ctx, actorID, surveyID, internshipID, answers)
	if err != nil || updatedDraft.ID != draft.ID {
		t.Fatalf("expected to update draft %s, got %s: %v", draft.ID, updatedDraft.ID, err)
	}

	saved, err := store.Snapshot(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(saved.Responses[previous.ID], previous) || !reflect.DeepEqual(saved.Metrics, before.Metrics) {
		t.Fatal("saving a correction draft changed the active response or its metrics")
	}
	if saved.SurveyCoverage(surveyID) != before.SurveyCoverage(surveyID) || !reflect.DeepEqual(saved.Assignments[previous.AssignmentID], before.Assignments[previous.AssignmentID]) {
		t.Fatal("saving a correction draft changed the submitted assignment or coverage")
	}
	take, err := service.TakeSurvey(ctx, actorID, surveyID, internshipID)
	if err != nil {
		t.Fatal(err)
	}
	loaded, _ := take["draft"].(*domain.Response)
	if loaded == nil || loaded.ID != draft.ID || loaded.Answers[questionID] != float64(3) {
		t.Fatalf("expected to resume the updated correction draft, got %+v", loaded)
	}

	corrected, err := service.SubmitSurvey(ctx, actorID, surveyID, internshipID, loaded.Answers)
	if err != nil {
		t.Fatal(err)
	}
	if corrected.ID != previous.ID || corrected.Version != previous.Version+1 {
		t.Fatalf("expected a new version of the submitted answer, got %+v", corrected)
	}
	after, err := store.Snapshot(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if _, found := after.Responses[draft.ID]; found {
		t.Fatal("submitting the correction left its draft behind")
	}
	if after.SurveyCoverage(surveyID) != before.SurveyCoverage(surveyID) || findMetric(t, after, corrected.ID, questionID).Value != 3 {
		t.Fatal("submitting the correction did not update metrics while preserving coverage")
	}
}
