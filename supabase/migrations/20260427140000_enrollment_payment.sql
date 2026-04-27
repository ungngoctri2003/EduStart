-- Payment method + approval workflow for course enrollments and class memberships.

ALTER TABLE public.enrollments
  ADD COLUMN payment_method TEXT CHECK (payment_method IS NULL OR payment_method IN ('cash', 'bank_transfer', 'momo', 'vnpay')),
  ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'approved' CHECK (payment_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN payment_note TEXT,
  ADD COLUMN reviewed_at TIMESTAMPTZ,
  ADD COLUMN reviewed_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL;

ALTER TABLE public.class_students
  ADD COLUMN payment_method TEXT CHECK (payment_method IS NULL OR payment_method IN ('cash', 'bank_transfer', 'momo', 'vnpay')),
  ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'approved' CHECK (payment_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN payment_note TEXT,
  ADD COLUMN reviewed_at TIMESTAMPTZ,
  ADD COLUMN reviewed_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL;

-- Existing rows keep access (NOT NULL DEFAULT applied on add).
UPDATE public.enrollments SET payment_status = 'approved' WHERE payment_status IS DISTINCT FROM 'approved';
UPDATE public.class_students SET payment_status = 'approved' WHERE payment_status IS DISTINCT FROM 'approved';

-- Students may only self-enroll with pending + declared payment method (API also enforces).
DROP POLICY IF EXISTS enrollments_student_insert ON public.enrollments;
CREATE POLICY enrollments_student_insert ON public.enrollments
  FOR INSERT WITH CHECK (
    student_id = auth.uid()
    AND public.current_role() = 'student'
    AND payment_status = 'pending'
    AND payment_method IS NOT NULL
    AND payment_method IN ('cash', 'bank_transfer', 'momo', 'vnpay')
  );

-- Class content: only approved members count as enrolled for RLS.
DROP POLICY IF EXISTS classes_select_member ON public.classes;
CREATE POLICY classes_select_member ON public.classes
  FOR SELECT USING (
    public.current_role() = 'admin'
    OR teacher_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.class_students cs
      WHERE cs.class_id = classes.id
        AND cs.student_id = auth.uid()
        AND cs.payment_status = 'approved'
    )
  );

DROP POLICY IF EXISTS class_lectures_select ON public.class_lectures;
CREATE POLICY class_lectures_select ON public.class_lectures
  FOR SELECT USING (
    public.current_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_lectures.class_id AND c.teacher_id = auth.uid()
    )
    OR (
      published = true
      AND EXISTS (
        SELECT 1 FROM public.class_students cs
        WHERE cs.class_id = class_lectures.class_id
          AND cs.student_id = auth.uid()
          AND cs.payment_status = 'approved'
      )
    )
  );

DROP POLICY IF EXISTS class_quizzes_select ON public.class_quizzes;
CREATE POLICY class_quizzes_select ON public.class_quizzes
  FOR SELECT USING (
    public.current_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_quizzes.class_id AND c.teacher_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.class_students cs
      WHERE cs.class_id = class_quizzes.class_id
        AND cs.student_id = auth.uid()
        AND cs.payment_status = 'approved'
    )
  );

DROP POLICY IF EXISTS class_schedules_select ON public.class_schedules;
CREATE POLICY class_schedules_select ON public.class_schedules
  FOR SELECT USING (
    public.current_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_schedules.class_id AND c.teacher_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.class_students cs
      WHERE cs.class_id = class_schedules.class_id
        AND cs.student_id = auth.uid()
        AND cs.payment_status = 'approved'
    )
  );

DROP POLICY IF EXISTS class_quiz_attempts_insert_student ON public.class_quiz_attempts;
CREATE POLICY class_quiz_attempts_insert_student ON public.class_quiz_attempts
  FOR INSERT WITH CHECK (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.class_quizzes q
      JOIN public.class_students cs ON cs.class_id = q.class_id
      WHERE q.id = quiz_id
        AND cs.student_id = auth.uid()
        AND cs.payment_status = 'approved'
    )
    AND class_id IN (SELECT class_id FROM public.class_quizzes WHERE id = quiz_id)
  );

-- Public stats: count only fully approved enrollments.
CREATE OR REPLACE VIEW public.course_public_stats
WITH (security_invoker = true) AS
SELECT
  c.id AS course_id,
  ROUND(AVG(r.rating::numeric), 1) AS review_avg,
  COUNT(r.id)::int AS review_count,
  (
    SELECT COUNT(*)::int
    FROM public.enrollments e
    WHERE e.course_id = c.id AND e.payment_status = 'approved'
  ) AS enrollment_count
FROM public.courses c
LEFT JOIN public.course_reviews r ON r.course_id = c.id
GROUP BY c.id;

-- Reviews only for students with approved enrollment.
DROP POLICY IF EXISTS course_reviews_insert_enrolled ON public.course_reviews;
CREATE POLICY course_reviews_insert_enrolled ON public.course_reviews
  FOR INSERT
  WITH CHECK (
    auth.uid() = student_id
    AND EXISTS (
      SELECT 1
      FROM public.enrollments e
      WHERE e.student_id = student_id
        AND e.course_id = course_id
        AND e.payment_status = 'approved'
    )
  );
