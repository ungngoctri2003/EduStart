import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { supabaseAdmin } from '../supabase.js';
import { insertQuizAttempt, loadCourseLecturesAndQuizzes, scoreQuizSubmission } from '../lib/courseContent.js';

const r = Router();

async function assertStudentEnrolledInCourse(req, slug) {
  const { data: course, error: cErr } = await supabaseAdmin
    .from('courses')
    .select('id, slug, published')
    .eq('slug', slug)
    .single();
  if (cErr || !course) return { error: 'Course not found', status: 404 };
  if (!course.published) return { error: 'Course not found', status: 404 };

  const { data: enr, error: eErr } = await supabaseAdmin
    .from('enrollments')
    .select('id')
    .eq('student_id', req.user.id)
    .eq('course_id', course.id)
    .maybeSingle();
  if (eErr) return { error: eErr.message, status: 500 };
  if (!enr) return { error: 'NOT_ENROLLED', status: 403 };
  return { course };
}

r.get('/courses/:slug', requireAuth, requireRole('student'), async (req, res) => {
  try {
    const gate = await assertStudentEnrolledInCourse(req, req.params.slug);
    if (gate.error) {
      return res.status(gate.status).json({ error: gate.error });
    }
    const { lectures, quizzes } = await loadCourseLecturesAndQuizzes(gate.course.id);
    res.json({ lectures, quizzes });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Internal error' });
  }
});

r.post('/courses/:slug/quizzes/:quizId/submit', requireAuth, requireRole('student'), async (req, res) => {
  const answers = req.body?.answers;
  if (!Array.isArray(answers)) {
    return res.status(400).json({ error: 'answers must be an array' });
  }
  try {
    const gate = await assertStudentEnrolledInCourse(req, req.params.slug);
    if (gate.error) {
      return res.status(gate.status).json({ error: gate.error });
    }
    const { quizId } = req.params;
    const result = await scoreQuizSubmission(quizId, gate.course.id, answers);
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }
    try {
      await insertQuizAttempt(req.user.id, quizId, gate.course.id, {
        correct: result.correct,
        total: result.total,
        percent: result.percent,
      });
    } catch (e) {
      return res.status(500).json({ error: e.message || 'Failed to save quiz result' });
    }
    res.json({ correct: result.correct, total: result.total, percent: result.percent });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Internal error' });
  }
});

r.put('/courses/:slug/reviews', requireAuth, requireRole('student'), async (req, res) => {
  const rating = Number(req.body?.rating);
  const commentRaw = req.body?.comment;
  const comment =
    typeof commentRaw === 'string' && commentRaw.trim() ? commentRaw.trim().slice(0, 8000) : null;
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'rating must be an integer from 1 to 5' });
  }
  try {
    const gate = await assertStudentEnrolledInCourse(req, req.params.slug);
    if (gate.error) {
      return res.status(gate.status).json({ error: gate.error });
    }
    const { data, error } = await supabaseAdmin
      .from('course_reviews')
      .upsert(
        {
          student_id: req.user.id,
          course_id: gate.course.id,
          rating,
          comment,
        },
        { onConflict: 'student_id,course_id' },
      )
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Internal error' });
  }
});

r.get('/quiz-attempts/me', requireAuth, requireRole('student'), async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('quiz_attempts')
      .select(
        `
        id,
        quiz_id,
        course_id,
        correct,
        total,
        percent,
        submitted_at,
        course_quizzes ( title ),
        courses ( title, slug )
      `,
      )
      .eq('student_id', req.user.id)
      .order('submitted_at', { ascending: false })
      .limit(500);
    if (error) return res.status(500).json({ error: error.message });
    const attempts = (data || []).map((row) => ({
      id: row.id,
      quiz_id: row.quiz_id,
      course_id: row.course_id,
      correct: row.correct,
      total: row.total,
      percent: row.percent,
      submitted_at: row.submitted_at,
      quiz_title: row.course_quizzes?.title ?? null,
      course_title: row.courses?.title ?? null,
      course_slug: row.courses?.slug ?? null,
    }));
    res.json(attempts);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Internal error' });
  }
});

export default r;
