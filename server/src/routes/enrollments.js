import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { supabaseAdmin } from '../supabase.js';
import { normalizePaymentNote, paymentMethodError } from '../lib/paymentEnrollment.js';

const r = Router();

r.post('/', requireAuth, requireRole('student'), async (req, res) => {
  const {
    course_id: courseId,
    payment_method: paymentMethod,
    payment_note: paymentNoteRaw,
  } = req.body || {};
  if (!courseId) return res.status(400).json({ error: 'course_id required' });

  const pmErr = paymentMethodError(paymentMethod);
  if (pmErr) return res.status(400).json({ error: pmErr });
  const payment_note = normalizePaymentNote(paymentNoteRaw);

  const { data: course, error: cErr } = await supabaseAdmin
    .from('courses')
    .select('id, published')
    .eq('id', courseId)
    .single();
  if (cErr || !course) return res.status(404).json({ error: 'Course not found' });
  if (!course.published) return res.status(400).json({ error: 'Course not available' });

  const insertPayload = {
    student_id: req.user.id,
    course_id: courseId,
    payment_method: paymentMethod,
    payment_status: 'pending',
    payment_note,
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
      if (existing.payment_status === 'pending') {
        return res.status(409).json({
          error: 'Enrollment pending approval',
          payment_status: 'pending',
          enrollment: existing,
        });
      }
      if (existing.payment_status === 'rejected') {
        const { data: updated, error: uErr } = await supabaseAdmin
          .from('enrollments')
          .update({
            payment_status: 'pending',
            payment_method: paymentMethod,
            payment_note,
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
