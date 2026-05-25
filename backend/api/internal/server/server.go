package server

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/danielheroiaagen/Profesor-IA/backend/api/internal/attempts"
	"github.com/danielheroiaagen/Profesor-IA/backend/api/internal/auth"
	"github.com/danielheroiaagen/Profesor-IA/backend/api/internal/curriculum"
	"github.com/danielheroiaagen/Profesor-IA/backend/api/internal/progress"
	"github.com/danielheroiaagen/Profesor-IA/backend/api/internal/session"
)

const serviceName = "profesor-ia-api"

type DatabasePinger interface {
	Ping(context.Context) error
}

type Config struct {
	Addr            string
	Version         string
	Database        DatabasePinger
	ProgressAwards  progress.AwardRecorder
	ProgressSummary progress.SummaryProvider
	SessionResolver progress.SessionResolver
	SessionRevoker  session.Revoker
	SecureCookies   bool
	Curriculum      curriculum.Provider
	AuthUsers       auth.CredentialUserCreator
	AuthSessions    auth.SessionCreator
	AttemptStarter  attempts.Starter
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
		statusCode, response := readinessResponse(r.Context(), config)
		writeJSON(w, statusCode, response)
	})

	progressHandler := progress.NewHandlerWithSessionsAndSummary(config.ProgressAwards, config.ProgressSummary, config.SessionResolver, session.CookieName)
	mux.HandleFunc("POST /v1/progress/awards", progressHandler.RegisterAward)
	mux.HandleFunc("GET /v1/progress/summary", progressHandler.Summary)
	sessionPolicy := session.NewCookiePolicy(config.SecureCookies)
	authHandler := auth.NewHandler(config.AuthUsers, config.AuthSessions, sessionPolicy)
	mux.HandleFunc("POST /v1/auth/register", authHandler.Register)
	mux.HandleFunc("POST /v1/auth/login", authHandler.Login)
	sessionHandler := session.NewHandlerWithResolver(config.SessionRevoker, config.SessionResolver, sessionPolicy)
	mux.HandleFunc("POST /v1/session/logout", sessionHandler.Logout)
	mux.HandleFunc("GET /v1/session/me", sessionHandler.Current)
	curriculumHandler := curriculum.NewHandler(config.Curriculum)
	mux.HandleFunc("GET /v1/curriculum/next", curriculumHandler.NextLesson)
	attemptHandler := attempts.NewHandler(config.AttemptStarter, config.SessionResolver, session.CookieName)
	mux.HandleFunc("POST /v1/lesson-attempts/start", attemptHandler.Start)
	mux.HandleFunc("POST /v1/lesson-attempts/complete", attemptHandler.Complete)
	mux.HandleFunc("POST /v1/lesson-attempts/events", attemptHandler.RecordEvent)
	mux.HandleFunc("POST /v1/lesson-attempts/feedback", attemptHandler.RecordFeedback)

	return withSecurityHeaders(mux)
}

func readinessResponse(ctx context.Context, config Config) (int, statusResponse) {
	checks := map[string]string{
		"http": "ok",
	}
	statusCode := http.StatusOK
	status := "ready"

	if config.Database == nil {
		checks["postgres"] = "not_configured"
	} else {
		pingContext, cancel := context.WithTimeout(ctx, 2*time.Second)
		defer cancel()

		if err := config.Database.Ping(pingContext); err != nil {
			checks["postgres"] = "unavailable"
			statusCode = http.StatusServiceUnavailable
			status = "degraded"
		} else {
			checks["postgres"] = "ok"
		}
	}

	return statusCode, statusResponse{
		Service: serviceName,
		Status:  status,
		Version: versionOrDefault(config.Version),
		Checks:  checks,
	}
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
