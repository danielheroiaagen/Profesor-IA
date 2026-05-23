package database

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrMissingURL    = errors.New("postgres URL is required")
	ErrMissingPinger = errors.New("database pinger is required")
)

type Config struct {
	URL      string
	MaxConns int32
}

type Pinger interface {
	Ping(context.Context) error
}

type Executor interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

type Querier interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

type Pool interface {
	Pinger
	Executor
	Querier
	Close()
}

func Open(ctx context.Context, config Config) (Pool, error) {
	url := strings.TrimSpace(config.URL)
	if url == "" {
		return nil, ErrMissingURL
	}

	poolConfig, err := pgxpool.ParseConfig(url)
	if err != nil {
		return nil, fmt.Errorf("parse postgres config: %w", err)
	}

	if config.MaxConns > 0 {
		poolConfig.MaxConns = config.MaxConns
	}

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("open postgres pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping postgres: %w", err)
	}

	return pool, nil
}

func Check(ctx context.Context, pinger Pinger) error {
	if pinger == nil {
		return ErrMissingPinger
	}

	if err := pinger.Ping(ctx); err != nil {
		return fmt.Errorf("ping postgres: %w", err)
	}

	return nil
}
