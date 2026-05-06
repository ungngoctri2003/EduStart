import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { supabaseAdmin } from '../supabase.js';
import { insertQuizAttempt, loadCourseLecturesAndQuizzes, scoreQuizSubmission } from '../lib/courseContent.js';
import { studentHasCourseAccess } from '../lib/courseAccess.js';

const r = Router();

async function assertStudentCourseLearnAccess(req, slug) {
  const { data: course, error: cErr } = await supabaseAdmin
    .from('courses')
    .select('id, slug, published')
    .eq('slug', slug)
    .single();
  if (cErr || !course) return { error: 'Course not found', status: 404 };
  if (!course.published) return { error: 'Course not found', status: 404 };

  const gate = await studentHasCourseAccess(req.user.id, course.id);
  if (gate.error) return { error: gate.error, status: gate.status ?? 500 };
  if (!gate.ok) return { error: 'NOT_ENROLLED', status: 403 };
  return { course };
}

r.get('/courses/:slug', requireAuth, requireRole('student'), async (req, res) => {
  try {
    const gate = await assertStudentCourseLearnAccess(req, req.params.slug);
    if (gate.error) {
      return res.status(gate.status).json({ error: gate.error });
    }
    const { lectures, quizzes } = await loadCourseLecturesAndQuizzes(gate.course.id);
    const lectureIds = (lectures || []).map((l) => l.id).filter(Boolean);
    let completedLectureIds = [];
    if (lectureIds.length > 0) {
      const { data: prog, error: pErr } = await supabaseAdmin
        .from('course_lecture_progress')
        .select('course_lecture_id')
        .eq('student_id', req.user.id)
        .in('course_lecture_id', lectureIds);
      if (pErr) return res.status(500).json({ error: pErr.message });
      completedLectureIds = (prog || []).map((r) => r.course_lecture_id);
    }
    res.json({ lectures, quizzes, completed_lecture_ids: completedLectureIds });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Internal error' });
  }
});

r.post('/courses/:slug/lectures/:lectureId/complete', requireAuth, requireRole('student'), async (req, res) => {
  try {
    const gate = await assertStudentCourseLearnAccess(req, req.params.slug);
    if (gate.error) {
      return res.status(gate.status).json({ error: gate.error });
    }
    const { lectureId } = req.params;
    const { data: lec, error: lErr } = await supabaseAdmin
      .from('course_lectures')
      .select('id, course_id')
      .eq('id', lectureId)
      .maybeSingle();
    if (lErr) return res.status(500).json({ error: lErr.message });
    if (!lec || lec.course_id !== gate.course.id) {
      return res.status(404).json({ error: 'Lecture not found' });
    }
    const { error: uErr } = await supabaseAdmin.from('course_lecture_progress').upsert(
      {
        student_id: req.user.id,
        course_lecture_id: lec.id,
        completed_at: new Date().toISOString(),
      },
      { onConflict: 'student_id,course_lecture_id' },
    );
    if (uErr) return res.status(500).json({ error: uErr.message });
    res.json({ ok: true });
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
    const gate = await assertStudentCourseLearnAccess(req, req.params.slug);
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
    const gate = await assertStudentCourseLearnAccess(req, req.params.slug);
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
