package session

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"
)

const (
	CookieName       = "profesor-ia.session"
	DefaultTokenSize = 32
)

var (
	ErrMissingTokenReader = errors.New("session token reader is required")
	ErrInvalidTokenSize   = errors.New("session token size must be positive")
)

type TokenGenerator struct {
	reader io.Reader
	size   int
}

func NewTokenGenerator() TokenGenerator {
	return TokenGenerator{reader: rand.Reader, size: DefaultTokenSize}
}

func NewTokenGeneratorWithReader(reader io.Reader, size int) TokenGenerator {
	return TokenGenerator{reader: reader, size: size}
}

func (g TokenGenerator) NewToken() (string, error) {
	if g.reader == nil {
		return "", ErrMissingTokenReader
	}
	if g.size <= 0 {
		return "", ErrInvalidTokenSize
	}

	value := make([]byte, g.size)
	if _, err := io.ReadFull(g.reader, value); err != nil {
		return "", fmt.Errorf("generate session token: %w", err)
	}

	return base64.RawURLEncoding.EncodeToString(value), nil
}

type CookiePolicy struct {
	Name     string
	Path     string
	MaxAge   time.Duration
	Secure   bool
	SameSite http.SameSite
}

func NewCookiePolicy(secure bool) CookiePolicy {
	return CookiePolicy{
		Name:     CookieName,
		Path:     "/",
		MaxAge:   30 * 24 * time.Hour,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
	}
}

func (p CookiePolicy) NewCookie(value string, now time.Time) *http.Cookie {
	return &http.Cookie{
		Name:     p.cookieName(),
		Value:    value,
		Path:     p.cookiePath(),
		Expires:  now.Add(p.cookieMaxAge()),
		MaxAge:   int(p.cookieMaxAge().Seconds()),
		HttpOnly: true,
		Secure:   p.Secure,
		SameSite: p.cookieSameSite(),
	}
}

func (p CookiePolicy) ExpiredCookie(now time.Time) *http.Cookie {
	return &http.Cookie{
		Name:     p.cookieName(),
		Value:    "",
		Path:     p.cookiePath(),
		Expires:  now.Add(-1 * time.Hour),
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   p.Secure,
		SameSite: p.cookieSameSite(),
	}
}

func (p CookiePolicy) cookieName() string {
	if p.Name == "" {
		return CookieName
	}

	return p.Name
}

func (p CookiePolicy) cookiePath() string {
	if p.Path == "" {
		return "/"
	}

	return p.Path
}

func (p CookiePolicy) cookieMaxAge() time.Duration {
	if p.MaxAge <= 0 {
		return 30 * 24 * time.Hour
	}

	return p.MaxAge
}

func (p CookiePolicy) cookieSameSite() http.SameSite {
	if p.SameSite == http.SameSiteDefaultMode {
		return http.SameSiteLaxMode
	}

	return p.SameSite
}
