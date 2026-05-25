package attempts

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
)

const DefaultRealtimeModel = "gpt-realtime-2"

var (
	ErrMissingStore           = errors.New("lesson attempt store is required")
	ErrInvalidIdentity        = errors.New("exactly one attempt identity is required")
	ErrMissingLessonReference = errors.New("lesson reference is required")
	ErrMissingAttemptID       = errors.New("attempt ID is required")
	ErrAttemptNotFound        = errors.New("lesson attempt not found")
)

type Identity struct {
	UserID              string
	AnonymousProgressID string
}

type StartRecord struct {
	Identity       Identity
	LessonPlanID   string
	LegacyLessonID string
	RealtimeModel  string
}

type CompleteRecord struct {
	Identity  Identity
	AttemptID string
}

type Attempt struct {
	ID     string
	Status string
}

type Starter interface {
	StartAttempt(ctx context.Context, record StartRecord) (Attempt, error)
}

type Completer interface {
	CompleteAttempt(ctx context.Context, record CompleteRecord) (Attempt, error)
}

type Store interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

type PostgresRepository struct{ store Store }

func NewPostgresRepository(store Store) (*PostgresRepository, error) {
	if store == nil {
		return nil, ErrMissingStore
	}
	return &PostgresRepository{store: store}, nil
}

func (r *PostgresRepository) StartAttempt(ctx context.Context, record StartRecord) (Attempt, error) {
	normalized, err := normalizeStartRecord(record)
	if err != nil {
		return Attempt{}, err
	}

	var attempt Attempt
	err = r.store.QueryRow(
		ctx,
		insertAttemptSQL,
		nullableString(normalized.Identity.UserID),
		nullableString(normalized.Identity.AnonymousProgressID),
		nullableString(normalized.LessonPlanID),
		nullableString(normalized.LegacyLessonID),
		normalized.RealtimeModel,
	).Scan(&attempt.ID, &attempt.Status)
	if err != nil {
		return Attempt{}, fmt.Errorf("start lesson attempt: %w", err)
	}
	if strings.TrimSpace(attempt.ID) == "" {
		return Attempt{}, ErrMissingAttemptID
	}

	return attempt, nil
}

func (r *PostgresRepository) CompleteAttempt(ctx context.Context, record CompleteRecord) (Attempt, error) {
	normalized, err := normalizeCompleteRecord(record)
	if err != nil {
		return Attempt{}, err
	}

	query := completeUserAttemptSQL
	identityArg := normalized.Identity.UserID
	if normalized.Identity.UserID == "" {
		query = completeAnonymousAttemptSQL
		identityArg = normalized.Identity.AnonymousProgressID
	}

	var attempt Attempt
	if err := r.store.QueryRow(ctx, query, normalized.AttemptID, identityArg).Scan(&attempt.ID, &attempt.Status); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Attempt{}, ErrAttemptNotFound
		}
		return Attempt{}, fmt.Errorf("complete lesson attempt: %w", err)
	}
	if strings.TrimSpace(attempt.ID) == "" {
		return Attempt{}, ErrMissingAttemptID
	}

	return attempt, nil
}

func normalizeStartRecord(record StartRecord) (StartRecord, error) {
	identity, err := normalizeIdentity(record.Identity)
	if err != nil {
		return StartRecord{}, err
	}

	lessonPlanID := strings.TrimSpace(record.LessonPlanID)
	legacyLessonID := strings.TrimSpace(record.LegacyLessonID)
	if lessonPlanID == "" && legacyLessonID == "" {
		return StartRecord{}, ErrMissingLessonReference
	}

	realtimeModel := strings.TrimSpace(record.RealtimeModel)
	if realtimeModel == "" {
		realtimeModel = DefaultRealtimeModel
	}

	return StartRecord{
		Identity:       identity,
		LessonPlanID:   lessonPlanID,
		LegacyLessonID: legacyLessonID,
		RealtimeModel:  realtimeModel,
	}, nil
}

func normalizeCompleteRecord(record CompleteRecord) (CompleteRecord, error) {
	identity, err := normalizeIdentity(record.Identity)
	if err != nil {
		return CompleteRecord{}, err
	}

	attemptID := strings.TrimSpace(record.AttemptID)
	if attemptID == "" {
		return CompleteRecord{}, ErrMissingAttemptID
	}

	return CompleteRecord{Identity: identity, AttemptID: attemptID}, nil
}

func normalizeIdentity(identity Identity) (Identity, error) {
	userID := strings.TrimSpace(identity.UserID)
	anonymousProgressID := strings.TrimSpace(identity.AnonymousProgressID)
	if (userID == "") == (anonymousProgressID == "") {
		return Identity{}, ErrInvalidIdentity
	}
	return Identity{UserID: userID, AnonymousProgressID: anonymousProgressID}, nil
}

func nullableString(value string) any {
	if value == "" {
		return nil
	}
	return value
}

const insertAttemptSQL = `
INSERT INTO lesson_attempts (
  user_id,
  anonymous_progress_id,
  lesson_plan_id,
  legacy_lesson_id,
  status,
  realtime_model
)
VALUES ($1, $2, $3, $4, 'started', $5)
RETURNING id::text, status
`

const completeUserAttemptSQL = `
UPDATE lesson_attempts
SET status = 'completed', completed_at = now()
WHERE id = $1 AND user_id = $2 AND status = 'started'
RETURNING id::text, status
`

const completeAnonymousAttemptSQL = `
UPDATE lesson_attempts
SET status = 'completed', completed_at = now()
WHERE id = $1 AND anonymous_progress_id = $2 AND status = 'started'
RETURNING id::text, status
`
