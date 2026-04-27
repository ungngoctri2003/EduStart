import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { supabaseAdmin } from '../supabase.js';
import { parsePaginationQuery } from '../lib/pagination.js';

const r = Router();

r.use(requireAuth, requireRole('admin'));

function lastNLocalDayKeys(n) {
  const keys = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i -= 1) {
    const dt = new Date(base);
    dt.setDate(dt.getDate() - i);
    keys.push(
      `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`,
    );
  }
  return keys;
}

function toLocalYMD(iso) {
  const x = new Date(iso);
  if (Number.isNaN(x.getTime())) return null;
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

function slugifyClassSlug(slugInput, nameFallback) {
  const raw = slugInput && String(slugInput).trim() ? String(slugInput).trim() : String(nameFallback || 'lop').trim();
  const s = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return s || 'lop';
}

async function uniqueClassSlug(base) {
  let slug = base;
  for (let i = 0; i < 50; i += 1) {
    const { data } = await supabaseAdmin.from('classes').select('id').eq('slug', slug).maybeSingle();
    if (!data) return slug;
    slug = `${base}-${Math.random().toString(36).slice(2, 7)}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

r.get('/users/metrics', async (_req, res) => {
  const { data, error } = await supabaseAdmin.from('profiles').select('role, created_at');
  if (error) return res.status(500).json({ error: error.message });
  const list = data || [];
  const dayKeys = lastNLocalDayKeys(30);
  const byDay = Object.fromEntries(dayKeys.map((k) => [k, 0]));
  let students = 0;
  let admins = 0;
  let teachers = 0;
  for (const u of list) {
    if (u.role === 'admin') admins += 1;
    else if (u.role === 'teacher') teachers += 1;
    else students += 1;
    const ymd = u.created_at ? toLocalYMD(u.created_at) : null;
    if (ymd && Object.prototype.hasOwnProperty.call(byDay, ymd)) {
      byDay[ymd] += 1;
    }
  }
  const byDaySeries = dayKeys.map((k) => {
    const [, m, d] = k.split('-');
    return { day: `${d}/${m}`, count: byDay[k] };
  });
  res.json({ total: list.length, students, admins, teachers, byDaySeries });
});

r.get('/users', async (req, res) => {
  const { page, pageSize, from, to } = parsePaginationQuery(req, { defaultPageSize: 15, maxPageSize: 100 });
  const roleFilter = req.query.role;
  let q = supabaseAdmin
    .from('profiles')
    .select('id, full_name, role, email, created_at', { count: 'exact' })
    .order('created_at', { ascending: false });
  if (roleFilter && ['admin', 'student', 'teacher'].includes(String(roleFilter))) {
    q = q.eq('role', String(roleFilter));
  }
  const { data, error, count } = await q.range(from, to);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ items: data || [], total: count ?? 0, page, pageSize });
});

/** Exact email lookup (for adding class members by email). */
r.get('/users/by-email', async (req, res) => {
  const email = String(req.query.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'email required' });
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, role')
    .eq('email', email)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'User not found' });
  res.json(data);
});

r.post('/users', async (req, res) => {
  const { email, password, full_name, role } = req.body || {};
  if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
    return res.status(400).json({ error: 'email and password required' });
  }
  const rVal = role && ['admin', 'student', 'teacher'].includes(role) ? role : 'student';
  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email: email.trim(),
    password,
    email_confirm: true,
    user_metadata: { full_name: typeof full_name === 'string' ? full_name : '' },
  });
  if (createErr) return res.status(400).json({ error: createErr.message });
  const uid = created.user.id;

  const profilePatch = { role: rVal };
  if (typeof full_name === 'string' && full_name.trim()) {
    profilePatch.full_name = full_name.trim();
  }
  const { error: upErr } = await supabaseAdmin.from('profiles').update(profilePatch).eq('id', uid);
  if (upErr) return res.status(500).json({ error: upErr.message });

  const { data: row, error: fetchErr } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, role, email, created_at')
    .eq('id', uid)
    .single();
  if (fetchErr || !row) return res.status(500).json({ error: fetchErr?.message || 'Profile fetch failed' });
  res.status(201).json(row);
});

r.patch('/users/:id', async (req, res) => {
  const { id } = req.params;
  const { full_name, role, email, password } = req.body || {};

  if (id === req.user.id && role !== undefined && role !== 'admin' && req.user.role === 'admin') {
    return res.status(400).json({ error: 'Cannot change own admin role' });
  }

  const authUpdate = {};
  if (typeof email === 'string' && email.trim()) authUpdate.email = email.trim();
  if (typeof password === 'string' && password.length > 0) authUpdate.password = password;
  if (Object.keys(authUpdate).length > 0) {
    const { error: auErr } = await supabaseAdmin.auth.admin.updateUserById(id, authUpdate);
    if (auErr) return res.status(400).json({ error: auErr.message });
  }

  const profilePatch = {};
  if (full_name !== undefined) {
    profilePatch.full_name = typeof full_name === 'string' && full_name.trim() ? full_name.trim() : null;
  }
  if (role !== undefined) {
    if (!['admin', 'student', 'teacher'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
    profilePatch.role = role;
  }
  if (Object.keys(profilePatch).length > 0) {
    const { error: pErr } = await supabaseAdmin.from('profiles').update(profilePatch).eq('id', id);
    if (pErr) return res.status(500).json({ error: pErr.message });
  }

  const { data: row, error: fetchErr } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, role, email, created_at')
    .eq('id', id)
    .single();
  if (fetchErr || !row) return res.status(404).json({ error: 'User not found' });
  res.json(row);
});

r.delete('/users/:id', async (req, res) => {
  const { id } = req.params;
  if (id === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete own account' });
  }
  const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
  if (error) return res.status(400).json({ error: error.message });
  res.status(204).send();
});

r.get('/contact-messages/metrics', async (_req, res) => {
  const { data, error } = await supabaseAdmin.from('contact_messages').select('subject, created_at');
  if (error) return res.status(500).json({ error: error.message });
  const list = data || [];
  const dayKeys = lastNLocalDayKeys(30);
  const byDay = Object.fromEntries(dayKeys.map((k) => [k, 0]));
  let withSubject = 0;
  let withoutSubject = 0;
  for (const row of list) {
    const ymd = row.created_at ? toLocalYMD(row.created_at) : null;
    if (ymd && Object.prototype.hasOwnProperty.call(byDay, ymd)) {
      byDay[ymd] += 1;
    }
    const has = row.subject != null && String(row.subject).trim() !== '';
    if (has) withSubject += 1;
    else withoutSubject += 1;
  }
  const byDaySeries = dayKeys.map((k) => {
    const [, mo, d] = k.split('-');
    return { day: `${d}/${mo}`, count: byDay[k] };
  });
  const newIn30d = dayKeys.reduce((s, k) => s + byDay[k], 0);
  res.json({
    total: list.length,
    withSubject,
    withoutSubject,
    newIn30d,
    byDaySeries,
  });
});

r.get('/contact-messages', async (req, res) => {
  const { page, pageSize, from, to } = parsePaginationQuery(req, { defaultPageSize: 10, maxPageSize: 100 });
  const { data, error, count } = await supabaseAdmin
    .from('contact_messages')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ items: data || [], total: count ?? 0, page, pageSize });
});

r.delete('/contact-messages/:id', async (req, res) => {
  const { error } = await supabaseAdmin.from('contact_messages').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

// Categories CRUD
r.post('/categories', async (req, res) => {
  const { name, slug, image_url, sort_order } = req.body || {};
  if (!name || !slug) return res.status(400).json({ error: 'name and slug required' });
  const { data, error } = await supabaseAdmin
    .from('categories')
    .insert({
      name,
      slug,
      image_url: image_url ?? null,
      sort_order: sort_order ?? 0,
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

r.patch('/categories/:id', async (req, res) => {
  const { id } = req.params;
  const patch = {};
  for (const k of ['name', 'slug', 'image_url', 'sort_order']) {
    if (req.body[k] !== undefined) patch[k] = req.body[k];
  }
  const { data, error } = await supabaseAdmin
    .from('categories')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

r.delete('/categories/:id', async (req, res) => {
  const { error } = await supabaseAdmin.from('categories').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

// Courses (admin full)
r.get('/content-stats', async (_req, res) => {
  const [coursesRes, lecturesRes, quizzesRes] = await Promise.all([
    supabaseAdmin.from('courses').select('id, title, published, created_at'),
    supabaseAdmin.from('course_lectures').select('course_id, created_at'),
    supabaseAdmin.from('course_quizzes').select('course_id, created_at'),
  ]);
  if (coursesRes.error) return res.status(500).json({ error: coursesRes.error.message });
  if (lecturesRes.error) return res.status(500).json({ error: lecturesRes.error.message });
  if (quizzesRes.error) return res.status(500).json({ error: quizzesRes.error.message });

  const courses = coursesRes.data || [];
  const lectures = lecturesRes.data || [];
  const quizzes = quizzesRes.data || [];

  const publishedCourses = courses.filter((c) => c.published).length;
  const summary = {
    totalCourses: courses.length,
    publishedCourses,
    draftCourses: courses.length - publishedCourses,
    totalLectures: lectures.length,
    totalQuizzes: quizzes.length,
  };

  const lectureByCourse = new Map();
  for (const row of lectures) {
    const id = row.course_id;
    if (!id) continue;
    lectureByCourse.set(id, (lectureByCourse.get(id) || 0) + 1);
  }
  const quizByCourse = new Map();
  for (const row of quizzes) {
    const id = row.course_id;
    if (!id) continue;
    quizByCourse.set(id, (quizByCourse.get(id) || 0) + 1);
  }

  const byCourse = courses
    .map((c) => ({
      id: c.id,
      title: c.title || '—',
      lectures: lectureByCourse.get(c.id) || 0,
      quizzes: quizByCourse.get(c.id) || 0,
    }))
    .sort((a, b) => b.lectures + b.quizzes - (a.lectures + a.quizzes))
    .slice(0, 8);

  const dayKeys = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let i = 29; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    dayKeys.push(d.toISOString().slice(0, 10));
  }
  const timelineMap = new Map(dayKeys.map((k) => [k, { day: k, courses: 0, lectures: 0, quizzes: 0 }]));
  for (const c of courses) {
    if (!c.created_at) continue;
    const key = new Date(c.created_at).toISOString().slice(0, 10);
    const row = timelineMap.get(key);
    if (row) row.courses += 1;
  }
  for (const row of lectures) {
    if (!row.created_at) continue;
    const key = new Date(row.created_at).toISOString().slice(0, 10);
    const t = timelineMap.get(key);
    if (t) t.lectures += 1;
  }
  for (const row of quizzes) {
    if (!row.created_at) continue;
    const key = new Date(row.created_at).toISOString().slice(0, 10);
    const t = timelineMap.get(key);
    if (t) t.quizzes += 1;
  }
  const timeline = [...timelineMap.values()].map((row) => {
    const [, m, d] = row.day.split('-');
    return { day: `${d}/${m}`, courses: row.courses, lectures: row.lectures, quizzes: row.quizzes };
  });

  res.json({ summary, byCourse, timeline });
});

r.get('/courses/compact', async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from('courses')
    .select('id, title, slug, published, category_id, updated_at')
    .order('title', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

r.get('/courses', async (req, res) => {
  const { page, pageSize, from, to } = parsePaginationQuery(req, { defaultPageSize: 12, maxPageSize: 100 });
  const { data, error, count } = await supabaseAdmin
    .from('courses')
    .select('*, categories(id, name, slug)', { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range(from, to);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ items: data || [], total: count ?? 0, page, pageSize });
});

function slugFromTitle(title) {
  const raw = String(title || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  let s = raw.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!s) s = `khoa-hoc-${Date.now()}`;
  return s.slice(0, 120);
}

r.post('/courses', async (req, res) => {
  const body = req.body || {};
  if (!body.title || typeof body.title !== 'string' || !String(body.title).trim()) {
    return res.status(400).json({ error: 'title required' });
  }
  const slug =
    typeof body.slug === 'string' && String(body.slug).trim()
      ? String(body.slug).trim().toLowerCase().replace(/\s+/g, '-').slice(0, 120)
      : slugFromTitle(body.title);
  const { data, error } = await supabaseAdmin
    .from('courses')
    .insert({
      title: String(body.title).trim(),
      slug,
      description: body.description ?? null,
      thumbnail_url: body.thumbnail_url ?? null,
      category_id: body.category_id ?? null,
      teacher_id: body.teacher_id ?? null,
      published: !!body.published,
      price_cents: body.price_cents ?? 0,
      duration_hours: body.duration_hours ?? null,
      level: body.level ?? null,
      rating: body.rating ?? null,
      learners_count: body.learners_count ?? null,
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

r.patch('/courses/:id', async (req, res) => {
  const { id } = req.params;
  const allowed = [
    'title', 'slug', 'description', 'thumbnail_url', 'category_id', 'teacher_id',
    'published', 'price_cents', 'duration_hours', 'level', 'rating', 'learners_count',
  ];
  const patch = {};
  for (const k of allowed) {
    if (req.body[k] !== undefined) patch[k] = req.body[k];
  }
  if (patch.title !== undefined && req.body.slug === undefined) {
    patch.slug = slugFromTitle(patch.title);
  }
  const { data, error } = await supabaseAdmin
    .from('courses')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

r.delete('/courses/:id', async (req, res) => {
  const { error } = await supabaseAdmin.from('courses').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

function enrollmentStatsFromRows(list) {
  const byCourseMap = new Map();
  for (const row of list) {
    const c = row.courses;
    const cid = c?.id || row.course_id;
    if (!cid) continue;
    const cur = byCourseMap.get(cid) || {
      course_id: cid,
      title: c?.title || '—',
      slug: c?.slug || '',
      count: 0,
    };
    cur.count += 1;
    byCourseMap.set(cid, cur);
  }
  const byCourse = [...byCourseMap.values()].sort((a, b) => b.count - a.count);

  const byDayMap = new Map();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let i = 29; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    byDayMap.set(key, 0);
  }
  for (const row of list) {
    if (!row.enrolled_at) continue;
    const key = new Date(row.enrolled_at).toISOString().slice(0, 10);
    if (byDayMap.has(key)) byDayMap.set(key, (byDayMap.get(key) || 0) + 1);
  }
  const byDay = [...byDayMap.entries()].map(([d, c]) => ({ day: d, count: c }));
  return { byCourse, byDay };
}

/** Dữ liệu theo dòng thanh toán: trạng thái, phương thức, timeline 30 ngày (UTC) */
function paymentQueueStatsFromRows(list, dateKey) {
  const byStatus = { pending: 0, approved: 0, rejected: 0 };
  const byMethod = { cash: 0, bank_transfer: 0, momo: 0, vnpay: 0, unset: 0 };
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const byDayMap = new Map();
  for (let i = 29; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    byDayMap.set(d.toISOString().slice(0, 10), 0);
  }
  for (const row of list) {
    const s = row.payment_status;
    if (s === 'pending' || s === 'approved' || s === 'rejected') {
      byStatus[s] = (byStatus[s] || 0) + 1;
    }
    const pm = row.payment_method;
    if (pm === 'cash' || pm === 'bank_transfer' || pm === 'momo' || pm === 'vnpay') {
      byMethod[pm] = (byMethod[pm] || 0) + 1;
    } else {
      byMethod.unset = (byMethod.unset || 0) + 1;
    }
    const raw = row[dateKey];
    if (!raw) continue;
    const key = new Date(raw).toISOString().slice(0, 10);
    if (byDayMap.has(key)) byDayMap.set(key, (byDayMap.get(key) || 0) + 1);
  }
  const byStatusList = [
    { status: 'pending', count: byStatus.pending },
    { status: 'approved', count: byStatus.approved },
    { status: 'rejected', count: byStatus.rejected },
  ];
  const byMethodList = [
    { method: 'cash', count: byMethod.cash },
    { method: 'bank_transfer', count: byMethod.bank_transfer },
    { method: 'momo', count: byMethod.momo },
    { method: 'vnpay', count: byMethod.vnpay },
    { method: 'unset', count: byMethod.unset },
  ];
  const byDay = [...byDayMap.entries()].map(([d, c]) => ({ day: d, count: c }));
  const total = byStatus.pending + byStatus.approved + byStatus.rejected;
  return { total, byStatus: byStatusList, byMethod: byMethodList, byDay };
}

r.get('/enrollments/stats', async (_req, res) => {
  const { data: rows, error } = await supabaseAdmin
    .from('enrollments')
    .select('enrolled_at, course_id, courses(id, title, slug)')
    .eq('payment_status', 'approved');
  if (error) return res.status(500).json({ error: error.message });
  const list = rows || [];
  res.json({ stats: enrollmentStatsFromRows(list) });
});

r.get('/enrollments', async (req, res) => {
  const { page, pageSize, from, to } = parsePaginationQuery(req, { defaultPageSize: 15, maxPageSize: 100 });
  const courseId = typeof req.query.courseId === 'string' && req.query.courseId.trim() ? req.query.courseId.trim() : null;
  let q = supabaseAdmin
    .from('enrollments')
    .select(
      'id, enrolled_at, student_id, course_id, payment_method, payment_status, payment_note, reviewed_at, reviewed_by, courses(id, title, slug), student:profiles!enrollments_student_id_fkey(id, full_name, email)',
      { count: 'exact' },
    )
    .order('enrolled_at', { ascending: false });
  if (courseId) q = q.eq('course_id', courseId);
  const { data: rows, error, count } = await q.range(from, to);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ enrollments: rows || [], total: count ?? 0, page, pageSize });
});

r.get('/payments/stats', async (_req, res) => {
  const [cRes, clRes] = await Promise.all([
    supabaseAdmin.from('enrollments').select('enrolled_at, payment_status, payment_method'),
    supabaseAdmin.from('class_students').select('joined_at, payment_status, payment_method'),
  ]);
  if (cRes.error) return res.status(500).json({ error: cRes.error.message });
  if (clRes.error) return res.status(500).json({ error: clRes.error.message });
  const courseRows = cRes.data || [];
  const classRows = clRes.data || [];
  res.json({
    coursePayments: paymentQueueStatsFromRows(courseRows, 'enrolled_at'),
    classPayments: paymentQueueStatsFromRows(classRows, 'joined_at'),
  });
});

r.get('/payments/courses', async (req, res) => {
  const statusRaw = req.query.status;
  const status =
    statusRaw === undefined || statusRaw === null || statusRaw === ''
      ? 'pending'
      : String(statusRaw);
  if (status !== 'all' && status !== 'pending' && status !== 'approved' && status !== 'rejected') {
    return res.status(400).json({ error: 'status must be pending, approved, rejected, or all' });
  }
  const { page, pageSize, from, to } = parsePaginationQuery(req, { defaultPageSize: 20, maxPageSize: 200 });
  let q = supabaseAdmin
    .from('enrollments')
    .select(
      `
      id,
      enrolled_at,
      student_id,
      course_id,
      payment_method,
      payment_status,
      payment_note,
      reviewed_at,
      reviewed_by,
      student:profiles!enrollments_student_id_fkey ( id, full_name, email ),
      courses ( id, title, slug, price_cents )
    `,
      { count: 'exact' },
    )
    .order('enrolled_at', { ascending: false });
  if (status !== 'all') q = q.eq('payment_status', status);
  const { data: rows, error, count } = await q.range(from, to);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ items: rows || [], total: count ?? 0, page, pageSize });
});

r.get('/payments/classes', async (req, res) => {
  const statusRaw = req.query.status;
  const status =
    statusRaw === undefined || statusRaw === null || statusRaw === ''
      ? 'pending'
      : String(statusRaw);
  if (status !== 'all' && status !== 'pending' && status !== 'approved' && status !== 'rejected') {
    return res.status(400).json({ error: 'status must be pending, approved, rejected, or all' });
  }
  const { page, pageSize, from, to } = parsePaginationQuery(req, { defaultPageSize: 20, maxPageSize: 200 });
  let q = supabaseAdmin
    .from('class_students')
    .select(
      `
      id,
      joined_at,
      student_id,
      class_id,
      payment_method,
      payment_status,
      payment_note,
      reviewed_at,
      reviewed_by,
      student:profiles!class_students_student_id_fkey ( id, full_name, email ),
      classes ( id, name, slug )
    `,
      { count: 'exact' },
    )
    .order('joined_at', { ascending: false });
  if (status !== 'all') q = q.eq('payment_status', status);
  const { data: rows, error, count } = await q.range(from, to);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ items: rows || [], total: count ?? 0, page, pageSize });
});

r.patch('/payments/courses/:enrollmentId', async (req, res) => {
  const { enrollmentId } = req.params;
  const payment_status = req.body?.payment_status;
  if (payment_status !== 'approved' && payment_status !== 'rejected') {
    return res.status(400).json({ error: 'payment_status must be approved or rejected' });
  }
  const { data: existing, error: exErr } = await supabaseAdmin
    .from('enrollments')
    .select('id')
    .eq('id', enrollmentId)
    .maybeSingle();
  if (exErr) return res.status(500).json({ error: exErr.message });
  if (!existing) return res.status(404).json({ error: 'Enrollment not found' });
  const { data, error } = await supabaseAdmin
    .from('enrollments')
    .update({
      payment_status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: req.user.id,
    })
    .eq('id', enrollmentId)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

r.patch('/payments/classes/:classStudentId', async (req, res) => {
  const { classStudentId } = req.params;
  const payment_status = req.body?.payment_status;
  if (payment_status !== 'approved' && payment_status !== 'rejected') {
    return res.status(400).json({ error: 'payment_status must be approved or rejected' });
  }
  const { data: existing, error: exErr } = await supabaseAdmin
    .from('class_students')
    .select('id')
    .eq('id', classStudentId)
    .maybeSingle();
  if (exErr) return res.status(500).json({ error: exErr.message });
  if (!existing) return res.status(404).json({ error: 'Class membership not found' });
  const { data, error } = await supabaseAdmin
    .from('class_students')
    .update({
      payment_status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: req.user.id,
    })
    .eq('id', classStudentId)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

const QUIZ_ATTEMPT_SELECT = `
      id,
      student_id,
      quiz_id,
      course_id,
      correct,
      total,
      percent,
      submitted_at,
      course_quizzes ( title ),
      courses ( title, slug ),
      profiles ( full_name, email )
    `;

function mapQuizAttemptRow(row) {
  return {
    id: row.id,
    student_id: row.student_id,
    quiz_id: row.quiz_id,
    course_id: row.course_id,
    correct: row.correct,
    total: row.total,
    percent: row.percent,
    submitted_at: row.submitted_at,
    quiz_title: row.course_quizzes?.title ?? null,
    course_title: row.courses?.title ?? null,
    course_slug: row.courses?.slug ?? null,
    student_name: row.profiles?.full_name ?? null,
    student_email: row.profiles?.email ?? null,
  };
}

function quizSummaryAndStatsFromAttempts(list) {
  const n = list.length;
  const avgPercent = n === 0 ? 0 : Math.round(list.reduce((s, r) => s + (r.percent || 0), 0) / n);
  const distinctStudents = new Set(list.map((r) => r.student_id)).size;

  const byCourseMap = new Map();
  for (const row of list) {
    const cid = row.course_id;
    if (!cid) continue;
    const cur = byCourseMap.get(cid) || {
      course_id: cid,
      title: row.course_title || '—',
      slug: row.course_slug || '',
      attempts: 0,
      percentSum: 0,
    };
    cur.attempts += 1;
    cur.percentSum += row.percent || 0;
    byCourseMap.set(cid, cur);
  }
  const byCourse = [...byCourseMap.values()]
    .map((c) => ({
      course_id: c.course_id,
      title: c.title,
      slug: c.slug,
      attempts: c.attempts,
      avgPercent: c.attempts === 0 ? 0 : Math.round(c.percentSum / c.attempts),
    }))
    .sort((a, b) => b.attempts - a.attempts);

  const byDayMap = new Map();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let i = 29; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    byDayMap.set(key, 0);
  }
  for (const row of list) {
    if (!row.submitted_at) continue;
    const key = new Date(row.submitted_at).toISOString().slice(0, 10);
    if (byDayMap.has(key)) byDayMap.set(key, (byDayMap.get(key) || 0) + 1);
  }
  const byDay = [...byDayMap.entries()].map(([day, count]) => ({ day, count }));

  const bands = [
    { key: '0–49%', min: 0, max: 49, count: 0 },
    { key: '50–69%', min: 50, max: 69, count: 0 },
    { key: '70–89%', min: 70, max: 89, count: 0 },
    { key: '90–100%', min: 90, max: 100, count: 0 },
  ];
  for (const row of list) {
    const p = row.percent ?? 0;
    const b = bands.find((x) => p >= x.min && p <= x.max);
    if (b) b.count += 1;
  }
  const byScoreBand = bands.map(({ key, count }) => ({ band: key, count }));

  return {
    summary: { totalAttempts: n, avgPercent, distinctStudents },
    stats: { byCourse, byDay, byScoreBand },
  };
}

r.get('/quiz-analytics/summary', async (_req, res) => {
  const { data: rows, error } = await supabaseAdmin
    .from('quiz_attempts')
    .select(QUIZ_ATTEMPT_SELECT)
    .order('submitted_at', { ascending: false })
    .limit(10000);
  if (error) return res.status(500).json({ error: error.message });
  const list = (rows || []).map(mapQuizAttemptRow);
  res.json(quizSummaryAndStatsFromAttempts(list));
});

r.get('/quiz-analytics/attempts', async (req, res) => {
  const { page, pageSize, from, to } = parsePaginationQuery(req, { defaultPageSize: 15, maxPageSize: 150 });
  const { data: rows, error, count } = await supabaseAdmin
    .from('quiz_attempts')
    .select(QUIZ_ATTEMPT_SELECT, { count: 'exact' })
    .order('submitted_at', { ascending: false })
    .range(from, to);
  if (error) return res.status(500).json({ error: error.message });
  const items = (rows || []).map(mapQuizAttemptRow);
  res.json({ items, total: count ?? 0, page, pageSize });
});

// Course lectures
r.get('/courses/:courseId/lectures', async (req, res) => {
  const { courseId } = req.params;
  if (req.query.page != null || req.query.pageSize != null) {
    const { page, pageSize, from, to } = parsePaginationQuery(req, { defaultPageSize: 20, maxPageSize: 200 });
    const { data, error, count } = await supabaseAdmin
      .from('course_lectures')
      .select('*', { count: 'exact' })
      .eq('course_id', courseId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .range(from, to);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ items: data || [], total: count ?? 0, page, pageSize });
  }
  const { data, error } = await supabaseAdmin
    .from('course_lectures')
    .select('*')
    .eq('course_id', courseId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

r.post('/courses/:courseId/lectures', async (req, res) => {
  const { courseId } = req.params;
  const body = req.body || {};
  if (!body.title) return res.status(400).json({ error: 'title required' });
  let blocks = body.blocks;
  if (blocks !== undefined && !Array.isArray(blocks)) {
    return res.status(400).json({ error: 'blocks must be an array' });
  }
  if (Array.isArray(blocks) && blocks.length > 0) {
    blocks = blocks.map((b) => ({
      title: b?.title != null && String(b.title).trim() ? String(b.title).trim() : null,
      content: b?.content != null && String(b.content).trim() ? String(b.content).trim() : null,
      video_url: b?.video_url != null && String(b.video_url).trim() ? String(b.video_url).trim() : null,
    }));
  } else {
    blocks = [];
  }
  const useBlocks = blocks.some((b) => b.title || b.content || b.video_url);
  const { data, error } = await supabaseAdmin
    .from('course_lectures')
    .insert({
      course_id: courseId,
      title: body.title,
      content: useBlocks ? null : body.content ?? null,
      video_url: useBlocks ? null : body.video_url ?? null,
      blocks: useBlocks ? blocks : [],
      sort_order: body.sort_order ?? 0,
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

r.patch('/lectures/:id', async (req, res) => {
  const patch = {};
  for (const k of ['title', 'content', 'video_url', 'sort_order', 'blocks']) {
    if (req.body[k] !== undefined) {
      if (k === 'blocks') {
        if (!Array.isArray(req.body.blocks)) {
          return res.status(400).json({ error: 'blocks must be an array' });
        }
        patch.blocks = req.body.blocks.map((b) => ({
          title: b?.title != null && String(b.title).trim() ? String(b.title).trim() : null,
          content: b?.content != null && String(b.content).trim() ? String(b.content).trim() : null,
          video_url: b?.video_url != null && String(b.video_url).trim() ? String(b.video_url).trim() : null,
        }));
      } else {
        patch[k] = req.body[k];
      }
    }
  }
  if (
    patch.blocks !== undefined &&
    Array.isArray(patch.blocks) &&
    patch.blocks.some((b) => b.title || b.content || b.video_url)
  ) {
    patch.content = null;
    patch.video_url = null;
  }
  const { data, error } = await supabaseAdmin
    .from('course_lectures')
    .update(patch)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

r.delete('/lectures/:id', async (req, res) => {
  const { error } = await supabaseAdmin.from('course_lectures').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

// Course quizzes (questions: JSON array of { question, options[], correctIndex })
r.get('/courses/:courseId/quizzes', async (req, res) => {
  const { courseId } = req.params;
  if (req.query.page != null || req.query.pageSize != null) {
    const { page, pageSize, from, to } = parsePaginationQuery(req, { defaultPageSize: 20, maxPageSize: 200 });
    const { data, error, count } = await supabaseAdmin
      .from('course_quizzes')
      .select('*', { count: 'exact' })
      .eq('course_id', courseId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .range(from, to);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ items: data || [], total: count ?? 0, page, pageSize });
  }
  const { data, error } = await supabaseAdmin
    .from('course_quizzes')
    .select('*')
    .eq('course_id', courseId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

r.post('/courses/:courseId/quizzes', async (req, res) => {
  const { courseId } = req.params;
  const body = req.body || {};
  if (!body.title) return res.status(400).json({ error: 'title required' });
  let questions = body.questions;
  if (questions === undefined) questions = [];
  if (!Array.isArray(questions)) return res.status(400).json({ error: 'questions must be an array' });
  const { data, error } = await supabaseAdmin
    .from('course_quizzes')
    .insert({
      course_id: courseId,
      title: body.title,
      description: body.description ?? null,
      questions,
      sort_order: body.sort_order ?? 0,
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

r.patch('/quizzes/:id', async (req, res) => {
  const patch = {};
  for (const k of ['title', 'description', 'questions', 'sort_order']) {
    if (req.body[k] !== undefined) {
      if (k === 'questions' && !Array.isArray(req.body[k])) {
        return res.status(400).json({ error: 'questions must be an array' });
      }
      patch[k] = req.body[k];
    }
  }
  const { data, error } = await supabaseAdmin
    .from('course_quizzes')
    .update(patch)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

r.delete('/quizzes/:id', async (req, res) => {
  const { error } = await supabaseAdmin.from('course_quizzes').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

// Team
r.get('/team/metrics', async (_req, res) => {
  const { data, error } = await supabaseAdmin.from('team_members').select('role_title, created_at');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ items: data || [] });
});

r.get('/team', async (req, res) => {
  const { page, pageSize, from, to } = parsePaginationQuery(req, { defaultPageSize: 10, maxPageSize: 100 });
  const { data, error, count } = await supabaseAdmin
    .from('team_members')
    .select('*', { count: 'exact' })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
    .range(from, to);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ items: data || [], total: count ?? 0, page, pageSize });
});

r.post('/team', async (req, res) => {
  const { name, role_title, image_url, bio, sort_order } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const { data, error } = await supabaseAdmin
    .from('team_members')
    .insert({
      name,
      role_title: role_title ?? null,
      image_url: image_url ?? null,
      bio: bio ?? null,
      sort_order: sort_order ?? 0,
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

r.patch('/team/:id', async (req, res) => {
  const patch = {};
  for (const k of ['name', 'role_title', 'image_url', 'bio', 'sort_order']) {
    if (req.body[k] !== undefined) patch[k] = req.body[k];
  }
  const { data, error } = await supabaseAdmin
    .from('team_members')
    .update(patch)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

r.delete('/team/:id', async (req, res) => {
  const { error } = await supabaseAdmin.from('team_members').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

// Testimonials
r.get('/testimonials/metrics', async (_req, res) => {
  const { data, error } = await supabaseAdmin.from('testimonials').select('rating, created_at');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ items: data || [] });
});

r.get('/testimonials', async (req, res) => {
  const { page, pageSize, from, to } = parsePaginationQuery(req, { defaultPageSize: 10, maxPageSize: 100 });
  const { data, error, count } = await supabaseAdmin
    .from('testimonials')
    .select('*', { count: 'exact' })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ items: data || [], total: count ?? 0, page, pageSize });
});

r.post('/testimonials', async (req, res) => {
  const { author_name, author_title, content, image_url, rating, sort_order, author_email } = req.body || {};
  if (!author_name || !content) {
    return res.status(400).json({ error: 'author_name and content required' });
  }
  const { data, error } = await supabaseAdmin
    .from('testimonials')
    .insert({
      author_name,
      author_title: author_title ?? null,
      content,
      image_url: image_url ?? null,
      author_email: author_email != null && String(author_email).trim() ? String(author_email).trim() : null,
      rating: rating ?? null,
      sort_order: sort_order ?? 0,
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

r.patch('/testimonials/:id', async (req, res) => {
  const patch = {};
  for (const k of ['author_name', 'author_title', 'content', 'image_url', 'author_email', 'rating', 'sort_order']) {
    if (req.body[k] !== undefined) patch[k] = req.body[k];
  }
  const { data, error } = await supabaseAdmin
    .from('testimonials')
    .update(patch)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

r.delete('/testimonials/:id', async (req, res) => {
  const { error } = await supabaseAdmin.from('testimonials').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

r.delete('/course-reviews/:id', async (req, res) => {
  const { error } = await supabaseAdmin.from('course_reviews').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

// ---------------------------------------------------------------------------
// School classes (independent of catalog courses)
// ---------------------------------------------------------------------------

r.get('/classes/metrics', async (_req, res) => {
  const { data, error } = await supabaseAdmin.from('classes').select('status, created_at');
  if (error) return res.status(500).json({ error: error.message });
  const list = data || [];
  const dayKeys = lastNLocalDayKeys(30);
  const byDay = Object.fromEntries(dayKeys.map((k) => [k, 0]));
  let active = 0;
  let archived = 0;
  for (const row of list) {
    if (row.status === 'archived') archived += 1;
    else active += 1;
    const ymd = row.created_at ? toLocalYMD(row.created_at) : null;
    if (ymd && Object.prototype.hasOwnProperty.call(byDay, ymd)) {
      byDay[ymd] += 1;
    }
  }
  const byDaySeries = dayKeys.map((k) => {
    const [, m, d] = k.split('-');
    return { day: `${d}/${m}`, count: byDay[k] };
  });
  const newIn30d = dayKeys.reduce((s, k) => s + byDay[k], 0);
  res.json({
    total: list.length,
    active,
    archived,
    newIn30d,
    byDaySeries,
  });
});

r.get('/classes', async (req, res) => {
  const { page, pageSize, from, to } = parsePaginationQuery(req, { defaultPageSize: 15, maxPageSize: 100 });
  const { data, error, count } = await supabaseAdmin
    .from('classes')
    .select(
      `
      *,
      teacher:profiles!classes_teacher_id_fkey ( id, full_name, email, role )
    `,
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ items: data || [], total: count ?? 0, page, pageSize });
});

r.post('/classes', async (req, res) => {
  const body = req.body || {};
  const { name, description, teacher_id, status, starts_at, ends_at, image_url } = body;
  const slugRaw = body.slug;
  if (!name || typeof name !== 'string') return res.status(400).json({ error: 'name required' });
  if (!teacher_id || typeof teacher_id !== 'string') return res.status(400).json({ error: 'teacher_id required' });
  const { data: tprof, error: tErr } = await supabaseAdmin
    .from('profiles')
    .select('id, role')
    .eq('id', teacher_id)
    .maybeSingle();
  if (tErr) return res.status(500).json({ error: tErr.message });
  if (!tprof) return res.status(400).json({ error: 'Teacher not found' });
  if (tprof.role !== 'teacher') return res.status(400).json({ error: 'teacher_id must be a teacher profile' });
  const baseSlug = slugifyClassSlug(slugRaw, name);
  const slug = await uniqueClassSlug(baseSlug);
  const { data, error } = await supabaseAdmin
    .from('classes')
    .insert({
      name: name.trim(),
      slug,
      description: typeof description === 'string' ? description : null,
      teacher_id,
      status: status && ['active', 'archived'].includes(status) ? status : 'active',
      starts_at: starts_at ?? null,
      ends_at: ends_at ?? null,
      image_url:
        image_url === undefined || image_url === null
          ? null
          : typeof image_url === 'string' && image_url.trim()
            ? image_url.trim()
            : null,
      created_by: req.user.id,
    })
    .select(
      `
      *,
      teacher:profiles!classes_teacher_id_fkey ( id, full_name, email, role )
    `,
    )
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

r.patch('/classes/:id', async (req, res) => {
  const { id } = req.params;
  const patch = {};
  for (const k of ['name', 'description', 'teacher_id', 'status', 'starts_at', 'ends_at', 'image_url']) {
    if (req.body[k] !== undefined) patch[k] = req.body[k];
  }
  if (patch.image_url !== undefined) {
    patch.image_url =
      patch.image_url === null || patch.image_url === ''
        ? null
        : typeof patch.image_url === 'string'
          ? patch.image_url.trim() || null
          : null;
  }
  if (patch.teacher_id !== undefined) {
    const { data: tprof, error: tErr } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('id', patch.teacher_id)
      .maybeSingle();
    if (tErr) return res.status(500).json({ error: tErr.message });
    if (!tprof) return res.status(400).json({ error: 'Teacher not found' });
    if (tprof.role !== 'teacher') return res.status(400).json({ error: 'teacher_id must be a teacher profile' });
  }
  if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'No valid fields' });
  const { data, error } = await supabaseAdmin
    .from('classes')
    .update(patch)
    .eq('id', id)
    .select(
      `
      *,
      teacher:profiles!classes_teacher_id_fkey ( id, full_name, email, role )
    `,
    )
    .single();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Class not found' });
  res.json(data);
});

r.delete('/classes/:id', async (req, res) => {
  const { error } = await supabaseAdmin.from('classes').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

r.get('/classes/:classId/students', async (req, res) => {
  const { classId } = req.params;
  const { page, pageSize, from, to } = parsePaginationQuery(req, { defaultPageSize: 20, maxPageSize: 200 });
  const { data, error, count } = await supabaseAdmin
    .from('class_students')
    .select(
      'id, joined_at, student_id, student:profiles!class_students_student_id_fkey ( id, full_name, email, role )',
      { count: 'exact' },
    )
    .eq('class_id', classId)
    .order('joined_at', { ascending: false })
    .range(from, to);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ items: data || [], total: count ?? 0, page, pageSize });
});

r.post('/classes/:classId/students', async (req, res) => {
  const { classId } = req.params;
  const studentId = req.body?.student_id;
  if (!studentId || typeof studentId !== 'string') {
    return res.status(400).json({ error: 'student_id required' });
  }
  const { data: profile, error: pErr } = await supabaseAdmin
    .from('profiles')
    .select('id, role')
    .eq('id', studentId)
    .maybeSingle();
  if (pErr) return res.status(500).json({ error: pErr.message });
  if (!profile) return res.status(404).json({ error: 'Student not found' });
  if (profile.role !== 'student') return res.status(400).json({ error: 'User is not a student' });
  const { data, error } = await supabaseAdmin
    .from('class_students')
    .insert({ class_id: classId, student_id: studentId, payment_status: 'approved' })
    .select()
    .single();
  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Already in class' });
    return res.status(500).json({ error: error.message });
  }
  res.status(201).json(data);
});

r.delete('/classes/:classId/students/:studentId', async (req, res) => {
  const { classId, studentId } = req.params;
  const { error } = await supabaseAdmin
    .from('class_students')
    .delete()
    .eq('class_id', classId)
    .eq('student_id', studentId);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

r.get('/classes/:classId/lectures', async (req, res) => {
  const { classId } = req.params;
  if (req.query.page != null || req.query.pageSize != null) {
    const { page, pageSize, from, to } = parsePaginationQuery(req, { defaultPageSize: 20, maxPageSize: 200 });
    const { data, error, count } = await supabaseAdmin
      .from('class_lectures')
      .select('*', { count: 'exact' })
      .eq('class_id', classId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .range(from, to);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ items: data || [], total: count ?? 0, page, pageSize });
  }
  const { data, error } = await supabaseAdmin
    .from('class_lectures')
    .select('*')
    .eq('class_id', classId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

r.post('/classes/:classId/lectures', async (req, res) => {
  const { classId } = req.params;
  const body = req.body || {};
  if (!body.title) return res.status(400).json({ error: 'title required' });
  let blocks = body.blocks;
  if (blocks !== undefined && !Array.isArray(blocks)) {
    return res.status(400).json({ error: 'blocks must be an array' });
  }
  if (Array.isArray(blocks) && blocks.length > 0) {
    blocks = blocks.map((b) => ({
      title: b?.title != null && String(b.title).trim() ? String(b.title).trim() : null,
      content: b?.content != null && String(b.content).trim() ? String(b.content).trim() : null,
      video_url: b?.video_url != null && String(b.video_url).trim() ? String(b.video_url).trim() : null,
    }));
  } else {
    blocks = [];
  }
  const useBlocks = blocks.some((b) => b.title || b.content || b.video_url);
  const { data, error } = await supabaseAdmin
    .from('class_lectures')
    .insert({
      class_id: classId,
      title: body.title,
      content: useBlocks ? null : body.content ?? null,
      video_url: useBlocks ? null : body.video_url ?? null,
      blocks: useBlocks ? blocks : [],
      sort_order: body.sort_order ?? 0,
      published: body.published !== undefined ? Boolean(body.published) : true,
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

r.patch('/class-lectures/:id', async (req, res) => {
  const patch = {};
  for (const k of ['title', 'content', 'video_url', 'sort_order', 'blocks', 'published']) {
    if (req.body[k] !== undefined) {
      if (k === 'blocks') {
        if (!Array.isArray(req.body.blocks)) {
          return res.status(400).json({ error: 'blocks must be an array' });
        }
        patch.blocks = req.body.blocks.map((b) => ({
          title: b?.title != null && String(b.title).trim() ? String(b.title).trim() : null,
          content: b?.content != null && String(b.content).trim() ? String(b.content).trim() : null,
          video_url: b?.video_url != null && String(b.video_url).trim() ? String(b.video_url).trim() : null,
        }));
      } else {
        patch[k] = req.body[k];
      }
    }
  }
  if (
    patch.blocks !== undefined &&
    Array.isArray(patch.blocks) &&
    patch.blocks.some((b) => b.title || b.content || b.video_url)
  ) {
    patch.content = null;
    patch.video_url = null;
  }
  const { data, error } = await supabaseAdmin
    .from('class_lectures')
    .update(patch)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

r.delete('/class-lectures/:id', async (req, res) => {
  const { error } = await supabaseAdmin.from('class_lectures').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

r.get('/classes/:classId/quizzes', async (req, res) => {
  const { classId } = req.params;
  const { data, error } = await supabaseAdmin
    .from('class_quizzes')
    .select('*')
    .eq('class_id', classId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

r.post('/classes/:classId/quizzes', async (req, res) => {
  const { classId } = req.params;
  const body = req.body || {};
  if (!body.title) return res.status(400).json({ error: 'title required' });
  let questions = body.questions;
  if (questions === undefined) questions = [];
  if (!Array.isArray(questions)) return res.status(400).json({ error: 'questions must be an array' });
  const { data, error } = await supabaseAdmin
    .from('class_quizzes')
    .insert({
      class_id: classId,
      title: body.title,
      description: body.description ?? null,
      questions,
      sort_order: body.sort_order ?? 0,
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

r.patch('/class-quizzes/:id', async (req, res) => {
  const patch = {};
  for (const k of ['title', 'description', 'questions', 'sort_order']) {
    if (req.body[k] !== undefined) {
      if (k === 'questions' && !Array.isArray(req.body[k])) {
        return res.status(400).json({ error: 'questions must be an array' });
      }
      patch[k] = req.body[k];
    }
  }
  const { data, error } = await supabaseAdmin
    .from('class_quizzes')
    .update(patch)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

r.delete('/class-quizzes/:id', async (req, res) => {
  const { error } = await supabaseAdmin.from('class_quizzes').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

r.get('/classes/:classId/schedules', async (req, res) => {
  const { classId } = req.params;
  const { data, error } = await supabaseAdmin
    .from('class_schedules')
    .select('*')
    .eq('class_id', classId)
    .order('starts_at', { ascending: true })
    .order('sort_order', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

r.post('/classes/:classId/schedules', async (req, res) => {
  const { classId } = req.params;
  const body = req.body || {};
  if (!body.title || !body.starts_at) {
    return res.status(400).json({ error: 'title and starts_at required' });
  }
  const { data, error } = await supabaseAdmin
    .from('class_schedules')
    .insert({
      class_id: classId,
      title: body.title,
      starts_at: body.starts_at,
      ends_at: body.ends_at ?? null,
      location: body.location ?? null,
      meeting_url: body.meeting_url ?? null,
      notes: body.notes ?? null,
      sort_order: body.sort_order ?? 0,
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

r.patch('/class-schedules/:id', async (req, res) => {
  const patch = {};
  for (const k of ['title', 'starts_at', 'ends_at', 'location', 'meeting_url', 'notes', 'sort_order']) {
    if (req.body[k] !== undefined) patch[k] = req.body[k];
  }
  const { data, error } = await supabaseAdmin
    .from('class_schedules')
    .update(patch)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

r.delete('/class-schedules/:id', async (req, res) => {
  const { error } = await supabaseAdmin.from('class_schedules').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

export default r;
