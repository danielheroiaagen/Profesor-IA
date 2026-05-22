package progress

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgconn"
)

var (
	ErrMissingAwardStore    = errors.New("progress award store is required")
	ErrMissingAttemptID     = errors.New("attempt ID is required")
	ErrInvalidAwardIdentity = errors.New("exactly one award identity is required")
)

type AwardIdentity struct {
	UserID              string
	AnonymousProgressID string
}

type AwardRecord struct {
	Identity  AwardIdentity
	AttemptID string
	Decision  AwardDecision
}

type AwardStore interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

type PostgresAwardRepository struct {
	store AwardStore
}

func NewPostgresAwardRepository(store AwardStore) (*PostgresAwardRepository, error) {
	if store == nil {
		return nil, ErrMissingAwardStore
	}

	return &PostgresAwardRepository{store: store}, nil
}

func (r *PostgresAwardRepository) RecordAward(ctx context.Context, record AwardRecord) (bool, error) {
	if !record.Decision.Awarded || record.Decision.XP <= 0 {
		return false, nil
	}

	attemptID := strings.TrimSpace(record.AttemptID)
	if attemptID == "" {
		return false, ErrMissingAttemptID
	}

	identity, err := normalizeAwardIdentity(record.Identity)
	if err != nil {
		return false, err
	}

	commandTag, err := r.store.Exec(
		ctx,
		insertProgressAwardSQL,
		nullableString(identity.UserID),
		nullableString(identity.AnonymousProgressID),
		attemptID,
		record.Decision.XP,
		record.Decision.Reason,
	)
	if err != nil {
		return false, fmt.Errorf("record progress award: %w", err)
	}

	return commandTag.RowsAffected() > 0, nil
}

func normalizeAwardIdentity(identity AwardIdentity) (AwardIdentity, error) {
	userID := strings.TrimSpace(identity.UserID)
	anonymousProgressID := strings.TrimSpace(identity.AnonymousProgressID)

	if (userID == "") == (anonymousProgressID == "") {
		return AwardIdentity{}, ErrInvalidAwardIdentity
	}

	return AwardIdentity{
		UserID:              userID,
		AnonymousProgressID: anonymousProgressID,
	}, nil
}

func nullableString(value string) any {
	if value == "" {
		return nil
	}

	return value
}

const insertProgressAwardSQL = `
INSERT INTO progress_awards (
  user_id,
  anonymous_progress_id,
  attempt_id,
  xp,
  reason
)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (attempt_id) DO NOTHING
`
