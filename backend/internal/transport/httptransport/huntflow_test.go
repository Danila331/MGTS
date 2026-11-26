package httptransport

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/rs/zerolog"
	"mgts/backend/internal/modules/core/usecase"
	"mgts/backend/internal/platform/huntflow"
	"mgts/backend/internal/storage/memory"
)

type huntflowTransportFunc func(*http.Request) (*http.Response, error)

func (f huntflowTransportFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return f(request)
}

func TestHuntflowCandidateLink(t *testing.T) {
	const path = "/api/v1/interns/internship-01/candidate"
	const applicant = "/v2/accounts/42/applicants/101"
	const privateValue = "ats-private-test-data"
	store := memory.New(memory.Seed())
	service := usecase.New(store)
	requests := 0
	client := huntflow.Client{
		Token: "test-token", AccountID: 42, WebURL: "https://huntflow.ru/my/test-workspace",
		Transport: huntflowTransportFunc(func(req *http.Request) (*http.Response, error) {
			requests++
			if req.Method != http.MethodGet || req.URL.Scheme != "https" || req.URL.Host != "api.huntflow.ru" ||
				req.Header.Get("Authorization") != "Bearer test-token" || req.Header.Get("Accept") != "application/json" {
				t.Fatalf("unexpected outgoing request: %v", req)
			}
			var body string
			status := http.StatusOK
			switch req.URL.RequestURI() {
			case applicant:
				body = `{"id":101,"account":42,"position":"Разработчик","first_name":"` + privateValue + `","external":[{"id":59}],"links":[
					{"vacancy":8,"updated":"2026-11-02T09:00:00+03:00"},
					{"vacancy":7,"updated":"2026-11-03T09:00:00+03:00"}
				]}`
			case applicant + "/logs?count=10&page=1":
				body = `{"page":1,"count":3,"total_pages":1,"items":[{"comment":"` + privateValue + `"},{"comment":null},{"comment":" "}]}`
			case "/v2/accounts/42/applicants/102":
				status, body = http.StatusTooManyRequests, `{"error":"`+privateValue+`"}`
			default:
				t.Fatalf("unexpected API path: %s", req.URL.RequestURI())
			}
			return &http.Response{StatusCode: status, Body: io.NopCloser(strings.NewReader(body))}, nil
		}),
	}
	e := NewServer(service, zerolog.Nop(), "test", 8080, ServerOptions{Candidate: client}).Echo()
	for _, actor := range []string{"", "Н-001", "СТ-001", "actor-manager"} {
		want := http.StatusForbidden
		if actor == "" {
			want = http.StatusUnauthorized
		}
		rec, body := request(t, e, http.MethodPut, path, actor, map[string]int{"candidate_id": 101})
		expectStatus(t, rec, want, body)
		rec, body = request(t, e, http.MethodGet, path, actor, nil)
		expectStatus(t, rec, want, body)
	}
	rec, body := request(t, e, http.MethodGet, path, "actor-hr", nil)
	expectStatus(t, rec, http.StatusOK, body)
	if body["profile"] != nil || requests != 0 {
		t.Fatalf("unlinked record should make no provider requests: %v, %d calls", body, requests)
	}
	rec, body = request(t, e, http.MethodPut, path, "actor-hr", map[string]int{"candidate_id": 101})
	expectStatus(t, rec, http.StatusOK, body)
	profile := body["profile"].(map[string]any)
	if number(profile, "id") != 101 || number(profile, "recent_feedback") != 1 || profile["position"] != "Разработчик" ||
		profile["url"] != "https://huntflow.ru/my/test-workspace#vacancy/7/filter/workon/id/101" ||
		strings.Contains(rec.Body.String(), privateValue) || requests != 2 {
		t.Fatalf("unexpected provider projection: %v, %d calls", profile, requests)
	}
	rec, body = request(t, e, http.MethodPut, path, "actor-hr", map[string]int{"candidate_id": 102})
	expectStatus(t, rec, http.StatusServiceUnavailable, body)
	if strings.Contains(rec.Body.String(), privateValue) {
		t.Fatal("provider response must stay out of error payload")
	}
	rec, body = request(t, e, http.MethodGet, path, "actor-hr", nil)
	expectStatus(t, rec, http.StatusOK, body)
	if number(body["profile"].(map[string]any), "id") != 101 || requests != 5 {
		t.Fatalf("failed relink must keep the linked ID: %v, %d calls", body, requests)
	}
	rec, body = request(t, e, http.MethodPut, path, "actor-hr", map[string]int{"candidate_id": 101})
	expectStatus(t, rec, http.StatusOK, body)
	linkedState, err := store.Snapshot(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	linkedJSON, err := json.Marshal(linkedState)
	if err != nil {
		t.Fatal(err)
	}
	if linkedState.CandidateLinks["internship-01"] != 101 || strings.Contains(string(linkedJSON), privateValue) {
		t.Fatal("provider data beyond the candidate ID must stay out of persisted state")
	}
	rec, body = request(t, e, http.MethodPut, path, "actor-hr", map[string]int{"candidate_id": 0})
	expectStatus(t, rec, http.StatusOK, body)
	if body["profile"] != nil || requests != 7 {
		t.Fatalf("unlink should update local state only: %v, %d calls", body, requests)
	}
	snapshot, err := store.Snapshot(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(snapshot.CandidateLinks) != 0 {
		t.Fatal("candidate still linked after unlink")
	}
	entries := 0
	for _, entry := range snapshot.Journal {
		if entry.IntegrationID == "huntflow" {
			entries++
		}
	}
	if entries != 2 {
		t.Fatalf("want one audit entry per successful change, got %d", entries)
	}
}
