-- Link each class to a catalog course (1:N: one course, many classes).

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES public.courses (id) ON DELETE CASCADE;

-- Backfill: attach orphan classes to the earliest published course, then any course.
UPDATE public.classes cl
SET course_id = sub.id
FROM (
  SELECT id FROM public.courses
  WHERE published = true
  ORDER BY created_at ASC
  LIMIT 1
) AS sub
WHERE cl.course_id IS NULL;

UPDATE public.classes cl
SET course_id = sub.id
FROM (
  SELECT id FROM public.courses
  ORDER BY created_at ASC
  LIMIT 1
) AS sub
WHERE cl.course_id IS NULL;

ALTER TABLE public.classes
  ALTER COLUMN course_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_classes_course ON public.classes (course_id);
