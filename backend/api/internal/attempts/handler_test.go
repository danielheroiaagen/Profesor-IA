package attempts

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHandlerStartsAttemptWithSessionIdentity(t *testing.T) {
	t.Parallel()

	starter := &fakeStarter{attempt: Attempt{ID: "attempt-1", Status: "started"}}
	resolver := &fakeResolver{userID: "session-user"}
	handler := NewHandler(starter, resolver, "profesor-ia.session")
	request := newStartRequest(`{"anonymousProgressId":"anonymous-1","legacyLessonId":"lesson-1"}`)
	request.AddCookie(&http.Cookie{Name: "profesor-ia.session", Value: "session-token"})
	response := httptest.NewRecorder()

	handler.Start(response, request)

	if response.Code != http.StatusCreated {
		t.Fatalf("expected status %d, got %d body=%s", http.StatusCreated, response.Code, response.Body.String())
	}
	if resolver.token != "session-token" {
		t.Fatalf("expected resolver token, got %q", resolver.token)
	}
	if starter.record.Identity.UserID != "session-user" || starter.record.Identity.AnonymousProgressID != "" {
		t.Fatalf("expected session identity, got %+v", starter.record.Identity)
	}
	assertBodyContains(t, response, `"attemptId":"attempt-1"`, `"status":"started"`)
}

func TestHandlerStartsAnonymousAttempt(t *testing.T) {
	t.Parallel()

	starter := &fakeStarter{attempt: Attempt{ID: "attempt-1", Status: "started"}}
	handler := NewHandler(starter, &fakeResolver{}, "profesor-ia.session")
	response := httptest.NewRecorder()

	handler.Start(response, newStartRequest(`{"anonymousProgressId":"anonymous-1","lessonPlanId":"lesson-plan-1"}`))

	if response.Code != http.StatusCreated {
		t.Fatalf("expected status %d, got %d body=%s", http.StatusCreated, response.Code, response.Body.String())
	}
	if starter.record.Identity.AnonymousProgressID != "anonymous-1" || starter.record.LessonPlanID != "lesson-plan-1" {
		t.Fatalf("unexpected record: %+v", starter.record)
	}
}

func TestHandlerStartErrors(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		handler Handler
		request *http.Request
		status  int
		code    string
	}{
		{"starter missing", NewHandler(nil, nil, "profesor-ia.session"), newStartRequest(`{"anonymousProgressId":"anonymous-1","legacyLessonId":"lesson-1"}`), http.StatusServiceUnavailable, "lesson_attempts_unavailable"},
		{"unsupported method", NewHandler(&fakeStarter{}, nil, "profesor-ia.session"), httptest.NewRequest(http.MethodGet, "/v1/lesson-attempts/start", nil), http.StatusMethodNotAllowed, "method_not_allowed"},
		{"bad json", NewHandler(&fakeStarter{}, nil, "profesor-ia.session"), newStartRequest(`{"anonymousProgressId":`), http.StatusBadRequest, "invalid_request"},
		{"body user without session", NewHandler(&fakeStarter{}, nil, "profesor-ia.session"), newStartRequest(`{"userId":"user-1","legacyLessonId":"lesson-1"}`), http.StatusBadRequest, "invalid_attempt_identity"},
		{"invalid session", NewHandler(&fakeStarter{}, &fakeResolver{err: errors.New("expired")}, "profesor-ia.session"), startRequestWithCookie("expired-token"), http.StatusUnauthorized, "invalid_session"},
		{"missing lesson reference", NewHandler(&fakeStarter{err: ErrMissingLessonReference}, nil, "profesor-ia.session"), newStartRequest(`{"anonymousProgressId":"anonymous-1"}`), http.StatusBadRequest, "invalid_lesson_reference"},
		{"starter fails", NewHandler(&fakeStarter{err: errors.New("database unavailable")}, nil, "profesor-ia.session"), newStartRequest(`{"anonymousProgressId":"anonymous-1","legacyLessonId":"lesson-1"}`), http.StatusInternalServerError, "lesson_attempt_start_failed"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			response := httptest.NewRecorder()
			tc.handler.Start(response, tc.request)
			if response.Code != tc.status {
				t.Fatalf("expected status %d, got %d body=%s", tc.status, response.Code, response.Body.String())
			}
			assertBodyContains(t, response, `"error":"`+tc.code+`"`)
		})
	}
}

type fakeStarter struct {
	record  StartRecord
	attempt Attempt
	err     error
}

func (s *fakeStarter) StartAttempt(_ context.Context, record StartRecord) (Attempt, error) {
	s.record = record
	return s.attempt, s.err
}

type fakeResolver struct {
	token  string
	userID string
	err    error
}

func (r *fakeResolver) ResolveSessionUserID(_ context.Context, token string) (string, error) {
	r.token = token
	return r.userID, r.err
}

func newStartRequest(body string) *http.Request {
	return httptest.NewRequest(http.MethodPost, "/v1/lesson-attempts/start", strings.NewReader(body))
}

func startRequestWithCookie(token string) *http.Request {
	request := newStartRequest(`{"anonymousProgressId":"anonymous-1","legacyLessonId":"lesson-1"}`)
	request.AddCookie(&http.Cookie{Name: "profesor-ia.session", Value: token})
	return request
}

func assertBodyContains(t *testing.T, response *httptest.ResponseRecorder, snippets ...string) {
	t.Helper()

	body := response.Body.String()
	for _, snippet := range snippets {
		if !strings.Contains(body, snippet) {
			t.Fatalf("expected body %q to contain %q", body, snippet)
		}
	}
}
