package auth

import (
	"errors"
	"net/mail"
	"strings"
	"unicode/utf8"

	"golang.org/x/crypto/bcrypt"
)

const MinPasswordLength = 12

var (
	ErrMissingEmail        = errors.New("email is required")
	ErrInvalidEmail        = errors.New("email is invalid")
	ErrWeakPassword        = errors.New("password does not meet minimum requirements")
	ErrMissingPasswordHash = errors.New("password hash is required")
	ErrInvalidPasswordHash = errors.New("password hash is invalid")
	ErrPasswordMismatch    = errors.New("password does not match")
)

type PasswordHasher struct {
	Cost int
}

func NewPasswordHasher() PasswordHasher {
	return PasswordHasher{Cost: bcrypt.DefaultCost}
}

func NormalizeEmail(email string) (string, error) {
	value := strings.TrimSpace(email)
	if value == "" {
		return "", ErrMissingEmail
	}
	if strings.ContainsAny(value, " \t\n\r") {
		return "", ErrInvalidEmail
	}
	parsed, err := mail.ParseAddress(value)
	if err != nil || parsed.Address != value {
		return "", ErrInvalidEmail
	}

	return strings.ToLower(value), nil
}

func (h PasswordHasher) HashPassword(password string) (string, error) {
	if err := validatePassword(password); err != nil {
		return "", err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), h.cost())
	if err != nil {
		return "", err
	}

	return string(hash), nil
}

func VerifyPassword(hash string, password string) error {
	value := strings.TrimSpace(hash)
	if value == "" {
		return ErrMissingPasswordHash
	}
	if _, err := bcrypt.Cost([]byte(value)); err != nil {
		return ErrInvalidPasswordHash
	}
	if err := bcrypt.CompareHashAndPassword([]byte(value), []byte(password)); err != nil {
		return ErrPasswordMismatch
	}

	return nil
}

func (h PasswordHasher) cost() int {
	if h.Cost <= 0 {
		return bcrypt.DefaultCost
	}

	return h.Cost
}

func validatePassword(password string) error {
	if utf8.RuneCountInString(password) < MinPasswordLength {
		return ErrWeakPassword
	}

	return nil
}
