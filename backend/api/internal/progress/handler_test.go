package progress

import (
	"bytes"
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

const validAwardJSON = `{
	"attemptId":"attempt-1",
	"anonymousProgressId":"anonymous-1",
	"evidence":{"verified":true,"learnerTurns":1,"feedbacks":1,"interrupted":false}
}`

func TestRegisterAwardRecordsValidEvidence(t *testing.T) {
	t.Parallel()

	recorder := &fakeAwardRecorder{inserted: true}
	response := postAward(t, NewHandler(recorder), validAwardJSON)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, response.Code)
	}
	if !recorder.called {
		t.Fatal("expected recorder call")
	}
	if recorder.record.AttemptID != "attempt-1" || recorder.record.Identity.AnonymousProgressID != "anonymous-1" {
		t.Fatalf("unexpected record: %+v", recorder.record)
	}
	if recorder.record.Decision.XP != LessonCompletionXP {
		t.Fatalf("expected %d XP, got %d", LessonCompletionXP, recorder.record.Decision.XP)
	}
	assertBodyContains(t, response, `"awarded":true`, `"xp":50`, `"reason":"lesson_completed"`, `"inserted":true`)
}

func TestRegisterAwardUsesSessionIdentity(t *testing.T) {
	t.Parallel()

	recorder := &fakeAwardRecorder{inserted: true}
	resolver := &fakeSessionResolver{userID: "session-user"}
	handler := NewHandlerWithSessions(recorder, resolver, "profesor-ia.session")
	request := newAwardRequest(http.MethodPost, validAwardJSON)
	request.AddCookie(&http.Cookie{Name: "profesor-ia.session", Value: "session-token"})
	response := httptest.NewRecorder()

	handler.RegisterAward(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, response.Code)
	}
	if resolver.token != "session-token" {
		t.Fatalf("expected session resolver token, got %q", resolver.token)
	}
	if recorder.record.Identity.UserID != "session-user" || recorder.record.Identity.AnonymousProgressID != "" {
		t.Fatalf("expected session identity to replace request identity, got %+v", recorder.record.Identity)
	}
}

func TestRegisterAwardRejectsBodyUserIDWithoutSession(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		handler Handler
	}{
		{"session resolver not configured", NewHandler(&fakeAwardRecorder{inserted: true})},
		{"session cookie missing", NewHandlerWithSessions(&fakeAwardRecorder{inserted: true}, &fakeSessionResolver{userID: "session-user"}, "profesor-ia.session")},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			recorder := &fakeAwardRecorder{inserted: true}
			tc.handler.awards = recorder
			response := httptest.NewRecorder()
			tc.handler.RegisterAward(response, newAwardRequest(http.MethodPost, strings.Replace(validAwardJSON, `"anonymousProgressId":"anonymous-1"`, `"userId":"user-1"`, 1)))

			if response.Code != http.StatusUnauthorized {
				t.Fatalf("expected status %d, got %d", http.StatusUnauthorized, response.Code)
			}
			if recorder.called {
				t.Fatal("expected body userId without session to skip recorder")
			}
			assertBodyContains(t, response, `"error":"invalid_session"`)
		})
	}
}

func TestRegisterAwardRejectsInvalidSession(t *testing.T) {
	t.Parallel()

	recorder := &fakeAwardRecorder{inserted: true}
	handler := NewHandlerWithSessions(recorder, &fakeSessionResolver{err: errors.New("expired")}, "profesor-ia.session")
	request := newAwardRequest(http.MethodPost, validAwardJSON)
	request.AddCookie(&http.Cookie{Name: "profesor-ia.session", Value: "expired-token"})
	response := httptest.NewRecorder()

	handler.RegisterAward(response, request)

	if response.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d", http.StatusUnauthorized, response.Code)
	}
	if recorder.called {
		t.Fatal("expected invalid session to skip recorder")
	}
	assertBodyContains(t, response, `"error":"invalid_session"`)
}

func TestRegisterAwardSkipsDeniedEvidence(t *testing.T) {
	t.Parallel()

	recorder := &fakeAwardRecorder{inserted: true}
	response := postAward(t, NewHandler(recorder), strings.Replace(validAwardJSON, `"feedbacks":1`, `"feedbacks":0`, 1))

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, response.Code)
	}
	if recorder.called {
		t.Fatal("expected denied evidence to skip recorder")
	}
	assertBodyContains(t, response, `"awarded":false`, `"xp":0`, `"reason":"missing_feedback"`)
}

func TestRegisterAwardErrors(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		handler Handler
		request *http.Request
		status  int
		code    string
	}{
		{"recorder missing", NewHandler(nil), newAwardRequest(http.MethodPost, validAwardJSON), http.StatusServiceUnavailable, "progress_awards_unavailable"},
		{"invalid json", NewHandler(&fakeAwardRecorder{}), newAwardRequest(http.MethodPost, `{"attemptId":`), http.StatusBadRequest, "invalid_request"},
		{"invalid award request", NewHandler(&fakeAwardRecorder{err: ErrInvalidAwardIdentity}), newAwardRequest(http.MethodPost, validAwardJSON), http.StatusBadRequest, "invalid_award_request"},
		{"storage error hidden", NewHandler(&fakeAwardRecorder{err: errors.New("postgres://secret@localhost")}), newAwardRequest(http.MethodPost, validAwardJSON), http.StatusInternalServerError, "progress_award_failed"},
		{"unsupported method", NewHandler(&fakeAwardRecorder{}), newAwardRequest(http.MethodGet, ""), http.StatusMethodNotAllowed, "method_not_allowed"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			response := httptest.NewRecorder()
			tc.handler.RegisterAward(response, tc.request)

			if response.Code != tc.status {
				t.Fatalf("expected status %d, got %d", tc.status, response.Code)
			}
			assertBodyContains(t, response, `"error":"`+tc.code+`"`)
		})
	}
}

func postAward(t *testing.T, handler Handler, body string) *httptest.ResponseRecorder {
	t.Helper()

	response := httptest.NewRecorder()
	handler.RegisterAward(response, newAwardRequest(http.MethodPost, body))
	return response
}

func newAwardRequest(method string, body string) *http.Request {
	return httptest.NewRequest(method, "/v1/progress/awards", bytes.NewBufferString(body))
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

type fakeAwardRecorder struct {
	called   bool
	record   AwardRecord
	inserted bool
	err      error
}

func (r *fakeAwardRecorder) RecordAward(_ context.Context, record AwardRecord) (bool, error) {
	r.called = true
	r.record = record

	return r.inserted, r.err
}

type fakeSessionResolver struct {
	userID string
	token  string
	err    error
}

func (r *fakeSessionResolver) ResolveSessionUserID(_ context.Context, token string) (string, error) {
	r.token = token
	return r.userID, r.err
}
