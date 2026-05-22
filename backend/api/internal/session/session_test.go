package session

import (
	"bytes"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"
)

func TestTokenGeneratorCreatesOpaqueURLSafeToken(t *testing.T) {
	t.Parallel()

	generator := NewTokenGeneratorWithReader(bytes.NewReader(bytes.Repeat([]byte{0xab}, DefaultTokenSize)), DefaultTokenSize)
	token, err := generator.NewToken()

	if err != nil {
		t.Fatalf("expected token, got error: %v", err)
	}
	if len(token) != 43 {
		t.Fatalf("expected 43 character token, got %d", len(token))
	}
	if strings.ContainsAny(token, "+/=") {
		t.Fatalf("expected URL-safe unpadded token, got %q", token)
	}
}

func TestTokenGeneratorRejectsInvalidConfiguration(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name      string
		generator TokenGenerator
		expected  error
	}{
		{
			name:      "missing reader",
			generator: NewTokenGeneratorWithReader(nil, DefaultTokenSize),
			expected:  ErrMissingTokenReader,
		},
		{
			name:      "invalid size",
			generator: NewTokenGeneratorWithReader(bytes.NewReader(nil), 0),
			expected:  ErrInvalidTokenSize,
		},
		{
			name:      "reader failure",
			generator: NewTokenGeneratorWithReader(failingReader{}, DefaultTokenSize),
			expected:  errTokenReader,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			_, err := tc.generator.NewToken()
			if !errors.Is(err, tc.expected) {
				t.Fatalf("expected %v, got %v", tc.expected, err)
			}
		})
	}
}

func TestCookiePolicyCreatesSecureHTTPOnlyCookie(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 5, 22, 12, 0, 0, 0, time.UTC)
	cookie := NewCookiePolicy(true).NewCookie("session-token", now)

	if cookie.Name != CookieName {
		t.Fatalf("expected cookie name %q, got %q", CookieName, cookie.Name)
	}
	if cookie.Value != "session-token" {
		t.Fatalf("expected cookie value to be set")
	}
	if cookie.Path != "/" {
		t.Fatalf("expected root path, got %q", cookie.Path)
	}
	if cookie.MaxAge != int((30*24*time.Hour).Seconds()) {
		t.Fatalf("expected 30 day max age, got %d", cookie.MaxAge)
	}
	if !cookie.Expires.Equal(now.Add(30 * 24 * time.Hour)) {
		t.Fatalf("expected expiry 30 days after now, got %s", cookie.Expires)
	}
	if !cookie.HttpOnly {
		t.Fatal("expected HTTP-only cookie")
	}
	if !cookie.Secure {
		t.Fatal("expected secure cookie")
	}
	if cookie.SameSite != http.SameSiteLaxMode {
		t.Fatalf("expected lax same-site mode, got %d", cookie.SameSite)
	}
}

func TestCookiePolicyCreatesExpiredCookie(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 5, 22, 12, 0, 0, 0, time.UTC)
	cookie := NewCookiePolicy(false).ExpiredCookie(now)

	if cookie.Name != CookieName {
		t.Fatalf("expected cookie name %q, got %q", CookieName, cookie.Name)
	}
	if cookie.Value != "" {
		t.Fatalf("expected empty expired cookie value, got %q", cookie.Value)
	}
	if cookie.MaxAge != -1 {
		t.Fatalf("expected deletion max age, got %d", cookie.MaxAge)
	}
	if !cookie.Expires.Before(now) {
		t.Fatalf("expected expiry before now, got %s", cookie.Expires)
	}
	if !cookie.HttpOnly {
		t.Fatal("expected HTTP-only expired cookie")
	}
	if cookie.Secure {
		t.Fatal("expected insecure local-development cookie")
	}
	if cookie.SameSite != http.SameSiteLaxMode {
		t.Fatalf("expected lax same-site mode, got %d", cookie.SameSite)
	}
}

var errTokenReader = errors.New("token reader failed")

type failingReader struct{}

func (failingReader) Read([]byte) (int, error) {
	return 0, errTokenReader
}

var _ io.Reader = failingReader{}
