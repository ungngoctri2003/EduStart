-- Refund workflow for class memberships: student requests admin approval.

ALTER TABLE public.class_students
  DROP CONSTRAINT IF EXISTS class_students_payment_status_check;

ALTER TABLE public.class_students
  ADD CONSTRAINT class_students_payment_status_check
  CHECK (payment_status IN ('pending', 'approved', 'rejected', 'refunded'));

CREATE TABLE public.class_refund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_student_id UUID NOT NULL REFERENCES public.class_students (id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reason TEXT NOT NULL,
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX class_refund_requests_one_pending_per_membership
  ON public.class_refund_requests (class_student_id)
  WHERE status = 'pending';

CREATE INDEX class_refund_requests_status_created_idx
  ON public.class_refund_requests (status, created_at DESC);

ALTER TABLE public.class_refund_requests ENABLE ROW LEVEL SECURITY;
