import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { supabaseAdmin } from '../supabase.js';
import { normalizePaymentNote, paymentMethodError } from '../lib/paymentEnrollment.js';

const r = Router();

r.post('/', requireAuth, requireRole('student'), async (req, res) => {
  const {
    class_id: classIdRaw,
    class_slug: classSlug,
    payment_method: paymentMethod,
    payment_note: paymentNoteRaw,
  } = req.body || {};

  const pmErr = paymentMethodError(paymentMethod);
  if (pmErr) return res.status(400).json({ error: pmErr });
  const payment_note = normalizePaymentNote(paymentNoteRaw);

  let classId = classIdRaw;

  if (classId && typeof classId !== 'string') {
    return res.status(400).json({ error: 'class_id must be a string UUID' });
  }

  if (!classId && classSlug && typeof classSlug === 'string') {
    const { data: row, error: sErr } = await supabaseAdmin
      .from('classes')
      .select('id, status')
      .eq('slug', classSlug.trim())
      .maybeSingle();
    if (sErr) return res.status(500).json({ error: sErr.message });
    if (!row) return res.status(404).json({ error: 'Class not found' });
    if (row.status !== 'active') return res.status(400).json({ error: 'Class not available' });
    classId = row.id;
  }

  if (!classId) {
    return res.status(400).json({ error: 'class_id or class_slug required' });
  }

  const { data: klass, error: cErr } = await supabaseAdmin
    .from('classes')
    .select('id, status')
    .eq('id', classId)
    .single();
  if (cErr || !klass) return res.status(404).json({ error: 'Class not found' });
  if (klass.status !== 'active') return res.status(400).json({ error: 'Class not available' });

  const insertPayload = {
    student_id: req.user.id,
    class_id: classId,
    payment_method: paymentMethod,
    payment_status: 'pending',
    payment_note,
  };

  const { data, error } = await supabaseAdmin.from('class_students').insert(insertPayload).select().single();

  if (error) {
    if (error.code === '23505') {
      const { data: existing, error: exErr } = await supabaseAdmin
        .from('class_students')
        .select(
          'id, payment_status, payment_method, class_id, student_id, joined_at, payment_note, reviewed_at, reviewed_by',
        )
        .eq('student_id', req.user.id)
        .eq('class_id', classId)
        .maybeSingle();
      if (exErr || !existing) return res.status(409).json({ error: 'Already joined' });
      if (existing.payment_status === 'approved') {
        return res.status(409).json({ error: 'Already joined', payment_status: 'approved' });
      }
      if (existing.payment_status === 'pending') {
        return res.status(409).json({
          error: 'Join request pending approval',
          payment_status: 'pending',
          membership: existing,
        });
      }
      if (existing.payment_status === 'rejected' || existing.payment_status === 'refunded') {
        const { data: updated, error: uErr } = await supabaseAdmin
          .from('class_students')
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

export default r;
