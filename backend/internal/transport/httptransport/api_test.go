package httptransport

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/rs/zerolog"
	"mgts/backend/internal/modules/core/usecase"
	"mgts/backend/internal/storage/memory"
)

func testAPI() (*echo.Echo, *usecase.Service) {
	store := memory.New(memory.Seed())
	service := usecase.New(store)
	server := NewServer(service, zerolog.Nop(), "test", 8080)
	return server.Echo(), service
}

func request(t *testing.T, e *echo.Echo, method, path, actorID string, body any) (*httptest.ResponseRecorder, map[string]any) {
	t.Helper()
	var reader *bytes.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
		reader = bytes.NewReader(data)
	} else {
		reader = bytes.NewReader(nil)
	}
	req := httptest.NewRequest(method, path, reader)
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	if actorID != "" {
		req.Header.Set("X-Actor-ID", actorID)
	}
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	result := map[string]any{}
	if len(rec.Body.Bytes()) > 0 {
		if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
			t.Fatalf("invalid JSON %s: %v", rec.Body.String(), err)
		}
	}
	return rec, result
}

func expectStatus(t *testing.T, rec *httptest.ResponseRecorder, want int, body map[string]any) {
	t.Helper()
	if rec.Code != want {
		t.Fatalf("status=%d want=%d body=%v", rec.Code, want, body)
	}
}

func items(body map[string]any) []any            { result, _ := body["items"].([]any); return result }
func number(body map[string]any, key string) int { value, _ := body[key].(float64); return int(value) }

func TestRBACScopes(t *testing.T) {
	e, _ := testAPI()
	for _, test := range []struct {
		actor string
		want  int
	}{{"actor-hr", 5}, {"actor-manager", 5}, {"Н-001", 1}, {"СТ-001", 1}} {
		t.Run(test.actor, func(t *testing.T) {
			rec, body := request(t, e, http.MethodGet, "/api/v1/interns", test.actor, nil)
			expectStatus(t, rec, 200, body)
			if got := number(body, "total"); got != test.want {
				t.Fatalf("total=%d want=%d", got, test.want)
			}
		})
	}
	for _, test := range []struct {
		actor, path string
		want        int
	}{
		{"actor-manager", "/api/v1/interns/internship-02", 200},
		{"Н-002", "/api/v1/interns/internship-02", 200},
		{"Н-001", "/api/v1/interns/internship-02", 403},
		{"СТ-001", "/api/v1/interns/internship-02", 403},
		{"СТ-001", "/api/v1/dashboard", 403},
		{"СТ-001", "/api/v1/me", 200},
		{"unknown", "/api/v1/interns", 401},
	} {
		rec, body := request(t, e, http.MethodGet, test.path, test.actor, nil)
		expectStatus(t, rec, test.want, body)
	}
}

func TestDashboardAndInternMetricsContract(t *testing.T) {
	e, _ := testAPI()
	rec, body := request(t, e, http.MethodGet, "/api/v1/dashboard", "actor-manager", nil)
	expectStatus(t, rec, 200, body)
	if len(items(body)) != 5 || body["averages"] == nil {
		t.Fatalf("dashboard items/averages missing: %v", body)
	}
	coverage := body["coverage"].(map[string]any)
	if coverage["invited"] != float64(60) || coverage["submitted"] != float64(60) || coverage["percent"] != float64(100) {
		t.Fatalf("unexpected coverage: %v", coverage)
	}
	if _, exists := body["attention_signals"]; exists {
		t.Fatal("legacy signals leaked into dashboard")
	}
	for _, raw := range items(body) {
		item := raw.(map[string]any)
		for _, key := range []string{"latest_score", "overall_score", "cohort_average", "percentile_min", "percentile_max", "percentile_label", "traffic_light", "department", "current_period"} {
			if _, exists := item[key]; !exists {
				t.Fatalf("dashboard item misses %s: %v", key, item)
			}
		}
		if _, exists := item["percentile"]; exists {
			t.Fatal("exact percentile leaked")
		}
	}

	rec, body = request(t, e, http.MethodGet, "/api/v1/interns?department=IT&sort=score", "actor-hr", nil)
	expectStatus(t, rec, 200, body)
	if number(body, "total") != 1 || items(body)[0].(map[string]any)["department"] != "IT" {
		t.Fatalf("department filter failed: %v", body)
	}
	rec, body = request(t, e, http.MethodGet, "/api/v1/interns?search=СТ-003&sort=percentile", "actor-hr", nil)
	expectStatus(t, rec, 200, body)
	if number(body, "total") != 1 || items(body)[0].(map[string]any)["percentile_label"] != "0–20" {
		t.Fatalf("search/percentile failed: %v", body)
	}
}

func TestInternshipDetailIncludesMentorFeedbackAndRoleTrends(t *testing.T) {
	e, _ := testAPI()
	rec, body := request(t, e, http.MethodGet, "/api/v1/interns/internship-01", "СТ-001", nil)
	expectStatus(t, rec, 200, body)
	responses, _ := body["responses"].([]any)
	if len(responses) != 12 {
		t.Fatalf("responses=%d, want own 6 + mentor 6", len(responses))
	}
	for _, raw := range responses {
		response := raw.(map[string]any)
		respondent := response["respondent_id"]
		if respondent != "СТ-001" && respondent != "Н-001" {
			t.Fatalf("unrelated respondent leaked: %v", response)
		}
	}
	trends, _ := body["trends"].([]any)
	if len(trends) != 13 {
		t.Fatalf("trends=%d, want 7 intern + 6 mentor", len(trends))
	}
	roles := map[string]int{}
	for _, raw := range trends {
		trend := raw.(map[string]any)
		roles[trend["role"].(string)]++
		if len(trend["points"].([]any)) != 6 {
			t.Fatalf("trend does not contain six periods: %v", trend)
		}
	}
	if roles["intern"] != 7 || roles["mentor"] != 6 {
		t.Fatalf("role trends=%v", roles)
	}
	internship := body["internship"].(map[string]any)
	if internship["percentile_label"] != "60–80" || body["percentile_label"] != "60–80" || body["current_period"] != "Месяц 6" {
		t.Fatalf("detail metrics missing: %v", body)
	}
	for _, legacy := range []string{"signals", "actions", "feedback", "reviews", "development"} {
		if _, exists := body[legacy]; exists {
			t.Fatalf("legacy %s leaked into detail", legacy)
		}
	}
}

func TestSurveyDraftSubmitAndWebhookIdempotency(t *testing.T) {
	e, _ := testAPI()
	create := map[string]any{
		"title": "Новый пульс", "audience": "intern", "period": "Месяц 7", "wave": 7,
		"questions": []any{
			map[string]any{"id": "score", "type": "scale", "title": "Оценка", "required": true, "dimension": "score", "min": 1, "max": 5},
			map[string]any{"id": "comment", "type": "text", "title": "Комментарий", "required": true},
		},
	}
	rec, body := request(t, e, http.MethodPost, "/api/v1/surveys", "actor-hr", create)
	expectStatus(t, rec, 201, body)
	surveyID := body["id"].(string)
	rec, body = request(t, e, http.MethodPost, "/api/v1/surveys/"+surveyID+"/publish", "actor-hr", nil)
	expectStatus(t, rec, 200, body)
	rec, body = request(t, e, http.MethodPost, "/api/v1/surveys/"+surveyID+"/assign", "actor-hr", map[string]any{"internship_ids": []string{"internship-02"}})
	expectStatus(t, rec, 200, body)
	rec, body = request(t, e, http.MethodPut, "/api/v1/surveys/"+surveyID+"/draft?internship_id=internship-02", "СТ-002", map[string]any{"answers": map[string]any{"score": 4}})
	expectStatus(t, rec, 200, body)
	rec, body = request(t, e, http.MethodGet, "/api/v1/surveys/"+surveyID+"/take?internship_id=internship-02", "СТ-002", nil)
	expectStatus(t, rec, 200, body)
	if body["draft"] == nil {
		t.Fatal("draft not returned")
	}
	rec, body = request(t, e, http.MethodPost, "/api/v1/surveys/"+surveyID+"/submit?internship_id=internship-02", "СТ-002", map[string]any{"answers": map[string]any{"score": 4, "comment": "Готово"}})
	expectStatus(t, rec, 200, body)
	if body["status"] != "submitted" {
		t.Fatalf("submit failed: %v", body)
	}

	payload := map[string]any{
		"external_id": "external-test-1", "survey_id": "survey-intern-2", "internship_id": "internship-01", "respondent_id": "СТ-001", "version": 1,
		"answers": map[string]any{
			"intern_clarity": 4, "intern_support": 4, "intern_workload": 4, "intern_interest": 4,
			"intern_growth": 4, "intern_team": 4, "intern_satisfaction": 4,
			"intern_difficulties": "Внешний ответ", "intern_blockers": "Нет",
		},
	}
	rec, first := request(t, e, http.MethodPost, "/api/v1/integrations/surveys/webhook", "", payload)
	expectStatus(t, rec, 200, first)
	if first["duplicate"] != false {
		t.Fatal("first import marked duplicate")
	}
	rec, second := request(t, e, http.MethodPost, "/api/v1/integrations/surveys/webhook", "", payload)
	expectStatus(t, rec, 200, second)
	if second["duplicate"] != true {
		t.Fatal("second import not idempotent")
	}
}
