package usecase

import (
	"context"
	"errors"
	"testing"
	"time"

	analytics "mgts/backend/internal/modules/analytics/usecase"
	"mgts/backend/internal/modules/core/domain"
	"mgts/backend/internal/storage/memory"
)

type testSurveyAnalyzer struct {
	invalid bool
}

func (*testSurveyAnalyzer) Version() string { return "test-provider/v1" }
func (*testSurveyAnalyzer) Name() string    { return "test-provider" }

func (p *testSurveyAnalyzer) Analyze(_ context.Context, history analytics.PulseHistory) (*domain.SurveySummary, error) {
	answer := history.Answers[len(history.Answers)-1]
	quote := answer.Comments[0]
	if p.invalid {
		quote = "Вымышленная цитата"
	}
	return &domain.SurveySummary{
		Summary: "В анкете есть комментарий о задачах.", NextStep: "Уточнить следующие задачи.",
		Evidence: []domain.SurveyEvidence{{ResponseID: answer.ID, Role: "invalid", Wave: 99, Text: quote}},
	}, nil
}

func TestSurveyAnalysisFollowsActiveAnswersAndScope(t *testing.T) {
	ctx := context.Background()
	state := memory.Seed()
	for id, response := range state.Responses {
		if response.InternshipID != "internship-01" {
			delete(state.Responses, id)
		}
	}
	service := New(memory.New(state))
	analyzer := &testSurveyAnalyzer{}
	service.SetSurveyAnalyzer(analyzer)
	now := domain.Now()
	service.now = func() time.Time { return now }
	load := func() domain.SurveyAnalysis {
		t.Helper()
		card, err := service.Internship(ctx, DefaultActorID, "internship-01")
		if err != nil {
			t.Fatal(err)
		}
		return card["survey_analysis"].(domain.SurveyAnalysis)
	}
	if result := load(); result.Status != "pending" {
		t.Fatalf("before job: %#v", result)
	}
	worked, err := service.ProcessSurveyAnalysis(ctx)
	if err != nil || !worked {
		t.Fatalf("run analysis: worked=%v, err=%v", worked, err)
	}
	result := load()
	if result.Status != "ready" || result.AI.Evidence[0].Role != domain.RoleMentor || result.AI.Evidence[0].Wave != 6 {
		t.Fatalf("model evidence must use source metadata: %#v", result)
	}
	if _, err := service.UpdateSurveyFollowUp(ctx, DefaultActorID, "internship-01", "done", "Договорились обсудить задачи", result.ReviewVersion); err != nil {
		t.Fatal(err)
	}

	answers := map[string]any{}
	for _, question := range state.Surveys["survey-intern-6"].Questions {
		if question.Type == "scale" {
			answers[question.ID] = 5
		} else {
			answers[question.ID] = "Мне нужна помощь с приоритетами по задачам."
		}
	}
	if _, err := service.SubmitSurvey(ctx, "СТ-001", "survey-intern-6", "internship-01", answers); err != nil {
		t.Fatal(err)
	}
	if _, err := service.UpdateSurveyFollowUp(ctx, DefaultActorID, "internship-01", "done", "Шаг до исправления", result.ReviewVersion); !errors.Is(err, domain.ErrConflict) {
		t.Fatalf("stale update was accepted: %v", err)
	}
	changed := load()
	if changed.Status != "pending" || changed.AI != nil || changed.FollowUp != nil ||
		len(changed.Findings) == 0 || changed.Findings[0].Severity != "critical" {
		t.Fatalf("stale analysis or follow-up visible after correction: %#v", changed)
	}
	dashboard, err := service.Dashboard(ctx, DefaultActorID)
	if err != nil {
		t.Fatal(err)
	}
	queue := dashboard["attention_queue"].([]map[string]any)
	var redAtHighScore bool
	for _, intern := range dashboard["items"].([]map[string]any) {
		if intern["id"] == "internship-01" {
			redAtHighScore = intern["traffic_light"] == "red" && intern["latest_score"] == float64(5)
		}
	}
	if len(queue) == 0 || queue[0]["severity"] != "critical" || !redAtHighScore {
		t.Fatalf("HR dashboard did not reflect critical comment with high scores")
	}
	for _, actor := range []string{"actor-manager", "Н-001", "СТ-001"} {
		card, err := service.Internship(ctx, actor, "internship-01")
		if err != nil || card["survey_analysis"] != nil {
			t.Fatalf("restricted analysis exposed for %q: %v", actor, err)
		}
	}

	analyzer.invalid = true
	for attempt := 0; attempt < 4; attempt++ {
		if worked, err := service.ProcessSurveyAnalysis(ctx); !worked || err == nil {
			t.Fatalf("fabricated evidence was accepted (attempt %d)", attempt+1)
		}
		now = now.Add(3 * time.Minute)
	}
	if failed := load(); failed.Status != "failed" || failed.AI != nil {
		t.Fatalf("analysis should fail after retries: %#v", failed)
	}
	if err := service.RetrySurveyAnalysis(ctx, DefaultActorID, "internship-01"); err != nil {
		t.Fatal(err)
	}
	if pending := load(); pending.Status != "pending" {
		t.Fatalf("manual retry did not requeue: %#v", pending)
	}
}

func TestSurveyWavesOpenMonthlyWithoutDuplicateAssignments(t *testing.T) {
	ctx := context.Background()
	store := memory.New(memory.Seed())
	service := New(store)
	start := time.Date(2026, time.January, 31, 11, 0, 0, 0, time.UTC)
	now := start
	service.now = func() time.Time { return now }
	intern, err := service.CreateIntern(ctx, DefaultActorID, NewIntern{
		Name: "Тестовый Стажёр", TeamID: "department-01", MentorID: "Н-001", IdentitySubject: "intern-subject",
	})
	if err != nil {
		t.Fatal(err)
	}
	if actor, err := service.ResolveActor(ctx, "", "intern-subject"); err != nil || actor.ID != intern.Intern.ID {
		t.Fatalf("SSO binding did not resolve created intern: %v", err)
	}
	now = time.Date(2026, time.February, 27, 12, 0, 0, 0, time.UTC)
	if created, err := service.ProcessSurveyWaves(ctx); err != nil || created != 0 {
		t.Fatalf("second control period opened too early: %d, %v", created, err)
	}
	now = now.AddDate(0, 0, 1)
	for _, want := range []int{2, 0} {
		if created, err := service.ProcessSurveyWaves(ctx); err != nil || created != want {
			t.Fatalf("second month created %d, want %d: %v", created, want, err)
		}
	}
	state, err := store.Snapshot(ctx)
	if err != nil {
		t.Fatal(err)
	}
	var assignments int
	for _, item := range state.Assignments {
		if item.InternshipID == intern.ID {
			assignments++
		}
	}
	if assignments != 4 {
		t.Fatalf("new intern has %d assignments, want two per elapsed control month", assignments)
	}
}
