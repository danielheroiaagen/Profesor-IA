package progress

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
)

type AwardRecorder interface {
	RecordAward(ctx context.Context, record AwardRecord) (bool, error)
}

type Handler struct {
	awards AwardRecorder
}

func NewHandler(awards AwardRecorder) Handler {
	return Handler{awards: awards}
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
		writeProgressJSON(w, http.StatusOK, awardResponse{
			Awarded: false,
			XP:      0,
			Reason:  decision.Reason,
		})
		return
	}

	inserted, err := h.awards.RecordAward(r.Context(), AwardRecord{
		Identity: AwardIdentity{
			UserID:              request.UserID,
			AnonymousProgressID: request.AnonymousProgressID,
		},
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

func writeProgressJSON(w http.ResponseWriter, statusCode int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		return
	}
}
