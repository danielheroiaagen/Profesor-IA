-- Seed the first RAIO/YouTalk speaking lesson used by the Go curriculum API.

WITH unit AS (
  INSERT INTO curriculum_units (
    slug,
    title,
    cefr_level,
    description,
    sort_order
  )
  VALUES (
    'raio-youtalk-a1-foundations',
    'RAIO/YouTalk A1 Foundations',
    'A1',
    'Short bilingual speaking drills sourced from the Currículo Integral RAIO de Inglés notebook.',
    10
  )
  ON CONFLICT (slug) DO UPDATE
  SET
    title = EXCLUDED.title,
    cefr_level = EXCLUDED.cefr_level,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    updated_at = now()
  RETURNING id
)
INSERT INTO lesson_plans (
  curriculum_unit_id,
  slug,
  title,
  objective,
  cefr_level,
  phonetic_focus,
  linking_rule,
  matrix_drill,
  story_prompt,
  rubric,
  correction_criteria,
  prompt_version,
  is_active
)
SELECT
  unit.id,
  'raio-youtalk-a1-it-book',
  'Pronombre neutro y vocales cortas',
  'Say “Es un libro.” in English as one short, natural chunk.',
  'A1',
  'Short /ɪ/ in “it” and relaxed /ʊ/ in “book”.',
  'Keep “It’s a book” connected as one short spoken block.',
  $json$[
    {
      "spanish": "Es un libro.",
      "targetEnglish": "It's a book.",
      "focus": "Do not drop the required subject “it”."
    }
  ]$json$::jsonb,
  'Ask the learner in Spanish to say “Es un libro.” in English, then correct the actual spoken answer briefly in Spanish.',
  $json${
    "method": "RAIO/YouTalk",
    "minimumLearnerTurns": 1,
    "minimumFeedbackEvents": 1,
    "success": "Learner says “It's a book.” with the required subject and a short natural chunk."
  }$json$::jsonb,
  $json${
    "sourceNotebook": "Currículo Integral RAIO de Inglés",
    "commonMistakes": [
      "Dropping the required subject “it”.",
      "Saying “is a book” instead of “It's a book”.",
      "Using a long Spanish-style vowel for “it” or “book”."
    ],
    "spanishFeedback": "En inglés necesitás sujeto. Decí “It's a book.”, no “is a book”. Hacé “it” corto y “book” con una vocal relajada."
  }$json$::jsonb,
  1,
  true
FROM unit
ON CONFLICT (slug) DO UPDATE
SET
  curriculum_unit_id = EXCLUDED.curriculum_unit_id,
  title = EXCLUDED.title,
  objective = EXCLUDED.objective,
  cefr_level = EXCLUDED.cefr_level,
  phonetic_focus = EXCLUDED.phonetic_focus,
  linking_rule = EXCLUDED.linking_rule,
  matrix_drill = EXCLUDED.matrix_drill,
  story_prompt = EXCLUDED.story_prompt,
  rubric = EXCLUDED.rubric,
  correction_criteria = EXCLUDED.correction_criteria,
  prompt_version = EXCLUDED.prompt_version,
  is_active = EXCLUDED.is_active,
  updated_at = now();
