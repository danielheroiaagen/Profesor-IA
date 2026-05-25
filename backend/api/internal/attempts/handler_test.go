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

	starter := &fakeAttemptStore{attempt: Attempt{ID: "attempt-1", Status: "started"}}
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

	starter := &fakeAttemptStore{attempt: Attempt{ID: "attempt-1", Status: "started"}}
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

func TestHandlerCompletesAttemptWithSessionIdentity(t *testing.T) {
	t.Parallel()

	store := &fakeAttemptStore{completeAttempt: Attempt{ID: "attempt-1", Status: "completed"}}
	resolver := &fakeResolver{userID: "session-user"}
	handler := NewHandler(store, resolver, "profesor-ia.session")
	request := newCompleteRequest(`{"attemptId":"attempt-1","anonymousProgressId":"anonymous-1"}`)
	request.AddCookie(&http.Cookie{Name: "profesor-ia.session", Value: "session-token"})
	response := httptest.NewRecorder()

	handler.Complete(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d body=%s", http.StatusOK, response.Code, response.Body.String())
	}
	if resolver.token != "session-token" {
		t.Fatalf("expected resolver token, got %q", resolver.token)
	}
	if store.completeRecord.Identity.UserID != "session-user" || store.completeRecord.Identity.AnonymousProgressID != "" {
		t.Fatalf("expected session identity, got %+v", store.completeRecord.Identity)
	}
	assertBodyContains(t, response, `"attemptId":"attempt-1"`, `"status":"completed"`)
}

func TestHandlerCompletesAnonymousAttempt(t *testing.T) {
	t.Parallel()

	store := &fakeAttemptStore{completeAttempt: Attempt{ID: "attempt-1", Status: "completed"}}
	handler := NewHandler(store, &fakeResolver{}, "profesor-ia.session")
	response := httptest.NewRecorder()

	handler.Complete(response, newCompleteRequest(`{"attemptId":"attempt-1","anonymousProgressId":"anonymous-1"}`))

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d body=%s", http.StatusOK, response.Code, response.Body.String())
	}
	if store.completeRecord.Identity.AnonymousProgressID != "anonymous-1" || store.completeRecord.AttemptID != "attempt-1" {
		t.Fatalf("unexpected record: %+v", store.completeRecord)
	}
}

func TestHandlerRecordsEventWithSessionIdentity(t *testing.T) {
	t.Parallel()

	store := &fakeAttemptStore{event: RecordedEvent{ID: 42}}
	resolver := &fakeResolver{userID: "session-user"}
	handler := NewHandler(store, resolver, "profesor-ia.session")
	request := newEventRequest(`{"attemptId":"attempt-1","anonymousProgressId":"anonymous-1","eventType":"learner_turn","payload":{"transcript":"hello"}}`)
	request.AddCookie(&http.Cookie{Name: "profesor-ia.session", Value: "session-token"})
	response := httptest.NewRecorder()

	handler.RecordEvent(response, request)

	if response.Code != http.StatusCreated {
		t.Fatalf("expected status %d, got %d body=%s", http.StatusCreated, response.Code, response.Body.String())
	}
	if resolver.token != "session-token" {
		t.Fatalf("expected resolver token, got %q", resolver.token)
	}
	if store.eventRecord.Identity.UserID != "session-user" || store.eventRecord.Identity.AnonymousProgressID != "" {
		t.Fatalf("expected session identity, got %+v", store.eventRecord.Identity)
	}
	if store.eventRecord.AttemptID != "attempt-1" || store.eventRecord.EventType != "learner_turn" {
		t.Fatalf("unexpected event record: %+v", store.eventRecord)
	}
	assertBodyContains(t, response, `"eventId":42`)
}

func TestHandlerRecordsAnonymousFeedback(t *testing.T) {
	t.Parallel()

	store := &fakeAttemptStore{feedback: RecordedFeedback{ID: "feedback-1"}}
	handler := NewHandler(store, &fakeResolver{}, "profesor-ia.session")
	response := httptest.NewRecorder()

	handler.RecordFeedback(response, newFeedbackRequest(`{"attemptId":"attempt-1","anonymousProgressId":"anonymous-1","correctionText":"Use the past tense.","rubricResult":{"score":3}}`))

	if response.Code != http.StatusCreated {
		t.Fatalf("expected status %d, got %d body=%s", http.StatusCreated, response.Code, response.Body.String())
	}
	if store.feedbackRecord.Identity.AnonymousProgressID != "anonymous-1" || store.feedbackRecord.AttemptID != "attempt-1" {
		t.Fatalf("unexpected feedback record: %+v", store.feedbackRecord)
	}
	if string(store.feedbackRecord.RubricResult) != `{"score":3}` {
		t.Fatalf("expected rubric result to be preserved, got %s", store.feedbackRecord.RubricResult)
	}
	assertBodyContains(t, response, `"feedbackId":"feedback-1"`)
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
		{"unsupported method", NewHandler(&fakeAttemptStore{}, nil, "profesor-ia.session"), httptest.NewRequest(http.MethodGet, "/v1/lesson-attempts/start", nil), http.StatusMethodNotAllowed, "method_not_allowed"},
		{"bad json", NewHandler(&fakeAttemptStore{}, nil, "profesor-ia.session"), newStartRequest(`{"anonymousProgressId":`), http.StatusBadRequest, "invalid_request"},
		{"body user without session", NewHandler(&fakeAttemptStore{}, nil, "profesor-ia.session"), newStartRequest(`{"userId":"user-1","legacyLessonId":"lesson-1"}`), http.StatusBadRequest, "invalid_attempt_identity"},
		{"invalid session", NewHandler(&fakeAttemptStore{}, &fakeResolver{err: errors.New("expired")}, "profesor-ia.session"), startRequestWithCookie("expired-token"), http.StatusUnauthorized, "invalid_session"},
		{"missing lesson reference", NewHandler(&fakeAttemptStore{err: ErrMissingLessonReference}, nil, "profesor-ia.session"), newStartRequest(`{"anonymousProgressId":"anonymous-1"}`), http.StatusBadRequest, "invalid_lesson_reference"},
		{"starter fails", NewHandler(&fakeAttemptStore{err: errors.New("database unavailable")}, nil, "profesor-ia.session"), newStartRequest(`{"anonymousProgressId":"anonymous-1","legacyLessonId":"lesson-1"}`), http.StatusInternalServerError, "lesson_attempt_start_failed"},
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

func TestHandlerCompleteErrors(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		handler Handler
		request *http.Request
		status  int
		code    string
	}{
		{"completer missing", NewHandler(nil, nil, "profesor-ia.session"), newCompleteRequest(`{"attemptId":"attempt-1","anonymousProgressId":"anonymous-1"}`), http.StatusServiceUnavailable, "lesson_attempts_unavailable"},
		{"unsupported method", NewHandler(&fakeAttemptStore{}, nil, "profesor-ia.session"), httptest.NewRequest(http.MethodGet, "/v1/lesson-attempts/complete", nil), http.StatusMethodNotAllowed, "method_not_allowed"},
		{"bad json", NewHandler(&fakeAttemptStore{}, nil, "profesor-ia.session"), newCompleteRequest(`{"attemptId":`), http.StatusBadRequest, "invalid_request"},
		{"body user without session", NewHandler(&fakeAttemptStore{}, nil, "profesor-ia.session"), newCompleteRequest(`{"attemptId":"attempt-1","userId":"user-1"}`), http.StatusBadRequest, "invalid_attempt_identity"},
		{"invalid session", NewHandler(&fakeAttemptStore{}, &fakeResolver{err: errors.New("expired")}, "profesor-ia.session"), completeRequestWithCookie("expired-token"), http.StatusUnauthorized, "invalid_session"},
		{"missing attempt", NewHandler(&fakeAttemptStore{completeErr: ErrMissingAttemptID}, nil, "profesor-ia.session"), newCompleteRequest(`{"anonymousProgressId":"anonymous-1"}`), http.StatusBadRequest, "invalid_attempt"},
		{"not found", NewHandler(&fakeAttemptStore{completeErr: ErrAttemptNotFound}, nil, "profesor-ia.session"), newCompleteRequest(`{"attemptId":"attempt-1","anonymousProgressId":"anonymous-1"}`), http.StatusNotFound, "attempt_not_found"},
		{"storage failure", NewHandler(&fakeAttemptStore{completeErr: errors.New("database unavailable")}, nil, "profesor-ia.session"), newCompleteRequest(`{"attemptId":"attempt-1","anonymousProgressId":"anonymous-1"}`), http.StatusInternalServerError, "lesson_attempt_complete_failed"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			response := httptest.NewRecorder()
			tc.handler.Complete(response, tc.request)
			if response.Code != tc.status {
				t.Fatalf("expected status %d, got %d body=%s", tc.status, response.Code, response.Body.String())
			}
			assertBodyContains(t, response, `"error":"`+tc.code+`"`)
		})
	}
}

func TestHandlerRecordEventErrors(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		handler Handler
		request *http.Request
		status  int
		code    string
	}{
		{"recorder missing", NewHandler(nil, nil, "profesor-ia.session"), newEventRequest(`{"attemptId":"attempt-1","anonymousProgressId":"anonymous-1","eventType":"learner_turn"}`), http.StatusServiceUnavailable, "lesson_events_unavailable"},
		{"unsupported method", NewHandler(&fakeAttemptStore{}, nil, "profesor-ia.session"), httptest.NewRequest(http.MethodGet, "/v1/lesson-attempts/events", nil), http.StatusMethodNotAllowed, "method_not_allowed"},
		{"bad json", NewHandler(&fakeAttemptStore{}, nil, "profesor-ia.session"), newEventRequest(`{"attemptId":`), http.StatusBadRequest, "invalid_request"},
		{"body user without session", NewHandler(&fakeAttemptStore{}, nil, "profesor-ia.session"), newEventRequest(`{"attemptId":"attempt-1","userId":"user-1","eventType":"learner_turn"}`), http.StatusBadRequest, "invalid_attempt_identity"},
		{"invalid session", NewHandler(&fakeAttemptStore{}, &fakeResolver{err: errors.New("expired")}, "profesor-ia.session"), eventRequestWithCookie("expired-token"), http.StatusUnauthorized, "invalid_session"},
		{"missing attempt", NewHandler(&fakeAttemptStore{eventErr: ErrMissingAttemptID}, nil, "profesor-ia.session"), newEventRequest(`{"anonymousProgressId":"anonymous-1","eventType":"learner_turn"}`), http.StatusBadRequest, "invalid_attempt"},
		{"invalid event type", NewHandler(&fakeAttemptStore{eventErr: ErrInvalidEventType}, nil, "profesor-ia.session"), newEventRequest(`{"attemptId":"attempt-1","anonymousProgressId":"anonymous-1","eventType":"unknown"}`), http.StatusBadRequest, "invalid_event_type"},
		{"invalid payload", NewHandler(&fakeAttemptStore{eventErr: ErrInvalidPayload}, nil, "profesor-ia.session"), newEventRequest(`{"attemptId":"attempt-1","anonymousProgressId":"anonymous-1","eventType":"learner_turn","payload":{}}`), http.StatusBadRequest, "invalid_payload"},
		{"not found", NewHandler(&fakeAttemptStore{eventErr: ErrAttemptNotFound}, nil, "profesor-ia.session"), newEventRequest(`{"attemptId":"attempt-1","anonymousProgressId":"anonymous-1","eventType":"learner_turn"}`), http.StatusNotFound, "attempt_not_found"},
		{"storage failure", NewHandler(&fakeAttemptStore{eventErr: errors.New("database unavailable")}, nil, "profesor-ia.session"), newEventRequest(`{"attemptId":"attempt-1","anonymousProgressId":"anonymous-1","eventType":"learner_turn"}`), http.StatusInternalServerError, "lesson_event_record_failed"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			response := httptest.NewRecorder()
			tc.handler.RecordEvent(response, tc.request)
			if response.Code != tc.status {
				t.Fatalf("expected status %d, got %d body=%s", tc.status, response.Code, response.Body.String())
			}
			assertBodyContains(t, response, `"error":"`+tc.code+`"`)
		})
	}
}

func TestHandlerRecordFeedbackErrors(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		handler Handler
		request *http.Request
		status  int
		code    string
	}{
		{"recorder missing", NewHandler(nil, nil, "profesor-ia.session"), newFeedbackRequest(`{"attemptId":"attempt-1","anonymousProgressId":"anonymous-1","correctionText":"Use past tense."}`), http.StatusServiceUnavailable, "feedback_events_unavailable"},
		{"unsupported method", NewHandler(&fakeAttemptStore{}, nil, "profesor-ia.session"), httptest.NewRequest(http.MethodGet, "/v1/lesson-attempts/feedback", nil), http.StatusMethodNotAllowed, "method_not_allowed"},
		{"bad json", NewHandler(&fakeAttemptStore{}, nil, "profesor-ia.session"), newFeedbackRequest(`{"attemptId":`), http.StatusBadRequest, "invalid_request"},
		{"body user without session", NewHandler(&fakeAttemptStore{}, nil, "profesor-ia.session"), newFeedbackRequest(`{"attemptId":"attempt-1","userId":"user-1","correctionText":"Use past tense."}`), http.StatusBadRequest, "invalid_attempt_identity"},
		{"invalid session", NewHandler(&fakeAttemptStore{}, &fakeResolver{err: errors.New("expired")}, "profesor-ia.session"), feedbackRequestWithCookie("expired-token"), http.StatusUnauthorized, "invalid_session"},
		{"missing attempt", NewHandler(&fakeAttemptStore{feedbackErr: ErrMissingAttemptID}, nil, "profesor-ia.session"), newFeedbackRequest(`{"anonymousProgressId":"anonymous-1","correctionText":"Use past tense."}`), http.StatusBadRequest, "invalid_attempt"},
		{"invalid payload", NewHandler(&fakeAttemptStore{feedbackErr: ErrInvalidPayload}, nil, "profesor-ia.session"), newFeedbackRequest(`{"attemptId":"attempt-1","anonymousProgressId":"anonymous-1","correctionText":"Use past tense.","rubricResult":{}}`), http.StatusBadRequest, "invalid_payload"},
		{"missing correction", NewHandler(&fakeAttemptStore{feedbackErr: ErrMissingCorrectionText}, nil, "profesor-ia.session"), newFeedbackRequest(`{"attemptId":"attempt-1","anonymousProgressId":"anonymous-1","correctionText":""}`), http.StatusBadRequest, "invalid_correction"},
		{"not found", NewHandler(&fakeAttemptStore{feedbackErr: ErrAttemptNotFound}, nil, "profesor-ia.session"), newFeedbackRequest(`{"attemptId":"attempt-1","anonymousProgressId":"anonymous-1","correctionText":"Use past tense."}`), http.StatusNotFound, "attempt_not_found"},
		{"storage failure", NewHandler(&fakeAttemptStore{feedbackErr: errors.New("database unavailable")}, nil, "profesor-ia.session"), newFeedbackRequest(`{"attemptId":"attempt-1","anonymousProgressId":"anonymous-1","correctionText":"Use past tense."}`), http.StatusInternalServerError, "feedback_event_record_failed"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			response := httptest.NewRecorder()
			tc.handler.RecordFeedback(response, tc.request)
			if response.Code != tc.status {
				t.Fatalf("expected status %d, got %d body=%s", tc.status, response.Code, response.Body.String())
			}
			assertBodyContains(t, response, `"error":"`+tc.code+`"`)
		})
	}
}

type fakeAttemptStore struct {
	record          StartRecord
	attempt         Attempt
	err             error
	completeRecord  CompleteRecord
	completeAttempt Attempt
	completeErr     error
	eventRecord     EventRecord
	event           RecordedEvent
	eventErr        error
	feedbackRecord  FeedbackRecord
	feedback        RecordedFeedback
	feedbackErr     error
}

func (s *fakeAttemptStore) StartAttempt(_ context.Context, record StartRecord) (Attempt, error) {
	s.record = record
	return s.attempt, s.err
}

func (s *fakeAttemptStore) CompleteAttempt(_ context.Context, record CompleteRecord) (Attempt, error) {
	s.completeRecord = record
	return s.completeAttempt, s.completeErr
}

func (s *fakeAttemptStore) RecordEvent(_ context.Context, record EventRecord) (RecordedEvent, error) {
	s.eventRecord = record
	return s.event, s.eventErr
}

func (s *fakeAttemptStore) RecordFeedback(_ context.Context, record FeedbackRecord) (RecordedFeedback, error) {
	s.feedbackRecord = record
	return s.feedback, s.feedbackErr
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

func newCompleteRequest(body string) *http.Request {
	return httptest.NewRequest(http.MethodPost, "/v1/lesson-attempts/complete", strings.NewReader(body))
}

func newEventRequest(body string) *http.Request {
	return httptest.NewRequest(http.MethodPost, "/v1/lesson-attempts/events", strings.NewReader(body))
}

func newFeedbackRequest(body string) *http.Request {
	return httptest.NewRequest(http.MethodPost, "/v1/lesson-attempts/feedback", strings.NewReader(body))
}

func startRequestWithCookie(token string) *http.Request {
	request := newStartRequest(`{"anonymousProgressId":"anonymous-1","legacyLessonId":"lesson-1"}`)
	request.AddCookie(&http.Cookie{Name: "profesor-ia.session", Value: token})
	return request
}

func completeRequestWithCookie(token string) *http.Request {
	request := newCompleteRequest(`{"attemptId":"attempt-1","anonymousProgressId":"anonymous-1"}`)
	request.AddCookie(&http.Cookie{Name: "profesor-ia.session", Value: token})
	return request
}

func eventRequestWithCookie(token string) *http.Request {
	request := newEventRequest(`{"attemptId":"attempt-1","anonymousProgressId":"anonymous-1","eventType":"learner_turn"}`)
	request.AddCookie(&http.Cookie{Name: "profesor-ia.session", Value: token})
	return request
}

func feedbackRequestWithCookie(token string) *http.Request {
	request := newFeedbackRequest(`{"attemptId":"attempt-1","anonymousProgressId":"anonymous-1","correctionText":"Use past tense."}`)
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
