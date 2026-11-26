package usecase

import (
	"context"
	"math"
	"testing"

	"mgts/backend/internal/storage/memory"
)

func TestScoresUseInternAnswersAndPercentileBuckets(t *testing.T) {
	state := memory.Seed()
	scores := calculateInternshipScores(state)
	assertClose(t, scores["internship-03"].latestScore, 33.0/7.0)
	assertClose(t, scores["internship-05"].latestScore, 34.0/7.0)
	assertClose(t, scores["internship-01"].overallScore, 193.0/42.0)
	assertClose(t, scores["internship-01"].cohortAverage, (5+5+33.0/7.0+5+34.0/7.0)/5)

	tests := []struct {
		id         string
		percentile float64
		min, max   int
		label      string
	}{
		{"internship-03", 10, 0, 20, "0–20"},
		{"internship-05", 30, 20, 40, "20–40"},
		{"internship-01", 70, 60, 80, "60–80"},
		{"internship-02", 70, 60, 80, "60–80"},
		{"internship-04", 70, 60, 80, "60–80"},
	}
	for _, test := range tests {
		score := scores[test.id]
		assertClose(t, score.percentile, test.percentile)
		if score.percentileMin != test.min || score.percentileMax != test.max || score.percentileLabel != test.label {
			t.Fatalf("%s bucket=%d–%d %q", test.id, score.percentileMin, score.percentileMax, score.percentileLabel)
		}
		if score.trafficLight != "green" || score.currentPeriod != "Месяц 6" {
			t.Fatalf("%s status=%s period=%s", test.id, score.trafficLight, score.currentPeriod)
		}
	}
}

func TestInternDTOHidesExactPercentile(t *testing.T) {
	service := New(memory.New(memory.Seed()))
	result, err := service.Interns(context.Background(), "СТ-001", InternFilters{})
	if err != nil {
		t.Fatal(err)
	}
	items := result["items"].([]map[string]any)
	if len(items) != 1 {
		t.Fatalf("items=%d, want 1", len(items))
	}
	item := items[0]
	if _, exposed := item["percentile"]; exposed {
		t.Fatal("exact percentile leaked in public DTO")
	}
	if item["percentile_min"] != 60 || item["percentile_max"] != 80 || item["percentile_label"] != "60–80" {
		t.Fatalf("unexpected public percentile: %+v", item)
	}
}

func TestSubmitRecalculatesScoresWithoutDuplicatingHistory(t *testing.T) {
	store := memory.New(memory.Seed())
	service := New(store)
	answers := map[string]any{
		"intern_clarity": 1, "intern_support": 1, "intern_workload": 1,
		"intern_interest": 1, "intern_growth": 1, "intern_team": 1, "intern_satisfaction": 1,
		"intern_difficulties": "Тестовая корректировка", "intern_blockers": "Нет",
	}
	response, err := service.SubmitSurvey(context.Background(), "СТ-003", "survey-intern-6", "internship-03", answers)
	if err != nil {
		t.Fatal(err)
	}
	if response.Version != 2 {
		t.Fatalf("version=%d, want 2", response.Version)
	}
	state, err := store.Snapshot(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(state.Responses) != 60 || len(state.Metrics) != 390 {
		t.Fatalf("resubmit duplicated data: responses=%d metrics=%d", len(state.Responses), len(state.Metrics))
	}
	score := calculateInternshipScores(state)["internship-03"]
	if score.latestScore != 1 || score.trafficLight != "red" {
		t.Fatalf("score was not recalculated: %+v", score)
	}
}

func TestTrafficLightThresholdsAndPercentileBoundary(t *testing.T) {
	for _, test := range []struct {
		score float64
		want  string
	}{{4, "green"}, {3.99, "yellow"}, {3, "yellow"}, {2.99, "red"}} {
		if got := trafficLight(test.score, true); got != test.want {
			t.Fatalf("trafficLight(%v)=%s, want %s", test.score, got, test.want)
		}
	}
	if min, max := percentileBucket(100); min != 80 || max != 100 {
		t.Fatalf("p=100 bucket=%d–%d", min, max)
	}
}

func assertClose(t *testing.T, got, want float64) {
	t.Helper()
	if math.Abs(got-want) > 1e-9 {
		t.Fatalf("got %.12f, want %.12f", got, want)
	}
}
