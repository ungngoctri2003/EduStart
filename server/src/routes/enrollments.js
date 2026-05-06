import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { supabaseAdmin } from '../supabase.js';

const r = Router();

/** Courses with scheduled classes enroll only via class (payment there). */
async function courseHasActiveClasses(courseId) {
  const { count, error } = await supabaseAdmin
    .from('classes')
    .select('id', { count: 'exact', head: true })
    .eq('course_id', courseId)
    .eq('status', 'active');
  if (error) return { error: error.message };
  return { has: (count ?? 0) > 0 };
}

r.post('/', requireAuth, requireRole('student'), async (req, res) => {
  const { course_id: courseId } = req.body || {};
  if (!courseId) return res.status(400).json({ error: 'course_id required' });

  const { data: course, error: cErr } = await supabaseAdmin
    .from('courses')
    .select('id, published')
    .eq('id', courseId)
    .single();
  if (cErr || !course) return res.status(404).json({ error: 'Course not found' });
  if (!course.published) return res.status(400).json({ error: 'Course not available' });

  const activeCheck = await courseHasActiveClasses(courseId);
  if (activeCheck.error) return res.status(500).json({ error: activeCheck.error });
  if (activeCheck.has) {
    return res.status(400).json({
      error: 'ENROLL_VIA_CLASS',
      message:
        'Khóa học này mở theo lớp. Vui lòng chọn và đăng ký một lớp bên dưới để thanh toán.',
    });
  }

  const insertPayload = {
    student_id: req.user.id,
    course_id: courseId,
    payment_method: null,
    payment_status: 'approved',
    payment_note: null,
    reviewed_at: null,
    reviewed_by: null,
  };

  const { data, error } = await supabaseAdmin.from('enrollments').insert(insertPayload).select().single();

  if (error) {
    if (error.code === '23505') {
      const { data: existing, error: exErr } = await supabaseAdmin
        .from('enrollments')
        .select(
          'id, payment_status, payment_method, course_id, student_id, enrolled_at, payment_note, reviewed_at, reviewed_by',
        )
        .eq('student_id', req.user.id)
        .eq('course_id', courseId)
        .maybeSingle();
      if (exErr || !existing) return res.status(409).json({ error: 'Already enrolled' });
      if (existing.payment_status === 'approved') {
        return res.status(409).json({ error: 'Already enrolled', payment_status: 'approved' });
      }
      if (existing.payment_status === 'pending' || existing.payment_status === 'rejected') {
        const { data: updated, error: uErr } = await supabaseAdmin
          .from('enrollments')
          .update({
            payment_status: 'approved',
            payment_method: null,
            payment_note: null,
            reviewed_at: null,
            reviewed_by: null,
          })
          .eq('id', existing.id)
          .select()
          .single();
        if (uErr) return res.status(500).json({ error: uErr.message });
        return res.status(200).json(updated);
      }
    }
    return res.status(500).json({ error: error.message });
  }
  res.status(201).json(data);
});

r.get('/me', requireAuth, requireRole('student'), async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('enrollments')
    .select(
      `
      *,
      courses(*)
    `,
    )
    .eq('student_id', req.user.id)
    .order('enrolled_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

export default r;
