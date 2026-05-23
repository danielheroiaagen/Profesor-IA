package auth

import (
	"context"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"golang.org/x/crypto/bcrypt"
)

func TestPostgresUserRepositoryCreatesCredentialUser(t *testing.T) {
	t.Parallel()

	hash := validCredentialHash()
	store := &fakeUserStore{row: fakeUserRow{values: []any{
		"user-1",
		"teacher@example.com",
		"Teacher Fran",
		hash,
	}}}
	repository := mustUserRepository(t, store)

	user, err := repository.CreateCredentialUser(context.Background(), CredentialUserRecord{
		Email:        " Teacher@Example.COM ",
		DisplayName:  " Teacher Fran ",
		PasswordHash: hash,
	})

	if err != nil {
		t.Fatalf("create user: %v", err)
	}
	if store.query != insertCredentialUserSQL {
		t.Fatal("expected insert credential user SQL")
	}
	assertUserArg(t, store.args[0], "teacher@example.com")
	assertUserArg(t, store.args[1], "Teacher Fran")
	assertUserArg(t, store.args[2], hash)
	if user.ID != "user-1" || user.Email != "teacher@example.com" || user.DisplayName != "Teacher Fran" {
		t.Fatalf("unexpected user: %+v", user)
	}
	if user.PasswordHash == "" {
		t.Fatal("expected credential hash for future login verification")
	}
}

func TestPostgresUserRepositoryRejectsInvalidCredentialUsers(t *testing.T) {
	t.Parallel()

	repository := mustUserRepository(t, &fakeUserStore{})
	cases := []struct {
		name     string
		record   CredentialUserRecord
		expected error
	}{
		{name: "missing email", record: CredentialUserRecord{PasswordHash: validCredentialHash()}, expected: ErrMissingEmail},
		{name: "invalid email", record: CredentialUserRecord{Email: "bad email", PasswordHash: validCredentialHash()}, expected: ErrInvalidEmail},
		{name: "missing hash", record: CredentialUserRecord{Email: "teacher@example.com"}, expected: ErrMissingPasswordHash},
		{name: "plain password", record: CredentialUserRecord{Email: "teacher@example.com", PasswordHash: "correct horse battery staple"}, expected: ErrInvalidPasswordHash},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			_, err := repository.CreateCredentialUser(context.Background(), tc.record)
			if !errors.Is(err, tc.expected) {
				t.Fatalf("expected %v, got %v", tc.expected, err)
			}
		})
	}
}

func TestPostgresUserRepositoryTreatsDuplicateEmailAsTypedError(t *testing.T) {
	t.Parallel()

	store := &fakeUserStore{row: fakeUserRow{err: &pgconn.PgError{Code: "23505"}}}
	repository := mustUserRepository(t, store)

	_, err := repository.CreateCredentialUser(context.Background(), CredentialUserRecord{
		Email:        "teacher@example.com",
		PasswordHash: validCredentialHash(),
	})

	if !errors.Is(err, ErrEmailAlreadyExists) {
		t.Fatalf("expected duplicate email error, got %v", err)
	}
}

func TestPostgresUserRepositoryFindsCredentialUserByEmail(t *testing.T) {
	t.Parallel()

	store := &fakeUserStore{row: fakeUserRow{values: []any{
		"user-1",
		"teacher@example.com",
		"Teacher Fran",
		validCredentialHash(),
	}}}
	repository := mustUserRepository(t, store)

	user, err := repository.FindCredentialUserByEmail(context.Background(), " Teacher@Example.COM ")

	if err != nil {
		t.Fatalf("find user: %v", err)
	}
	if store.query != selectCredentialUserByEmailSQL {
		t.Fatal("expected select credential user SQL")
	}
	assertUserArg(t, store.args[0], "teacher@example.com")
	if user.ID != "user-1" || user.PasswordHash == "" {
		t.Fatalf("unexpected user: %+v", user)
	}
}

func TestPostgresUserRepositoryHandlesMissingCredentialUser(t *testing.T) {
	t.Parallel()

	repository := mustUserRepository(t, &fakeUserStore{row: fakeUserRow{err: pgx.ErrNoRows}})

	_, err := repository.FindCredentialUserByEmail(context.Background(), "missing@example.com")

	if !errors.Is(err, ErrUserNotFound) {
		t.Fatalf("expected user not found, got %v", err)
	}
}

func TestNewPostgresUserRepositoryRequiresStore(t *testing.T) {
	t.Parallel()

	_, err := NewPostgresUserRepository(nil)

	if !errors.Is(err, ErrMissingUserStore) {
		t.Fatalf("expected missing store, got %v", err)
	}
}

func mustUserRepository(t *testing.T, store UserStore) *PostgresUserRepository {
	t.Helper()

	repository, err := NewPostgresUserRepository(store)
	if err != nil {
		t.Fatalf("new user repository: %v", err)
	}

	return repository
}

func validCredentialHash() string {
	hash, err := bcrypt.GenerateFromPassword([]byte("correct horse battery staple"), bcrypt.MinCost)
	if err != nil {
		panic(err)
	}
	return string(hash)
}

type fakeUserStore struct {
	query string
	args  []any
	row   fakeUserRow
}

func (s *fakeUserStore) QueryRow(_ context.Context, query string, args ...any) pgx.Row {
	s.query = query
	s.args = args
	return s.row
}

type fakeUserRow struct {
	values []any
	err    error
}

func (r fakeUserRow) Scan(dest ...any) error {
	if r.err != nil {
		return r.err
	}
	*(dest[0].(*string)) = r.values[0].(string)
	*(dest[1].(*string)) = r.values[1].(string)
	*(dest[2].(*string)) = r.values[2].(string)
	*(dest[3].(*string)) = r.values[3].(string)
	return nil
}

func assertUserArg(t *testing.T, got any, want any) {
	t.Helper()
	if got != want {
		t.Fatalf("expected arg %v, got %v", want, got)
	}
}
