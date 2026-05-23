package server

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/danielheroiaagen/Profesor-IA/backend/api/internal/auth"
	"github.com/danielheroiaagen/Profesor-IA/backend/api/internal/session"
)

func TestRegisterRouteCreatesSessionCookie(t *testing.T) {
	t.Parallel()

	users := &fakeAuthUsers{user: auth.CredentialUser{ID: "user-1", Email: "teacher@example.com"}}
	sessions := &fakeAuthSessions{}
	handler := NewHandler(Config{AuthUsers: users, AuthSessions: sessions})
	request := httptest.NewRequest(http.MethodPost, "/v1/auth/register", strings.NewReader(`{"email":"teacher@example.com","password":"correct horse battery staple"}`))
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusCreated {
		t.Fatalf("expected status %d, got %d body=%s", http.StatusCreated, response.Code, response.Body.String())
	}
	if users.record.PasswordHash == "" || strings.Contains(response.Body.String(), users.record.PasswordHash) {
		t.Fatalf("expected private password hash, body=%s", response.Body.String())
	}
	if sessions.record.UserID != "user-1" {
		t.Fatalf("expected user session, got %+v", sessions.record)
	}
	if got := response.Result().Cookies()[0].Name; got != session.CookieName {
		t.Fatalf("expected session cookie, got %q", got)
	}
}

func TestHealthzReturnsServiceStatus(t *testing.T) {
	t.Parallel()

	handler := NewHandler(Config{Version: "test"})
	request := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, response.Code)
	}
	if got := response.Header().Get("Content-Type"); got != "application/json" {
		t.Fatalf("expected JSON content type, got %q", got)
	}
	if got := response.Header().Get("X-Content-Type-Options"); got != "nosniff" {
		t.Fatalf("expected nosniff header, got %q", got)
	}

	var body statusResponse
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	if body.Service != serviceName {
		t.Fatalf("expected service %q, got %q", serviceName, body.Service)
	}
	if body.Status != "ok" {
		t.Fatalf("expected status ok, got %q", body.Status)
	}
	if body.Version != "test" {
		t.Fatalf("expected version test, got %q", body.Version)
	}
}

func TestReadyzReturnsReadyWithoutExternalDependencies(t *testing.T) {
	t.Parallel()

	handler := NewHandler(Config{Version: "test"})
	request := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, response.Code)
	}

	var body statusResponse
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	if body.Status != "ready" {
		t.Fatalf("expected status ready, got %q", body.Status)
	}
	if got := body.Checks["http"]; got != "ok" {
		t.Fatalf("expected http check ok, got %q", got)
	}
	if got := body.Checks["postgres"]; got != "not_configured" {
		t.Fatalf("expected postgres not_configured, got %q", got)
	}
}

func TestReadyzReturnsReadyWhenDatabasePingPasses(t *testing.T) {
	t.Parallel()

	database := &fakeDatabasePinger{}
	handler := NewHandler(Config{Version: "test", Database: database})
	request := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, response.Code)
	}
	if !database.called {
		t.Fatal("expected database ping")
	}

	var body statusResponse
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if got := body.Checks["postgres"]; got != "ok" {
		t.Fatalf("expected postgres ok, got %q", got)
	}
}

func TestReadyzDegradesWhenDatabasePingFails(t *testing.T) {
	t.Parallel()

	database := &fakeDatabasePinger{err: errors.New("connection refused")}
	handler := NewHandler(Config{Version: "test", Database: database})
	request := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status %d, got %d", http.StatusServiceUnavailable, response.Code)
	}

	var body statusResponse
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Status != "degraded" {
		t.Fatalf("expected status degraded, got %q", body.Status)
	}
	if got := body.Checks["postgres"]; got != "unavailable" {
		t.Fatalf("expected postgres unavailable, got %q", got)
	}
}

func TestHealthEndpointsRejectUnsupportedMethods(t *testing.T) {
	t.Parallel()

	handler := NewHandler(Config{})
	request := httptest.NewRequest(http.MethodPost, "/healthz", nil)
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected status %d, got %d", http.StatusMethodNotAllowed, response.Code)
	}
}

type fakeDatabasePinger struct {
	called bool
	err    error
}

func (p *fakeDatabasePinger) Ping(context.Context) error {
	p.called = true
	return p.err
}

type fakeAuthUsers struct {
	record auth.CredentialUserRecord
	user   auth.CredentialUser
}

func (u *fakeAuthUsers) CreateCredentialUser(_ context.Context, record auth.CredentialUserRecord) (auth.CredentialUser, error) {
	u.record = record
	return u.user, nil
}

type fakeAuthSessions struct {
	record session.SessionRecord
}

func (s *fakeAuthSessions) CreateSession(_ context.Context, record session.SessionRecord) error {
	s.record = record
	return nil
}
