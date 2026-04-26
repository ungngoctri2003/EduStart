import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { supabaseAdmin } from '../supabase.js';
import {
  loadClassLecturesAndQuizzes,
  loadClassSchedules,
  scoreClassQuizSubmission,
  insertClassQuizAttempt,
} from '../lib/classContent.js';

const r = Router();

async function assertStudentInClass(req, slug) {
  const { data: klass, error: cErr } = await supabaseAdmin
    .from('classes')
    .select('id, name, slug, description, status, starts_at, ends_at, teacher_id')
    .eq('slug', slug)
    .maybeSingle();
  if (cErr) return { error: cErr.message, status: 500 };
  if (!klass) return { error: 'Class not found', status: 404 };

  const { data: row, error: mErr } = await supabaseAdmin
    .from('class_students')
    .select('id')
    .eq('class_id', klass.id)
    .eq('student_id', req.user.id)
    .maybeSingle();
  if (mErr) return { error: mErr.message, status: 500 };
  if (!row) return { error: 'NOT_IN_CLASS', status: 403 };
  return { klass };
}

r.get('/me', requireAuth, requireRole('student'), async (req, res) => {
  try {
    const { data: memberships, error: mErr } = await supabaseAdmin
      .from('class_students')
      .select(
        `
        joined_at,
        classes ( id, name, slug, description, status, starts_at, ends_at, teacher_id )
      `,
      )
      .eq('student_id', req.user.id)
      .order('joined_at', { ascending: false });
    if (mErr) return res.status(500).json({ error: mErr.message });
    const mem = memberships || [];
    const ids = mem.map((m) => m.classes?.id).filter(Boolean);
    let lecBy = new Map();
    let quizBy = new Map();
    if (ids.length > 0) {
      const [{ data: lecRows, error: lErr }, { data: quizRows, error: qErr }] = await Promise.all([
        supabaseAdmin.from('class_lectures').select('class_id').eq('published', true).in('class_id', ids),
        supabaseAdmin.from('class_quizzes').select('class_id').in('class_id', ids),
      ]);
      if (lErr || qErr) return res.status(500).json({ error: lErr?.message || qErr?.message || 'count error' });
      for (const r of lecRows || []) {
        lecBy.set(r.class_id, (lecBy.get(r.class_id) || 0) + 1);
      }
      for (const r of quizRows || []) {
        quizBy.set(r.class_id, (quizBy.get(r.class_id) || 0) + 1);
      }
    }
    const list = mem.map((m) => ({
      joined_at: m.joined_at,
      class: m.classes,
      counts: {
        lectures: m.classes?.id ? lecBy.get(m.classes.id) || 0 : 0,
        quizzes: m.classes?.id ? quizBy.get(m.classes.id) || 0 : 0,
      },
    }));
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Error' });
  }
});

r.get('/classes/:slug', requireAuth, requireRole('student'), async (req, res) => {
  try {
    const gate = await assertStudentInClass(req, req.params.slug);
    if (gate.error) return res.status(gate.status).json({ error: gate.error });
    const { klass } = gate;
    const [{ lectures, quizzes }, schedules] = await Promise.all([
      loadClassLecturesAndQuizzes(klass.id, { publishedOnly: true }),
      loadClassSchedules(klass.id),
    ]);
    res.json({
      class: klass,
      lectures,
      quizzes,
      schedules,
    });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Error' });
  }
});

r.post('/classes/:slug/quizzes/:quizId/submit', requireAuth, requireRole('student'), async (req, res) => {
  const answers = req.body?.answers;
  if (!Array.isArray(answers)) {
    return res.status(400).json({ error: 'answers must be an array' });
  }
  try {
    const gate = await assertStudentInClass(req, req.params.slug);
    if (gate.error) return res.status(gate.status).json({ error: gate.error });
    const { quizId } = req.params;
    const result = await scoreClassQuizSubmission(quizId, gate.klass.id, answers);
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }
    await insertClassQuizAttempt(req.user.id, quizId, gate.klass.id, {
      correct: result.correct,
      total: result.total,
      percent: result.percent,
    });
    res.json({ correct: result.correct, total: result.total, percent: result.percent });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Error' });
  }
});

r.get('/quiz-attempts/me', requireAuth, requireRole('student'), async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('class_quiz_attempts')
      .select(
        `
        id,
        quiz_id,
        class_id,
        correct,
        total,
        percent,
        submitted_at,
        class_quizzes ( title ),
        classes ( name, slug )
      `,
      )
      .eq('student_id', req.user.id)
      .order('submitted_at', { ascending: false })
      .limit(500);
    if (error) return res.status(500).json({ error: error.message });
    const attempts = (data || []).map((row) => ({
      id: row.id,
      quiz_id: row.quiz_id,
      class_id: row.class_id,
      correct: row.correct,
      total: row.total,
      percent: row.percent,
      submitted_at: row.submitted_at,
      quiz_title: row.class_quizzes?.title ?? null,
      class_name: row.classes?.name ?? null,
      class_slug: row.classes?.slug ?? null,
    }));
    res.json(attempts);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Error' });
  }
});

export default r;
