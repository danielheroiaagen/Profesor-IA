package server

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/danielheroiaagen/Profesor-IA/backend/api/internal/progress"
)

func TestProgressAwardRouteRecordsValidCompletion(t *testing.T) {
	t.Parallel()

	recorder := &fakeProgressAwardRecorder{inserted: true}
	handler := NewHandler(Config{ProgressAwards: recorder})
	requestBody := `{
		"attemptId":"attempt-1",
		"anonymousProgressId":"anonymous-1",
		"evidence":{"verified":true,"learnerTurns":1,"feedbacks":1,"interrupted":false}
	}`
	request := httptest.NewRequest(http.MethodPost, "/v1/progress/awards", bytes.NewBufferString(requestBody))
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, response.Code)
	}
	if !recorder.called {
		t.Fatal("expected progress award recorder call")
	}
	if recorder.record.AttemptID != "attempt-1" || recorder.record.Identity.AnonymousProgressID != "anonymous-1" {
		t.Fatalf("unexpected record: %+v", recorder.record)
	}

	body := response.Body.String()
	for _, snippet := range []string{`"awarded":true`, `"xp":50`, `"reason":"lesson_completed"`, `"inserted":true`} {
		if !strings.Contains(body, snippet) {
			t.Fatalf("expected body %q to contain %q", body, snippet)
		}
	}
}

type fakeProgressAwardRecorder struct {
	called   bool
	record   progress.AwardRecord
	inserted bool
	err      error
}

func (r *fakeProgressAwardRecorder) RecordAward(_ context.Context, record progress.AwardRecord) (bool, error) {
	r.called = true
	r.record = record

	return r.inserted, r.err
}
