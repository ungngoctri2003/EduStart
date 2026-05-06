import { Router } from 'express';
import { supabaseAdmin } from '../supabase.js';
import { optionalAuth } from '../middleware/auth.js';
import { fetchCourseStatsMap, mergeCourseStats } from '../lib/courseStats.js';

const r = Router();

/** Active class rows per course (for catalog: hide standalone course price when classes handle fees). */
async function fetchActiveClassCountByCourseIds(courseIds) {
  const ids = [...new Set((courseIds || []).filter(Boolean))];
  if (ids.length === 0) return new Map();
  const { data, error } = await supabaseAdmin
    .from('classes')
    .select('course_id')
    .eq('status', 'active')
    .in('course_id', ids);
  if (error) throw new Error(error.message);
  const map = new Map();
  for (const row of data || []) {
    const cid = row.course_id;
    if (!cid) continue;
    map.set(cid, (map.get(cid) || 0) + 1);
  }
  return map;
}

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
    const activeMap = await fetchActiveClassCountByCourseIds(list.map((c) => c.id));
    const merged = list.map((c) => ({
      ...mergeCourseStats(c, map),
      active_classes_count: activeMap.get(c.id) || 0,
    }));
    res.json(merged);
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Failed to load course stats' });
  }
});

/** Must be before GET /courses/:slug so static path segments win. */
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

/** Single class under a published course (verify course_id matches). */
r.get('/courses/:courseSlug/classes/:classSlug', async (req, res) => {
  try {
    const { courseSlug, classSlug } = req.params;
    const { data: course, error: cErr } = await supabaseAdmin
      .from('courses')
      .select('id, slug, title, published')
      .eq('slug', courseSlug)
      .maybeSingle();
    if (cErr) return res.status(500).json({ error: cErr.message });
    if (!course || !course.published) return res.status(404).json({ error: 'Course not found' });
    const { data: row, error } = await supabaseAdmin
      .from('classes')
      .select(
        'id, name, slug, description, status, starts_at, ends_at, created_at, teacher_id, image_url, price_cents, course_id',
      )
      .eq('slug', classSlug)
      .eq('course_id', course.id)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!row || row.status !== 'active') return res.status(404).json({ error: 'Class not found' });
    const [enriched] = await enrichPublicClassRows([row]);
    res.json({
      ...enriched,
      course: { id: course.id, slug: course.slug, title: course.title },
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Failed to load class' });
  }
});

/** Active classes for enrollment under a published course. */
r.get('/courses/:slug/classes', async (req, res) => {
  try {
    const { slug } = req.params;
    const { data: course, error: cErr } = await supabaseAdmin
      .from('courses')
      .select('id')
      .eq('slug', slug)
      .eq('published', true)
      .maybeSingle();
    if (cErr) return res.status(500).json({ error: cErr.message });
    if (!course) return res.status(404).json({ error: 'Course not found' });
    const { data, error } = await supabaseAdmin
      .from('classes')
      .select(
        'id, name, slug, description, status, starts_at, ends_at, created_at, teacher_id, image_url, price_cents, course_id',
      )
      .eq('course_id', course.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    const out = await enrichPublicClassRows(data);
    res.json((out || []).map((row) => ({ ...row, course_slug: slug })));
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Failed to list classes' });
  }
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
    const activeMap = await fetchActiveClassCountByCourseIds([course.id]);
    const base = mergeCourseStats({ ...course, lectures: [], quizzes: [] }, map);
    res.json({ ...base, active_classes_count: activeMap.get(course.id) || 0 });
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

/** Deprecated: use GET /courses/:slug/classes. */
r.get('/classes', async (_req, res) => {
  res.json([]);
});

r.get('/classes/:slug', async (req, res) => {
  try {
    const { data: row, error } = await supabaseAdmin
      .from('classes')
      .select(
        'id, name, slug, description, status, starts_at, ends_at, created_at, teacher_id, image_url, price_cents, course_id',
      )
      .eq('slug', req.params.slug)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!row || row.status !== 'active') return res.status(404).json({ error: 'Class not found' });
    let courseJson = null;
    if (row.course_id) {
      const { data: co } = await supabaseAdmin
        .from('courses')
        .select('id, slug, title')
        .eq('id', row.course_id)
        .maybeSingle();
      if (co) courseJson = { id: co.id, slug: co.slug, title: co.title };
    }
    const [enriched] = await enrichPublicClassRows([row]);
    res.json({ ...enriched, course: courseJson });
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
