package usecase

import (
	"context"
	"testing"

	"mgts/backend/internal/modules/core/domain"
	"mgts/backend/internal/storage/memory"
)

func TestExternalV2ThenV1KeepsNewestAndOneActiveResponse(t *testing.T) {
	store := memory.New(memory.Seed())
	service := New(store)
	ctx := context.Background()
	assignmentID := "assignment-intern-01-2"
	old, err := store.Snapshot(ctx)
	if err != nil {
		t.Fatal(err)
	}
	builtInID := "response-intern-01-2"
	if old.Responses[builtInID].Status != "submitted" {
		t.Fatal("seed precondition failed")
	}
	input := ExternalResponseInput{ExternalID: "ordered-webhook", SurveyID: "survey-intern-2", InternshipID: "internship-01", RespondentID: "СТ-001", Version: 2,
		Answers: map[string]any{
			"intern_clarity": 2, "intern_support": 3, "intern_workload": 3,
			"intern_interest": 3, "intern_growth": 3, "intern_team": 3, "intern_satisfaction": 3,
			"intern_difficulties": "newest", "intern_blockers": "Нет",
		}}
	newest, duplicate, err := service.ImportExternalResponse(ctx, input)
	if err != nil || duplicate {
		t.Fatalf("v2 import failed: duplicate=%v err=%v", duplicate, err)
	}
	afterV2, _ := store.Snapshot(ctx)
	if afterV2.Responses[builtInID].Status != "superseded" {
		t.Fatal("external import did not supersede built-in response")
	}
	for _, point := range afterV2.Metrics {
		if point.ResponseID == builtInID {
			t.Fatal("superseded built-in response kept metric weight")
		}
	}
	assertOneActiveResponse(t, afterV2, assignmentID)
	responseCount, metricCount := len(afterV2.Responses), len(afterV2.Metrics)

	input.Version = 1
	input.Answers["intern_clarity"] = 5
	input.Answers["intern_difficulties"] = "stale"
	stale, duplicate, err := service.ImportExternalResponse(ctx, input)
	if err != nil {
		t.Fatal(err)
	}
	if !duplicate || stale.ID != newest.ID {
		t.Fatalf("out-of-order v1 was not absorbed: duplicate=%v stale=%s newest=%s", duplicate, stale.ID, newest.ID)
	}
	afterV1, _ := store.Snapshot(ctx)
	if len(afterV1.Responses) != responseCount || len(afterV1.Metrics) != metricCount {
		t.Fatal("out-of-order v1 changed responses or metrics")
	}
	assertOneActiveResponse(t, afterV1, assignmentID)
	activeID, active, _ := activeResponse(afterV1, assignmentID)
	if activeID != newest.ID || active.Version != 2 || active.Answers["intern_difficulties"] != "newest" {
		t.Fatalf("stale version replaced newest: %v", active)
	}
	if countResponseMetrics(afterV1, activeID) != 7 {
		t.Fatalf("active response has incorrect metric count: %d", countResponseMetrics(afterV1, activeID))
	}
}

func assertOneActiveResponse(t *testing.T, state *domain.State, assignmentID string) {
	t.Helper()
	count := 0
	for _, response := range state.Responses {
		if response.AssignmentID == assignmentID && response.Status == "submitted" {
			count++
		}
	}
	if count != 1 {
		t.Fatalf("assignment %s has %d active responses, want 1", assignmentID, count)
	}
}

func countResponseMetrics(state *domain.State, responseID string) int {
	count := 0
	for _, point := range state.Metrics {
		if point.ResponseID == responseID {
			count++
		}
	}
	return count
}
