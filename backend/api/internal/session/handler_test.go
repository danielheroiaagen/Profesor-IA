package session

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestLogoutRevokesSessionAndClearsCookie(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 5, 22, 12, 0, 0, 0, time.UTC)
	revoker := &fakeSessionRevoker{revoked: true}
	handler := NewHandlerWithClock(revoker, NewCookiePolicy(true), func() time.Time { return now })
	request := httptest.NewRequest(http.MethodPost, "/v1/session/logout", nil)
	request.AddCookie(&http.Cookie{Name: CookieName, Value: "session-token"})
	response := httptest.NewRecorder()

	handler.Logout(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, response.Code)
	}
	if revoker.token != "session-token" {
		t.Fatalf("expected revoked token, got %q", revoker.token)
	}
	assertSessionBodyContains(t, response, `"revoked":true`)
	assertExpiredSessionCookie(t, response, now, true)
}

func TestLogoutWithoutCookieIsIdempotent(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 5, 22, 12, 0, 0, 0, time.UTC)
	revoker := &fakeSessionRevoker{revoked: true}
	handler := NewHandlerWithClock(revoker, NewCookiePolicy(false), func() time.Time { return now })
	response := httptest.NewRecorder()

	handler.Logout(response, httptest.NewRequest(http.MethodPost, "/v1/session/logout", nil))

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, response.Code)
	}
	if revoker.called {
		t.Fatal("expected missing cookie to skip revocation")
	}
	assertSessionBodyContains(t, response, `"revoked":false`)
	assertExpiredSessionCookie(t, response, now, false)
}

func TestLogoutErrors(t *testing.T) {
	t.Parallel()

	expectedErr := errors.New("database unavailable")
	cases := []struct {
		name    string
		handler Handler
		request *http.Request
		status  int
		code    string
	}{
		{
			name:    "revoker failure",
			handler: NewHandler(&fakeSessionRevoker{err: expectedErr}, NewCookiePolicy(true)),
			request: requestWithSessionCookie(http.MethodPost, "session-token"),
			status:  http.StatusInternalServerError,
			code:    "logout_failed",
		},
		{
			name:    "unsupported method",
			handler: NewHandler(&fakeSessionRevoker{}, NewCookiePolicy(true)),
			request: requestWithSessionCookie(http.MethodGet, "session-token"),
			status:  http.StatusMethodNotAllowed,
			code:    "method_not_allowed",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			response := httptest.NewRecorder()
			tc.handler.Logout(response, tc.request)

			if response.Code != tc.status {
				t.Fatalf("expected status %d, got %d", tc.status, response.Code)
			}
			assertSessionBodyContains(t, response, `"error":"`+tc.code+`"`)
		})
	}
}

func requestWithSessionCookie(method string, value string) *http.Request {
	request := httptest.NewRequest(method, "/v1/session/logout", nil)
	request.AddCookie(&http.Cookie{Name: CookieName, Value: value})
	return request
}

func assertExpiredSessionCookie(t *testing.T, response *httptest.ResponseRecorder, now time.Time, secure bool) {
	t.Helper()

	cookies := response.Result().Cookies()
	if len(cookies) != 1 {
		t.Fatalf("expected one cookie, got %d", len(cookies))
	}
	cookie := cookies[0]
	if cookie.Name != CookieName || cookie.Value != "" || cookie.MaxAge != -1 {
		t.Fatalf("expected expired session cookie, got %+v", cookie)
	}
	if !cookie.HttpOnly || cookie.Secure != secure || cookie.SameSite != http.SameSiteLaxMode {
		t.Fatalf("unexpected cookie policy: %+v", cookie)
	}
	if !cookie.Expires.Before(now) {
		t.Fatalf("expected cookie expiry before now, got %s", cookie.Expires)
	}
}

func assertSessionBodyContains(t *testing.T, response *httptest.ResponseRecorder, snippet string) {
	t.Helper()

	if !strings.Contains(response.Body.String(), snippet) {
		t.Fatalf("expected body %q to contain %q", response.Body.String(), snippet)
	}
}

type fakeSessionRevoker struct {
	called  bool
	token   string
	revoked bool
	err     error
}

func (r *fakeSessionRevoker) RevokeSession(_ context.Context, token string) (bool, error) {
	r.called = true
	r.token = token
	return r.revoked, r.err
}
