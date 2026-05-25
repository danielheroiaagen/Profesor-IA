package attempts

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
)

type SessionResolver interface {
	ResolveSessionUserID(ctx context.Context, token string) (string, error)
}

type Handler struct {
	starter           Starter
	completer         Completer
	events            EventRecorder
	feedback          FeedbackRecorder
	history           HistoryProvider
	sessions          SessionResolver
	sessionCookieName string
}

func NewHandler(attempts Starter, sessions SessionResolver, sessionCookieName string) Handler {
	completer, _ := attempts.(Completer)
	events, _ := attempts.(EventRecorder)
	feedback, _ := attempts.(FeedbackRecorder)
	history, _ := attempts.(HistoryProvider)
	return Handler{starter: attempts, completer: completer, events: events, feedback: feedback, history: history, sessions: sessions, sessionCookieName: sessionCookieName}
}

type startRequest struct {
	UserID              string `json:"userId,omitempty"`
	AnonymousProgressID string `json:"anonymousProgressId,omitempty"`
	LessonPlanID        string `json:"lessonPlanId,omitempty"`
	LegacyLessonID      string `json:"legacyLessonId,omitempty"`
	RealtimeModel       string `json:"realtimeModel,omitempty"`
}

type completeRequest struct {
	UserID              string `json:"userId,omitempty"`
	AnonymousProgressID string `json:"anonymousProgressId,omitempty"`
	AttemptID           string `json:"attemptId"`
}

type eventRequest struct {
	UserID              string          `json:"userId,omitempty"`
	AnonymousProgressID string          `json:"anonymousProgressId,omitempty"`
	AttemptID           string          `json:"attemptId"`
	EventType           string          `json:"eventType"`
	Payload             json.RawMessage `json:"payload,omitempty"`
}

type feedbackRequest struct {
	UserID              string          `json:"userId,omitempty"`
	AnonymousProgressID string          `json:"anonymousProgressId,omitempty"`
	AttemptID           string          `json:"attemptId"`
	CorrectionText      string          `json:"correctionText"`
	RubricResult        json.RawMessage `json:"rubricResult,omitempty"`
}

type startResponse struct {
	AttemptID string `json:"attemptId"`
	Status    string `json:"status"`
}

type eventResponse struct {
	EventID int64 `json:"eventId"`
}

type feedbackResponse struct {
	FeedbackID string `json:"feedbackId"`
}

type errorResponse struct {
	Error string `json:"error"`
}

func (h Handler) Start(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, errorResponse{Error: "method_not_allowed"})
		return
	}
	if h.starter == nil {
		writeJSON(w, http.StatusServiceUnavailable, errorResponse{Error: "lesson_attempts_unavailable"})
		return
	}

	var request startRequest
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&request); err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "invalid_request"})
		return
	}

	identity, err := h.identity(r, request)
	if err != nil {
		status, code := http.StatusUnauthorized, "invalid_session"
		if errors.Is(err, ErrInvalidIdentity) {
			status, code = http.StatusBadRequest, "invalid_attempt_identity"
		}
		writeJSON(w, status, errorResponse{Error: code})
		return
	}

	attempt, err := h.starter.StartAttempt(r.Context(), StartRecord{
		Identity:       identity,
		LessonPlanID:   request.LessonPlanID,
		LegacyLessonID: request.LegacyLessonID,
		RealtimeModel:  request.RealtimeModel,
	})
	if err != nil {
		status, code := http.StatusInternalServerError, "lesson_attempt_start_failed"
		switch {
		case errors.Is(err, ErrInvalidIdentity):
			status, code = http.StatusBadRequest, "invalid_attempt_identity"
		case errors.Is(err, ErrMissingLessonReference):
			status, code = http.StatusBadRequest, "invalid_lesson_reference"
		}
		writeJSON(w, status, errorResponse{Error: code})
		return
	}

	writeJSON(w, http.StatusCreated, startResponse{AttemptID: attempt.ID, Status: attempt.Status})
}

func (h Handler) Complete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, errorResponse{Error: "method_not_allowed"})
		return
	}
	if h.completer == nil {
		writeJSON(w, http.StatusServiceUnavailable, errorResponse{Error: "lesson_attempts_unavailable"})
		return
	}

	var request completeRequest
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&request); err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "invalid_request"})
		return
	}

	identity, err := h.identity(r, startRequest{UserID: request.UserID, AnonymousProgressID: request.AnonymousProgressID})
	if err != nil {
		status, code := http.StatusUnauthorized, "invalid_session"
		if errors.Is(err, ErrInvalidIdentity) {
			status, code = http.StatusBadRequest, "invalid_attempt_identity"
		}
		writeJSON(w, status, errorResponse{Error: code})
		return
	}

	attempt, err := h.completer.CompleteAttempt(r.Context(), CompleteRecord{Identity: identity, AttemptID: request.AttemptID})
	if err != nil {
		status, code := http.StatusInternalServerError, "lesson_attempt_complete_failed"
		switch {
		case errors.Is(err, ErrInvalidIdentity):
			status, code = http.StatusBadRequest, "invalid_attempt_identity"
		case errors.Is(err, ErrMissingAttemptID):
			status, code = http.StatusBadRequest, "invalid_attempt"
		case errors.Is(err, ErrAttemptNotFound):
			status, code = http.StatusNotFound, "attempt_not_found"
		}
		writeJSON(w, status, errorResponse{Error: code})
		return
	}

	writeJSON(w, http.StatusOK, startResponse{AttemptID: attempt.ID, Status: attempt.Status})
}

func (h Handler) RecordEvent(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, errorResponse{Error: "method_not_allowed"})
		return
	}
	if h.events == nil {
		writeJSON(w, http.StatusServiceUnavailable, errorResponse{Error: "lesson_events_unavailable"})
		return
	}

	var request eventRequest
	if err := decodeStrictJSON(r, &request); err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "invalid_request"})
		return
	}

	identity, ok := h.requestIdentity(w, r, request.UserID, request.AnonymousProgressID)
	if !ok {
		return
	}

	event, err := h.events.RecordEvent(r.Context(), EventRecord{Identity: identity, AttemptID: request.AttemptID, EventType: request.EventType, Payload: request.Payload})
	if err != nil {
		writeAttemptWriteError(w, err, "lesson_event_record_failed")
		return
	}

	writeJSON(w, http.StatusCreated, eventResponse{EventID: event.ID})
}

func (h Handler) RecordFeedback(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, errorResponse{Error: "method_not_allowed"})
		return
	}
	if h.feedback == nil {
		writeJSON(w, http.StatusServiceUnavailable, errorResponse{Error: "feedback_events_unavailable"})
		return
	}

	var request feedbackRequest
	if err := decodeStrictJSON(r, &request); err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "invalid_request"})
		return
	}

	identity, ok := h.requestIdentity(w, r, request.UserID, request.AnonymousProgressID)
	if !ok {
		return
	}

	feedback, err := h.feedback.RecordFeedback(r.Context(), FeedbackRecord{Identity: identity, AttemptID: request.AttemptID, CorrectionText: request.CorrectionText, RubricResult: request.RubricResult})
	if err != nil {
		writeAttemptWriteError(w, err, "feedback_event_record_failed")
		return
	}

	writeJSON(w, http.StatusCreated, feedbackResponse{FeedbackID: feedback.ID})
}

func (h Handler) History(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, errorResponse{Error: "method_not_allowed"})
		return
	}
	if h.history == nil {
		writeJSON(w, http.StatusServiceUnavailable, errorResponse{Error: "lesson_attempt_history_unavailable"})
		return
	}

	identity, ok := h.requestIdentity(w, r, r.URL.Query().Get("userId"), r.URL.Query().Get("anonymousProgressId"))
	if !ok {
		return
	}

	history, err := h.history.GetHistory(r.Context(), HistoryRecord{Identity: identity, AttemptID: r.URL.Query().Get("attemptId")})
	if err != nil {
		writeAttemptWriteError(w, err, "lesson_attempt_history_failed")
		return
	}

	writeJSON(w, http.StatusOK, history)
}

func (h Handler) identity(r *http.Request, request startRequest) (Identity, error) {
	if h.sessions != nil && strings.TrimSpace(h.sessionCookieName) != "" {
		cookie, err := r.Cookie(h.sessionCookieName)
		if err == nil {
			userID, err := h.sessions.ResolveSessionUserID(r.Context(), cookie.Value)
			if err != nil {
				return Identity{}, err
			}
			if userID = strings.TrimSpace(userID); userID != "" {
				return Identity{UserID: userID}, nil
			}
			return Identity{}, ErrInvalidIdentity
		}
		if err != nil && !errors.Is(err, http.ErrNoCookie) {
			return Identity{}, err
		}
	}

	if strings.TrimSpace(request.UserID) != "" {
		return Identity{}, ErrInvalidIdentity
	}
	return normalizeIdentity(Identity{AnonymousProgressID: request.AnonymousProgressID})
}

func (h Handler) requestIdentity(w http.ResponseWriter, r *http.Request, userID string, anonymousProgressID string) (Identity, bool) {
	identity, err := h.identity(r, startRequest{UserID: userID, AnonymousProgressID: anonymousProgressID})
	if err != nil {
		status, code := http.StatusUnauthorized, "invalid_session"
		if errors.Is(err, ErrInvalidIdentity) {
			status, code = http.StatusBadRequest, "invalid_attempt_identity"
		}
		writeJSON(w, status, errorResponse{Error: code})
		return Identity{}, false
	}

	return identity, true
}

func decodeStrictJSON(r *http.Request, target any) error {
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	return decoder.Decode(target)
}

func writeAttemptWriteError(w http.ResponseWriter, err error, fallback string) {
	status, code := http.StatusInternalServerError, fallback
	switch {
	case errors.Is(err, ErrInvalidIdentity):
		status, code = http.StatusBadRequest, "invalid_attempt_identity"
	case errors.Is(err, ErrMissingAttemptID):
		status, code = http.StatusBadRequest, "invalid_attempt"
	case errors.Is(err, ErrInvalidEventType):
		status, code = http.StatusBadRequest, "invalid_event_type"
	case errors.Is(err, ErrInvalidPayload):
		status, code = http.StatusBadRequest, "invalid_payload"
	case errors.Is(err, ErrMissingCorrectionText):
		status, code = http.StatusBadRequest, "invalid_correction"
	case errors.Is(err, ErrAttemptNotFound):
		status, code = http.StatusNotFound, "attempt_not_found"
	}
	writeJSON(w, status, errorResponse{Error: code})
}

func writeJSON(w http.ResponseWriter, statusCode int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		return
	}
}
