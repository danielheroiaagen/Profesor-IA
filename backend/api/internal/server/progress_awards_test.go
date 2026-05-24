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

func TestProgressAwardRouteRejectsBodyUserIDWithoutSession(t *testing.T) {
	t.Parallel()

	recorder := &fakeProgressAwardRecorder{inserted: true}
	handler := NewHandler(Config{ProgressAwards: recorder})
	requestBody := `{
		"attemptId":"attempt-1",
		"userId":"user-1",
		"evidence":{"verified":true,"learnerTurns":1,"feedbacks":1,"interrupted":false}
	}`
	request := httptest.NewRequest(http.MethodPost, "/v1/progress/awards", bytes.NewBufferString(requestBody))
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d", http.StatusUnauthorized, response.Code)
	}
	if recorder.called {
		t.Fatal("expected unauthenticated body userId to skip recorder")
	}
	if !strings.Contains(response.Body.String(), `"error":"invalid_session"`) {
		t.Fatalf("expected invalid_session response, got %q", response.Body.String())
	}
}

func TestProgressSummaryRouteReturnsAnonymousSummary(t *testing.T) {
	t.Parallel()

	summaries := &fakeProgressSummaryProvider{summary: progress.ProgressSummary{TotalXP: 50, CompletedLessons: 1}}
	handler := NewHandler(Config{ProgressSummary: summaries})
	request := httptest.NewRequest(http.MethodGet, "/v1/progress/summary?anonymousProgressId=anonymous-1", nil)
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d body=%s", http.StatusOK, response.Code, response.Body.String())
	}
	if summaries.identity.AnonymousProgressID != "anonymous-1" || summaries.identity.UserID != "" {
		t.Fatalf("expected anonymous summary identity, got %+v", summaries.identity)
	}
	if body := response.Body.String(); !strings.Contains(body, `"totalXp":50`) || !strings.Contains(body, `"completedLessons":1`) {
		t.Fatalf("expected progress summary response, got %s", body)
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

type fakeProgressSummaryProvider struct {
	identity progress.AwardIdentity
	summary  progress.ProgressSummary
}

func (p *fakeProgressSummaryProvider) SummarizeProgress(_ context.Context, identity progress.AwardIdentity) (progress.ProgressSummary, error) {
	p.identity = identity
	return p.summary, nil
}
