package usecase

import (
	"context"
	"testing"
	"time"

	"mgts/backend/internal/modules/core/domain"
	"mgts/backend/internal/storage/memory"
)

func TestTrendsSeparateQuestionVersionsScalesAndRoles(t *testing.T) {
	now := time.Now().UTC()
	points := []domain.MetricPoint{
		{ID: "p1", Dimension: "clarity", Role: domain.RoleIntern, QuestionID: "q1", QuestionVersion: 1, ScaleMin: 1, ScaleMax: 5, ScaleSignature: "q1-v1", Wave: 1, Value: 4, CreatedAt: now},
		{ID: "p2", Dimension: "clarity", Role: domain.RoleIntern, QuestionID: "q1", QuestionVersion: 1, ScaleMin: 1, ScaleMax: 5, ScaleSignature: "q1-v1", Wave: 2, Value: 2, CreatedAt: now},
		{ID: "p3", Dimension: "clarity", Role: domain.RoleIntern, QuestionID: "q1", QuestionVersion: 2, ScaleMin: 1, ScaleMax: 10, ScaleSignature: "q1-v2", Wave: 3, Value: 8, CreatedAt: now},
		{ID: "p4", Dimension: "clarity", Role: domain.RoleMentor, QuestionID: "q1", QuestionVersion: 1, ScaleMin: 1, ScaleMax: 5, ScaleSignature: "q1-v1", Wave: 1, Value: 1, CreatedAt: now},
	}
	trends := buildTrends(points)
	if len(trends) != 3 {
		t.Fatalf("incompatible points or roles were mixed: %v", trends)
	}
	bySignatureAndRole := map[string][]map[string]any{}
	for _, trend := range trends {
		key := trend["scale_signature"].(string) + "/" + string(trend["role"].(domain.Role))
		bySignatureAndRole[key] = trend["points"].([]map[string]any)
	}
	compatible := bySignatureAndRole["q1-v1/intern"]
	if len(compatible) != 2 || compatible[0]["delta"] != nil || compatible[1]["delta"].(float64) != -2 {
		t.Fatalf("compatible delta is wrong: %v", compatible)
	}
	if compatible[0]["period"] != "Месяц 1" {
		t.Fatalf("period is missing: %v", compatible[0])
	}
	incompatible := bySignatureAndRole["q1-v2/intern"]
	if len(incompatible) != 1 || incompatible[0]["delta"] != nil {
		t.Fatalf("incompatible series acquired a cross-scale delta: %v", incompatible)
	}
	if len(bySignatureAndRole["q1-v1/mentor"]) != 1 {
		t.Fatal("mentor series was mixed with intern series")
	}
}

func TestScaleEditVersionsNewMetricsWithoutChangingOldPoints(t *testing.T) {
	store := memory.New(memory.Seed())
	service := New(store)
	ctx := context.Background()
	before, _ := store.Snapshot(ctx)
	oldMetric := findMetric(t, before, "response-intern-01-2", "intern_clarity")
	if oldMetric.QuestionVersion != 1 || oldMetric.ScaleMax != 5 || oldMetric.ScaleSignature == "" {
		t.Fatalf("seed metric lacks scale metadata: %v", oldMetric)
	}
	survey := before.Surveys["survey-intern-2"]
	questions := append([]domain.Question(nil), survey.Questions...)
	for index := range questions {
		if questions[index].ID == "intern_clarity" {
			questions[index].Max = 10
		}
	}
	updated, err := service.UpdateSurvey(ctx, "actor-hr", survey.ID, SurveyPatch{Questions: &questions})
	if err != nil {
		t.Fatal(err)
	}
	if updated.Questions[0].Version != 2 {
		t.Fatalf("scale edit did not increment question version: %v", updated.Questions[0])
	}
	afterEdit, _ := store.Snapshot(ctx)
	preserved := findMetric(t, afterEdit, "response-intern-01-2", "intern_clarity")
	if preserved != oldMetric {
		t.Fatal("editing a scale mutated historical metric metadata")
	}
	answers := map[string]any{
		"intern_clarity": 8, "intern_support": 4, "intern_workload": 4,
		"intern_interest": 4, "intern_growth": 4, "intern_team": 4, "intern_satisfaction": 4,
		"intern_difficulties": "Нет", "intern_blockers": "New ten-point scale",
	}
	if _, err := service.SubmitSurvey(ctx, "СТ-002", survey.ID, "internship-02", answers); err != nil {
		t.Fatal(err)
	}
	afterSubmit, _ := store.Snapshot(ctx)
	newMetric := findMetric(t, afterSubmit, "response-intern-02-2", "intern_clarity")
	if newMetric.QuestionVersion != 2 || newMetric.ScaleMin != 1 || newMetric.ScaleMax != 10 || newMetric.ScaleSignature == oldMetric.ScaleSignature {
		t.Fatalf("new response did not retain new scale signature: %v", newMetric)
	}
	oldAgain := findMetric(t, afterSubmit, "response-intern-01-2", "intern_clarity")
	if oldAgain != oldMetric {
		t.Fatal("another response changed historical data")
	}
	trends := service.internTrends(afterSubmit, "internship-02")
	signatures := map[string]bool{}
	for _, trend := range trends {
		if trend["dimension"] == "clarity" && trend["role"] == domain.RoleIntern {
			signatures[trend["scale_signature"].(string)] = true
		}
	}
	if !signatures[oldMetric.ScaleSignature] || !signatures[newMetric.ScaleSignature] {
		t.Fatalf("trends do not expose both compatible series: %v", signatures)
	}
}

func findMetric(t *testing.T, state *domain.State, responseID, questionID string) domain.MetricPoint {
	t.Helper()
	for _, point := range state.Metrics {
		if point.ResponseID == responseID && point.QuestionID == questionID {
			return point
		}
	}
	t.Fatalf("metric not found: response=%s question=%s", responseID, questionID)
	return domain.MetricPoint{}
}
