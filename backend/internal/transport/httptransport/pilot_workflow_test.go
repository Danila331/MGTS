package httptransport

import (
	"context"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/rs/zerolog"
	analytics "mgts/backend/internal/modules/analytics/usecase"
	"mgts/backend/internal/modules/core/domain"
	"mgts/backend/internal/modules/core/usecase"
	"mgts/backend/internal/storage/memory"
)

func TestPilotSurveyRemindersScopeAndLifecycle(t *testing.T) {
	ctx := context.Background()
	state := memory.Seed()
	store := memory.New(state)
	service := usecase.New(store)
	server := NewServer(service, zerolog.Nop(), "test", 8080).Echo()
	first, err := service.CreateIntern(ctx, "actor-hr", usecase.NewIntern{
		Name: "Тестовый Участник", TeamID: "department-01", MentorID: "Н-001",
	})
	if err != nil {
		t.Fatal(err)
	}
	submit := func(respondent, survey string) {
		t.Helper()
		answers := map[string]any{}
		for _, question := range state.Surveys[survey].Questions {
			if question.Type == "scale" {
				answers[question.ID] = 5
			} else {
				answers[question.ID] = "Тестовый ответ."
			}
		}
		if _, err := service.SubmitSurvey(ctx, respondent, survey, first.ID, answers); err != nil {
			t.Fatal(err)
		}
	}
	submit(first.Intern.ID, "survey-intern-1")
	payload := map[string]any{"internship_id": first.ID, "wave": 1}
	const path = "/api/v1/survey-reminders"
	rec, body := request(t, server, http.MethodPost, path, "actor-manager", payload)
	expectStatus(t, rec, http.StatusForbidden, body)
	for _, want := range []float64{1, 0} {
		rec, body = request(t, server, http.MethodPost, path, "actor-hr", payload)
		expectStatus(t, rec, http.StatusOK, body)
		if body["sent"] != want {
			t.Fatalf("want %v notification(s), got %v", want, body)
		}
	}
	for _, id := range []string{first.Intern.ID, "Н-002", "actor-hr"} {
		rec, body = request(t, server, http.MethodGet, path, id, nil)
		expectStatus(t, rec, http.StatusOK, body)
		if len(items(body)) != 0 {
			t.Fatalf("reminder disclosed to %s: %v", id, body)
		}
	}
	rec, body = request(t, server, http.MethodGet, path, "Н-001", nil)
	expectStatus(t, rec, http.StatusOK, body)
	if len(items(body)) != 1 {
		t.Fatalf("one scoped reminder expected: %v", body)
	}
	item := items(body)[0].(map[string]any)
	if item["internship_id"] != first.ID || item["survey_id"] != "survey-mentor-1" {
		t.Fatalf("reminder did not identify the personal assignment: %v", item)
	}
	submit("Н-001", "survey-mentor-1")
	rec, body = request(t, server, http.MethodGet, path, "Н-001", nil)
	expectStatus(t, rec, http.StatusOK, body)
	if len(items(body)) != 0 {
		t.Fatalf("reminder persisted after answered assignment: %v", body)
	}

	second, err := service.CreateIntern(ctx, "actor-hr", usecase.NewIntern{
		Name: "Второй Участник", TeamID: "department-01", MentorID: "Н-002",
	})
	if err != nil {
		t.Fatal(err)
	}
	err = store.Update(ctx, func(state *domain.State) error {
		for id, assignment := range state.Assignments {
			if assignment.InternshipID == second.ID && assignment.RespondentID == second.Intern.ID {
				assignment.DueAt = domain.Now().Add(24 * time.Hour)
				state.Assignments[id] = assignment
			}
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []int{1, 0} {
		got, err := service.ProcessNotifications(ctx)
		if err != nil || got != want {
			t.Fatalf("automatic notifications: got %d, want %d, error %v", got, want, err)
		}
	}
	rec, body = request(t, server, http.MethodGet, path, second.Intern.ID, nil)
	expectStatus(t, rec, http.StatusOK, body)
	if len(items(body)) != 1 {
		t.Fatalf("due-soon personal assignment was not reminded: %v", body)
	}
}

func TestPilotFinalRecapAndConfidentialHRContact(t *testing.T) {
	ctx := context.Background()
	server, service := testAPI()
	internship, err := service.CreateIntern(ctx, "actor-hr", usecase.NewIntern{
		Name: "Тестовый Участник", TeamID: "department-01", MentorID: "Н-001",
	})
	if err != nil {
		t.Fatal(err)
	}
	const hr, manager = "actor-hr", "actor-manager"
	const recapPath = "/api/v1/interns/internship-01/final-recap"
	rec, body := request(t, server, http.MethodGet, "/api/v1/interns/"+internship.ID+"/final-recap", hr, nil)
	expectStatus(t, rec, http.StatusOK, body)
	if body["available"] != false {
		t.Fatalf("new participant had a final recap: %v", body)
	}
	rec, body = request(t, server, http.MethodGet, recapPath, manager, nil)
	expectStatus(t, rec, http.StatusForbidden, body)
	rec, body = request(t, server, http.MethodGet, recapPath, hr, nil)
	expectStatus(t, rec, http.StatusOK, body)
	initial, ok := body["recap"].(map[string]any)
	if !ok || body["available"] != true || !strings.Contains(initial["progress"].(string), "12 из 12") {
		t.Fatalf("expected computed six-wave recap: %v", body)
	}
	draft := map[string]any{"progress": "Проверенная динамика", "open_questions": "Обсудить организацию работы", "next_steps": "Встреча с наставником", "version": 0}
	rec, body = request(t, server, http.MethodPut, recapPath, hr, draft)
	expectStatus(t, rec, http.StatusOK, body)
	rec, body = request(t, server, http.MethodPut, recapPath, hr, draft)
	expectStatus(t, rec, http.StatusConflict, body)
	rec, body = request(t, server, http.MethodGet, recapPath, hr, nil)
	expectStatus(t, rec, http.StatusOK, body)
	if saved := body["recap"].(map[string]any); saved["progress"] != draft["progress"] || saved["version"] != float64(1) {
		t.Fatalf("edited recap not retained: %v", body)
	}

	const contactPath = "/api/v1/hr-contacts"
	message := map[string]any{"survey_id": "survey-intern-1", "internship_id": internship.ID, "message": "Отдельное тестовое обращение."}
	rec, body = request(t, server, http.MethodPost, contactPath, "СТ-002", message)
	expectStatus(t, rec, http.StatusForbidden, body)
	rec, body = request(t, server, http.MethodPost, contactPath, internship.Intern.ID, message)
	expectStatus(t, rec, http.StatusCreated, body)
	rec, body = request(t, server, http.MethodGet, contactPath, "Н-001", nil)
	expectStatus(t, rec, http.StatusForbidden, body)
	rec, body = request(t, server, http.MethodGet, contactPath, manager, nil)
	expectStatus(t, rec, http.StatusForbidden, body)
	rec, body = request(t, server, http.MethodGet, contactPath, hr, nil)
	expectStatus(t, rec, http.StatusOK, body)
	if len(items(body)) != 1 || items(body)[0].(map[string]any)["message"] != message["message"] {
		t.Fatalf("expected exactly one HR message: %v", body)
	}
	rec, body = request(t, server, http.MethodGet, "/api/v1/interns/"+internship.ID, "Н-001", nil)
	expectStatus(t, rec, http.StatusOK, body)
	if len(body["responses"].([]any)) != 0 {
		t.Fatalf("private contact appeared as a survey answer: %v", body)
	}
}

type sampleCommentAdvisor struct{ text string }

func (*sampleCommentAdvisor) Name() string    { return "pilot-advice-test" }
func (*sampleCommentAdvisor) Version() string { return "v1" }
func (*sampleCommentAdvisor) Analyze(context.Context, analytics.PulseHistory) (*domain.SurveySummary, error) {
	return nil, nil
}
func (a *sampleCommentAdvisor) MentorCommentAdvice(_ context.Context, text string) ([]string, error) {
	a.text = text
	return []string{"Какая конкретная задача показывает самостоятельность?"}, nil
}

func TestPilotMentorCommentAdviceIsScopedAndDoesNotWrite(t *testing.T) {
	ctx := context.Background()
	state := memory.Seed()
	store := memory.New(state)
	svc := usecase.New(store)
	server := NewServer(svc, zerolog.Nop(), "test", 8080).Echo()
	const surveyID = "survey-mentor-1"
	path := "/api/v1/surveys/" + surveyID + "/comment-advice?internship_id=internship-01"
	var questionID string
	for _, question := range state.Surveys[surveyID].Questions {
		if question.Type == "text" {
			questionID = question.ID
			break
		}
	}
	payload := map[string]any{"question_id": questionID, "text": "Мало самостоятельности."}
	rec, body := request(t, server, http.MethodPost, path, "Н-002", payload)
	expectStatus(t, rec, http.StatusForbidden, body)
	rec, body = request(t, server, http.MethodPost, path, "Н-001", payload)
	expectStatus(t, rec, http.StatusOK, body)
	if body["source"] != "template" {
		t.Fatalf("fallback must have an explicit source: %v", body)
	}
	advisor := &sampleCommentAdvisor{}
	svc.SetSurveyAnalyzer(advisor)
	rec, body = request(t, server, http.MethodPost, path, "Н-001", payload)
	expectStatus(t, rec, http.StatusOK, body)
	if body["source"] != "ai" || advisor.text != payload["text"] {
		t.Fatalf("configured provider was not used: %v", body)
	}
	after, err := store.Snapshot(ctx)
	if err != nil || after.Revision != state.Revision {
		t.Fatalf("advice must not mutate survey state: %v %v", after.Revision, err)
	}
}
