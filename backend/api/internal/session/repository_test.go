package session

import (
	"context"
	"errors"
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

	err := repository.CreateSession(context.Background(), SessionRecord{UserID: " user-1 ", Token: "raw-token", ExpiresAt: expiresAt})

	if err != nil {
		t.Fatalf("create session: %v", err)
	}
	if !store.execCalled || store.execQuery != insertSessionSQL {
		t.Fatal("expected insert session SQL")
	}
	assertSessionArg(t, store.execArgs[0], "user-1")
	assertSessionArg(t, store.execArgs[1], mustSessionHash(t, "raw-token"))
	assertSessionArg(t, store.execArgs[2], expiresAt)
	if store.execArgs[1] == "raw-token" {
		t.Fatal("expected token hash, not raw token")
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
		{"missing user", SessionRecord{Token: "token", ExpiresAt: now.Add(time.Hour)}, ErrMissingUserID},
		{"missing token", SessionRecord{UserID: "user-1", ExpiresAt: now.Add(time.Hour)}, ErrMissingSessionToken},
		{"missing expiry", SessionRecord{UserID: "user-1", Token: "token"}, ErrMissingSessionExpiry},
		{"expired session", SessionRecord{UserID: "user-1", Token: "token", ExpiresAt: now.Add(-time.Second)}, ErrExpiredSession},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if err := repository.CreateSession(context.Background(), tc.record); !errors.Is(err, tc.expected) {
				t.Fatalf("expected %v, got %v", tc.expected, err)
			}
		})
	}
}

func TestPostgresSessionRepositoryResolvesSession(t *testing.T) {
	t.Parallel()

	now := fixedSessionTime()
	expectedErr := errors.New("database unavailable")
	cases := []struct {
		name       string
		row        fakeSessionRow
		wantUserID string
		expected   error
	}{
		{"active", fakeSessionRow{values: []any{"user-1", now.Add(time.Hour)}}, "user-1", nil},
		{"expired", fakeSessionRow{values: []any{"user-1", now.Add(-time.Second)}}, "", ErrExpiredSession},
		{"missing", fakeSessionRow{err: pgx.ErrNoRows}, "", ErrSessionNotFound},
		{"database error", fakeSessionRow{err: expectedErr}, "", expectedErr},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			store := &fakeSessionStore{row: tc.row}
			repository := mustSessionRepository(t, store, now)
			identity, err := repository.ResolveSession(context.Background(), "raw-token")

			if tc.expected != nil {
				if !errors.Is(err, tc.expected) {
					t.Fatalf("expected %v, got %v", tc.expected, err)
				}
				return
			}
			if err != nil {
				t.Fatalf("resolve session: %v", err)
			}
			if identity.UserID != tc.wantUserID {
				t.Fatalf("expected %q, got %q", tc.wantUserID, identity.UserID)
			}
			assertSessionArg(t, store.queryArgs[0], mustSessionHash(t, "raw-token"))
		})
	}
}

func TestPostgresSessionRepositoryRevokesSession(t *testing.T) {
	t.Parallel()

	now := fixedSessionTime()
	expectedErr := errors.New("database unavailable")
	cases := []struct {
		name     string
		store    *fakeSessionStore
		revoked  bool
		expected error
	}{
		{"revoked", &fakeSessionStore{execTag: pgconn.NewCommandTag("UPDATE 1")}, true, nil},
		{"missing", &fakeSessionStore{execTag: pgconn.NewCommandTag("UPDATE 0")}, false, nil},
		{"error", &fakeSessionStore{execErr: expectedErr}, false, expectedErr},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			repository := mustSessionRepository(t, tc.store, now)
			revoked, err := repository.RevokeSession(context.Background(), "raw-token")

			if tc.expected != nil {
				if !errors.Is(err, tc.expected) {
					t.Fatalf("expected %v, got %v", tc.expected, err)
				}
				return
			}
			if err != nil {
				t.Fatalf("revoke session: %v", err)
			}
			if revoked != tc.revoked {
				t.Fatalf("expected revoked=%v, got %v", tc.revoked, revoked)
			}
			assertSessionArg(t, tc.store.execArgs[0], mustSessionHash(t, "raw-token"))
			assertSessionArg(t, tc.store.execArgs[1], now)
		})
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

func fixedSessionTime() time.Time { return time.Date(2026, 5, 22, 12, 0, 0, 0, time.UTC) }

type fakeSessionStore struct {
	execCalled  bool
	execQuery   string
	execArgs    []any
	execTag     pgconn.CommandTag
	execErr     error
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
	*(dest[0].(*string)) = r.values[0].(string)
	*(dest[1].(*time.Time)) = r.values[1].(time.Time)
	return nil
}

func assertSessionArg(t *testing.T, got any, want any) {
	t.Helper()
	if got != want {
		t.Fatalf("expected arg %v, got %v", want, got)
	}
}
