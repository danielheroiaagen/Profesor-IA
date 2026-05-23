package curriculum

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"
)

var (
	ErrMissingStore     = errors.New("curriculum store is required")
	ErrInvalidCEFRLevel = errors.New("invalid CEFR level")
	ErrLessonNotFound   = errors.New("lesson not found")
)

type LessonPlan struct {
	Slug               string          `json:"slug"`
	Title              string          `json:"title"`
	Objective          string          `json:"objective"`
	CEFRLevel          string          `json:"cefrLevel"`
	PhoneticFocus      string          `json:"phoneticFocus"`
	LinkingRule        string          `json:"linkingRule"`
	MatrixDrill        json.RawMessage `json:"matrixDrill"`
	StoryPrompt        string          `json:"storyPrompt"`
	Rubric             json.RawMessage `json:"rubric"`
	CorrectionCriteria json.RawMessage `json:"correctionCriteria"`
	PromptVersion      int             `json:"promptVersion"`
}

type Provider interface {
	NextLesson(ctx context.Context, level string) (LessonPlan, error)
}

type Store interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

type PostgresRepository struct {
	store Store
}

func NewPostgresRepository(store Store) (*PostgresRepository, error) {
	if store == nil {
		return nil, ErrMissingStore
	}

	return &PostgresRepository{store: store}, nil
}

func (r *PostgresRepository) NextLesson(ctx context.Context, level string) (LessonPlan, error) {
	normalizedLevel, err := normalizeCEFRLevel(level)
	if err != nil {
		return LessonPlan{}, err
	}

	var lesson LessonPlan
	var matrixDrill []byte
	var rubric []byte
	var correctionCriteria []byte
	err = r.store.QueryRow(ctx, selectNextLessonSQL, normalizedLevel).Scan(
		&lesson.Slug,
		&lesson.Title,
		&lesson.Objective,
		&lesson.CEFRLevel,
		&lesson.PhoneticFocus,
		&lesson.LinkingRule,
		&matrixDrill,
		&lesson.StoryPrompt,
		&rubric,
		&correctionCriteria,
		&lesson.PromptVersion,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return LessonPlan{}, ErrLessonNotFound
		}

		return LessonPlan{}, fmt.Errorf("select next lesson: %w", err)
	}

	lesson.MatrixDrill = jsonOrFallback(matrixDrill, `[]`)
	lesson.Rubric = jsonOrFallback(rubric, `{}`)
	lesson.CorrectionCriteria = jsonOrFallback(correctionCriteria, `{}`)
	return lesson, nil
}

type Handler struct {
	provider Provider
}

func NewHandler(provider Provider) Handler {
	return Handler{provider: provider}
}

func (h Handler) NextLesson(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeCurriculumJSON(w, http.StatusMethodNotAllowed, errorResponse{Error: "method_not_allowed"})
		return
	}
	if h.provider == nil {
		writeCurriculumJSON(w, http.StatusServiceUnavailable, errorResponse{Error: "curriculum_unavailable"})
		return
	}

	lesson, err := h.provider.NextLesson(r.Context(), r.URL.Query().Get("level"))
	if err != nil {
		status := http.StatusInternalServerError
		code := "curriculum_failed"
		switch {
		case errors.Is(err, ErrInvalidCEFRLevel):
			status = http.StatusBadRequest
			code = "invalid_cefr_level"
		case errors.Is(err, ErrLessonNotFound):
			status = http.StatusNotFound
			code = "lesson_not_found"
		}
		writeCurriculumJSON(w, status, errorResponse{Error: code})
		return
	}

	writeCurriculumJSON(w, http.StatusOK, lesson)
}

type errorResponse struct {
	Error string `json:"error"`
}

func normalizeCEFRLevel(level string) (string, error) {
	value := strings.ToUpper(strings.TrimSpace(level))
	if value == "" {
		return "A1", nil
	}
	for _, allowed := range []string{"A1", "A2", "B1", "B2", "C1", "C2"} {
		if value == allowed {
			return value, nil
		}
	}

	return "", ErrInvalidCEFRLevel
}

func jsonOrFallback(value []byte, fallback string) json.RawMessage {
	if !json.Valid(value) {
		return json.RawMessage(fallback)
	}

	return json.RawMessage(value)
}

func writeCurriculumJSON(w http.ResponseWriter, statusCode int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		return
	}
}

const selectNextLessonSQL = `
SELECT slug, title, objective, cefr_level, phonetic_focus, linking_rule, matrix_drill, story_prompt, rubric, correction_criteria, prompt_version
FROM lesson_plans
WHERE is_active = true AND cefr_level = $1
ORDER BY updated_at ASC, slug ASC
LIMIT 1
`
