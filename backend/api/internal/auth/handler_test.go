package auth

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/danielheroiaagen/Profesor-IA/backend/api/internal/session"
)

const testBcryptCost = 4

func TestRegisterCreatesUserSessionAndSafeResponse(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 5, 23, 12, 0, 0, 0, time.UTC)
	users := &fakeRegisterUsers{user: CredentialUser{ID: "user-1", Email: "teacher@example.com", DisplayName: "Teacher", PasswordHash: validCredentialHash()}}
	sessions := &fakeRegisterSessions{}
	handler := NewHandlerWithConfig(RegisterConfig{
		Users:    users,
		Sessions: sessions,
		Tokens:   fixedTokenGenerator("session-token"),
		Hasher:   PasswordHasher{Cost: testBcryptCost},
		Policy:   session.NewCookiePolicy(true),
		Now:      func() time.Time { return now },
	})
	request := httptest.NewRequest(http.MethodPost, "/v1/auth/register", strings.NewReader(`{"email":" Teacher@Example.COM ","password":"correct horse battery staple","displayName":" Teacher "}`))
	response := httptest.NewRecorder()

	handler.Register(response, request)

	if response.Code != http.StatusCreated {
		t.Fatalf("expected status %d, got %d body=%s", http.StatusCreated, response.Code, response.Body.String())
	}
	if users.record.Email != "teacher@example.com" || users.record.DisplayName != "Teacher" {
		t.Fatalf("unexpected user record: %+v", users.record)
	}
	if users.record.PasswordHash == "correct horse battery staple" || !strings.HasPrefix(users.record.PasswordHash, "$2") {
		t.Fatalf("expected bcrypt hash, got %q", users.record.PasswordHash)
	}
	if sessions.record.UserID != "user-1" || sessions.record.Token != "session-token" || sessions.record.ExpiresAt.IsZero() {
		t.Fatalf("unexpected session record: %+v", sessions.record)
	}
	cookie := response.Result().Cookies()[0]
	if cookie.Name != session.CookieName || cookie.Value != "session-token" || !cookie.HttpOnly || !cookie.Secure {
		t.Fatalf("unexpected session cookie: %+v", cookie)
	}
	body := response.Body.String()
	if !strings.Contains(body, `"email":"teacher@example.com"`) || strings.Contains(body, "PasswordHash") || strings.Contains(body, "correct horse") || strings.Contains(body, users.record.PasswordHash) {
		t.Fatalf("unsafe register response: %s", body)
	}
}

func TestRegisterErrors(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		handler Handler
		method  string
		body    string
		status  int
		code    string
	}{
		{name: "unavailable", handler: NewHandlerWithConfig(RegisterConfig{}), method: http.MethodPost, body: `{}`, status: http.StatusServiceUnavailable, code: "auth_unavailable"},
		{name: "unsupported method", handler: readyRegisterHandler(), method: http.MethodGet, status: http.StatusMethodNotAllowed, code: "method_not_allowed"},
		{name: "bad json", handler: readyRegisterHandler(), method: http.MethodPost, body: `{`, status: http.StatusBadRequest, code: "invalid_register_request"},
		{name: "weak password", handler: readyRegisterHandler(), method: http.MethodPost, body: `{"email":"teacher@example.com","password":"short"}`, status: http.StatusBadRequest, code: "invalid_register_request"},
		{name: "duplicate email", handler: NewHandlerWithConfig(RegisterConfig{Users: &fakeRegisterUsers{err: ErrEmailAlreadyExists}, Sessions: &fakeRegisterSessions{}, Tokens: fixedTokenGenerator("session-token"), Hasher: PasswordHasher{Cost: testBcryptCost}, Policy: session.NewCookiePolicy(true)}), method: http.MethodPost, body: `{"email":"teacher@example.com","password":"correct horse battery staple"}`, status: http.StatusConflict, code: "email_already_exists"},
		{name: "session failure", handler: NewHandlerWithConfig(RegisterConfig{Users: &fakeRegisterUsers{user: CredentialUser{ID: "user-1", Email: "teacher@example.com"}}, Sessions: &fakeRegisterSessions{err: errors.New("database unavailable")}, Tokens: fixedTokenGenerator("session-token"), Hasher: PasswordHasher{Cost: testBcryptCost}, Policy: session.NewCookiePolicy(true)}), method: http.MethodPost, body: `{"email":"teacher@example.com","password":"correct horse battery staple"}`, status: http.StatusInternalServerError, code: "register_failed"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			request := httptest.NewRequest(tc.method, "/v1/auth/register", strings.NewReader(tc.body))
			response := httptest.NewRecorder()
			tc.handler.Register(response, request)

			if response.Code != tc.status {
				t.Fatalf("expected status %d, got %d body=%s", tc.status, response.Code, response.Body.String())
			}
			if !strings.Contains(response.Body.String(), `"error":"`+tc.code+`"`) {
				t.Fatalf("expected error %q in body %s", tc.code, response.Body.String())
			}
		})
	}
}

func TestLoginCreatesSessionAndSafeResponse(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 5, 24, 12, 0, 0, 0, time.UTC)
	users := &fakeLoginUsers{user: CredentialUser{ID: "user-1", Email: "teacher@example.com", DisplayName: "Teacher", PasswordHash: validCredentialHash()}}
	sessions := &fakeRegisterSessions{}
	handler := NewHandlerWithConfig(RegisterConfig{
		UserFinder: users,
		Sessions:   sessions,
		Tokens:     fixedTokenGenerator("session-token"),
		Policy:     session.NewCookiePolicy(true),
		Now:        func() time.Time { return now },
	})
	request := httptest.NewRequest(http.MethodPost, "/v1/auth/login", strings.NewReader(`{"email":" Teacher@Example.COM ","password":"correct horse battery staple"}`))
	response := httptest.NewRecorder()

	handler.Login(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d body=%s", http.StatusOK, response.Code, response.Body.String())
	}
	if users.email != "teacher@example.com" {
		t.Fatalf("expected normalized lookup email, got %q", users.email)
	}
	if sessions.record.UserID != "user-1" || sessions.record.Token != "session-token" || sessions.record.ExpiresAt.IsZero() {
		t.Fatalf("unexpected session record: %+v", sessions.record)
	}
	cookie := response.Result().Cookies()[0]
	if cookie.Name != session.CookieName || cookie.Value != "session-token" || !cookie.HttpOnly || !cookie.Secure {
		t.Fatalf("unexpected session cookie: %+v", cookie)
	}
	body := response.Body.String()
	if !strings.Contains(body, `"email":"teacher@example.com"`) || strings.Contains(body, "PasswordHash") || strings.Contains(body, "correct horse") || strings.Contains(body, users.user.PasswordHash) {
		t.Fatalf("unsafe login response: %s", body)
	}
}

func TestLoginErrors(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		handler Handler
		method  string
		body    string
		status  int
		code    string
	}{
		{name: "unavailable", handler: NewHandlerWithConfig(RegisterConfig{}), method: http.MethodPost, body: `{}`, status: http.StatusServiceUnavailable, code: "auth_unavailable"},
		{name: "unsupported method", handler: readyLoginHandler(), method: http.MethodGet, status: http.StatusMethodNotAllowed, code: "method_not_allowed"},
		{name: "bad json", handler: readyLoginHandler(), method: http.MethodPost, body: `{`, status: http.StatusBadRequest, code: "invalid_login_request"},
		{name: "invalid email", handler: readyLoginHandler(), method: http.MethodPost, body: `{"email":"bad email","password":"correct horse battery staple"}`, status: http.StatusBadRequest, code: "invalid_login_request"},
		{name: "missing user", handler: NewHandlerWithConfig(RegisterConfig{UserFinder: &fakeLoginUsers{err: ErrUserNotFound}, Sessions: &fakeRegisterSessions{}, Tokens: fixedTokenGenerator("session-token"), Policy: session.NewCookiePolicy(true)}), method: http.MethodPost, body: `{"email":"teacher@example.com","password":"correct horse battery staple"}`, status: http.StatusUnauthorized, code: "invalid_credentials"},
		{name: "wrong password", handler: readyLoginHandler(), method: http.MethodPost, body: `{"email":"teacher@example.com","password":"wrong horse battery staple"}`, status: http.StatusUnauthorized, code: "invalid_credentials"},
		{name: "invalid stored hash", handler: NewHandlerWithConfig(RegisterConfig{UserFinder: &fakeLoginUsers{user: CredentialUser{ID: "user-1", Email: "teacher@example.com", PasswordHash: "not-bcrypt"}}, Sessions: &fakeRegisterSessions{}, Tokens: fixedTokenGenerator("session-token"), Policy: session.NewCookiePolicy(true)}), method: http.MethodPost, body: `{"email":"teacher@example.com","password":"correct horse battery staple"}`, status: http.StatusInternalServerError, code: "login_failed"},
		{name: "session failure", handler: NewHandlerWithConfig(RegisterConfig{UserFinder: &fakeLoginUsers{user: CredentialUser{ID: "user-1", Email: "teacher@example.com", PasswordHash: validCredentialHash()}}, Sessions: &fakeRegisterSessions{err: errors.New("database unavailable")}, Tokens: fixedTokenGenerator("session-token"), Policy: session.NewCookiePolicy(true)}), method: http.MethodPost, body: `{"email":"teacher@example.com","password":"correct horse battery staple"}`, status: http.StatusInternalServerError, code: "login_failed"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			request := httptest.NewRequest(tc.method, "/v1/auth/login", strings.NewReader(tc.body))
			response := httptest.NewRecorder()
			tc.handler.Login(response, request)

			if response.Code != tc.status {
				t.Fatalf("expected status %d, got %d body=%s", tc.status, response.Code, response.Body.String())
			}
			if !strings.Contains(response.Body.String(), `"error":"`+tc.code+`"`) {
				t.Fatalf("expected error %q in body %s", tc.code, response.Body.String())
			}
		})
	}
}

func readyRegisterHandler() Handler {
	return NewHandlerWithConfig(RegisterConfig{
		Users:    &fakeRegisterUsers{user: CredentialUser{ID: "user-1", Email: "teacher@example.com"}},
		Sessions: &fakeRegisterSessions{},
		Tokens:   fixedTokenGenerator("session-token"),
		Hasher:   PasswordHasher{Cost: testBcryptCost},
		Policy:   session.NewCookiePolicy(true),
	})
}

func readyLoginHandler() Handler {
	return NewHandlerWithConfig(RegisterConfig{
		UserFinder: &fakeLoginUsers{user: CredentialUser{ID: "user-1", Email: "teacher@example.com", PasswordHash: validCredentialHash()}},
		Sessions:   &fakeRegisterSessions{},
		Tokens:     fixedTokenGenerator("session-token"),
		Policy:     session.NewCookiePolicy(true),
	})
}

type fakeRegisterUsers struct {
	record CredentialUserRecord
	user   CredentialUser
	err    error
}

func (u *fakeRegisterUsers) CreateCredentialUser(_ context.Context, record CredentialUserRecord) (CredentialUser, error) {
	u.record = record
	return u.user, u.err
}

type fakeLoginUsers struct {
	email string
	user  CredentialUser
	err   error
}

func (u *fakeLoginUsers) FindCredentialUserByEmail(_ context.Context, email string) (CredentialUser, error) {
	u.email = email
	return u.user, u.err
}

type fakeRegisterSessions struct {
	record session.SessionRecord
	err    error
}

func (s *fakeRegisterSessions) CreateSession(_ context.Context, record session.SessionRecord) error {
	s.record = record
	return s.err
}

type fixedTokenGenerator string

func (g fixedTokenGenerator) NewToken() (string, error) { return string(g), nil }
