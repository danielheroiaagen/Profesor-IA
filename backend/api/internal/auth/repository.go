package auth

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrMissingUserStore   = errors.New("user store is required")
	ErrMissingUserID      = errors.New("user ID is required")
	ErrEmailAlreadyExists = errors.New("email already exists")
	ErrUserNotFound       = errors.New("user not found")
)

type CredentialUser struct {
	ID           string
	Email        string
	DisplayName  string
	PasswordHash string
}

type CredentialUserRecord struct {
	Email        string
	DisplayName  string
	PasswordHash string
}

type UserStore interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

type PostgresUserRepository struct {
	store UserStore
}

func NewPostgresUserRepository(store UserStore) (*PostgresUserRepository, error) {
	if store == nil {
		return nil, ErrMissingUserStore
	}

	return &PostgresUserRepository{store: store}, nil
}

func (r *PostgresUserRepository) CreateCredentialUser(ctx context.Context, record CredentialUserRecord) (CredentialUser, error) {
	normalized, err := normalizeCredentialUserRecord(record)
	if err != nil {
		return CredentialUser{}, err
	}

	user, err := scanCredentialUser(r.store.QueryRow(
		ctx,
		insertCredentialUserSQL,
		normalized.Email,
		normalized.DisplayName,
		normalized.PasswordHash,
	))
	if err != nil {
		if isUniqueViolation(err) {
			return CredentialUser{}, ErrEmailAlreadyExists
		}

		return CredentialUser{}, fmt.Errorf("create credential user: %w", err)
	}

	return user, nil
}

func (r *PostgresUserRepository) FindCredentialUserByEmail(ctx context.Context, email string) (CredentialUser, error) {
	normalizedEmail, err := NormalizeEmail(email)
	if err != nil {
		return CredentialUser{}, err
	}

	user, err := scanCredentialUser(r.store.QueryRow(ctx, selectCredentialUserByEmailSQL, normalizedEmail))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return CredentialUser{}, ErrUserNotFound
		}

		return CredentialUser{}, fmt.Errorf("find credential user: %w", err)
	}

	return user, nil
}

func normalizeCredentialUserRecord(record CredentialUserRecord) (CredentialUserRecord, error) {
	email, err := NormalizeEmail(record.Email)
	if err != nil {
		return CredentialUserRecord{}, err
	}

	passwordHash, err := normalizePasswordHash(record.PasswordHash)
	if err != nil {
		return CredentialUserRecord{}, err
	}

	return CredentialUserRecord{
		Email:        email,
		DisplayName:  strings.TrimSpace(record.DisplayName),
		PasswordHash: passwordHash,
	}, nil
}

func normalizePasswordHash(hash string) (string, error) {
	value := strings.TrimSpace(hash)
	if value == "" {
		return "", ErrMissingPasswordHash
	}
	if _, err := bcryptCost(value); err != nil {
		return "", ErrInvalidPasswordHash
	}

	return value, nil
}

func bcryptCost(hash string) (int, error) {
	return bcrypt.Cost([]byte(hash))
}

func scanCredentialUser(row pgx.Row) (CredentialUser, error) {
	var user CredentialUser
	if err := row.Scan(&user.ID, &user.Email, &user.DisplayName, &user.PasswordHash); err != nil {
		return CredentialUser{}, err
	}
	if strings.TrimSpace(user.ID) == "" {
		return CredentialUser{}, ErrMissingUserID
	}

	return user, nil
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

const insertCredentialUserSQL = `INSERT INTO users (email, display_name, password_hash)
VALUES ($1, NULLIF($2, ''), $3)
RETURNING id::text, email, COALESCE(display_name, ''), password_hash`

const selectCredentialUserByEmailSQL = `SELECT id::text, email, COALESCE(display_name, ''), password_hash
FROM users
WHERE lower(email) = lower($1) AND password_hash IS NOT NULL
LIMIT 1`
