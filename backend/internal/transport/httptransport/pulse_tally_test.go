package httptransport

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/rs/zerolog"
	"mgts/backend/internal/modules/core/domain"
	"mgts/backend/internal/modules/core/usecase"
	"mgts/backend/internal/storage/memory"
)

func TestTallyWebhookImportsBothAssignedSurveys(t *testing.T) {
	ctx := context.Background()
	store := memory.New(memory.Seed())
	service := usecase.New(store)
	config := usecase.TallyConfig{
		Secret: "test-tally-signing-secret", InviteKey: "test-pulse-assignment-signing-key",
		InternID: "abcIntern", MentorID: "defMentor",
	}
	demo := NewServer(service, zerolog.Nop(), "test", 8080, ServerOptions{Tally: config}).Echo()
	// The provider authenticates with the Tally signature in production, without an actor JWT.
	webhook := NewServer(service, zerolog.Nop(), "test", 8080, ServerOptions{Tally: config, Auth: &JWTAuth{}}).Echo()
	internship, err := service.CreateIntern(ctx, "actor-hr", usecase.NewIntern{
		Name: "Тестовый Стажёр", TeamID: "department-01", MentorID: "Н-001",
	})
	if err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		role             domain.Role
		surveyID, formID string
		otherForm        string
		respondentID     string
		firstField       string
	}{
		{domain.RoleIntern, "survey-intern-1", config.InternID, config.MentorID, internship.Intern.ID, "Понятность задач"},
		{domain.RoleMentor, "survey-mentor-1", config.MentorID, config.InternID, internship.MentorID, "Понимание задач и ожиданий"},
	} {
		t.Run(string(tc.role), func(t *testing.T) {
			path := "/api/v1/surveys/" + tc.surveyID + "/tally-invites"
			rec, body := request(t, demo, http.MethodGet, path, tc.respondentID, nil)
			expectStatus(t, rec, http.StatusForbidden, body)
			rec, body = request(t, demo, http.MethodGet, path, "actor-hr", nil)
			expectStatus(t, rec, http.StatusOK, body)
			if len(items(body)) != 1 {
				t.Fatalf("expected one eligible invitation, got %v", body)
			}
			link, err := url.Parse(items(body)[0].(map[string]any)["url"].(string))
			if err != nil || link.Host != "tally.so" || link.Path != "/r/"+tc.formID {
				t.Fatalf("unexpected Tally link: %v, %v", link, err)
			}
			invite := link.Query().Get("pulse_invite")
			if invite == "" {
				t.Fatal("no signed invitation")
			}
			assignmentID, _, _ := strings.Cut(invite, ".")
			state, err := store.Snapshot(ctx)
			if err != nil {
				t.Fatal(err)
			}
			questions := state.Surveys[tc.surveyID].Questions
			fields := []map[string]any{
				{"label": "pulse_invite", "type": "HIDDEN_FIELDS", "value": invite},
				{"label": "", "value": nil}, {"label": "", "value": nil},
				{"label": "Иное поле", "value": nil}, {"label": "Иное поле", "value": nil},
			}
			for index, question := range questions {
				label := question.Dimension
				if index == 0 {
					label = tc.firstField
				}
				if question.Type == "scale" {
					fields = append(fields, map[string]any{"label": label, "type": "LINEAR_SCALE", "value": 5})
				} else {
					fields = append(fields, map[string]any{"label": question.Title, "type": "TEXTAREA", "value": "Нужна помощь с настройкой рабочего окружения"})
				}
			}
			submittedAt := domain.Now().Add(-time.Minute)
			payload := map[string]any{"submissionId": "submission-1", "formId": tc.formID, "createdAt": submittedAt, "fields": fields}
			rec, body = deliverTally(t, webhook, payload, "incorrect-secret")
			expectStatus(t, rec, http.StatusUnauthorized, body)
			payload["formId"] = tc.otherForm
			rec, body = deliverTally(t, webhook, payload, config.Secret)
			expectStatus(t, rec, http.StatusForbidden, body)
			payload["formId"] = tc.formID
			fields[0]["value"] = invite + "changed"
			rec, body = deliverTally(t, webhook, payload, config.Secret)
			expectStatus(t, rec, http.StatusForbidden, body)
			fields[0]["value"] = invite
			payload["fields"] = append(fields, map[string]any{"label": questions[0].Dimension, "value": 4})
			rec, body = deliverTally(t, webhook, payload, config.Secret)
			expectStatus(t, rec, http.StatusBadRequest, body)
			payload["fields"] = fields
			rec, body = deliverTally(t, webhook, payload, config.Secret)
			expectStatus(t, rec, http.StatusOK, body)
			if body["duplicate"] != false {
				t.Fatalf("unexpected first delivery: %v", body)
			}
			rec, body = deliverTally(t, webhook, payload, config.Secret)
			expectStatus(t, rec, http.StatusOK, body)
			if body["duplicate"] != true {
				t.Fatalf("retry should be idempotent: %v", body)
			}
			payload["submissionId"] = "another-submission"
			rec, body = deliverTally(t, webhook, payload, config.Secret)
			expectStatus(t, rec, http.StatusConflict, body)
			state, err = store.Snapshot(ctx)
			if err != nil {
				t.Fatal(err)
			}
			assignment := state.Assignments[assignmentID]
			if assignment.Status != "submitted" || assignment.SubmittedAt == nil || !assignment.SubmittedAt.Equal(submittedAt) {
				t.Fatalf("unexpected imported assignment: %+v", assignment)
			}
			responseID := state.Imports["tally:"+tc.formID+":submission-1:1"]
			response := state.Responses[responseID]
			if response.AssignmentID != assignmentID || response.InternshipID != internship.ID || response.Role != tc.role || response.Wave != 1 ||
				response.RespondentID != tc.respondentID || !response.CreatedAt.Equal(submittedAt) || response.Answers[questions[0].ID] != float64(5) {
				t.Fatalf("unexpected imported response: %+v", response)
			}
			if response.ID == "" || state.SurveyCoverage(tc.surveyID).Submitted != 6 {
				t.Fatal("submission did not update survey coverage")
			}
			if _, err := service.SubmitSurvey(ctx, tc.respondentID, tc.surveyID, internship.ID, response.Answers); err != nil {
				t.Fatal(err)
			}
			payload["submissionId"] = "submission-1"
			rec, body = deliverTally(t, webhook, payload, config.Secret)
			expectStatus(t, rec, http.StatusOK, body)
			if body["duplicate"] != true {
				t.Fatalf("retry after a built-in correction should be idempotent: %v", body)
			}
			state, err = store.Snapshot(ctx)
			if err != nil {
				t.Fatal(err)
			}
			if state.Responses[responseID].Status != "superseded" {
				t.Fatal("late retry undid the correction")
			}
		})
	}
	rec, body := request(t, demo, http.MethodGet, "/api/v1/interns/"+internship.ID, "actor-hr", nil)
	expectStatus(t, rec, http.StatusOK, body)
	if got := body["traffic_light"]; got != "red" {
		t.Fatalf("help-request comments should surface in HR, traffic_light=%v", got)
	}

	second, err := service.CreateIntern(ctx, "actor-hr", usecase.NewIntern{
		Name: "Другой Стажёр", TeamID: "department-01", MentorID: "Н-001",
	})
	if err != nil {
		t.Fatal(err)
	}
	now := domain.Now()
	setDue := func(dueAt time.Time) {
		t.Helper()
		if err := store.Update(ctx, func(state *domain.State) error {
			for id, assignment := range state.Assignments {
				if assignment.InternshipID == second.ID && assignment.SurveyID == "survey-intern-1" {
					assignment.DueAt = dueAt
					state.Assignments[id] = assignment
				}
			}
			return nil
		}); err != nil {
			t.Fatal(err)
		}
	}
	inviteForSecond := func() (string, time.Time) {
		t.Helper()
		rec, body := request(t, demo, http.MethodGet, "/api/v1/surveys/survey-intern-1/tally-invites", "actor-hr", nil)
		expectStatus(t, rec, http.StatusOK, body)
		if len(items(body)) != 1 {
			t.Fatalf("expected only the pending invitation, got %v", body)
		}
		item := items(body)[0].(map[string]any)
		link, err := url.Parse(item["url"].(string))
		if err != nil {
			t.Fatal(err)
		}
		deadline, err := time.Parse(time.RFC3339, item["deadline"].(string))
		if err != nil {
			t.Fatal(err)
		}
		return link.Query().Get("pulse_invite"), deadline
	}
	setDue(now.AddDate(0, 0, 60))
	invite, deadline := inviteForSecond()
	if deadline.After(now.AddDate(0, 0, 32)) {
		t.Fatalf("unbounded invite expiry: %v", deadline)
	}
	payload := map[string]any{"submissionId": "submission-1", "formId": config.InternID, "createdAt": now,
		"fields": []map[string]any{{"label": "pulse_invite", "value": invite}}}
	rec, body = deliverTally(t, webhook, payload, config.Secret)
	expectStatus(t, rec, http.StatusConflict, body)
	setDue(now.Add(time.Minute))
	invite, deadline = inviteForSecond()
	payload["createdAt"] = deadline.Add(time.Second)
	payload["fields"] = []map[string]any{{"label": "pulse_invite", "value": invite}}
	rec, body = deliverTally(t, webhook, payload, config.Secret)
	expectStatus(t, rec, http.StatusForbidden, body)
}

func deliverTally(t *testing.T, e *echo.Echo, fields map[string]any, secret string) (*httptest.ResponseRecorder, map[string]any) {
	t.Helper()
	payload, err := json.MarshalIndent(map[string]any{"eventId": "sample-event", "eventType": "FORM_RESPONSE", "data": fields}, "", " ")
	if err != nil {
		t.Fatal(err)
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/integrations/tally/webhook", bytes.NewReader(payload))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	req.Header.Set("Tally-Signature", base64.StdEncoding.EncodeToString(mac.Sum(nil)))
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	return rec, body
}
