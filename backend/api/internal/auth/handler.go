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

type CredentialUserFinder interface {
	FindCredentialUserByEmail(ctx context.Context, email string) (CredentialUser, error)
}

type SessionCreator interface {
	CreateSession(ctx context.Context, record session.SessionRecord) error
}

type TokenGenerator interface {
	NewToken() (string, error)
}

type RegisterConfig struct {
	Users      CredentialUserCreator
	UserFinder CredentialUserFinder
	Sessions   SessionCreator
	Tokens     TokenGenerator
	Hasher     PasswordHasher
	Policy     session.CookiePolicy
	Now        func() time.Time
}

type Handler struct {
	users      CredentialUserCreator
	userFinder CredentialUserFinder
	sessions   SessionCreator
	tokens     TokenGenerator
	hasher     PasswordHasher
	policy     session.CookiePolicy
	now        func() time.Time
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
	userFinder := config.UserFinder
	if userFinder == nil {
		if finder, ok := config.Users.(CredentialUserFinder); ok {
			userFinder = finder
		}
	}

	return Handler{
		users:      config.Users,
		userFinder: userFinder,
		sessions:   config.Sessions,
		tokens:     tokens,
		hasher:     config.Hasher,
		policy:     config.Policy,
		now:        now,
	}
}

type registerRequest struct {
	Email       string `json:"email"`
	Password    string `json:"password"`
	DisplayName string `json:"displayName"`
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
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

	if err := h.issueSessionCookie(r.Context(), w, user.ID); err != nil {
		writeRegisterJSON(w, http.StatusInternalServerError, registerErrorResponse{Error: "register_failed"})
		return
	}

	writeRegisterJSON(w, http.StatusCreated, registerResponse{User: registerUserResponse{ID: user.ID, Email: user.Email, DisplayName: strings.TrimSpace(user.DisplayName)}})
}

func (h Handler) Login(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeRegisterJSON(w, http.StatusMethodNotAllowed, registerErrorResponse{Error: "method_not_allowed"})
		return
	}
	if h.userFinder == nil || h.sessions == nil {
		writeRegisterJSON(w, http.StatusServiceUnavailable, registerErrorResponse{Error: "auth_unavailable"})
		return
	}

	request, err := decodeLoginRequest(r)
	if err != nil {
		writeRegisterJSON(w, http.StatusBadRequest, registerErrorResponse{Error: "invalid_login_request"})
		return
	}

	email, err := NormalizeEmail(request.Email)
	if err != nil {
		writeRegisterJSON(w, http.StatusBadRequest, registerErrorResponse{Error: "invalid_login_request"})
		return
	}
	user, err := h.userFinder.FindCredentialUserByEmail(r.Context(), email)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			writeRegisterJSON(w, http.StatusUnauthorized, registerErrorResponse{Error: "invalid_credentials"})
			return
		}
		writeRegisterJSON(w, http.StatusInternalServerError, registerErrorResponse{Error: "login_failed"})
		return
	}
	if err := VerifyPassword(user.PasswordHash, request.Password); err != nil {
		if errors.Is(err, ErrPasswordMismatch) || errors.Is(err, ErrMissingPasswordHash) {
			writeRegisterJSON(w, http.StatusUnauthorized, registerErrorResponse{Error: "invalid_credentials"})
			return
		}
		writeRegisterJSON(w, http.StatusInternalServerError, registerErrorResponse{Error: "login_failed"})
		return
	}
	if err := h.issueSessionCookie(r.Context(), w, user.ID); err != nil {
		writeRegisterJSON(w, http.StatusInternalServerError, registerErrorResponse{Error: "login_failed"})
		return
	}

	writeRegisterJSON(w, http.StatusOK, registerResponse{User: registerUserResponse{ID: user.ID, Email: user.Email, DisplayName: strings.TrimSpace(user.DisplayName)}})
}

func decodeRegisterRequest(r *http.Request) (registerRequest, error) {
	defer r.Body.Close()

	var request registerRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		return registerRequest{}, err
	}

	return request, nil
}

func decodeLoginRequest(r *http.Request) (loginRequest, error) {
	defer r.Body.Close()

	var request loginRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		return loginRequest{}, err
	}

	return request, nil
}

func (h Handler) issueSessionCookie(ctx context.Context, w http.ResponseWriter, userID string) error {
	token, err := h.tokens.NewToken()
	if err != nil {
		return err
	}
	cookie := h.policy.NewCookie(token, h.now())
	if err := h.sessions.CreateSession(ctx, session.SessionRecord{UserID: userID, Token: token, ExpiresAt: cookie.Expires}); err != nil {
		return err
	}

	http.SetCookie(w, cookie)
	return nil
}

func writeRegisterJSON(w http.ResponseWriter, statusCode int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		return
	}
}
