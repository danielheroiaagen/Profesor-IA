package progress

import (
	"context"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5"
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

func TestPostgresAwardRepositorySummarizesUserProgress(t *testing.T) {
	t.Parallel()

	store := &fakeAwardStore{row: fakeSummaryRow{values: []any{100, 2}}}
	repository := mustAwardRepository(t, store)

	summary, err := repository.SummarizeProgress(context.Background(), AwardIdentity{UserID: " user-1 "})

	if err != nil {
		t.Fatalf("summarize progress: %v", err)
	}
	if summary.TotalXP != 100 || summary.CompletedLessons != 2 {
		t.Fatalf("unexpected summary: %+v", summary)
	}
	if store.query != selectUserProgressSummarySQL {
		t.Fatal("expected user progress summary SQL")
	}
	assertArg(t, store.queryArgs[0], "user-1")
}

func TestPostgresAwardRepositorySummarizesAnonymousProgress(t *testing.T) {
	t.Parallel()

	store := &fakeAwardStore{row: fakeSummaryRow{values: []any{50, 1}}}
	repository := mustAwardRepository(t, store)

	summary, err := repository.SummarizeProgress(context.Background(), AwardIdentity{AnonymousProgressID: " anonymous-1 "})

	if err != nil {
		t.Fatalf("summarize progress: %v", err)
	}
	if summary.TotalXP != 50 || summary.CompletedLessons != 1 {
		t.Fatalf("unexpected summary: %+v", summary)
	}
	if store.query != selectAnonymousProgressSummarySQL {
		t.Fatal("expected anonymous progress summary SQL")
	}
	assertArg(t, store.queryArgs[0], "anonymous-1")
}

func TestPostgresAwardRepositorySummaryRequiresExactlyOneIdentity(t *testing.T) {
	t.Parallel()

	repository := mustAwardRepository(t, &fakeAwardStore{})

	_, err := repository.SummarizeProgress(context.Background(), AwardIdentity{})
	if !errors.Is(err, ErrInvalidAwardIdentity) {
		t.Fatalf("expected ErrInvalidAwardIdentity for missing identity, got %v", err)
	}

	_, err = repository.SummarizeProgress(context.Background(), AwardIdentity{UserID: "user-1", AnonymousProgressID: "anonymous-1"})
	if !errors.Is(err, ErrInvalidAwardIdentity) {
		t.Fatalf("expected ErrInvalidAwardIdentity for ambiguous identity, got %v", err)
	}
}

func TestPostgresAwardRepositoryWrapsSummaryStoreError(t *testing.T) {
	t.Parallel()

	expected := errors.New("database unavailable")
	repository := mustAwardRepository(t, &fakeAwardStore{row: fakeSummaryRow{err: expected}})

	_, err := repository.SummarizeProgress(context.Background(), AwardIdentity{UserID: "user-1"})

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
	called    bool
	query     string
	args      []any
	tag       pgconn.CommandTag
	err       error
	queryArgs []any
	row       fakeSummaryRow
}

func (s *fakeAwardStore) Exec(_ context.Context, query string, args ...any) (pgconn.CommandTag, error) {
	s.called = true
	s.query = query
	s.args = args

	return s.tag, s.err
}

func (s *fakeAwardStore) QueryRow(_ context.Context, query string, args ...any) pgx.Row {
	s.query = query
	s.queryArgs = args
	return s.row
}

type fakeSummaryRow struct {
	values []any
	err    error
}

func (r fakeSummaryRow) Scan(dest ...any) error {
	if r.err != nil {
		return r.err
	}
	*(dest[0].(*int)) = r.values[0].(int)
	*(dest[1].(*int)) = r.values[1].(int)
	return nil
}

func assertArg(t *testing.T, got any, want any) {
	t.Helper()

	if got != want {
		t.Fatalf("expected arg %v, got %v", want, got)
	}
}
