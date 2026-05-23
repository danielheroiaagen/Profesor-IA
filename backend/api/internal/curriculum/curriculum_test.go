package curriculum

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
)

func TestPostgresRepositorySelectsNextLesson(t *testing.T) {
	t.Parallel()

	store := &fakeStore{row: fakeRow{values: []any{
		"raio-a1-linking", "A1 Linking Basics", "Use connected speech in short answers", "A1",
		"/t/ and /d/ endings", "Link consonant endings into vowel starts", []byte(`["I am","you are"]`),
		"Tell a short story about your morning", []byte(`{"fluency":"emerging"}`), []byte(`{"target":"linking"}`), 1,
	}}}
	repository := mustRepository(t, store)

	lesson, err := repository.NextLesson(context.Background(), " a1 ")

	if err != nil {
		t.Fatalf("next lesson: %v", err)
	}
	if store.query != selectNextLessonSQL || store.args[0] != "A1" {
		t.Fatalf("unexpected query: %q args=%v", store.query, store.args)
	}
	if lesson.Slug != "raio-a1-linking" || lesson.CEFRLevel != "A1" || lesson.PromptVersion != 1 {
		t.Fatalf("unexpected lesson: %+v", lesson)
	}
	if string(lesson.MatrixDrill) != `["I am","you are"]` {
		t.Fatalf("unexpected matrix drill: %s", lesson.MatrixDrill)
	}
}

func TestPostgresRepositoryErrors(t *testing.T) {
	t.Parallel()

	expectedErr := errors.New("database unavailable")
	cases := []struct {
		name     string
		level    string
		row      fakeRow
		expected error
	}{
		{"invalid level", "starter", fakeRow{}, ErrInvalidCEFRLevel},
		{"missing lesson", "A1", fakeRow{err: pgx.ErrNoRows}, ErrLessonNotFound},
		{"store error", "A1", fakeRow{err: expectedErr}, expectedErr},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			repository := mustRepository(t, &fakeStore{row: tc.row})
			_, err := repository.NextLesson(context.Background(), tc.level)
			if !errors.Is(err, tc.expected) {
				t.Fatalf("expected %v, got %v", tc.expected, err)
			}
		})
	}
}

func TestNextLessonHandlerRespondsWithLesson(t *testing.T) {
	t.Parallel()

	handler := NewHandler(&fakeProvider{lesson: LessonPlan{
		Slug: "raio-a1-linking", Title: "A1 Linking Basics", Objective: "Connect words",
		CEFRLevel: "A1", MatrixDrill: []byte(`[]`), Rubric: []byte(`{}`), CorrectionCriteria: []byte(`{}`), PromptVersion: 1,
	}})
	response := httptest.NewRecorder()

	handler.NextLesson(response, httptest.NewRequest(http.MethodGet, "/v1/curriculum/next?level=A1", nil))

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, response.Code)
	}
	assertBodyContains(t, response, `"slug":"raio-a1-linking"`, `"cefrLevel":"A1"`, `"promptVersion":1`)
}

func TestNextLessonHandlerErrors(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		handler  Handler
		request  *http.Request
		status   int
		expected string
	}{
		{"missing provider", NewHandler(nil), httptest.NewRequest(http.MethodGet, "/v1/curriculum/next", nil), http.StatusServiceUnavailable, "curriculum_unavailable"},
		{"invalid level", NewHandler(&fakeProvider{err: ErrInvalidCEFRLevel}), httptest.NewRequest(http.MethodGet, "/v1/curriculum/next?level=starter", nil), http.StatusBadRequest, "invalid_cefr_level"},
		{"missing lesson", NewHandler(&fakeProvider{err: ErrLessonNotFound}), httptest.NewRequest(http.MethodGet, "/v1/curriculum/next?level=A1", nil), http.StatusNotFound, "lesson_not_found"},
		{"unsupported method", NewHandler(&fakeProvider{}), httptest.NewRequest(http.MethodPost, "/v1/curriculum/next", nil), http.StatusMethodNotAllowed, "method_not_allowed"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			response := httptest.NewRecorder()
			tc.handler.NextLesson(response, tc.request)

			if response.Code != tc.status {
				t.Fatalf("expected status %d, got %d", tc.status, response.Code)
			}
			assertBodyContains(t, response, `"error":"`+tc.expected+`"`)
		})
	}
}

func mustRepository(t *testing.T, store Store) *PostgresRepository {
	t.Helper()
	repository, err := NewPostgresRepository(store)
	if err != nil {
		t.Fatalf("new repository: %v", err)
	}
	return repository
}

type fakeProvider struct {
	lesson LessonPlan
	err    error
}

func (p *fakeProvider) NextLesson(context.Context, string) (LessonPlan, error) {
	return p.lesson, p.err
}

type fakeStore struct {
	query string
	args  []any
	row   fakeRow
}

func (s *fakeStore) QueryRow(_ context.Context, query string, args ...any) pgx.Row {
	s.query = query
	s.args = args
	return s.row
}

type fakeRow struct {
	values []any
	err    error
}

func (r fakeRow) Scan(dest ...any) error {
	if r.err != nil {
		return r.err
	}
	for i, value := range r.values {
		switch target := dest[i].(type) {
		case *string:
			*target = value.(string)
		case *[]byte:
			*target = value.([]byte)
		case *int:
			*target = value.(int)
		}
	}
	return nil
}

func assertBodyContains(t *testing.T, response *httptest.ResponseRecorder, snippets ...string) {
	t.Helper()
	body := response.Body.String()
	for _, snippet := range snippets {
		if !strings.Contains(body, snippet) {
			t.Fatalf("expected body %q to contain %q", body, snippet)
		}
	}
}
