package server

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/danielheroiaagen/Profesor-IA/backend/api/internal/attempts"
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

func TestLoginRouteCreatesSessionCookie(t *testing.T) {
	t.Parallel()

	hash := mustPasswordHash(t)
	users := &fakeAuthUsers{user: auth.CredentialUser{ID: "user-1", Email: "teacher@example.com", PasswordHash: hash}}
	sessions := &fakeAuthSessions{}
	handler := NewHandler(Config{AuthUsers: users, AuthSessions: sessions})
	request := httptest.NewRequest(http.MethodPost, "/v1/auth/login", strings.NewReader(`{"email":"teacher@example.com","password":"correct horse battery staple"}`))
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d body=%s", http.StatusOK, response.Code, response.Body.String())
	}
	if sessions.record.UserID != "user-1" {
		t.Fatalf("expected user session, got %+v", sessions.record)
	}
	if got := response.Result().Cookies()[0].Name; got != session.CookieName {
		t.Fatalf("expected session cookie, got %q", got)
	}
}

func TestCurrentSessionRouteReturnsIdentity(t *testing.T) {
	t.Parallel()

	resolver := &fakeSessionResolver{userID: "user-1"}
	handler := NewHandler(Config{SessionResolver: resolver})
	request := httptest.NewRequest(http.MethodGet, "/v1/session/me", nil)
	request.AddCookie(&http.Cookie{Name: session.CookieName, Value: "session-token"})
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d body=%s", http.StatusOK, response.Code, response.Body.String())
	}
	if resolver.token != "session-token" {
		t.Fatalf("expected resolved session token, got %q", resolver.token)
	}
	if body := response.Body.String(); !strings.Contains(body, `"authenticated":true`) || !strings.Contains(body, `"id":"user-1"`) {
		t.Fatalf("expected current session identity, got %s", body)
	}
}

func TestStartLessonAttemptRouteCreatesAttempt(t *testing.T) {
	t.Parallel()

	starter := &fakeAttemptStarter{attempt: attempts.Attempt{ID: "attempt-1", Status: "started"}}
	handler := NewHandler(Config{AttemptStarter: starter})
	request := httptest.NewRequest(http.MethodPost, "/v1/lesson-attempts/start", strings.NewReader(`{"anonymousProgressId":"anonymous-1","legacyLessonId":"lesson-1"}`))
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusCreated {
		t.Fatalf("expected status %d, got %d body=%s", http.StatusCreated, response.Code, response.Body.String())
	}
	if starter.record.Identity.AnonymousProgressID != "anonymous-1" || starter.record.LegacyLessonID != "lesson-1" {
		t.Fatalf("unexpected attempt record: %+v", starter.record)
	}
	if body := response.Body.String(); !strings.Contains(body, `"attemptId":"attempt-1"`) || !strings.Contains(body, `"status":"started"`) {
		t.Fatalf("expected attempt response, got %s", body)
	}
}

func TestCompleteLessonAttemptRouteCompletesAttempt(t *testing.T) {
	t.Parallel()

	store := &fakeAttemptStore{completeAttempt: attempts.Attempt{ID: "attempt-1", Status: "completed"}}
	handler := NewHandler(Config{AttemptStarter: store})
	request := httptest.NewRequest(http.MethodPost, "/v1/lesson-attempts/complete", strings.NewReader(`{"attemptId":"attempt-1","anonymousProgressId":"anonymous-1"}`))
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d body=%s", http.StatusOK, response.Code, response.Body.String())
	}
	if store.completeRecord.Identity.AnonymousProgressID != "anonymous-1" || store.completeRecord.AttemptID != "attempt-1" {
		t.Fatalf("unexpected attempt record: %+v", store.completeRecord)
	}
	if body := response.Body.String(); !strings.Contains(body, `"attemptId":"attempt-1"`) || !strings.Contains(body, `"status":"completed"`) {
		t.Fatalf("expected attempt response, got %s", body)
	}
}

func TestRecordLessonEventRouteRecordsEvent(t *testing.T) {
	t.Parallel()

	store := &fakeAttemptStore{event: attempts.RecordedEvent{ID: 42}}
	handler := NewHandler(Config{AttemptStarter: store})
	request := httptest.NewRequest(http.MethodPost, "/v1/lesson-attempts/events", strings.NewReader(`{"attemptId":"attempt-1","anonymousProgressId":"anonymous-1","eventType":"learner_turn","payload":{"transcript":"hello"}}`))
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusCreated {
		t.Fatalf("expected status %d, got %d body=%s", http.StatusCreated, response.Code, response.Body.String())
	}
	if store.eventRecord.Identity.AnonymousProgressID != "anonymous-1" || store.eventRecord.AttemptID != "attempt-1" {
		t.Fatalf("unexpected event record: %+v", store.eventRecord)
	}
	if store.eventRecord.EventType != "learner_turn" {
		t.Fatalf("expected learner_turn event, got %q", store.eventRecord.EventType)
	}
	if body := response.Body.String(); !strings.Contains(body, `"eventId":42`) {
		t.Fatalf("expected event response, got %s", body)
	}
}

func TestRecordLessonFeedbackRouteRecordsFeedback(t *testing.T) {
	t.Parallel()

	store := &fakeAttemptStore{feedback: attempts.RecordedFeedback{ID: "feedback-1"}}
	handler := NewHandler(Config{AttemptStarter: store})
	request := httptest.NewRequest(http.MethodPost, "/v1/lesson-attempts/feedback", strings.NewReader(`{"attemptId":"attempt-1","anonymousProgressId":"anonymous-1","correctionText":"Use past tense.","rubricResult":{"score":3}}`))
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusCreated {
		t.Fatalf("expected status %d, got %d body=%s", http.StatusCreated, response.Code, response.Body.String())
	}
	if store.feedbackRecord.Identity.AnonymousProgressID != "anonymous-1" || store.feedbackRecord.AttemptID != "attempt-1" {
		t.Fatalf("unexpected feedback record: %+v", store.feedbackRecord)
	}
	if store.feedbackRecord.CorrectionText != "Use past tense." {
		t.Fatalf("expected correction text, got %q", store.feedbackRecord.CorrectionText)
	}
	if body := response.Body.String(); !strings.Contains(body, `"feedbackId":"feedback-1"`) {
		t.Fatalf("expected feedback response, got %s", body)
	}
}

func TestLessonAttemptHistoryRouteReturnsHistory(t *testing.T) {
	t.Parallel()

	store := &fakeAttemptStore{history: attempts.AttemptHistory{
		AttemptID: "attempt-1",
		Status:    "completed",
		Events:    []attempts.HistoryEvent{{ID: 42, EventType: "learner_turn", Payload: []byte(`{"transcript":"hello"}`), OccurredAt: "2026-05-25T10:00:00Z"}},
		Feedback:  []attempts.HistoryFeedback{{ID: "feedback-1", CorrectionText: "Use past tense.", RubricResult: []byte(`{"score":3}`), CreatedAt: "2026-05-25T10:01:00Z"}},
	}}
	handler := NewHandler(Config{AttemptStarter: store})
	request := httptest.NewRequest(http.MethodGet, "/v1/lesson-attempts/history?attemptId=attempt-1&anonymousProgressId=anonymous-1", nil)
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d body=%s", http.StatusOK, response.Code, response.Body.String())
	}
	if store.historyRecord.Identity.AnonymousProgressID != "anonymous-1" || store.historyRecord.AttemptID != "attempt-1" {
		t.Fatalf("unexpected history record: %+v", store.historyRecord)
	}
	if body := response.Body.String(); !strings.Contains(body, `"eventType":"learner_turn"`) || !strings.Contains(body, `"correctionText":"Use past tense."`) {
		t.Fatalf("expected history response, got %s", body)
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

func (u *fakeAuthUsers) FindCredentialUserByEmail(_ context.Context, _ string) (auth.CredentialUser, error) {
	return u.user, nil
}

type fakeAuthSessions struct {
	record session.SessionRecord
}

func (s *fakeAuthSessions) CreateSession(_ context.Context, record session.SessionRecord) error {
	s.record = record
	return nil
}

type fakeSessionResolver struct {
	token  string
	userID string
}

func (r *fakeSessionResolver) ResolveSessionUserID(_ context.Context, token string) (string, error) {
	r.token = token
	return r.userID, nil
}

type fakeAttemptStarter struct {
	record  attempts.StartRecord
	attempt attempts.Attempt
}

func (s *fakeAttemptStarter) StartAttempt(_ context.Context, record attempts.StartRecord) (attempts.Attempt, error) {
	s.record = record
	return s.attempt, nil
}

type fakeAttemptStore struct {
	fakeAttemptStarter
	completeRecord  attempts.CompleteRecord
	completeAttempt attempts.Attempt
	eventRecord     attempts.EventRecord
	event           attempts.RecordedEvent
	feedbackRecord  attempts.FeedbackRecord
	feedback        attempts.RecordedFeedback
	historyRecord   attempts.HistoryRecord
	history         attempts.AttemptHistory
}

func (s *fakeAttemptStore) CompleteAttempt(_ context.Context, record attempts.CompleteRecord) (attempts.Attempt, error) {
	s.completeRecord = record
	return s.completeAttempt, nil
}

func (s *fakeAttemptStore) RecordEvent(_ context.Context, record attempts.EventRecord) (attempts.RecordedEvent, error) {
	s.eventRecord = record
	return s.event, nil
}

func (s *fakeAttemptStore) RecordFeedback(_ context.Context, record attempts.FeedbackRecord) (attempts.RecordedFeedback, error) {
	s.feedbackRecord = record
	return s.feedback, nil
}

func (s *fakeAttemptStore) GetHistory(_ context.Context, record attempts.HistoryRecord) (attempts.AttemptHistory, error) {
	s.historyRecord = record
	return s.history, nil
}

func mustPasswordHash(t *testing.T) string {
	t.Helper()

	hash, err := auth.PasswordHasher{Cost: 4}.HashPassword("correct horse battery staple")
	if err != nil {
		t.Fatalf("hash password: %v", err)
	}

	return hash
}
