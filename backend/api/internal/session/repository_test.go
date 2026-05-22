package session

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

func TestPostgresSessionRepositoryCreatesSessionWithHashedToken(t *testing.T) {
	t.Parallel()

	now := fixedSessionTime()
	expiresAt := now.Add(time.Hour)
	store := &fakeSessionStore{execTag: pgconn.NewCommandTag("INSERT 0 1")}
	repository := mustSessionRepository(t, store, now)

	err := repository.CreateSession(context.Background(), SessionRecord{
		UserID:    " user-1 ",
		Token:     "raw-session-token",
		ExpiresAt: expiresAt,
	})

	if err != nil {
		t.Fatalf("create session: %v", err)
	}
	if !store.execCalled {
		t.Fatal("expected store exec")
	}
	if store.execQuery != insertSessionSQL {
		t.Fatal("expected insert session SQL")
	}
	expectedHash := mustSessionHash(t, "raw-session-token")
	assertSessionArg(t, store.execArgs[0], "user-1")
	assertSessionArg(t, store.execArgs[1], expectedHash)
	assertSessionArg(t, store.execArgs[2], expiresAt)
	if store.execArgs[1] == "raw-session-token" {
		t.Fatal("expected repository to store a token hash, not the raw token")
	}
}

func TestPostgresSessionRepositoryRejectsInvalidSessionRecords(t *testing.T) {
	t.Parallel()

	now := fixedSessionTime()
	repository := mustSessionRepository(t, &fakeSessionStore{}, now)

	cases := []struct {
		name     string
		record   SessionRecord
		expected error
	}{
		{
			name:     "missing user",
			record:   SessionRecord{Token: "token", ExpiresAt: now.Add(time.Hour)},
			expected: ErrMissingUserID,
		},
		{
			name:     "missing token",
			record:   SessionRecord{UserID: "user-1", ExpiresAt: now.Add(time.Hour)},
			expected: ErrMissingSessionToken,
		},
		{
			name:     "missing expiry",
			record:   SessionRecord{UserID: "user-1", Token: "token"},
			expected: ErrMissingSessionExpiry,
		},
		{
			name:     "expired session",
			record:   SessionRecord{UserID: "user-1", Token: "token", ExpiresAt: now.Add(-time.Second)},
			expected: ErrExpiredSession,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			err := repository.CreateSession(context.Background(), tc.record)
			if !errors.Is(err, tc.expected) {
				t.Fatalf("expected %v, got %v", tc.expected, err)
			}
		})
	}
}

func TestPostgresSessionRepositoryWrapsCreateErrors(t *testing.T) {
	t.Parallel()

	expected := errors.New("database unavailable")
	repository := mustSessionRepository(t, &fakeSessionStore{execErr: expected}, fixedSessionTime())

	err := repository.CreateSession(context.Background(), SessionRecord{
		UserID:    "user-1",
		Token:     "token",
		ExpiresAt: fixedSessionTime().Add(time.Hour),
	})

	if !errors.Is(err, expected) {
		t.Fatalf("expected wrapped store error, got %v", err)
	}
}

func TestPostgresSessionRepositoryResolvesActiveSession(t *testing.T) {
	t.Parallel()

	now := fixedSessionTime()
	store := &fakeSessionStore{
		row: fakeSessionRow{values: []any{"user-1", now.Add(time.Hour)}},
	}
	repository := mustSessionRepository(t, store, now)

	identity, err := repository.ResolveSession(context.Background(), "raw-session-token")

	if err != nil {
		t.Fatalf("resolve session: %v", err)
	}
	if identity.UserID != "user-1" {
		t.Fatalf("expected user-1, got %q", identity.UserID)
	}
	if !store.queryCalled {
		t.Fatal("expected store query")
	}
	if store.query != selectSessionSQL {
		t.Fatal("expected select session SQL")
	}
	assertSessionArg(t, store.queryArgs[0], mustSessionHash(t, "raw-session-token"))
}

func TestPostgresSessionRepositoryRejectsExpiredResolvedSession(t *testing.T) {
	t.Parallel()

	now := fixedSessionTime()
	repository := mustSessionRepository(t, &fakeSessionStore{
		row: fakeSessionRow{values: []any{"user-1", now.Add(-time.Second)}},
	}, now)

	_, err := repository.ResolveSession(context.Background(), "raw-session-token")

	if !errors.Is(err, ErrExpiredSession) {
		t.Fatalf("expected ErrExpiredSession, got %v", err)
	}
}

func TestPostgresSessionRepositoryMapsMissingSession(t *testing.T) {
	t.Parallel()

	repository := mustSessionRepository(t, &fakeSessionStore{
		row: fakeSessionRow{err: pgx.ErrNoRows},
	}, fixedSessionTime())

	_, err := repository.ResolveSession(context.Background(), "raw-session-token")

	if !errors.Is(err, ErrSessionNotFound) {
		t.Fatalf("expected ErrSessionNotFound, got %v", err)
	}
}

func TestPostgresSessionRepositoryWrapsResolveErrors(t *testing.T) {
	t.Parallel()

	expected := errors.New("database unavailable")
	repository := mustSessionRepository(t, &fakeSessionStore{
		row: fakeSessionRow{err: expected},
	}, fixedSessionTime())

	_, err := repository.ResolveSession(context.Background(), "raw-session-token")

	if !errors.Is(err, expected) {
		t.Fatalf("expected wrapped row error, got %v", err)
	}
}

func TestPostgresSessionRepositoryRevokesSession(t *testing.T) {
	t.Parallel()

	now := fixedSessionTime()
	store := &fakeSessionStore{execTag: pgconn.NewCommandTag("UPDATE 1")}
	repository := mustSessionRepository(t, store, now)

	revoked, err := repository.RevokeSession(context.Background(), "raw-session-token")

	if err != nil {
		t.Fatalf("revoke session: %v", err)
	}
	if !revoked {
		t.Fatal("expected session to be revoked")
	}
	if store.execQuery != revokeSessionSQL {
		t.Fatal("expected revoke session SQL")
	}
	assertSessionArg(t, store.execArgs[0], mustSessionHash(t, "raw-session-token"))
	assertSessionArg(t, store.execArgs[1], now)
}

func TestPostgresSessionRepositoryTreatsMissingRevokeAsNoop(t *testing.T) {
	t.Parallel()

	repository := mustSessionRepository(t, &fakeSessionStore{execTag: pgconn.NewCommandTag("UPDATE 0")}, fixedSessionTime())

	revoked, err := repository.RevokeSession(context.Background(), "raw-session-token")

	if err != nil {
		t.Fatalf("revoke session: %v", err)
	}
	if revoked {
		t.Fatal("expected missing session revoke to be a noop")
	}
}

func TestPostgresSessionRepositoryWrapsRevokeErrors(t *testing.T) {
	t.Parallel()

	expected := errors.New("database unavailable")
	repository := mustSessionRepository(t, &fakeSessionStore{execErr: expected}, fixedSessionTime())

	_, err := repository.RevokeSession(context.Background(), "raw-session-token")

	if !errors.Is(err, expected) {
		t.Fatalf("expected wrapped store error, got %v", err)
	}
}

func TestPostgresSessionRepositoryRequiresStore(t *testing.T) {
	t.Parallel()

	_, err := NewPostgresSessionRepository(nil)

	if !errors.Is(err, ErrMissingSessionStore) {
		t.Fatalf("expected ErrMissingSessionStore, got %v", err)
	}
}

func mustSessionRepository(t *testing.T, store SessionStore, now time.Time) *PostgresSessionRepository {
	t.Helper()

	repository, err := NewPostgresSessionRepositoryWithClock(store, func() time.Time { return now })
	if err != nil {
		t.Fatalf("new repository: %v", err)
	}

	return repository
}

func mustSessionHash(t *testing.T, token string) string {
	t.Helper()

	value, err := hashSessionToken(token)
	if err != nil {
		t.Fatalf("hash session token: %v", err)
	}

	return value
}

func fixedSessionTime() time.Time {
	return time.Date(2026, 5, 22, 12, 0, 0, 0, time.UTC)
}

type fakeSessionStore struct {
	execCalled bool
	execQuery  string
	execArgs   []any
	execTag    pgconn.CommandTag
	execErr    error

	queryCalled bool
	query       string
	queryArgs   []any
	row         fakeSessionRow
}

func (s *fakeSessionStore) Exec(_ context.Context, query string, args ...any) (pgconn.CommandTag, error) {
	s.execCalled = true
	s.execQuery = query
	s.execArgs = args

	return s.execTag, s.execErr
}

func (s *fakeSessionStore) QueryRow(_ context.Context, query string, args ...any) pgx.Row {
	s.queryCalled = true
	s.query = query
	s.queryArgs = args

	return s.row
}

type fakeSessionRow struct {
	values []any
	err    error
}

func (r fakeSessionRow) Scan(dest ...any) error {
	if r.err != nil {
		return r.err
	}
	if len(dest) != len(r.values) {
		return fmt.Errorf("expected %d scan destinations, got %d", len(r.values), len(dest))
	}

	for index, destination := range dest {
		switch target := destination.(type) {
		case *string:
			value, ok := r.values[index].(string)
			if !ok {
				return fmt.Errorf("expected string value at index %d", index)
			}
			*target = value
		case *time.Time:
			value, ok := r.values[index].(time.Time)
			if !ok {
				return fmt.Errorf("expected time value at index %d", index)
			}
			*target = value
		default:
			return fmt.Errorf("unsupported scan destination %T", destination)
		}
	}

	return nil
}

func assertSessionArg(t *testing.T, got any, want any) {
	t.Helper()

	if got != want {
		t.Fatalf("expected arg %v, got %v", want, got)
	}
}
