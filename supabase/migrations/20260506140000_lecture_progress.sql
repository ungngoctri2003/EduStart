-- Track lecture completion for certificates (course-level and class-level)

CREATE TABLE public.course_lecture_progress (
  student_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  course_lecture_id UUID NOT NULL REFERENCES public.course_lectures (id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, course_lecture_id)
);

CREATE INDEX idx_course_lecture_progress_student ON public.course_lecture_progress (student_id);
CREATE INDEX idx_course_lecture_progress_lecture ON public.course_lecture_progress (course_lecture_id);

CREATE TABLE public.class_lecture_progress (
  student_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  class_lecture_id UUID NOT NULL REFERENCES public.class_lectures (id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, class_lecture_id)
);

CREATE INDEX idx_class_lecture_progress_student ON public.class_lecture_progress (student_id);
CREATE INDEX idx_class_lecture_progress_lecture ON public.class_lecture_progress (class_lecture_id);

ALTER TABLE public.course_lecture_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_lecture_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY course_lecture_progress_select_own ON public.course_lecture_progress
  FOR SELECT USING (student_id = auth.uid());

CREATE POLICY course_lecture_progress_insert_own ON public.course_lecture_progress
  FOR INSERT WITH CHECK (
    student_id = auth.uid()
    AND public.current_role() = 'student'
  );

CREATE POLICY course_lecture_progress_update_own ON public.course_lecture_progress
  FOR UPDATE USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());

CREATE POLICY course_lecture_progress_admin_all ON public.course_lecture_progress
  FOR ALL USING (public.current_role() = 'admin') WITH CHECK (public.current_role() = 'admin');

CREATE POLICY class_lecture_progress_select_own ON public.class_lecture_progress
  FOR SELECT USING (student_id = auth.uid());

CREATE POLICY class_lecture_progress_insert_own ON public.class_lecture_progress
  FOR INSERT WITH CHECK (
    student_id = auth.uid()
    AND public.current_role() = 'student'
  );

CREATE POLICY class_lecture_progress_update_own ON public.class_lecture_progress
  FOR UPDATE USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());

CREATE POLICY class_lecture_progress_admin_all ON public.class_lecture_progress
  FOR ALL USING (public.current_role() = 'admin') WITH CHECK (public.current_role() = 'admin');
