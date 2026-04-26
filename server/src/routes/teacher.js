import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { supabaseAdmin } from '../supabase.js';
import { parsePaginationQuery } from '../lib/pagination.js';
import { loadClassSchedules, loadClassTeacherContent } from '../lib/classContent.js';

const r = Router();
r.use(requireAuth, requireRole('teacher'));

/** Search students by email or name (for roster add). */
r.get('/student-lookup', async (req, res) => {
  const raw = String(req.query.q || '').trim();
  if (raw.length < 2) return res.json([]);
  const pattern = `%${raw}%`;
  const sel = 'id, full_name, email, role';
  const [{ data: byEmail, error: e1 }, { data: byName, error: e2 }] = await Promise.all([
    supabaseAdmin.from('profiles').select(sel).eq('role', 'student').ilike('email', pattern).limit(12),
    supabaseAdmin.from('profiles').select(sel).eq('role', 'student').ilike('full_name', pattern).limit(12),
  ]);
  if (e1 || e2) return res.status(500).json({ error: e1?.message || e2?.message || 'lookup failed' });
  const map = new Map();
  for (const row of [...(byEmail || []), ...(byName || [])]) {
    map.set(row.id, row);
  }
  res.json([...map.values()].slice(0, 20));
});

async function getOwnedClass(slug, teacherId) {
  const { data, error } = await supabaseAdmin.from('classes').select('*').eq('slug', slug).maybeSingle();
  if (error) return { error: error.message, status: 500 };
  if (!data) return { error: 'Class not found', status: 404 };
  if (data.teacher_id !== teacherId) return { error: 'Forbidden', status: 403 };
  return { klass: data };
}

async function assertLectureOwned(lectureId, teacherId) {
  const { data: lec, error: lErr } = await supabaseAdmin
    .from('class_lectures')
    .select('id, class_id')
    .eq('id', lectureId)
    .maybeSingle();
  if (lErr) return { error: lErr.message, status: 500 };
  if (!lec) return { error: 'Not found', status: 404 };
  const gate = await getOwnedClassById(lec.class_id, teacherId);
  if (gate.error) return gate;
  return { lecture: lec };
}

async function assertQuizOwned(quizId, teacherId) {
  const { data: quiz, error: qErr } = await supabaseAdmin
    .from('class_quizzes')
    .select('id, class_id')
    .eq('id', quizId)
    .maybeSingle();
  if (qErr) return { error: qErr.message, status: 500 };
  if (!quiz) return { error: 'Not found', status: 404 };
  const gate = await getOwnedClassById(quiz.class_id, teacherId);
  if (gate.error) return gate;
  return { quiz };
}

async function assertScheduleOwned(scheduleId, teacherId) {
  const { data: row, error } = await supabaseAdmin
    .from('class_schedules')
    .select('id, class_id')
    .eq('id', scheduleId)
    .maybeSingle();
  if (error) return { error: error.message, status: 500 };
  if (!row) return { error: 'Not found', status: 404 };
  const gate = await getOwnedClassById(row.class_id, teacherId);
  if (gate.error) return gate;
  return { row };
}

async function getOwnedClassById(classId, teacherId) {
  const { data, error } = await supabaseAdmin.from('classes').select('id, teacher_id').eq('id', classId).maybeSingle();
  if (error) return { error: error.message, status: 500 };
  if (!data) return { error: 'Not found', status: 404 };
  if (data.teacher_id !== teacherId) return { error: 'Forbidden', status: 403 };
  return { klass: data };
}

r.get('/classes', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('classes')
    .select('id, name, slug, description, status, starts_at, ends_at, teacher_id, created_at')
    .eq('teacher_id', req.user.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

r.get('/classes/:slug', async (req, res) => {
  const gate = await getOwnedClass(req.params.slug, req.user.id);
  if (gate.error) return res.status(gate.status).json({ error: gate.error });
  const { klass } = gate;
  const [{ count: nStudents }, { count: nLec }, { count: nQuiz }, { count: nSch }] = await Promise.all([
    supabaseAdmin.from('class_students').select('*', { count: 'exact', head: true }).eq('class_id', klass.id),
    supabaseAdmin.from('class_lectures').select('*', { count: 'exact', head: true }).eq('class_id', klass.id),
    supabaseAdmin.from('class_quizzes').select('*', { count: 'exact', head: true }).eq('class_id', klass.id),
    supabaseAdmin.from('class_schedules').select('*', { count: 'exact', head: true }).eq('class_id', klass.id),
  ]);
  res.json({
    class: klass,
    counts: {
      students: nStudents ?? 0,
      lectures: nLec ?? 0,
      quizzes: nQuiz ?? 0,
      schedules: nSch ?? 0,
    },
  });
});

r.patch('/classes/:slug', async (req, res) => {
  const gate = await getOwnedClass(req.params.slug, req.user.id);
  if (gate.error) return res.status(gate.status).json({ error: gate.error });
  const patch = {};
  for (const k of ['name', 'description', 'status', 'starts_at', 'ends_at']) {
    if (req.body[k] !== undefined) patch[k] = req.body[k];
  }
  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }
  const { data, error } = await supabaseAdmin
    .from('classes')
    .update(patch)
    .eq('id', gate.klass.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Lectures
r.get('/classes/:slug/lectures', async (req, res) => {
  const gate = await getOwnedClass(req.params.slug, req.user.id);
  if (gate.error) return res.status(gate.status).json({ error: gate.error });
  if (req.query.page != null || req.query.pageSize != null) {
    const { page, pageSize, from, to } = parsePaginationQuery(req, { defaultPageSize: 20, maxPageSize: 200 });
    const { data, error, count } = await supabaseAdmin
      .from('class_lectures')
      .select('*', { count: 'exact' })
      .eq('class_id', gate.klass.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .range(from, to);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ items: data || [], total: count ?? 0, page, pageSize });
  }
  const { data, error } = await supabaseAdmin
    .from('class_lectures')
    .select('*')
    .eq('class_id', gate.klass.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

r.post('/classes/:slug/lectures', async (req, res) => {
  const gate = await getOwnedClass(req.params.slug, req.user.id);
  if (gate.error) return res.status(gate.status).json({ error: gate.error });
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
      class_id: gate.klass.id,
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

r.patch('/lectures/:id', async (req, res) => {
  const o = await assertLectureOwned(req.params.id, req.user.id);
  if (o.error) return res.status(o.status).json({ error: o.error });
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

r.delete('/lectures/:id', async (req, res) => {
  const o = await assertLectureOwned(req.params.id, req.user.id);
  if (o.error) return res.status(o.status).json({ error: o.error });
  const { error } = await supabaseAdmin.from('class_lectures').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

// Quizzes
r.get('/classes/:slug/quizzes', async (req, res) => {
  const gate = await getOwnedClass(req.params.slug, req.user.id);
  if (gate.error) return res.status(gate.status).json({ error: gate.error });
  const { data, error } = await supabaseAdmin
    .from('class_quizzes')
    .select('*')
    .eq('class_id', gate.klass.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

r.post('/classes/:slug/quizzes', async (req, res) => {
  const gate = await getOwnedClass(req.params.slug, req.user.id);
  if (gate.error) return res.status(gate.status).json({ error: gate.error });
  const body = req.body || {};
  if (!body.title) return res.status(400).json({ error: 'title required' });
  let questions = body.questions;
  if (questions === undefined) questions = [];
  if (!Array.isArray(questions)) return res.status(400).json({ error: 'questions must be an array' });
  const { data, error } = await supabaseAdmin
    .from('class_quizzes')
    .insert({
      class_id: gate.klass.id,
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
  const o = await assertQuizOwned(req.params.id, req.user.id);
  if (o.error) return res.status(o.status).json({ error: o.error });
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

r.delete('/quizzes/:id', async (req, res) => {
  const o = await assertQuizOwned(req.params.id, req.user.id);
  if (o.error) return res.status(o.status).json({ error: o.error });
  const { error } = await supabaseAdmin.from('class_quizzes').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

// Schedules
r.get('/classes/:slug/schedules', async (req, res) => {
  const gate = await getOwnedClass(req.params.slug, req.user.id);
  if (gate.error) return res.status(gate.status).json({ error: gate.error });
  try {
    const rows = await loadClassSchedules(gate.klass.id);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Error' });
  }
});

r.post('/classes/:slug/schedules', async (req, res) => {
  const gate = await getOwnedClass(req.params.slug, req.user.id);
  if (gate.error) return res.status(gate.status).json({ error: gate.error });
  const body = req.body || {};
  if (!body.title || !body.starts_at) {
    return res.status(400).json({ error: 'title and starts_at required' });
  }
  const { data, error } = await supabaseAdmin
    .from('class_schedules')
    .insert({
      class_id: gate.klass.id,
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

r.patch('/schedules/:id', async (req, res) => {
  const o = await assertScheduleOwned(req.params.id, req.user.id);
  if (o.error) return res.status(o.status).json({ error: o.error });
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

r.delete('/schedules/:id', async (req, res) => {
  const o = await assertScheduleOwned(req.params.id, req.user.id);
  if (o.error) return res.status(o.status).json({ error: o.error });
  const { error } = await supabaseAdmin.from('class_schedules').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

// Students (roster)
r.get('/classes/:slug/students', async (req, res) => {
  const gate = await getOwnedClass(req.params.slug, req.user.id);
  if (gate.error) return res.status(gate.status).json({ error: gate.error });
  const { page, pageSize, from, to } = parsePaginationQuery(req, { defaultPageSize: 20, maxPageSize: 200 });
  const { data, error, count } = await supabaseAdmin
    .from('class_students')
    .select('id, joined_at, student_id, profiles ( id, full_name, email, role )', { count: 'exact' })
    .eq('class_id', gate.klass.id)
    .order('joined_at', { ascending: false })
    .range(from, to);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ items: data || [], total: count ?? 0, page, pageSize });
});

r.post('/classes/:slug/students', async (req, res) => {
  const gate = await getOwnedClass(req.params.slug, req.user.id);
  if (gate.error) return res.status(gate.status).json({ error: gate.error });
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
    .insert({ class_id: gate.klass.id, student_id: studentId })
    .select()
    .single();
  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Already in class' });
    return res.status(500).json({ error: error.message });
  }
  res.status(201).json(data);
});

r.delete('/classes/:slug/students/:studentId', async (req, res) => {
  const gate = await getOwnedClass(req.params.slug, req.user.id);
  if (gate.error) return res.status(gate.status).json({ error: gate.error });
  const { error } = await supabaseAdmin
    .from('class_students')
    .delete()
    .eq('class_id', gate.klass.id)
    .eq('student_id', req.params.studentId);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

// Quiz attempts (for class)
r.get('/classes/:slug/quiz-attempts', async (req, res) => {
  const gate = await getOwnedClass(req.params.slug, req.user.id);
  if (gate.error) return res.status(gate.status).json({ error: gate.error });
  const { page, pageSize, from, to } = parsePaginationQuery(req, { defaultPageSize: 25, maxPageSize: 200 });
  const { data, error, count } = await supabaseAdmin
    .from('class_quiz_attempts')
    .select(
      `
      id,
      student_id,
      quiz_id,
      correct,
      total,
      percent,
      submitted_at,
      class_quizzes ( title ),
      profiles!class_quiz_attempts_student_id_fkey ( full_name, email )
    `,
      { count: 'exact' },
    )
    .eq('class_id', gate.klass.id)
    .order('submitted_at', { ascending: false })
    .range(from, to);
  if (error) return res.status(500).json({ error: error.message });
  const items = (data || []).map((row) => ({
    id: row.id,
    student_id: row.student_id,
    quiz_id: row.quiz_id,
    correct: row.correct,
    total: row.total,
    percent: row.percent,
    submitted_at: row.submitted_at,
    quiz_title: row.class_quizzes?.title ?? null,
    student_name: row.profiles?.full_name ?? null,
    student_email: row.profiles?.email ?? null,
  }));
  res.json({ items, total: count ?? 0, page, pageSize });
});

// Bundle for editor UI
r.get('/classes/:slug/content', async (req, res) => {
  const gate = await getOwnedClass(req.params.slug, req.user.id);
  if (gate.error) return res.status(gate.status).json({ error: gate.error });
  try {
    const { lectures, quizzes, schedules } = await loadClassTeacherContent(gate.klass.id);
    res.json({ class: gate.klass, lectures, quizzes, schedules });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Error' });
  }
});

export default r;
