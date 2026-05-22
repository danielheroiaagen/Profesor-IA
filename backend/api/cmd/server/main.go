package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/danielheroiaagen/Profesor-IA/backend/api/internal/database"
	"github.com/danielheroiaagen/Profesor-IA/backend/api/internal/server"
)

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

	config := server.Config{
		Addr:     envOrDefault("GO_API_ADDR", ":8080"),
		Version:  envOrDefault("GO_API_VERSION", "dev"),
		Database: pool,
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

func envOrDefault(name string, fallback string) string {
	value := os.Getenv(name)
	if value == "" {
		return fallback
	}

	return value
}
