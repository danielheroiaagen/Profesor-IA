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

type Resolver interface {
	ResolveSessionUserID(ctx context.Context, token string) (string, error)
}

type Handler struct {
	revoker  Revoker
	resolver Resolver
	policy   CookiePolicy
	now      func() time.Time
}

func NewHandler(revoker Revoker, policy CookiePolicy) Handler {
	return NewHandlerWithResolverAndClock(revoker, nil, policy, time.Now)
}

func NewHandlerWithResolver(revoker Revoker, resolver Resolver, policy CookiePolicy) Handler {
	return NewHandlerWithResolverAndClock(revoker, resolver, policy, time.Now)
}

func NewHandlerWithClock(revoker Revoker, policy CookiePolicy, now func() time.Time) Handler {
	return NewHandlerWithResolverAndClock(revoker, nil, policy, now)
}

func NewHandlerWithResolverAndClock(revoker Revoker, resolver Resolver, policy CookiePolicy, now func() time.Time) Handler {
	if now == nil {
		now = time.Now
	}

	return Handler{revoker: revoker, resolver: resolver, policy: policy, now: now}
}

type logoutResponse struct {
	Revoked bool `json:"revoked"`
}

type currentSessionResponse struct {
	Authenticated bool                        `json:"authenticated"`
	User          *currentSessionUserResponse `json:"user,omitempty"`
}

type currentSessionUserResponse struct {
	ID string `json:"id"`
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

func (h Handler) Current(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeSessionJSON(w, http.StatusMethodNotAllowed, sessionErrorResponse{Error: "method_not_allowed"})
		return
	}
	if h.resolver == nil {
		writeSessionJSON(w, http.StatusServiceUnavailable, sessionErrorResponse{Error: "session_unavailable"})
		return
	}

	cookie, err := r.Cookie(h.policy.cookieName())
	if errors.Is(err, http.ErrNoCookie) {
		writeSessionJSON(w, http.StatusUnauthorized, sessionErrorResponse{Error: "unauthenticated"})
		return
	}
	if err != nil {
		writeSessionJSON(w, http.StatusUnauthorized, sessionErrorResponse{Error: "unauthenticated"})
		return
	}
	if strings.TrimSpace(cookie.Value) == "" {
		writeSessionJSON(w, http.StatusUnauthorized, sessionErrorResponse{Error: "unauthenticated"})
		return
	}

	userID, err := h.resolver.ResolveSessionUserID(r.Context(), cookie.Value)
	if err != nil {
		if errors.Is(err, ErrSessionNotFound) || errors.Is(err, ErrExpiredSession) || errors.Is(err, ErrMissingSessionToken) {
			writeSessionJSON(w, http.StatusUnauthorized, sessionErrorResponse{Error: "unauthenticated"})
			return
		}
		writeSessionJSON(w, http.StatusInternalServerError, sessionErrorResponse{Error: "session_lookup_failed"})
		return
	}
	userID = strings.TrimSpace(userID)
	if userID == "" {
		writeSessionJSON(w, http.StatusUnauthorized, sessionErrorResponse{Error: "unauthenticated"})
		return
	}

	writeSessionJSON(w, http.StatusOK, currentSessionResponse{
		Authenticated: true,
		User:          &currentSessionUserResponse{ID: userID},
	})
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
