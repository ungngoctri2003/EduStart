import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { supabaseAdmin } from '../supabase.js';

const r = Router();

function normalizeReason(raw) {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (s.length < 10) return { error: 'REASON_TOO_SHORT' };
  if (s.length > 4000) return { error: 'REASON_TOO_LONG' };
  return { value: s };
}

/** Học viên gửi yêu cầu hoàn tiền lớp (chờ admin duyệt). */
r.post('/', requireAuth, requireRole('student'), async (req, res) => {
  try {
    const { class_student_id: csid } = req.body || {};
    if (!csid || typeof csid !== 'string') {
      return res.status(400).json({ error: 'class_student_id required' });
    }
    const reasonParsed = normalizeReason(req.body?.reason);
    if (reasonParsed.error) {
      return res.status(400).json({ error: reasonParsed.error });
    }

    const { data: mem, error: mErr } = await supabaseAdmin
      .from('class_students')
      .select('id, student_id, class_id, payment_status')
      .eq('id', csid)
      .maybeSingle();
    if (mErr) return res.status(500).json({ error: mErr.message });
    if (!mem || mem.student_id !== req.user.id) {
      return res.status(403).json({ error: 'NOT_YOUR_MEMBERSHIP' });
    }
    if (mem.payment_status !== 'approved') {
      return res.status(400).json({ error: 'REFUND_NOT_ALLOWED_STATUS' });
    }

    const { data: pending, error: pErr } = await supabaseAdmin
      .from('class_refund_requests')
      .select('id')
      .eq('class_student_id', csid)
      .eq('status', 'pending')
      .maybeSingle();
    if (pErr) return res.status(500).json({ error: pErr.message });
    if (pending) {
      return res.status(409).json({ error: 'REFUND_REQUEST_PENDING' });
    }

    const { data: row, error: iErr } = await supabaseAdmin
      .from('class_refund_requests')
      .insert({
        class_student_id: csid,
        student_id: req.user.id,
        class_id: mem.class_id,
        reason: reasonParsed.value,
        status: 'pending',
      })
      .select()
      .single();

    if (iErr) {
      if (iErr.code === '23505') return res.status(409).json({ error: 'REFUND_REQUEST_PENDING' });
      return res.status(500).json({ error: iErr.message });
    }
    res.status(201).json(row);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Error' });
  }
});

export default r;
