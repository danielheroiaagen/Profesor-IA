package progress

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRegisterAwardRecordsValidEvidence(t *testing.T) {
	t.Parallel()

	recorder := &fakeAwardRecorder{inserted: true}
	handler := NewHandler(recorder)
	response := httptest.NewRecorder()
	request := awardHTTPPost(`{
		"attemptId":"attempt-1",
		"userId":"user-1",
		"evidence":{"verified":true,"learnerTurns":1,"feedbacks":1,"interrupted":false}
	}`)

	handler.RegisterAward(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, response.Code)
	}
	if !recorder.called {
		t.Fatal("expected recorder call")
	}
	if recorder.record.AttemptID != "attempt-1" {
		t.Fatalf("expected attempt-1, got %q", recorder.record.AttemptID)
	}
	if recorder.record.Identity.UserID != "user-1" {
		t.Fatalf("expected user-1, got %q", recorder.record.Identity.UserID)
	}
	if recorder.record.Decision.XP != LessonCompletionXP {
		t.Fatalf("expected %d XP, got %d", LessonCompletionXP, recorder.record.Decision.XP)
	}

	var body awardResponse
	decodeJSON(t, response, &body)
	if !body.Awarded || !body.Inserted || body.XP != LessonCompletionXP || body.Reason != "lesson_completed" {
		t.Fatalf("unexpected award response: %+v", body)
	}
}

func TestRegisterAwardSkipsDeniedEvidence(t *testing.T) {
	t.Parallel()

	recorder := &fakeAwardRecorder{inserted: true}
	handler := NewHandler(recorder)
	response := httptest.NewRecorder()
	request := awardHTTPPost(`{
		"attemptId":"attempt-1",
		"userId":"user-1",
		"evidence":{"verified":true,"learnerTurns":1,"feedbacks":0,"interrupted":false}
	}`)

	handler.RegisterAward(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, response.Code)
	}
	if recorder.called {
		t.Fatal("expected denied evidence to skip recorder")
	}

	var body awardResponse
	decodeJSON(t, response, &body)
	if body.Awarded || body.Inserted || body.XP != 0 || body.Reason != "missing_feedback" {
		t.Fatalf("unexpected denied response: %+v", body)
	}
}

func TestRegisterAwardReturnsUnavailableWhenRecorderMissing(t *testing.T) {
	t.Parallel()

	handler := NewHandler(nil)
	response := httptest.NewRecorder()
	request := awardHTTPPost(`{
		"attemptId":"attempt-1",
		"userId":"user-1",
		"evidence":{"verified":true,"learnerTurns":1,"feedbacks":1,"interrupted":false}
	}`)

	handler.RegisterAward(response, request)

	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status %d, got %d", http.StatusServiceUnavailable, response.Code)
	}
	assertErrorResponse(t, response, "progress_awards_unavailable")
}

func TestRegisterAwardRejectsInvalidJSON(t *testing.T) {
	t.Parallel()

	handler := NewHandler(&fakeAwardRecorder{})
	response := httptest.NewRecorder()
	request := awardHTTPPost(`{"attemptId":`)

	handler.RegisterAward(response, request)

	if response.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, response.Code)
	}
	assertErrorResponse(t, response, "invalid_request")
}

func TestRegisterAwardRejectsInvalidAwardRequest(t *testing.T) {
	t.Parallel()

	handler := NewHandler(&fakeAwardRecorder{err: ErrInvalidAwardIdentity})
	response := httptest.NewRecorder()
	request := awardHTTPPost(`{
		"attemptId":"attempt-1",
		"userId":"user-1",
		"anonymousProgressId":"anonymous-1",
		"evidence":{"verified":true,"learnerTurns":1,"feedbacks":1,"interrupted":false}
	}`)

	handler.RegisterAward(response, request)

	if response.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, response.Code)
	}
	assertErrorResponse(t, response, "invalid_award_request")
}

func TestRegisterAwardHidesRecorderErrors(t *testing.T) {
	t.Parallel()

	handler := NewHandler(&fakeAwardRecorder{err: errors.New("postgres://secret@localhost")})
	response := httptest.NewRecorder()
	request := awardHTTPPost(`{
		"attemptId":"attempt-1",
		"userId":"user-1",
		"evidence":{"verified":true,"learnerTurns":1,"feedbacks":1,"interrupted":false}
	}`)

	handler.RegisterAward(response, request)

	if response.Code != http.StatusInternalServerError {
		t.Fatalf("expected status %d, got %d", http.StatusInternalServerError, response.Code)
	}
	assertErrorResponse(t, response, "progress_award_failed")
}

func TestRegisterAwardRejectsUnsupportedMethod(t *testing.T) {
	t.Parallel()

	handler := NewHandler(&fakeAwardRecorder{})
	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/v1/progress/awards", nil)

	handler.RegisterAward(response, request)

	if response.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected status %d, got %d", http.StatusMethodNotAllowed, response.Code)
	}
	assertErrorResponse(t, response, "method_not_allowed")
}

func awardHTTPPost(body string) *http.Request {
	return httptest.NewRequest(http.MethodPost, "/v1/progress/awards", bytes.NewBufferString(body))
}

func decodeJSON[T any](t *testing.T, response *httptest.ResponseRecorder, body *T) {
	t.Helper()

	if err := json.NewDecoder(response.Body).Decode(body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
}

func assertErrorResponse(t *testing.T, response *httptest.ResponseRecorder, code string) {
	t.Helper()

	var body errorResponse
	decodeJSON(t, response, &body)
	if body.Error != code {
		t.Fatalf("expected error %q, got %q", code, body.Error)
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
