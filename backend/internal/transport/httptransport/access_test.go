package httptransport

import (
	"crypto/rand"
	"crypto/rsa"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/rs/zerolog"
	"mgts/backend/internal/modules/core/domain"
	"mgts/backend/internal/modules/core/usecase"
	"mgts/backend/internal/storage/memory"
)

func TestProductionUsesVerifiedIdentityAndProtectsMutations(t *testing.T) {
	const issuer, audience, origin = "https://identity.example", "pulse", "https://pulse.example"
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	state := memory.Seed()
	state.IdentitySubjects["intern-subject"] = "СТ-001"
	state.IdentitySubjects["hr-subject"] = "actor-hr"
	service := usecase.New(memory.New(state))
	server := NewServer(service, zerolog.Nop(), "test", 8080,
		ServerOptions{Auth: &JWTAuth{PublicKey: &key.PublicKey, Issuer: issuer, Audience: audience, Origin: origin}}).Echo()
	token := func(subject, aud string, expiry time.Time) string {
		t.Helper()
		signed, err := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.RegisteredClaims{
			Issuer: issuer, Subject: subject, Audience: jwt.ClaimStrings{aud}, ExpiresAt: jwt.NewNumericDate(expiry),
		}).SignedString(key)
		if err != nil {
			t.Fatal(err)
		}
		return signed
	}
	intern := token("intern-subject", audience, time.Now().Add(time.Hour))
	hr := token("hr-subject", audience, time.Now().Add(time.Hour))
	call := func(method, path, bearer, requestOrigin string, expected int) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, path+"?actor_id=actor-hr", strings.NewReader(`{"status":"in_progress","note":"План разговора"}`))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Actor-ID", "actor-hr")
		if bearer != "" {
			req.Header.Set("Authorization", "Bearer "+bearer)
		}
		if requestOrigin != "" {
			req.Header.Set("Origin", requestOrigin)
		}
		rec := httptest.NewRecorder()
		server.ServeHTTP(rec, req)
		if rec.Code != expected {
			t.Fatalf("%s %s status=%d want=%d body=%s", method, path, rec.Code, expected, rec.Body.String())
		}
		return rec
	}
	call(http.MethodGet, "/api/v1/actors", "", "", 401)
	call(http.MethodGet, "/api/v1/actors", token("intern-subject", "another-app", time.Now().Add(time.Hour)), "", 401)
	call(http.MethodGet, "/api/v1/actors", token("intern-subject", audience, time.Now().Add(-time.Hour)), "", 401)
	resp := call(http.MethodGet, "/api/v1/actors", intern, "", 200)
	var actors struct {
		Items []domain.Actor `json:"items"`
		Demo  bool           `json:"demo"`
	}
	if err := json.Unmarshal(resp.Body.Bytes(), &actors); err != nil || actors.Demo || len(actors.Items) != 1 || actors.Items[0].ID != "СТ-001" {
		t.Fatalf("actor override accepted or role list exposed: %s", resp.Body.String())
	}
	call(http.MethodGet, "/api/v1/dashboard", intern, "", 403)
	call(http.MethodPut, "/api/v1/interns/internship-01/follow-up", hr, "https://other.example", 403)
	call(http.MethodPut, "/api/v1/interns/internship-01/follow-up", intern, origin, 403)
	call(http.MethodPut, "/api/v1/interns/internship-01/follow-up", hr, origin, 200)
	call(http.MethodPost, "/api/v1/integrations/surveys/webhook", hr, origin, 404)
}
