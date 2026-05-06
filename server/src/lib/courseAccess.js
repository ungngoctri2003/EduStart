import { supabaseAdmin } from '../supabase.js';

/**
 * Student may use course-level learn/reviews if:
 * - approved enrollment for course, OR
 * - approved class_students row for any active class linked to course_id.
 */
export async function studentHasCourseAccess(studentId, courseId) {
  const { data: enr, error: eErr } = await supabaseAdmin
    .from('enrollments')
    .select('id')
    .eq('student_id', studentId)
    .eq('course_id', courseId)
    .or('payment_status.eq.approved,payment_status.is.null')
    .maybeSingle();
  if (eErr) return { ok: false, error: eErr.message, status: 500 };
  if (enr) return { ok: true };

  const { data: classes, error: cErr } = await supabaseAdmin
    .from('classes')
    .select('id')
    .eq('course_id', courseId)
    .eq('status', 'active');
  if (cErr) return { ok: false, error: cErr.message, status: 500 };
  const classIds = (classes || []).map((row) => row.id).filter(Boolean);
  if (classIds.length === 0) return { ok: false };

  const { data: mem, error: mErr } = await supabaseAdmin
    .from('class_students')
    .select('id')
    .eq('student_id', studentId)
    .eq('payment_status', 'approved')
    .in('class_id', classIds)
    .limit(1)
    .maybeSingle();
  if (mErr) return { ok: false, error: mErr.message, status: 500 };
  return { ok: Boolean(mem) };
}
