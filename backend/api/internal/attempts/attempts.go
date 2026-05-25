package attempts

import (
	"context"
	"encoding/json"
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
	ErrInvalidEventType       = errors.New("invalid lesson event type")
	ErrInvalidPayload         = errors.New("invalid lesson event payload")
	ErrMissingCorrectionText  = errors.New("feedback correction text is required")
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

type EventRecord struct {
	Identity  Identity
	AttemptID string
	EventType string
	Payload   json.RawMessage
}

type FeedbackRecord struct {
	Identity       Identity
	AttemptID      string
	CorrectionText string
	RubricResult   json.RawMessage
}

type HistoryRecord struct {
	Identity  Identity
	AttemptID string
}

type Attempt struct {
	ID     string
	Status string
}

type RecordedEvent struct {
	ID int64
}

type RecordedFeedback struct {
	ID string
}

type AttemptHistory struct {
	AttemptID string            `json:"attemptId"`
	Status    string            `json:"status"`
	Events    []HistoryEvent    `json:"events"`
	Feedback  []HistoryFeedback `json:"feedback"`
}

type HistoryEvent struct {
	ID         int64           `json:"id"`
	EventType  string          `json:"eventType"`
	Payload    json.RawMessage `json:"payload"`
	OccurredAt string          `json:"occurredAt"`
}

type HistoryFeedback struct {
	ID             string          `json:"id"`
	CorrectionText string          `json:"correctionText"`
	RubricResult   json.RawMessage `json:"rubricResult"`
	CreatedAt      string          `json:"createdAt"`
}

type Starter interface {
	StartAttempt(ctx context.Context, record StartRecord) (Attempt, error)
}

type Completer interface {
	CompleteAttempt(ctx context.Context, record CompleteRecord) (Attempt, error)
}

type EventRecorder interface {
	RecordEvent(ctx context.Context, record EventRecord) (RecordedEvent, error)
}

type FeedbackRecorder interface {
	RecordFeedback(ctx context.Context, record FeedbackRecord) (RecordedFeedback, error)
}

type HistoryProvider interface {
	GetHistory(ctx context.Context, record HistoryRecord) (AttemptHistory, error)
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

func (r *PostgresRepository) RecordEvent(ctx context.Context, record EventRecord) (RecordedEvent, error) {
	normalized, err := normalizeEventRecord(record)
	if err != nil {
		return RecordedEvent{}, err
	}

	query := insertUserEventSQL
	identityArg := normalized.Identity.UserID
	if normalized.Identity.UserID == "" {
		query = insertAnonymousEventSQL
		identityArg = normalized.Identity.AnonymousProgressID
	}

	var event RecordedEvent
	if err := r.store.QueryRow(ctx, query, normalized.AttemptID, identityArg, normalized.EventType, []byte(normalized.Payload)).Scan(&event.ID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return RecordedEvent{}, ErrAttemptNotFound
		}
		return RecordedEvent{}, fmt.Errorf("record lesson event: %w", err)
	}

	return event, nil
}

func (r *PostgresRepository) RecordFeedback(ctx context.Context, record FeedbackRecord) (RecordedFeedback, error) {
	normalized, err := normalizeFeedbackRecord(record)
	if err != nil {
		return RecordedFeedback{}, err
	}

	query := insertUserFeedbackSQL
	identityArg := normalized.Identity.UserID
	if normalized.Identity.UserID == "" {
		query = insertAnonymousFeedbackSQL
		identityArg = normalized.Identity.AnonymousProgressID
	}

	var feedback RecordedFeedback
	if err := r.store.QueryRow(ctx, query, normalized.AttemptID, identityArg, normalized.CorrectionText, []byte(normalized.RubricResult)).Scan(&feedback.ID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return RecordedFeedback{}, ErrAttemptNotFound
		}
		return RecordedFeedback{}, fmt.Errorf("record feedback event: %w", err)
	}

	return feedback, nil
}

func (r *PostgresRepository) GetHistory(ctx context.Context, record HistoryRecord) (AttemptHistory, error) {
	normalized, err := normalizeHistoryRecord(record)
	if err != nil {
		return AttemptHistory{}, err
	}

	query := selectUserAttemptHistorySQL
	identityArg := normalized.Identity.UserID
	if normalized.Identity.UserID == "" {
		query = selectAnonymousAttemptHistorySQL
		identityArg = normalized.Identity.AnonymousProgressID
	}

	var history AttemptHistory
	var eventsJSON []byte
	var feedbackJSON []byte
	if err := r.store.QueryRow(ctx, query, normalized.AttemptID, identityArg).Scan(&history.AttemptID, &history.Status, &eventsJSON, &feedbackJSON); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return AttemptHistory{}, ErrAttemptNotFound
		}
		return AttemptHistory{}, fmt.Errorf("select attempt history: %w", err)
	}
	if err := json.Unmarshal(eventsJSON, &history.Events); err != nil {
		return AttemptHistory{}, fmt.Errorf("decode attempt events: %w", err)
	}
	if err := json.Unmarshal(feedbackJSON, &history.Feedback); err != nil {
		return AttemptHistory{}, fmt.Errorf("decode feedback events: %w", err)
	}

	return history, nil
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

func normalizeEventRecord(record EventRecord) (EventRecord, error) {
	identity, attemptID, err := normalizeOwnedAttempt(record.Identity, record.AttemptID)
	if err != nil {
		return EventRecord{}, err
	}

	eventType := strings.TrimSpace(record.EventType)
	if !isAllowedEventType(eventType) {
		return EventRecord{}, ErrInvalidEventType
	}
	payload, err := normalizeJSON(record.Payload, `{}`)
	if err != nil {
		return EventRecord{}, err
	}

	return EventRecord{Identity: identity, AttemptID: attemptID, EventType: eventType, Payload: payload}, nil
}

func normalizeFeedbackRecord(record FeedbackRecord) (FeedbackRecord, error) {
	identity, attemptID, err := normalizeOwnedAttempt(record.Identity, record.AttemptID)
	if err != nil {
		return FeedbackRecord{}, err
	}

	correctionText := strings.TrimSpace(record.CorrectionText)
	if correctionText == "" {
		return FeedbackRecord{}, ErrMissingCorrectionText
	}
	rubricResult, err := normalizeJSON(record.RubricResult, `{}`)
	if err != nil {
		return FeedbackRecord{}, err
	}

	return FeedbackRecord{Identity: identity, AttemptID: attemptID, CorrectionText: correctionText, RubricResult: rubricResult}, nil
}

func normalizeHistoryRecord(record HistoryRecord) (HistoryRecord, error) {
	identity, attemptID, err := normalizeOwnedAttempt(record.Identity, record.AttemptID)
	if err != nil {
		return HistoryRecord{}, err
	}

	return HistoryRecord{Identity: identity, AttemptID: attemptID}, nil
}

func normalizeOwnedAttempt(identity Identity, attemptID string) (Identity, string, error) {
	normalizedIdentity, err := normalizeIdentity(identity)
	if err != nil {
		return Identity{}, "", err
	}

	normalizedAttemptID := strings.TrimSpace(attemptID)
	if normalizedAttemptID == "" {
		return Identity{}, "", ErrMissingAttemptID
	}

	return normalizedIdentity, normalizedAttemptID, nil
}

func normalizeIdentity(identity Identity) (Identity, error) {
	userID := strings.TrimSpace(identity.UserID)
	anonymousProgressID := strings.TrimSpace(identity.AnonymousProgressID)
	if (userID == "") == (anonymousProgressID == "") {
		return Identity{}, ErrInvalidIdentity
	}
	return Identity{UserID: userID, AnonymousProgressID: anonymousProgressID}, nil
}

func isAllowedEventType(eventType string) bool {
	switch eventType {
	case "learner_turn", "tutor_feedback", "system", "avatar":
		return true
	default:
		return false
	}
}

func normalizeJSON(value json.RawMessage, fallback string) (json.RawMessage, error) {
	if len(value) == 0 {
		return json.RawMessage(fallback), nil
	}
	if !json.Valid(value) {
		return nil, ErrInvalidPayload
	}

	return value, nil
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

const insertUserEventSQL = `
INSERT INTO lesson_events (attempt_id, event_type, payload)
SELECT id, $3, $4
FROM lesson_attempts
WHERE id = $1 AND user_id = $2
RETURNING id
`

const insertAnonymousEventSQL = `
INSERT INTO lesson_events (attempt_id, event_type, payload)
SELECT id, $3, $4
FROM lesson_attempts
WHERE id = $1 AND anonymous_progress_id = $2
RETURNING id
`

const insertUserFeedbackSQL = `
INSERT INTO feedback_events (attempt_id, correction_text, rubric_result)
SELECT id, $3, $4
FROM lesson_attempts
WHERE id = $1 AND user_id = $2
RETURNING id::text
`

const insertAnonymousFeedbackSQL = `
INSERT INTO feedback_events (attempt_id, correction_text, rubric_result)
SELECT id, $3, $4
FROM lesson_attempts
WHERE id = $1 AND anonymous_progress_id = $2
RETURNING id::text
`

const selectUserAttemptHistorySQL = `
SELECT
  la.id::text,
  la.status,
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', le.id,
      'eventType', le.event_type,
      'payload', le.payload,
      'occurredAt', le.occurred_at
    ) ORDER BY le.occurred_at, le.id)
    FROM lesson_events le
    WHERE le.attempt_id = la.id
  ), '[]'::jsonb),
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', fe.id::text,
      'correctionText', fe.correction_text,
      'rubricResult', fe.rubric_result,
      'createdAt', fe.created_at
    ) ORDER BY fe.created_at, fe.id)
    FROM feedback_events fe
    WHERE fe.attempt_id = la.id
  ), '[]'::jsonb)
FROM lesson_attempts la
WHERE la.id = $1 AND la.user_id = $2
`

const selectAnonymousAttemptHistorySQL = `
SELECT
  la.id::text,
  la.status,
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', le.id,
      'eventType', le.event_type,
      'payload', le.payload,
      'occurredAt', le.occurred_at
    ) ORDER BY le.occurred_at, le.id)
    FROM lesson_events le
    WHERE le.attempt_id = la.id
  ), '[]'::jsonb),
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', fe.id::text,
      'correctionText', fe.correction_text,
      'rubricResult', fe.rubric_result,
      'createdAt', fe.created_at
    ) ORDER BY fe.created_at, fe.id)
    FROM feedback_events fe
    WHERE fe.attempt_id = la.id
  ), '[]'::jsonb)
FROM lesson_attempts la
WHERE la.id = $1 AND la.anonymous_progress_id = $2
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
