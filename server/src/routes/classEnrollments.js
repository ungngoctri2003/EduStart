import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { supabaseAdmin } from '../supabase.js';

const r = Router();

r.post('/', requireAuth, requireRole('student'), async (req, res) => {
  const { class_id: classIdRaw, class_slug: classSlug } = req.body || {};
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

  const { data, error } = await supabaseAdmin
    .from('class_students')
    .insert({ student_id: req.user.id, class_id: classId })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Already joined' });
    }
    return res.status(500).json({ error: error.message });
  }
  res.status(201).json(data);
});

export default r;
