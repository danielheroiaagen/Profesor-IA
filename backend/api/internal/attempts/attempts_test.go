package attempts

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5"
)

func TestPostgresRepositoryStartsAttempt(t *testing.T) {
	t.Parallel()

	store := &fakeStore{row: fakeRow{values: []any{"attempt-1", "started"}}}
	repository := mustRepository(t, store)

	attempt, err := repository.StartAttempt(context.Background(), StartRecord{
		Identity:       Identity{UserID: " user-1 "},
		LegacyLessonID: " lesson-1 ",
	})

	if err != nil {
		t.Fatalf("start attempt: %v", err)
	}
	if attempt.ID != "attempt-1" || attempt.Status != "started" {
		t.Fatalf("unexpected attempt: %+v", attempt)
	}
	assertArg(t, store.args[0], "user-1")
	assertArg(t, store.args[1], nil)
	assertArg(t, store.args[2], nil)
	assertArg(t, store.args[3], "lesson-1")
	assertArg(t, store.args[4], DefaultRealtimeModel)
}

func TestPostgresRepositoryStartsAnonymousLessonPlanAttempt(t *testing.T) {
	t.Parallel()

	store := &fakeStore{row: fakeRow{values: []any{"attempt-1", "started"}}}
	repository := mustRepository(t, store)

	_, err := repository.StartAttempt(context.Background(), StartRecord{
		Identity:      Identity{AnonymousProgressID: " anonymous-1 "},
		LessonPlanID:  " lesson-plan-1 ",
		RealtimeModel: " custom-realtime ",
	})

	if err != nil {
		t.Fatalf("start attempt: %v", err)
	}
	assertArg(t, store.args[0], nil)
	assertArg(t, store.args[1], "anonymous-1")
	assertArg(t, store.args[2], "lesson-plan-1")
	assertArg(t, store.args[3], nil)
	assertArg(t, store.args[4], "custom-realtime")
}

func TestPostgresRepositoryCompletesUserAttempt(t *testing.T) {
	t.Parallel()

	store := &fakeStore{row: fakeRow{values: []any{"attempt-1", "completed"}}}
	repository := mustRepository(t, store)

	attempt, err := repository.CompleteAttempt(context.Background(), CompleteRecord{
		Identity:  Identity{UserID: " user-1 "},
		AttemptID: " attempt-1 ",
	})

	if err != nil {
		t.Fatalf("complete attempt: %v", err)
	}
	if attempt.ID != "attempt-1" || attempt.Status != "completed" {
		t.Fatalf("unexpected attempt: %+v", attempt)
	}
	if store.query != completeUserAttemptSQL {
		t.Fatal("expected user complete SQL")
	}
	assertArg(t, store.args[0], "attempt-1")
	assertArg(t, store.args[1], "user-1")
}

func TestPostgresRepositoryCompletesAnonymousAttempt(t *testing.T) {
	t.Parallel()

	store := &fakeStore{row: fakeRow{values: []any{"attempt-1", "completed"}}}
	repository := mustRepository(t, store)

	_, err := repository.CompleteAttempt(context.Background(), CompleteRecord{
		Identity:  Identity{AnonymousProgressID: " anonymous-1 "},
		AttemptID: "attempt-1",
	})

	if err != nil {
		t.Fatalf("complete attempt: %v", err)
	}
	if store.query != completeAnonymousAttemptSQL {
		t.Fatal("expected anonymous complete SQL")
	}
	assertArg(t, store.args[1], "anonymous-1")
}

func TestPostgresRepositoryRecordsOwnedLessonEvent(t *testing.T) {
	t.Parallel()

	store := &fakeStore{row: fakeRow{values: []any{int64(42)}}}
	repository := mustRepository(t, store)

	event, err := repository.RecordEvent(context.Background(), EventRecord{
		Identity:  Identity{UserID: " user-1 "},
		AttemptID: " attempt-1 ",
		EventType: "learner_turn",
		Payload:   json.RawMessage(`{"transcript":"hello"}`),
	})

	if err != nil {
		t.Fatalf("record event: %v", err)
	}
	if event.ID != 42 {
		t.Fatalf("expected event id 42, got %d", event.ID)
	}
	if store.query != insertUserEventSQL {
		t.Fatal("expected user event SQL")
	}
	assertArg(t, store.args[0], "attempt-1")
	assertArg(t, store.args[1], "user-1")
	assertArg(t, store.args[2], "learner_turn")
	assertArg(t, string(store.args[3].([]byte)), `{"transcript":"hello"}`)
}

func TestPostgresRepositoryRecordsOwnedFeedback(t *testing.T) {
	t.Parallel()

	store := &fakeStore{row: fakeRow{values: []any{"feedback-1"}}}
	repository := mustRepository(t, store)

	feedback, err := repository.RecordFeedback(context.Background(), FeedbackRecord{
		Identity:       Identity{AnonymousProgressID: " anonymous-1 "},
		AttemptID:      "attempt-1",
		CorrectionText: " Say: It's a book. ",
		RubricResult:   json.RawMessage(`{"score":1}`),
	})

	if err != nil {
		t.Fatalf("record feedback: %v", err)
	}
	if feedback.ID != "feedback-1" {
		t.Fatalf("expected feedback id, got %q", feedback.ID)
	}
	if store.query != insertAnonymousFeedbackSQL {
		t.Fatal("expected anonymous feedback SQL")
	}
	assertArg(t, store.args[1], "anonymous-1")
	assertArg(t, store.args[2], "Say: It's a book.")
	assertArg(t, string(store.args[3].([]byte)), `{"score":1}`)
}

func TestPostgresRepositoryRejectsInvalidRecords(t *testing.T) {
	t.Parallel()

	repository := mustRepository(t, &fakeStore{})
	cases := []struct {
		name     string
		record   StartRecord
		expected error
	}{
		{"missing identity", StartRecord{LegacyLessonID: "lesson-1"}, ErrInvalidIdentity},
		{"ambiguous identity", StartRecord{Identity: Identity{UserID: "user-1", AnonymousProgressID: "anonymous-1"}, LegacyLessonID: "lesson-1"}, ErrInvalidIdentity},
		{"missing lesson reference", StartRecord{Identity: Identity{UserID: "user-1"}}, ErrMissingLessonReference},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			_, err := repository.StartAttempt(context.Background(), tc.record)
			if !errors.Is(err, tc.expected) {
				t.Fatalf("expected %v, got %v", tc.expected, err)
			}
		})
	}
}

func TestPostgresRepositoryRejectsInvalidCompleteRecords(t *testing.T) {
	t.Parallel()

	repository := mustRepository(t, &fakeStore{})
	cases := []struct {
		name     string
		record   CompleteRecord
		expected error
	}{
		{"missing identity", CompleteRecord{AttemptID: "attempt-1"}, ErrInvalidIdentity},
		{"ambiguous identity", CompleteRecord{Identity: Identity{UserID: "user-1", AnonymousProgressID: "anonymous-1"}, AttemptID: "attempt-1"}, ErrInvalidIdentity},
		{"missing attempt", CompleteRecord{Identity: Identity{UserID: "user-1"}}, ErrMissingAttemptID},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			_, err := repository.CompleteAttempt(context.Background(), tc.record)
			if !errors.Is(err, tc.expected) {
				t.Fatalf("expected %v, got %v", tc.expected, err)
			}
		})
	}
}

func TestPostgresRepositoryRejectsInvalidEvents(t *testing.T) {
	t.Parallel()

	repository := mustRepository(t, &fakeStore{})
	cases := []struct {
		name     string
		record   EventRecord
		expected error
	}{
		{"missing identity", EventRecord{AttemptID: "attempt-1", EventType: "system"}, ErrInvalidIdentity},
		{"missing attempt", EventRecord{Identity: Identity{UserID: "user-1"}, EventType: "system"}, ErrMissingAttemptID},
		{"invalid type", EventRecord{Identity: Identity{UserID: "user-1"}, AttemptID: "attempt-1", EventType: "unknown"}, ErrInvalidEventType},
		{"invalid payload", EventRecord{Identity: Identity{UserID: "user-1"}, AttemptID: "attempt-1", EventType: "system", Payload: json.RawMessage(`{`)}, ErrInvalidPayload},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			_, err := repository.RecordEvent(context.Background(), tc.record)
			if !errors.Is(err, tc.expected) {
				t.Fatalf("expected %v, got %v", tc.expected, err)
			}
		})
	}
}

func TestPostgresRepositoryRejectsInvalidFeedback(t *testing.T) {
	t.Parallel()

	repository := mustRepository(t, &fakeStore{})
	cases := []struct {
		name     string
		record   FeedbackRecord
		expected error
	}{
		{"missing identity", FeedbackRecord{AttemptID: "attempt-1", CorrectionText: "fix"}, ErrInvalidIdentity},
		{"missing attempt", FeedbackRecord{Identity: Identity{UserID: "user-1"}, CorrectionText: "fix"}, ErrMissingAttemptID},
		{"missing correction", FeedbackRecord{Identity: Identity{UserID: "user-1"}, AttemptID: "attempt-1"}, ErrMissingCorrectionText},
		{"invalid rubric", FeedbackRecord{Identity: Identity{UserID: "user-1"}, AttemptID: "attempt-1", CorrectionText: "fix", RubricResult: json.RawMessage(`{`)}, ErrInvalidPayload},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			_, err := repository.RecordFeedback(context.Background(), tc.record)
			if !errors.Is(err, tc.expected) {
				t.Fatalf("expected %v, got %v", tc.expected, err)
			}
		})
	}
}

func TestPostgresRepositoryReturnsAttemptNotFound(t *testing.T) {
	t.Parallel()

	repository := mustRepository(t, &fakeStore{row: fakeRow{err: pgx.ErrNoRows}})

	_, err := repository.CompleteAttempt(context.Background(), CompleteRecord{
		Identity:  Identity{UserID: "user-1"},
		AttemptID: "attempt-1",
	})

	if !errors.Is(err, ErrAttemptNotFound) {
		t.Fatalf("expected ErrAttemptNotFound, got %v", err)
	}
}

func TestPostgresRepositoryReturnsAttemptNotFoundForOwnedEventWrites(t *testing.T) {
	t.Parallel()

	repository := mustRepository(t, &fakeStore{row: fakeRow{err: pgx.ErrNoRows}})

	_, err := repository.RecordEvent(context.Background(), EventRecord{Identity: Identity{UserID: "user-1"}, AttemptID: "attempt-1", EventType: "system"})

	if !errors.Is(err, ErrAttemptNotFound) {
		t.Fatalf("expected ErrAttemptNotFound, got %v", err)
	}
}

func TestPostgresRepositoryWrapsStoreError(t *testing.T) {
	t.Parallel()

	expected := errors.New("database unavailable")
	repository := mustRepository(t, &fakeStore{row: fakeRow{err: expected}})

	_, err := repository.StartAttempt(context.Background(), StartRecord{Identity: Identity{UserID: "user-1"}, LegacyLessonID: "lesson-1"})

	if !errors.Is(err, expected) {
		t.Fatalf("expected wrapped store error, got %v", err)
	}
}

func TestNewPostgresRepositoryRequiresStore(t *testing.T) {
	t.Parallel()

	_, err := NewPostgresRepository(nil)
	if !errors.Is(err, ErrMissingStore) {
		t.Fatalf("expected ErrMissingStore, got %v", err)
	}
}

func mustRepository(t *testing.T, store Store) *PostgresRepository {
	t.Helper()
	repository, err := NewPostgresRepository(store)
	if err != nil {
		t.Fatalf("new repository: %v", err)
	}
	return repository
}

type fakeStore struct {
	query string
	args  []any
	row   fakeRow
}

func (s *fakeStore) QueryRow(_ context.Context, query string, args ...any) pgx.Row {
	s.query = query
	s.args = args
	return s.row
}

type fakeRow struct {
	values []any
	err    error
}

func (r fakeRow) Scan(dest ...any) error {
	if r.err != nil {
		return r.err
	}
	for index, value := range r.values {
		switch target := dest[index].(type) {
		case *string:
			*target = value.(string)
		case *int64:
			*target = value.(int64)
		default:
			panic("unsupported scan target")
		}
	}
	return nil
}

func assertArg(t *testing.T, got any, want any) {
	t.Helper()
	if got != want {
		t.Fatalf("expected arg %v, got %v", want, got)
	}
}
