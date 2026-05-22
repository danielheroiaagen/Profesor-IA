package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHealthzReturnsServiceStatus(t *testing.T) {
	t.Parallel()

	handler := NewHandler(Config{Version: "test"})
	request := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, response.Code)
	}
	if got := response.Header().Get("Content-Type"); got != "application/json" {
		t.Fatalf("expected JSON content type, got %q", got)
	}
	if got := response.Header().Get("X-Content-Type-Options"); got != "nosniff" {
		t.Fatalf("expected nosniff header, got %q", got)
	}

	var body statusResponse
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	if body.Service != serviceName {
		t.Fatalf("expected service %q, got %q", serviceName, body.Service)
	}
	if body.Status != "ok" {
		t.Fatalf("expected status ok, got %q", body.Status)
	}
	if body.Version != "test" {
		t.Fatalf("expected version test, got %q", body.Version)
	}
}

func TestReadyzReturnsReadyWithoutExternalDependencies(t *testing.T) {
	t.Parallel()

	handler := NewHandler(Config{Version: "test"})
	request := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, response.Code)
	}

	var body statusResponse
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	if body.Status != "ready" {
		t.Fatalf("expected status ready, got %q", body.Status)
	}
	if got := body.Checks["http"]; got != "ok" {
		t.Fatalf("expected http check ok, got %q", got)
	}
}

func TestHealthEndpointsRejectUnsupportedMethods(t *testing.T) {
	t.Parallel()

	handler := NewHandler(Config{})
	request := httptest.NewRequest(http.MethodPost, "/healthz", nil)
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected status %d, got %d", http.StatusMethodNotAllowed, response.Code)
	}
}
