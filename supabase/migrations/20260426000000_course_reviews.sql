-- Real learner reviews (one per student per course)

CREATE TABLE public.course_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses (id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, course_id)
);

CREATE INDEX idx_course_reviews_course_id ON public.course_reviews (course_id);
CREATE INDEX idx_course_reviews_student_id ON public.course_reviews (student_id);

CREATE TRIGGER course_reviews_updated_at
  BEFORE UPDATE ON public.course_reviews
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- Aggregates for list endpoints (read via service role in Express; security invoker for safety if exposed)
CREATE OR REPLACE VIEW public.course_public_stats
WITH (security_invoker = true) AS
SELECT
  c.id AS course_id,
  ROUND(AVG(r.rating::numeric), 1) AS review_avg,
  COUNT(r.id)::int AS review_count,
  (SELECT COUNT(*)::int FROM public.enrollments e WHERE e.course_id = c.id) AS enrollment_count
FROM public.courses c
LEFT JOIN public.course_reviews r ON r.course_id = c.id
GROUP BY c.id;

ALTER TABLE public.course_reviews ENABLE ROW LEVEL SECURITY;

-- Public read: only reviews for published courses
CREATE POLICY course_reviews_select_published
  ON public.course_reviews
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.published = true)
  );

-- Students can insert if enrolled in the course
CREATE POLICY course_reviews_insert_enrolled
  ON public.course_reviews
  FOR INSERT
  WITH CHECK (
    auth.uid() = student_id
    AND EXISTS (
      SELECT 1
      FROM public.enrollments e
      WHERE e.student_id = student_id
        AND e.course_id = course_id
    )
  );

-- Students can update own review (still must be conceptually "their" row; enrollment not revoked check optional)
CREATE POLICY course_reviews_update_own
  ON public.course_reviews
  FOR UPDATE
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY course_reviews_delete_own
  ON public.course_reviews
  FOR DELETE
  USING (auth.uid() = student_id);

-- Admins: full access (for moderation)
CREATE POLICY course_reviews_admin_all
  ON public.course_reviews
  FOR ALL
  USING (public.current_role() = 'admin')
  WITH CHECK (public.current_role() = 'admin');
