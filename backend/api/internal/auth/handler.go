package auth

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/danielheroiaagen/Profesor-IA/backend/api/internal/session"
)

type CredentialUserCreator interface {
	CreateCredentialUser(ctx context.Context, record CredentialUserRecord) (CredentialUser, error)
}

type SessionCreator interface {
	CreateSession(ctx context.Context, record session.SessionRecord) error
}

type TokenGenerator interface {
	NewToken() (string, error)
}

type RegisterConfig struct {
	Users    CredentialUserCreator
	Sessions SessionCreator
	Tokens   TokenGenerator
	Hasher   PasswordHasher
	Policy   session.CookiePolicy
	Now      func() time.Time
}

type Handler struct {
	users    CredentialUserCreator
	sessions SessionCreator
	tokens   TokenGenerator
	hasher   PasswordHasher
	policy   session.CookiePolicy
	now      func() time.Time
}

func NewHandler(users CredentialUserCreator, sessions SessionCreator, policy session.CookiePolicy) Handler {
	return NewHandlerWithConfig(RegisterConfig{Users: users, Sessions: sessions, Policy: policy})
}

func NewHandlerWithConfig(config RegisterConfig) Handler {
	tokens := config.Tokens
	if tokens == nil {
		generator := session.NewTokenGenerator()
		tokens = generator
	}
	now := config.Now
	if now == nil {
		now = time.Now
	}

	return Handler{
		users:    config.Users,
		sessions: config.Sessions,
		tokens:   tokens,
		hasher:   config.Hasher,
		policy:   config.Policy,
		now:      now,
	}
}

type registerRequest struct {
	Email       string `json:"email"`
	Password    string `json:"password"`
	DisplayName string `json:"displayName"`
}

type registerResponse struct {
	User registerUserResponse `json:"user"`
}

type registerUserResponse struct {
	ID          string `json:"id"`
	Email       string `json:"email"`
	DisplayName string `json:"displayName,omitempty"`
}

type registerErrorResponse struct {
	Error string `json:"error"`
}

func (h Handler) Register(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeRegisterJSON(w, http.StatusMethodNotAllowed, registerErrorResponse{Error: "method_not_allowed"})
		return
	}
	if h.users == nil || h.sessions == nil {
		writeRegisterJSON(w, http.StatusServiceUnavailable, registerErrorResponse{Error: "auth_unavailable"})
		return
	}

	request, err := decodeRegisterRequest(r)
	if err != nil {
		writeRegisterJSON(w, http.StatusBadRequest, registerErrorResponse{Error: "invalid_register_request"})
		return
	}

	email, err := NormalizeEmail(request.Email)
	if err != nil {
		writeRegisterJSON(w, http.StatusBadRequest, registerErrorResponse{Error: "invalid_register_request"})
		return
	}
	passwordHash, err := h.hasher.HashPassword(request.Password)
	if err != nil {
		writeRegisterJSON(w, http.StatusBadRequest, registerErrorResponse{Error: "invalid_register_request"})
		return
	}
	user, err := h.users.CreateCredentialUser(r.Context(), CredentialUserRecord{
		Email:        email,
		DisplayName:  strings.TrimSpace(request.DisplayName),
		PasswordHash: passwordHash,
	})
	if err != nil {
		if errors.Is(err, ErrEmailAlreadyExists) {
			writeRegisterJSON(w, http.StatusConflict, registerErrorResponse{Error: "email_already_exists"})
			return
		}
		if errors.Is(err, ErrMissingEmail) || errors.Is(err, ErrInvalidEmail) || errors.Is(err, ErrMissingPasswordHash) || errors.Is(err, ErrInvalidPasswordHash) {
			writeRegisterJSON(w, http.StatusBadRequest, registerErrorResponse{Error: "invalid_register_request"})
			return
		}

		writeRegisterJSON(w, http.StatusInternalServerError, registerErrorResponse{Error: "register_failed"})
		return
	}

	token, err := h.tokens.NewToken()
	if err != nil {
		writeRegisterJSON(w, http.StatusInternalServerError, registerErrorResponse{Error: "register_failed"})
		return
	}
	cookie := h.policy.NewCookie(token, h.now())
	if err := h.sessions.CreateSession(r.Context(), session.SessionRecord{UserID: user.ID, Token: token, ExpiresAt: cookie.Expires}); err != nil {
		writeRegisterJSON(w, http.StatusInternalServerError, registerErrorResponse{Error: "register_failed"})
		return
	}

	http.SetCookie(w, cookie)
	writeRegisterJSON(w, http.StatusCreated, registerResponse{User: registerUserResponse{ID: user.ID, Email: user.Email, DisplayName: strings.TrimSpace(user.DisplayName)}})
}

func decodeRegisterRequest(r *http.Request) (registerRequest, error) {
	defer r.Body.Close()

	var request registerRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		return registerRequest{}, err
	}

	return request, nil
}

func writeRegisterJSON(w http.ResponseWriter, statusCode int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		return
	}
}
