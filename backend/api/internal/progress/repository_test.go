package progress

import (
	"context"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
)

func TestPostgresAwardRepositoryRecordsUserAward(t *testing.T) {
	t.Parallel()

	store := &fakeAwardStore{tag: pgconn.NewCommandTag("INSERT 0 1")}
	repository := mustAwardRepository(t, store)

	inserted, err := repository.RecordAward(context.Background(), AwardRecord{
		Identity:  AwardIdentity{UserID: "user-1"},
		AttemptID: "attempt-1",
		Decision:  AwardDecision{Awarded: true, XP: LessonCompletionXP, Reason: "lesson_completed"},
	})

	if err != nil {
		t.Fatalf("record award: %v", err)
	}
	if !inserted {
		t.Fatal("expected award insert")
	}
	if !store.called {
		t.Fatal("expected store exec")
	}
	if store.query != insertProgressAwardSQL {
		t.Fatal("expected progress award insert SQL")
	}
	assertArg(t, store.args[0], "user-1")
	assertArg(t, store.args[1], nil)
	assertArg(t, store.args[2], "attempt-1")
	assertArg(t, store.args[3], LessonCompletionXP)
	assertArg(t, store.args[4], "lesson_completed")
}

func TestPostgresAwardRepositoryRecordsAnonymousAward(t *testing.T) {
	t.Parallel()

	store := &fakeAwardStore{tag: pgconn.NewCommandTag("INSERT 0 1")}
	repository := mustAwardRepository(t, store)

	inserted, err := repository.RecordAward(context.Background(), AwardRecord{
		Identity:  AwardIdentity{AnonymousProgressID: "anonymous-1"},
		AttemptID: "attempt-1",
		Decision:  AwardDecision{Awarded: true, XP: LessonCompletionXP, Reason: "lesson_completed"},
	})

	if err != nil {
		t.Fatalf("record award: %v", err)
	}
	if !inserted {
		t.Fatal("expected award insert")
	}
	assertArg(t, store.args[0], nil)
	assertArg(t, store.args[1], "anonymous-1")
}

func TestPostgresAwardRepositoryTreatsDuplicateAttemptAsNoop(t *testing.T) {
	t.Parallel()

	store := &fakeAwardStore{tag: pgconn.NewCommandTag("INSERT 0 0")}
	repository := mustAwardRepository(t, store)

	inserted, err := repository.RecordAward(context.Background(), AwardRecord{
		Identity:  AwardIdentity{UserID: "user-1"},
		AttemptID: "attempt-1",
		Decision:  AwardDecision{Awarded: true, XP: LessonCompletionXP, Reason: "lesson_completed"},
	})

	if err != nil {
		t.Fatalf("record award: %v", err)
	}
	if inserted {
		t.Fatal("expected duplicate award noop")
	}
}

func TestPostgresAwardRepositorySkipsDeniedAwards(t *testing.T) {
	t.Parallel()

	store := &fakeAwardStore{tag: pgconn.NewCommandTag("INSERT 0 1")}
	repository := mustAwardRepository(t, store)

	inserted, err := repository.RecordAward(context.Background(), AwardRecord{
		Identity:  AwardIdentity{UserID: "user-1"},
		AttemptID: "attempt-1",
		Decision:  AwardDecision{Reason: "missing_feedback"},
	})

	if err != nil {
		t.Fatalf("record award: %v", err)
	}
	if inserted {
		t.Fatal("expected no insert")
	}
	if store.called {
		t.Fatal("expected denied award to skip store exec")
	}
}

func TestPostgresAwardRepositoryRequiresAttemptID(t *testing.T) {
	t.Parallel()

	repository := mustAwardRepository(t, &fakeAwardStore{})

	_, err := repository.RecordAward(context.Background(), AwardRecord{
		Identity: AwardIdentity{UserID: "user-1"},
		Decision: AwardDecision{Awarded: true, XP: LessonCompletionXP, Reason: "lesson_completed"},
	})

	if !errors.Is(err, ErrMissingAttemptID) {
		t.Fatalf("expected ErrMissingAttemptID, got %v", err)
	}
}

func TestPostgresAwardRepositoryRequiresExactlyOneIdentity(t *testing.T) {
	t.Parallel()

	repository := mustAwardRepository(t, &fakeAwardStore{})

	_, err := repository.RecordAward(context.Background(), AwardRecord{
		AttemptID: "attempt-1",
		Decision:  AwardDecision{Awarded: true, XP: LessonCompletionXP, Reason: "lesson_completed"},
	})
	if !errors.Is(err, ErrInvalidAwardIdentity) {
		t.Fatalf("expected ErrInvalidAwardIdentity for missing identity, got %v", err)
	}

	_, err = repository.RecordAward(context.Background(), AwardRecord{
		Identity:  AwardIdentity{UserID: "user-1", AnonymousProgressID: "anonymous-1"},
		AttemptID: "attempt-1",
		Decision:  AwardDecision{Awarded: true, XP: LessonCompletionXP, Reason: "lesson_completed"},
	})
	if !errors.Is(err, ErrInvalidAwardIdentity) {
		t.Fatalf("expected ErrInvalidAwardIdentity for ambiguous identity, got %v", err)
	}
}

func TestPostgresAwardRepositoryWrapsStoreError(t *testing.T) {
	t.Parallel()

	expected := errors.New("database unavailable")
	repository := mustAwardRepository(t, &fakeAwardStore{err: expected})

	_, err := repository.RecordAward(context.Background(), AwardRecord{
		Identity:  AwardIdentity{UserID: "user-1"},
		AttemptID: "attempt-1",
		Decision:  AwardDecision{Awarded: true, XP: LessonCompletionXP, Reason: "lesson_completed"},
	})

	if !errors.Is(err, expected) {
		t.Fatalf("expected wrapped store error, got %v", err)
	}
}

func TestNewPostgresAwardRepositoryRequiresStore(t *testing.T) {
	t.Parallel()

	_, err := NewPostgresAwardRepository(nil)

	if !errors.Is(err, ErrMissingAwardStore) {
		t.Fatalf("expected ErrMissingAwardStore, got %v", err)
	}
}

func mustAwardRepository(t *testing.T, store AwardStore) *PostgresAwardRepository {
	t.Helper()

	repository, err := NewPostgresAwardRepository(store)
	if err != nil {
		t.Fatalf("new repository: %v", err)
	}

	return repository
}

type fakeAwardStore struct {
	called bool
	query  string
	args   []any
	tag    pgconn.CommandTag
	err    error
}

func (s *fakeAwardStore) Exec(_ context.Context, query string, args ...any) (pgconn.CommandTag, error) {
	s.called = true
	s.query = query
	s.args = args

	return s.tag, s.err
}

func assertArg(t *testing.T, got any, want any) {
	t.Helper()

	if got != want {
		t.Fatalf("expected arg %v, got %v", want, got)
	}
}
