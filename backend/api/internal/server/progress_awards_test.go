package server

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/danielheroiaagen/Profesor-IA/backend/api/internal/progress"
)

func TestProgressAwardRouteRecordsValidCompletion(t *testing.T) {
	t.Parallel()

	recorder := &fakeProgressAwardRecorder{inserted: true}
	handler := NewHandler(Config{ProgressAwards: recorder})
	request := httptest.NewRequest(http.MethodPost, "/v1/progress/awards", bytes.NewBufferString(`{
		"attemptId":"attempt-1",
		"anonymousProgressId":"anonymous-1",
		"evidence":{"verified":true,"learnerTurns":1,"feedbacks":1,"interrupted":false}
	}`))
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, response.Code)
	}
	if !recorder.called {
		t.Fatal("expected progress award recorder call")
	}
	if recorder.record.AttemptID != "attempt-1" {
		t.Fatalf("expected attempt-1, got %q", recorder.record.AttemptID)
	}
	if recorder.record.Identity.AnonymousProgressID != "anonymous-1" {
		t.Fatalf("expected anonymous-1, got %q", recorder.record.Identity.AnonymousProgressID)
	}

	var body struct {
		Awarded  bool   `json:"awarded"`
		XP       int    `json:"xp"`
		Reason   string `json:"reason"`
		Inserted bool   `json:"inserted"`
	}
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !body.Awarded || !body.Inserted || body.XP != progress.LessonCompletionXP || body.Reason != "lesson_completed" {
		t.Fatalf("unexpected award response: %+v", body)
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
