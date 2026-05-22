package main

import (
	"errors"
	"log/slog"
	"net/http"
	"os"

	"github.com/danielheroiaagen/Profesor-IA/backend/api/internal/server"
)

func main() {
	config := server.Config{
		Addr:    envOrDefault("GO_API_ADDR", ":8080"),
		Version: envOrDefault("GO_API_VERSION", "dev"),
	}

	httpServer := server.NewHTTPServer(config)
	slog.Info("starting Profesor IA API", "addr", httpServer.Addr)

	if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		slog.Error("Profesor IA API stopped", "error", err)
		os.Exit(1)
	}
}

func envOrDefault(name string, fallback string) string {
	value := os.Getenv(name)
	if value == "" {
		return fallback
	}

	return value
}
