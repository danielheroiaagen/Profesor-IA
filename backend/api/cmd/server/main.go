package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/danielheroiaagen/Profesor-IA/backend/api/internal/attempts"
	"github.com/danielheroiaagen/Profesor-IA/backend/api/internal/auth"
	"github.com/danielheroiaagen/Profesor-IA/backend/api/internal/curriculum"
	"github.com/danielheroiaagen/Profesor-IA/backend/api/internal/database"
	"github.com/danielheroiaagen/Profesor-IA/backend/api/internal/progress"
	"github.com/danielheroiaagen/Profesor-IA/backend/api/internal/server"
	"github.com/danielheroiaagen/Profesor-IA/backend/api/internal/session"
)

type sessionStore interface {
	progress.SessionResolver
	session.Revoker
	auth.SessionCreator
}

type progressStore interface {
	progress.AwardRecorder
	progress.SummaryProvider
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

	progressRecords, err := openProgressStoreIfConfigured(pool)
	if err != nil {
		slog.Error("progress repository is unavailable", "error", err)
		os.Exit(1)
	}
	sessions, err := openSessionsIfConfigured(pool)
	if err != nil {
		slog.Error("session repository is unavailable", "error", err)
		os.Exit(1)
	}
	curriculumProvider, err := openCurriculumIfConfigured(pool)
	if err != nil {
		slog.Error("curriculum repository is unavailable", "error", err)
		os.Exit(1)
	}
	attemptStarter, err := openAttemptsIfConfigured(pool)
	if err != nil {
		slog.Error("lesson attempts repository is unavailable", "error", err)
		os.Exit(1)
	}
	credentialUsers, err := openCredentialUsersIfConfigured(pool)
	if err != nil {
		slog.Error("credential user repository is unavailable", "error", err)
		os.Exit(1)
	}

	config := server.Config{
		Addr:            envOrDefault("GO_API_ADDR", ":8080"),
		Version:         envOrDefault("GO_API_VERSION", "dev"),
		Database:        pool,
		ProgressAwards:  progressRecords,
		ProgressSummary: progressRecords,
		SessionResolver: sessions,
		SessionRevoker:  sessions,
		SecureCookies:   secureCookiesFromEnv(),
		Curriculum:      curriculumProvider,
		AuthUsers:       credentialUsers,
		AuthSessions:    sessions,
		AttemptStarter:  attemptStarter,
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

func openProgressStoreIfConfigured(pool database.Pool) (progressStore, error) {
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

func openCurriculumIfConfigured(pool database.Pool) (curriculum.Provider, error) {
	if pool == nil {
		return nil, nil
	}

	return curriculum.NewPostgresRepository(pool)
}

func openAttemptsIfConfigured(pool database.Pool) (attempts.Starter, error) {
	if pool == nil {
		return nil, nil
	}

	return attempts.NewPostgresRepository(pool)
}

func openCredentialUsersIfConfigured(pool database.Pool) (auth.CredentialUserCreator, error) {
	if pool == nil {
		return nil, nil
	}

	return auth.NewPostgresUserRepository(pool)
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
