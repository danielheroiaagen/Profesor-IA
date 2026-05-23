package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/danielheroiaagen/Profesor-IA/backend/api/internal/database"
	"github.com/danielheroiaagen/Profesor-IA/backend/api/internal/progress"
	"github.com/danielheroiaagen/Profesor-IA/backend/api/internal/server"
	"github.com/danielheroiaagen/Profesor-IA/backend/api/internal/session"
)

type sessionStore interface {
	progress.SessionResolver
	session.Revoker
}

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := openDatabaseIfConfigured(ctx)
	if err != nil {
		slog.Error("postgres configuration is present but unavailable", "error", err)
		os.Exit(1)
	}
	if pool != nil {
		defer pool.Close()
	}

	progressAwards, err := openProgressAwardsIfConfigured(pool)
	if err != nil {
		slog.Error("progress awards repository is unavailable", "error", err)
		os.Exit(1)
	}
	sessions, err := openSessionsIfConfigured(pool)
	if err != nil {
		slog.Error("session repository is unavailable", "error", err)
		os.Exit(1)
	}

	config := server.Config{
		Addr:            envOrDefault("GO_API_ADDR", ":8080"),
		Version:         envOrDefault("GO_API_VERSION", "dev"),
		Database:        pool,
		ProgressAwards:  progressAwards,
		SessionResolver: sessions,
		SessionRevoker:  sessions,
		SecureCookies:   secureCookiesFromEnv(),
	}

	httpServer := server.NewHTTPServer(config)
	slog.Info("starting Profesor IA API", "addr", httpServer.Addr)

	if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		slog.Error("Profesor IA API stopped", "error", err)
		os.Exit(1)
	}
}

func openDatabaseIfConfigured(ctx context.Context) (database.Pool, error) {
	postgresURL := os.Getenv("POSTGRES_URL")
	if postgresURL == "" {
		return nil, nil
	}

	return database.Open(ctx, database.Config{URL: postgresURL})
}

func openProgressAwardsIfConfigured(pool database.Pool) (progress.AwardRecorder, error) {
	if pool == nil {
		return nil, nil
	}

	return progress.NewPostgresAwardRepository(pool)
}

func openSessionsIfConfigured(pool database.Pool) (sessionStore, error) {
	if pool == nil {
		return nil, nil
	}

	return session.NewPostgresSessionRepository(pool)
}

func envOrDefault(name string, fallback string) string {
	value := os.Getenv(name)
	if value == "" {
		return fallback
	}

	return value
}

func secureCookiesFromEnv() bool {
	return os.Getenv("GO_API_SECURE_COOKIES") != "false"
}
