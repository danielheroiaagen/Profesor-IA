package auth

import (
	"errors"
	"strings"
	"testing"

	"golang.org/x/crypto/bcrypt"
)

func TestNormalizeEmail(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		email    string
		expected string
		err      error
	}{
		{name: "normalizes", email: " Teacher@Example.COM ", expected: "teacher@example.com"},
		{name: "missing", email: " ", err: ErrMissingEmail},
		{name: "invalid", email: "teacher example.com", err: ErrInvalidEmail},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			actual, err := NormalizeEmail(tc.email)
			if !errors.Is(err, tc.err) {
				t.Fatalf("expected error %v, got %v", tc.err, err)
			}
			if actual != tc.expected {
				t.Fatalf("expected %q, got %q", tc.expected, actual)
			}
		})
	}
}

func TestPasswordHasherHashesAndVerifiesPasswords(t *testing.T) {
	t.Parallel()

	hasher := PasswordHasher{Cost: bcrypt.MinCost}
	hash, err := hasher.HashPassword("correct horse battery staple")

	if err != nil {
		t.Fatalf("hash password: %v", err)
	}
	if hash == "correct horse battery staple" || !strings.HasPrefix(hash, "$2") {
		t.Fatalf("expected bcrypt hash, got %q", hash)
	}
	if err := VerifyPassword(hash, "correct horse battery staple"); err != nil {
		t.Fatalf("verify password: %v", err)
	}
}

func TestPasswordHasherRejectsUnsafeInputs(t *testing.T) {
	t.Parallel()

	hasher := PasswordHasher{Cost: bcrypt.MinCost}

	cases := []struct {
		name     string
		password string
		expected error
	}{
		{name: "missing", password: "", expected: ErrWeakPassword},
		{name: "too short", password: "short", expected: ErrWeakPassword},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			_, err := hasher.HashPassword(tc.password)
			if !errors.Is(err, tc.expected) {
				t.Fatalf("expected %v, got %v", tc.expected, err)
			}
		})
	}
}

func TestVerifyPasswordRejectsInvalidCredentials(t *testing.T) {
	t.Parallel()

	hasher := PasswordHasher{Cost: bcrypt.MinCost}
	hash, err := hasher.HashPassword("correct horse battery staple")
	if err != nil {
		t.Fatalf("hash password: %v", err)
	}

	cases := []struct {
		name     string
		hash     string
		password string
		expected error
	}{
		{name: "missing hash", password: "correct horse battery staple", expected: ErrMissingPasswordHash},
		{name: "invalid hash", hash: "not-a-bcrypt-hash", password: "correct horse battery staple", expected: ErrInvalidPasswordHash},
		{name: "wrong password", hash: hash, password: "wrong horse battery staple", expected: ErrPasswordMismatch},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			err := VerifyPassword(tc.hash, tc.password)
			if !errors.Is(err, tc.expected) {
				t.Fatalf("expected %v, got %v", tc.expected, err)
			}
		})
	}
}
