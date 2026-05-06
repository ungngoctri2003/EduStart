import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { supabaseAdmin } from '../supabase.js';
import {
  loadClassLecturesAndQuizzes,
  loadClassSchedules,
  scoreClassQuizSubmission,
  insertClassQuizAttempt,
} from '../lib/classContent.js';
import { loadClassCertificateParts } from '../lib/classCertificateParts.js';

const r = Router();

function pickRefundSummary(requestsForMembership) {
  if (!requestsForMembership?.length) return null;
  const pending = requestsForMembership.find((x) => x.status === 'pending');
  if (pending) return pending;
  return [...requestsForMembership].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )[0];
}

async function completedClassLectureIdsForStudent(studentId, lectureIds) {
  if (!lectureIds.length) return [];
  const { data: prog, error: pErr } = await supabaseAdmin
    .from('class_lecture_progress')
    .select('class_lecture_id')
    .eq('student_id', studentId)
    .in('class_lecture_id', lectureIds);
  if (pErr) throw new Error(pErr.message);
  return (prog || []).map((r) => r.class_lecture_id);
}

async function assertStudentInClass(req, classSlug, courseSlug = null) {
  const { data: klass, error: cErr } = await supabaseAdmin
    .from('classes')
    .select(
      `
      id, name, slug, description, status, starts_at, ends_at, teacher_id, image_url, course_id,
      course:courses!classes_course_id_fkey ( id, slug, title )
    `,
    )
    .eq('slug', classSlug)
    .maybeSingle();
  if (cErr) return { error: cErr.message, status: 500 };
  if (!klass) return { error: 'Class not found', status: 404 };
  if (courseSlug && klass.course?.slug !== courseSlug) {
    return { error: 'Class not found', status: 404 };
  }

  const { data: row, error: mErr } = await supabaseAdmin
    .from('class_students')
    .select('id')
    .eq('class_id', klass.id)
    .eq('student_id', req.user.id)
    .eq('payment_status', 'approved')
    .maybeSingle();
  if (mErr) return { error: mErr.message, status: 500 };
  if (!row) return { error: 'NOT_IN_CLASS', status: 403 };
  const { course, ...klassRest } = klass;
  return { klass: klassRest, course };
}

r.get('/me', requireAuth, requireRole('student'), async (req, res) => {
  try {
    const { data: memberships, error: mErr } = await supabaseAdmin
      .from('class_students')
      .select(
        `
        id,
        joined_at,
        payment_status,
        payment_method,
        payment_note,
        classes ( id, name, slug, description, status, starts_at, ends_at, teacher_id, image_url, course:courses!classes_course_id_fkey ( id, slug, title ) )
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
    const baseList = mem.map((m) => ({
      membership_id: m.id,
      joined_at: m.joined_at,
      payment_status: m.payment_status,
      payment_method: m.payment_method,
      payment_note: m.payment_note,
      class: m.classes,
      counts: {
        lectures: m.classes?.id ? lecBy.get(m.classes.id) || 0 : 0,
        quizzes: m.classes?.id ? quizBy.get(m.classes.id) || 0 : 0,
      },
    }));

    const mids = baseList.map((b) => b.membership_id).filter(Boolean);
    const refundsByMid = new Map();
    if (mids.length > 0) {
      const { data: rrows, error: rErr } = await supabaseAdmin
        .from('class_refund_requests')
        .select('id, class_student_id, status, reason, created_at, reviewed_at, admin_note')
        .in('class_student_id', mids);
      if (rErr) return res.status(500).json({ error: rErr.message });
      for (const row of rrows || []) {
        const mid = row.class_student_id;
        const arr = refundsByMid.get(mid) || [];
        arr.push(row);
        refundsByMid.set(mid, arr);
      }
    }

    const list = await Promise.all(
      baseList.map(async (row) => {
        const cid = row.class?.id;
        const approved = row.payment_status === 'approved';
        let certificateEligible = false;
        if (cid && approved) {
          try {
            const parts = await loadClassCertificateParts(req.user.id, cid);
            certificateEligible = Boolean(parts.eligible);
          } catch {
            certificateEligible = false;
          }
        }
        const refund_request = pickRefundSummary(refundsByMid.get(row.membership_id));
        return { ...row, certificate_eligible: certificateEligible, refund_request };
      }),
    );

    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Error' });
  }
});

r.get('/courses/:courseSlug/classes/:classSlug', requireAuth, requireRole('student'), async (req, res) => {
  try {
    const { courseSlug, classSlug } = req.params;
    const gate = await assertStudentInClass(req, classSlug, courseSlug);
    if (gate.error) return res.status(gate.status).json({ error: gate.error });
    const { klass, course } = gate;
    const [{ lectures, quizzes }, schedules] = await Promise.all([
      loadClassLecturesAndQuizzes(klass.id, { publishedOnly: true }),
      loadClassSchedules(klass.id),
    ]);
    const lectureIds = (lectures || []).map((l) => l.id).filter(Boolean);
    let completedLectureIds = [];
    try {
      completedLectureIds = await completedClassLectureIdsForStudent(req.user.id, lectureIds);
    } catch (e) {
      return res.status(500).json({ error: e.message || 'Error' });
    }
    res.json({
      class: klass,
      course: course ? { id: course.id, slug: course.slug, title: course.title } : null,
      lectures,
      quizzes,
      schedules,
      completed_lecture_ids: completedLectureIds,
    });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Error' });
  }
});

r.get('/classes/:slug', requireAuth, requireRole('student'), async (req, res) => {
  try {
    const gate = await assertStudentInClass(req, req.params.slug);
    if (gate.error) return res.status(gate.status).json({ error: gate.error });
    const { klass, course } = gate;
    const [{ lectures, quizzes }, schedules] = await Promise.all([
      loadClassLecturesAndQuizzes(klass.id, { publishedOnly: true }),
      loadClassSchedules(klass.id),
    ]);
    const lectureIds = (lectures || []).map((l) => l.id).filter(Boolean);
    let completedLectureIds = [];
    try {
      completedLectureIds = await completedClassLectureIdsForStudent(req.user.id, lectureIds);
    } catch (e) {
      return res.status(500).json({ error: e.message || 'Error' });
    }
    res.json({
      class: klass,
      course: course ? { id: course.id, slug: course.slug, title: course.title } : null,
      lectures,
      quizzes,
      schedules,
      completed_lecture_ids: completedLectureIds,
    });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Error' });
  }
});

async function markClassLectureComplete(req, res, classSlug, courseSlug) {
  const gate = await assertStudentInClass(req, classSlug, courseSlug ?? undefined);
  if (gate.error) return res.status(gate.status).json({ error: gate.error });
  const { lectureId } = req.params;
  const { data: lec, error: lErr } = await supabaseAdmin
    .from('class_lectures')
    .select('id, class_id')
    .eq('id', lectureId)
    .maybeSingle();
  if (lErr) return res.status(500).json({ error: lErr.message });
  if (!lec || lec.class_id !== gate.klass.id) {
    return res.status(404).json({ error: 'Lecture not found' });
  }
  const { error: uErr } = await supabaseAdmin.from('class_lecture_progress').upsert(
    {
      student_id: req.user.id,
      class_lecture_id: lec.id,
      completed_at: new Date().toISOString(),
    },
    { onConflict: 'student_id,class_lecture_id' },
  );
  if (uErr) return res.status(500).json({ error: uErr.message });
  return res.json({ ok: true });
}

r.post('/courses/:courseSlug/classes/:classSlug/lectures/:lectureId/complete', requireAuth, requireRole('student'), async (req, res) => {
  try {
    const { courseSlug, classSlug } = req.params;
    return await markClassLectureComplete(req, res, classSlug, courseSlug);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Error' });
  }
});

r.post('/classes/:slug/lectures/:lectureId/complete', requireAuth, requireRole('student'), async (req, res) => {
  try {
    const { slug } = req.params;
    return await markClassLectureComplete(req, res, slug, null);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Error' });
  }
});

r.post('/courses/:courseSlug/classes/:classSlug/quizzes/:quizId/submit', requireAuth, requireRole('student'), async (req, res) => {
  const answers = req.body?.answers;
  if (!Array.isArray(answers)) {
    return res.status(400).json({ error: 'answers must be an array' });
  }
  try {
    const { courseSlug, classSlug, quizId } = req.params;
    const gate = await assertStudentInClass(req, classSlug, courseSlug);
    if (gate.error) return res.status(gate.status).json({ error: gate.error });
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
        classes ( name, slug, course:courses!classes_course_id_fkey ( slug ) )
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
      course_slug: row.classes?.course?.slug ?? null,
    }));
    res.json(attempts);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Error' });
  }
});

export default r;
