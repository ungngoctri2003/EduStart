-- Restore teacher role + classroom model (independent of public.courses).
-- Enum value `teacher` is added in 20260426175500_add_teacher_enum_value.sql (separate transaction).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  teacher_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_classes_teacher ON public.classes (teacher_id);
CREATE INDEX idx_classes_status ON public.classes (status);

CREATE TABLE public.class_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, student_id)
);

CREATE INDEX idx_class_students_class ON public.class_students (class_id);
CREATE INDEX idx_class_students_student ON public.class_students (student_id);

CREATE TABLE public.class_lectures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  video_url TEXT,
  blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INT NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_class_lectures_class ON public.class_lectures (class_id);
CREATE INDEX idx_class_lectures_published ON public.class_lectures (class_id, published);

CREATE TABLE public.class_quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_class_quizzes_class ON public.class_quizzes (class_id);

CREATE TABLE public.class_quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES public.class_quizzes (id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE,
  correct INT NOT NULL CHECK (correct >= 0),
  total INT NOT NULL CHECK (total >= 0),
  percent INT NOT NULL CHECK (percent >= 0 AND percent <= 100),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_class_quiz_attempts_student ON public.class_quiz_attempts (student_id);
CREATE INDEX idx_class_quiz_attempts_quiz ON public.class_quiz_attempts (quiz_id);
CREATE INDEX idx_class_quiz_attempts_class ON public.class_quiz_attempts (class_id);

CREATE TABLE public.class_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  location TEXT,
  meeting_url TEXT,
  notes TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_class_schedules_class ON public.class_schedules (class_id);
CREATE INDEX idx_class_schedules_starts ON public.class_schedules (starts_at);

-- updated_at triggers (set_updated_at from init migration)
CREATE TRIGGER classes_updated_at
  BEFORE UPDATE ON public.classes
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER class_lectures_updated_at
  BEFORE UPDATE ON public.class_lectures
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER class_quizzes_updated_at
  BEFORE UPDATE ON public.class_quizzes
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER class_schedules_updated_at
  BEFORE UPDATE ON public.class_schedules
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_lectures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_schedules ENABLE ROW LEVEL SECURITY;

-- classes
CREATE POLICY classes_select_member ON public.classes
  FOR SELECT USING (
    public.current_role() = 'admin'
    OR teacher_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.class_students cs
      WHERE cs.class_id = classes.id AND cs.student_id = auth.uid()
    )
  );

CREATE POLICY classes_insert_admin ON public.classes
  FOR INSERT WITH CHECK (public.current_role() = 'admin');

CREATE POLICY classes_update_admin ON public.classes
  FOR UPDATE
  USING (public.current_role() = 'admin')
  WITH CHECK (public.current_role() = 'admin');

CREATE POLICY classes_update_teacher_own ON public.classes
  FOR UPDATE
  USING (public.current_role() = 'teacher' AND teacher_id = auth.uid())
  WITH CHECK (public.current_role() = 'teacher' AND teacher_id = auth.uid());

CREATE POLICY classes_delete_admin ON public.classes
  FOR DELETE USING (public.current_role() = 'admin');

-- class_students
CREATE POLICY class_students_select ON public.class_students
  FOR SELECT USING (
    public.current_role() = 'admin'
    OR student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_students.class_id AND c.teacher_id = auth.uid()
    )
  );

CREATE POLICY class_students_insert ON public.class_students
  FOR INSERT WITH CHECK (
    public.current_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_students.class_id AND c.teacher_id = auth.uid()
    )
  );

CREATE POLICY class_students_delete ON public.class_students
  FOR DELETE USING (
    public.current_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_students.class_id AND c.teacher_id = auth.uid()
    )
  );

-- class_lectures
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
        WHERE cs.class_id = class_lectures.class_id AND cs.student_id = auth.uid()
      )
    )
  );

CREATE POLICY class_lectures_write_teacher ON public.class_lectures
  FOR ALL
  USING (
    public.current_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_lectures.class_id AND c.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    public.current_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_lectures.class_id AND c.teacher_id = auth.uid()
    )
  );

-- class_quizzes (students see questions via RLS — clients should still strip answers server-side)
CREATE POLICY class_quizzes_select ON public.class_quizzes
  FOR SELECT USING (
    public.current_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_quizzes.class_id AND c.teacher_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.class_students cs
      WHERE cs.class_id = class_quizzes.class_id AND cs.student_id = auth.uid()
    )
  );

CREATE POLICY class_quizzes_write_teacher ON public.class_quizzes
  FOR ALL
  USING (
    public.current_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_quizzes.class_id AND c.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    public.current_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_quizzes.class_id AND c.teacher_id = auth.uid()
    )
  );

-- class_schedules
CREATE POLICY class_schedules_select ON public.class_schedules
  FOR SELECT USING (
    public.current_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_schedules.class_id AND c.teacher_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.class_students cs
      WHERE cs.class_id = class_schedules.class_id AND cs.student_id = auth.uid()
    )
  );

CREATE POLICY class_schedules_write_teacher ON public.class_schedules
  FOR ALL
  USING (
    public.current_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_schedules.class_id AND c.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    public.current_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_schedules.class_id AND c.teacher_id = auth.uid()
    )
  );

-- class_quiz_attempts
CREATE POLICY class_quiz_attempts_select ON public.class_quiz_attempts
  FOR SELECT USING (
    student_id = auth.uid()
    OR public.current_role() = 'admin'
    OR EXISTS (
      SELECT 1
      FROM public.class_quizzes q
      JOIN public.classes c ON c.id = q.class_id
      WHERE q.id = class_quiz_attempts.quiz_id AND c.teacher_id = auth.uid()
    )
  );

CREATE POLICY class_quiz_attempts_insert_student ON public.class_quiz_attempts
  FOR INSERT WITH CHECK (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.class_quizzes q
      JOIN public.class_students cs ON cs.class_id = q.class_id
      WHERE q.id = quiz_id AND cs.student_id = auth.uid()
    )
    AND class_id IN (SELECT class_id FROM public.class_quizzes WHERE id = quiz_id)
  );
