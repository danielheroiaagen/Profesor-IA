package progress

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
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

type ProgressSummary struct {
	TotalXP          int
	CompletedLessons int
}

type SummaryProvider interface {
	SummarizeProgress(ctx context.Context, identity AwardIdentity) (ProgressSummary, error)
}

type AwardStore interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
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

	query := insertUserProgressAwardSQL
	identityArg := identity.UserID
	if identity.UserID == "" {
		query = insertAnonymousProgressAwardSQL
		identityArg = identity.AnonymousProgressID
	}

	commandTag, err := r.store.Exec(
		ctx,
		query,
		attemptID,
		identityArg,
		record.Decision.XP,
		record.Decision.Reason,
	)
	if err != nil {
		return false, fmt.Errorf("record progress award: %w", err)
	}

	return commandTag.RowsAffected() > 0, nil
}

func (r *PostgresAwardRepository) SummarizeProgress(ctx context.Context, identity AwardIdentity) (ProgressSummary, error) {
	normalized, err := normalizeAwardIdentity(identity)
	if err != nil {
		return ProgressSummary{}, err
	}

	query := selectUserProgressSummarySQL
	arg := normalized.UserID
	if normalized.UserID == "" {
		query = selectAnonymousProgressSummarySQL
		arg = normalized.AnonymousProgressID
	}

	var summary ProgressSummary
	if err := r.store.QueryRow(ctx, query, arg).Scan(&summary.TotalXP, &summary.CompletedLessons); err != nil {
		return ProgressSummary{}, fmt.Errorf("summarize progress: %w", err)
	}

	return summary, nil
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

const insertUserProgressAwardSQL = `
INSERT INTO progress_awards (
  user_id,
  anonymous_progress_id,
  attempt_id,
  xp,
  reason
)
SELECT user_id, NULL, id, $3, $4
FROM lesson_attempts
WHERE id = $1 AND user_id = $2 AND status = 'completed'
ON CONFLICT (attempt_id) DO NOTHING
`

const insertAnonymousProgressAwardSQL = `
INSERT INTO progress_awards (
  user_id,
  anonymous_progress_id,
  attempt_id,
  xp,
  reason
)
SELECT NULL, anonymous_progress_id, id, $3, $4
FROM lesson_attempts
WHERE id = $1 AND anonymous_progress_id = $2 AND status = 'completed'
ON CONFLICT (attempt_id) DO NOTHING
`

const selectUserProgressSummarySQL = `
SELECT COALESCE(SUM(xp), 0)::integer AS total_xp, COUNT(*)::integer AS completed_lessons
FROM progress_awards
WHERE user_id = $1
`

const selectAnonymousProgressSummarySQL = `
SELECT COALESCE(SUM(xp), 0)::integer AS total_xp, COUNT(*)::integer AS completed_lessons
FROM progress_awards
WHERE anonymous_progress_id = $1
`
