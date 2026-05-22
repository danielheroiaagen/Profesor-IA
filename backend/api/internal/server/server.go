package server

import (
	"encoding/json"
	"net/http"
	"time"
)

const serviceName = "profesor-ia-api"

type Config struct {
	Addr    string
	Version string
}

type statusResponse struct {
	Service string            `json:"service"`
	Status  string            `json:"status"`
	Version string            `json:"version,omitempty"`
	Checks  map[string]string `json:"checks,omitempty"`
}

func NewHTTPServer(config Config) *http.Server {
	addr := config.Addr
	if addr == "" {
		addr = ":8080"
	}

	return &http.Server{
		Addr:              addr,
		Handler:           NewHandler(config),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
}

func NewHandler(config Config) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, statusResponse{
			Service: serviceName,
			Status:  "ok",
			Version: versionOrDefault(config.Version),
		})
	})

	mux.HandleFunc("GET /readyz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, statusResponse{
			Service: serviceName,
			Status:  "ready",
			Version: versionOrDefault(config.Version),
			Checks: map[string]string{
				"http": "ok",
			},
		})
	})

	return withSecurityHeaders(mux)
}

func withSecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Cache-Control", "no-store")
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, statusCode int, body statusResponse) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)

	if err := json.NewEncoder(w).Encode(body); err != nil {
		return
	}
}

func versionOrDefault(version string) string {
	if version == "" {
		return "dev"
	}

	return version
}
