package progress

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
)

type AwardRecorder interface {
	RecordAward(ctx context.Context, record AwardRecord) (bool, error)
}

type SessionResolver interface {
	ResolveSessionUserID(ctx context.Context, token string) (string, error)
}

type Handler struct {
	awards            AwardRecorder
	summaries         SummaryProvider
	sessions          SessionResolver
	sessionCookieName string
}

func NewHandler(awards AwardRecorder) Handler {
	return Handler{awards: awards}
}

func NewHandlerWithSessions(awards AwardRecorder, sessions SessionResolver, sessionCookieName string) Handler {
	return Handler{awards: awards, sessions: sessions, sessionCookieName: sessionCookieName}
}

func NewHandlerWithSessionsAndSummary(awards AwardRecorder, summaries SummaryProvider, sessions SessionResolver, sessionCookieName string) Handler {
	return Handler{awards: awards, summaries: summaries, sessions: sessions, sessionCookieName: sessionCookieName}
}

type awardRequest struct {
	AttemptID           string                    `json:"attemptId"`
	UserID              string                    `json:"userId,omitempty"`
	AnonymousProgressID string                    `json:"anonymousProgressId,omitempty"`
	Evidence            completionEvidenceRequest `json:"evidence"`
}

type completionEvidenceRequest struct {
	Verified     bool `json:"verified"`
	LearnerTurns int  `json:"learnerTurns"`
	Feedbacks    int  `json:"feedbacks"`
	Interrupted  bool `json:"interrupted"`
}

type awardResponse struct {
	Awarded  bool   `json:"awarded"`
	XP       int    `json:"xp"`
	Reason   string `json:"reason"`
	Inserted bool   `json:"inserted"`
}

type summaryResponse struct {
	TotalXP          int `json:"totalXp"`
	CompletedLessons int `json:"completedLessons"`
}

type errorResponse struct {
	Error string `json:"error"`
}

func (h Handler) RegisterAward(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeProgressJSON(w, http.StatusMethodNotAllowed, errorResponse{Error: "method_not_allowed"})
		return
	}
	if h.awards == nil {
		writeProgressJSON(w, http.StatusServiceUnavailable, errorResponse{Error: "progress_awards_unavailable"})
		return
	}

	var request awardRequest
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&request); err != nil {
		writeProgressJSON(w, http.StatusBadRequest, errorResponse{Error: "invalid_request"})
		return
	}

	decision := DecideCompletionAward(CompletionEvidence{
		Verified:     request.Evidence.Verified,
		LearnerTurns: request.Evidence.LearnerTurns,
		Feedbacks:    request.Evidence.Feedbacks,
		Interrupted:  request.Evidence.Interrupted,
	})

	if !decision.Awarded {
		writeProgressJSON(w, http.StatusOK, awardResponse{Awarded: false, XP: 0, Reason: decision.Reason})
		return
	}

	identity, err := h.awardIdentity(r, request)
	if err != nil {
		writeProgressJSON(w, http.StatusUnauthorized, errorResponse{Error: "invalid_session"})
		return
	}

	inserted, err := h.awards.RecordAward(r.Context(), AwardRecord{
		Identity:  identity,
		AttemptID: request.AttemptID,
		Decision:  decision,
	})
	if err != nil {
		status := http.StatusInternalServerError
		code := "progress_award_failed"
		if errors.Is(err, ErrMissingAttemptID) || errors.Is(err, ErrInvalidAwardIdentity) {
			status = http.StatusBadRequest
			code = "invalid_award_request"
		}
		writeProgressJSON(w, status, errorResponse{Error: code})
		return
	}

	writeProgressJSON(w, http.StatusOK, awardResponse{
		Awarded:  true,
		XP:       decision.XP,
		Reason:   decision.Reason,
		Inserted: inserted,
	})
}

func (h Handler) Summary(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeProgressJSON(w, http.StatusMethodNotAllowed, errorResponse{Error: "method_not_allowed"})
		return
	}
	if h.summaries == nil {
		writeProgressJSON(w, http.StatusServiceUnavailable, errorResponse{Error: "progress_summary_unavailable"})
		return
	}

	identity, err := h.summaryIdentity(r)
	if err != nil {
		if errors.Is(err, ErrInvalidAwardIdentity) {
			writeProgressJSON(w, http.StatusBadRequest, errorResponse{Error: "invalid_progress_identity"})
			return
		}
		writeProgressJSON(w, http.StatusUnauthorized, errorResponse{Error: "invalid_session"})
		return
	}

	summary, err := h.summaries.SummarizeProgress(r.Context(), identity)
	if err != nil {
		if errors.Is(err, ErrInvalidAwardIdentity) {
			writeProgressJSON(w, http.StatusBadRequest, errorResponse{Error: "invalid_progress_identity"})
			return
		}
		writeProgressJSON(w, http.StatusInternalServerError, errorResponse{Error: "progress_summary_failed"})
		return
	}

	writeProgressJSON(w, http.StatusOK, summaryResponse{TotalXP: summary.TotalXP, CompletedLessons: summary.CompletedLessons})
}

func (h Handler) awardIdentity(r *http.Request, request awardRequest) (AwardIdentity, error) {
	userID := strings.TrimSpace(request.UserID)
	anonymousProgressID := strings.TrimSpace(request.AnonymousProgressID)
	anonymousIdentity := AwardIdentity{AnonymousProgressID: anonymousProgressID}

	if h.sessions == nil || strings.TrimSpace(h.sessionCookieName) == "" {
		if userID != "" {
			return AwardIdentity{}, ErrInvalidAwardIdentity
		}
		return anonymousIdentity, nil
	}

	cookie, err := r.Cookie(h.sessionCookieName)
	if errors.Is(err, http.ErrNoCookie) {
		if userID != "" {
			return AwardIdentity{}, ErrInvalidAwardIdentity
		}
		return anonymousIdentity, nil
	}
	if err != nil {
		return AwardIdentity{}, err
	}

	resolvedUserID, err := h.sessions.ResolveSessionUserID(r.Context(), cookie.Value)
	if err != nil {
		return AwardIdentity{}, err
	}
	resolvedUserID = strings.TrimSpace(resolvedUserID)
	if resolvedUserID == "" {
		return AwardIdentity{}, ErrInvalidAwardIdentity
	}

	return AwardIdentity{UserID: resolvedUserID}, nil
}

func (h Handler) summaryIdentity(r *http.Request) (AwardIdentity, error) {
	if h.sessions != nil && strings.TrimSpace(h.sessionCookieName) != "" {
		cookie, err := r.Cookie(h.sessionCookieName)
		if err == nil {
			resolvedUserID, err := h.sessions.ResolveSessionUserID(r.Context(), cookie.Value)
			if err != nil {
				return AwardIdentity{}, err
			}
			resolvedUserID = strings.TrimSpace(resolvedUserID)
			if resolvedUserID == "" {
				return AwardIdentity{}, ErrInvalidAwardIdentity
			}

			return AwardIdentity{UserID: resolvedUserID}, nil
		}
		if err != nil && !errors.Is(err, http.ErrNoCookie) {
			return AwardIdentity{}, err
		}
	}

	anonymousProgressID := strings.TrimSpace(r.URL.Query().Get("anonymousProgressId"))
	if anonymousProgressID == "" {
		return AwardIdentity{}, ErrInvalidAwardIdentity
	}

	return AwardIdentity{AnonymousProgressID: anonymousProgressID}, nil
}

func writeProgressJSON(w http.ResponseWriter, statusCode int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		return
	}
}
