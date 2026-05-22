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
	"userId":"user-1",
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
	if recorder.record.AttemptID != "attempt-1" || recorder.record.Identity.UserID != "user-1" {
		t.Fatalf("unexpected record: %+v", recorder.record)
	}
	if recorder.record.Decision.XP != LessonCompletionXP {
		t.Fatalf("expected %d XP, got %d", LessonCompletionXP, recorder.record.Decision.XP)
	}
	assertBodyContains(t, response, `"awarded":true`, `"xp":50`, `"reason":"lesson_completed"`, `"inserted":true`)
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
		{
			name:    "recorder missing",
			handler: NewHandler(nil),
			request: newAwardRequest(http.MethodPost, validAwardJSON),
			status:  http.StatusServiceUnavailable,
			code:    "progress_awards_unavailable",
		},
		{
			name:    "invalid json",
			handler: NewHandler(&fakeAwardRecorder{}),
			request: newAwardRequest(http.MethodPost, `{"attemptId":`),
			status:  http.StatusBadRequest,
			code:    "invalid_request",
		},
		{
			name:    "invalid award request",
			handler: NewHandler(&fakeAwardRecorder{err: ErrInvalidAwardIdentity}),
			request: newAwardRequest(http.MethodPost, strings.Replace(validAwardJSON, `"userId":"user-1"`, `"userId":"user-1","anonymousProgressId":"anonymous-1"`, 1)),
			status:  http.StatusBadRequest,
			code:    "invalid_award_request",
		},
		{
			name:    "storage error hidden",
			handler: NewHandler(&fakeAwardRecorder{err: errors.New("postgres://secret@localhost")}),
			request: newAwardRequest(http.MethodPost, validAwardJSON),
			status:  http.StatusInternalServerError,
			code:    "progress_award_failed",
		},
		{
			name:    "unsupported method",
			handler: NewHandler(&fakeAwardRecorder{}),
			request: newAwardRequest(http.MethodGet, ""),
			status:  http.StatusMethodNotAllowed,
			code:    "method_not_allowed",
		},
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
