package session

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"
)

type Revoker interface {
	RevokeSession(ctx context.Context, token string) (bool, error)
}

type Handler struct {
	revoker Revoker
	policy  CookiePolicy
	now     func() time.Time
}

func NewHandler(revoker Revoker, policy CookiePolicy) Handler {
	return NewHandlerWithClock(revoker, policy, time.Now)
}

func NewHandlerWithClock(revoker Revoker, policy CookiePolicy, now func() time.Time) Handler {
	if now == nil {
		now = time.Now
	}

	return Handler{revoker: revoker, policy: policy, now: now}
}

type logoutResponse struct {
	Revoked bool `json:"revoked"`
}

type sessionErrorResponse struct {
	Error string `json:"error"`
}

func (h Handler) Logout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeSessionJSON(w, http.StatusMethodNotAllowed, sessionErrorResponse{Error: "method_not_allowed"})
		return
	}

	revoked, err := h.revokeRequestSession(r)
	if err != nil {
		writeSessionJSON(w, http.StatusInternalServerError, sessionErrorResponse{Error: "logout_failed"})
		return
	}

	http.SetCookie(w, h.policy.ExpiredCookie(h.now()))
	writeSessionJSON(w, http.StatusOK, logoutResponse{Revoked: revoked})
}

func (h Handler) revokeRequestSession(r *http.Request) (bool, error) {
	if h.revoker == nil {
		return false, nil
	}

	cookie, err := r.Cookie(h.policy.cookieName())
	if errors.Is(err, http.ErrNoCookie) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if strings.TrimSpace(cookie.Value) == "" {
		return false, nil
	}

	return h.revoker.RevokeSession(r.Context(), cookie.Value)
}

func writeSessionJSON(w http.ResponseWriter, statusCode int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		return
	}
}
