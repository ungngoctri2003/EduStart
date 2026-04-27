import { Router } from 'express';
import { supabaseAdmin } from '../supabase.js';
import { optionalAuth } from '../middleware/auth.js';
import { fetchCourseStatsMap, mergeCourseStats } from '../lib/courseStats.js';

const r = Router();

r.get('/courses', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('courses')
    .select('*, categories(id, name, slug)')
    .eq('published', true)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  const list = data || [];
  try {
    const map = await fetchCourseStatsMap(list.map((c) => c.id));
    const merged = list.map((c) => mergeCourseStats(c, map));
    res.json(merged);
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Failed to load course stats' });
  }
});

/** Must be before GET /courses/:slug so "reviews" is not captured as :slug (when slug = …); here :slug is first segment only for fixed paths — actually in Express, /courses/x/reviews matches first if registered first. */
r.get('/courses/:slug/reviews', optionalAuth, async (req, res) => {
  const { slug } = req.params;
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
  const offset = Math.max(0, parseInt(String(req.query.offset || '0'), 10) || 0);
  const end = offset + limit - 1;

  const { data: course, error: cErr } = await supabaseAdmin
    .from('courses')
    .select('id, published')
    .eq('slug', slug)
    .single();
  if (cErr || !course) return res.status(404).json({ error: 'Course not found' });
  if (!course.published) return res.status(404).json({ error: 'Course not found' });

  let statsMap;
  try {
    statsMap = await fetchCourseStatsMap([course.id]);
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Failed to load stats' });
  }
  const s = statsMap.get(course.id) || { review_avg: null, review_count: 0, enrollment_count: 0 };

  const { data: rows, error, count } = await supabaseAdmin
    .from('course_reviews')
    .select('id, rating, comment, created_at, student_id', { count: 'exact' })
    .eq('course_id', course.id)
    .order('created_at', { ascending: false })
    .range(offset, end);

  if (error) return res.status(500).json({ error: error.message });

  const sids = [...new Set((rows || []).map((row) => row.student_id))];
  const { data: profs } = await supabaseAdmin.from('profiles').select('id, full_name').in('id', sids);
  const nameById = Object.fromEntries((profs || []).map((p) => [p.id, p.full_name]));

  const items = (rows || []).map((row) => ({
    id: row.id,
    rating: row.rating,
    comment: row.comment,
    created_at: row.created_at,
    author_name: (nameById[row.student_id] && String(nameById[row.student_id]).trim()) || 'Học viên',
  }));

  let myReview = null;
  if (req.user?.role === 'student') {
    const { data: m } = await supabaseAdmin
      .from('course_reviews')
      .select('id, rating, comment, created_at')
      .eq('course_id', course.id)
      .eq('student_id', req.user.id)
      .maybeSingle();
    myReview = m;
  }

  res.json({
    summary: {
      review_avg: s.review_avg,
      review_count: s.review_count,
      enrollment_count: s.enrollment_count,
    },
    items,
    total: count ?? 0,
    myReview,
  });
});

/** Published course metadata only (no lectures/quizzes — use /api/learn when enrolled). */
r.get('/courses/:slug', async (req, res) => {
  const { data: course, error } = await supabaseAdmin
    .from('courses')
    .select('*, categories(id, name, slug)')
    .eq('slug', req.params.slug)
    .single();
  if (error || !course) return res.status(404).json({ error: 'Course not found' });
  if (!course.published) return res.status(404).json({ error: 'Course not found' });
  try {
    const map = await fetchCourseStatsMap([course.id]);
    res.json(mergeCourseStats({ ...course, lectures: [], quizzes: [] }, map));
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Failed to load course stats' });
  }
});

async function enrichPublicClassRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 0) return [];
  const ids = list.map((c) => c.id);
  const tids = [...new Set(list.map((c) => c.teacher_id).filter(Boolean))];

  const [stRes, profRes] = await Promise.all([
    supabaseAdmin.from('class_students').select('class_id').in('class_id', ids).eq('payment_status', 'approved'),
    tids.length
      ? supabaseAdmin.from('profiles').select('id, full_name').in('id', tids)
      : Promise.resolve({ data: [] }),
  ]);
  if (stRes.error) throw new Error(stRes.error.message);
  if (profRes.error) throw new Error(profRes.error.message);

  const countByClass = new Map();
  for (const r of stRes.data || []) {
    const cid = r.class_id;
    countByClass.set(cid, (countByClass.get(cid) || 0) + 1);
  }
  const nameById = Object.fromEntries((profRes.data || []).map((p) => [p.id, p.full_name]));

  return list.map((row) => ({
    ...row,
    teacher_name: row.teacher_id ? nameById[row.teacher_id] ?? null : null,
    student_count: countByClass.get(row.id) || 0,
  }));
}

/** Public catalog: active classes only (no lecture/quiz bodies — use /api/class-learn when enrolled). */
r.get('/classes', async (_req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('classes')
      .select('id, name, slug, description, status, starts_at, ends_at, created_at, teacher_id, image_url')
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    const out = await enrichPublicClassRows(data);
    res.json(out);
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Failed to list classes' });
  }
});

r.get('/classes/:slug', async (req, res) => {
  try {
    const { data: row, error } = await supabaseAdmin
      .from('classes')
      .select('id, name, slug, description, status, starts_at, ends_at, created_at, teacher_id, image_url')
      .eq('slug', req.params.slug)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!row || row.status !== 'active') return res.status(404).json({ error: 'Class not found' });
    const [enriched] = await enrichPublicClassRows([row]);
    res.json(enriched);
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Failed to load class' });
  }
});

r.get('/categories', async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

r.get('/team', async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from('team_members')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

r.get('/testimonials', async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from('testimonials')
    .select('id, author_name, author_title, content, image_url, rating, sort_order, created_at')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

/**
 * Gửi đánh giá từ trang công khai (lưu bảng testimonials, không dùng contact_messages).
 * author_email lưu riêng — không bao hàm trong JSON GET /testimonials ở trên.
 */
r.post('/testimonials', async (req, res) => {
  const { author_name, author_title, content, rating, email } = req.body || {};
  const name = typeof author_name === 'string' ? author_name.trim() : '';
  const em = typeof email === 'string' ? email.trim() : '';
  const text = typeof content === 'string' ? content.trim() : '';
  if (!name || !text) {
    return res.status(400).json({ error: 'author_name and content are required' });
  }
  if (!em) {
    return res.status(400).json({ error: 'email is required' });
  }
  const rVal = Number(rating);
  if (!Number.isFinite(rVal) || rVal < 1 || rVal > 5) {
    return res.status(400).json({ error: 'rating must be between 1 and 5' });
  }
  const title = author_title != null && String(author_title).trim() ? String(author_title).trim() : null;
  const { data, error } = await supabaseAdmin
    .from('testimonials')
    .insert({
      author_name: name,
      author_title: title,
      content: text,
      image_url: null,
      rating: Math.round(rVal),
      author_email: em,
      sort_order: 9999,
    })
    .select('id')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

export default r;
