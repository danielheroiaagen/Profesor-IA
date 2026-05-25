-- Remove the seeded RAIO/YouTalk speaking lesson.

DELETE FROM lesson_plans
WHERE slug = 'raio-youtalk-a1-it-book';

DELETE FROM curriculum_units
WHERE
  slug = 'raio-youtalk-a1-foundations'
  AND NOT EXISTS (
    SELECT 1
    FROM lesson_plans
    WHERE curriculum_unit_id = curriculum_units.id
  );
