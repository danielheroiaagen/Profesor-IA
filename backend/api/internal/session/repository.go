package session

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

var (
	ErrMissingSessionStore  = errors.New("session store is required")
	ErrMissingUserID        = errors.New("session user ID is required")
	ErrMissingSessionToken  = errors.New("session token is required")
	ErrMissingSessionExpiry = errors.New("session expiry is required")
	ErrExpiredSession       = errors.New("session is expired")
	ErrSessionNotFound      = errors.New("session not found")
)

type SessionIdentity struct {
	UserID string
}

type SessionRecord struct {
	UserID    string
	Token     string
	ExpiresAt time.Time
}

type SessionStore interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

type PostgresSessionRepository struct {
	store SessionStore
	now   func() time.Time
}

func NewPostgresSessionRepository(store SessionStore) (*PostgresSessionRepository, error) {
	return NewPostgresSessionRepositoryWithClock(store, time.Now)
}

func NewPostgresSessionRepositoryWithClock(store SessionStore, now func() time.Time) (*PostgresSessionRepository, error) {
	if store == nil {
		return nil, ErrMissingSessionStore
	}
	if now == nil {
		now = time.Now
	}

	return &PostgresSessionRepository{store: store, now: now}, nil
}

func (r *PostgresSessionRepository) CreateSession(ctx context.Context, record SessionRecord) error {
	normalized, err := r.normalizeRecord(record)
	if err != nil {
		return err
	}

	sessionHash, err := hashSessionToken(normalized.Token)
	if err != nil {
		return err
	}

	_, err = r.store.Exec(ctx, insertSessionSQL, normalized.UserID, sessionHash, normalized.ExpiresAt)
	if err != nil {
		return fmt.Errorf("create session: %w", err)
	}

	return nil
}

func (r *PostgresSessionRepository) ResolveSession(ctx context.Context, token string) (SessionIdentity, error) {
	sessionHash, err := hashSessionToken(token)
	if err != nil {
		return SessionIdentity{}, err
	}

	var userID string
	var expiresAt time.Time
	if err := r.store.QueryRow(ctx, selectSessionSQL, sessionHash).Scan(&userID, &expiresAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return SessionIdentity{}, ErrSessionNotFound
		}

		return SessionIdentity{}, fmt.Errorf("resolve session: %w", err)
	}

	userID = strings.TrimSpace(userID)
	if userID == "" {
		return SessionIdentity{}, ErrMissingUserID
	}
	if !expiresAt.After(r.now()) {
		return SessionIdentity{}, ErrExpiredSession
	}

	return SessionIdentity{UserID: userID}, nil
}

func (r *PostgresSessionRepository) RevokeSession(ctx context.Context, token string) (bool, error) {
	sessionHash, err := hashSessionToken(token)
	if err != nil {
		return false, err
	}

	commandTag, err := r.store.Exec(ctx, revokeSessionSQL, sessionHash, r.now())
	if err != nil {
		return false, fmt.Errorf("revoke session: %w", err)
	}

	return commandTag.RowsAffected() > 0, nil
}

func (r *PostgresSessionRepository) normalizeRecord(record SessionRecord) (SessionRecord, error) {
	userID := strings.TrimSpace(record.UserID)
	if userID == "" {
		return SessionRecord{}, ErrMissingUserID
	}
	if strings.TrimSpace(record.Token) == "" {
		return SessionRecord{}, ErrMissingSessionToken
	}
	if record.ExpiresAt.IsZero() {
		return SessionRecord{}, ErrMissingSessionExpiry
	}
	if !record.ExpiresAt.After(r.now()) {
		return SessionRecord{}, ErrExpiredSession
	}

	return SessionRecord{UserID: userID, Token: record.Token, ExpiresAt: record.ExpiresAt}, nil
}

func hashSessionToken(token string) (string, error) {
	value := strings.TrimSpace(token)
	if value == "" {
		return "", ErrMissingSessionToken
	}

	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:]), nil
}

const insertSessionSQL = `
INSERT INTO auth_sessions (
  user_id,
  session_hash,
  expires_at
)
VALUES ($1, $2, $3)
`

const selectSessionSQL = `
SELECT user_id, expires_at
FROM auth_sessions
WHERE session_hash = $1
  AND revoked_at IS NULL
LIMIT 1
`

const revokeSessionSQL = `
UPDATE auth_sessions
SET revoked_at = $2
WHERE session_hash = $1
  AND revoked_at IS NULL
`
