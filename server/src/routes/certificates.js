import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { supabaseAdmin } from '../supabase.js';
import {
  latestAttemptsByQuizId,
  lecturesCompleted,
  quizzesPassed,
} from '../lib/certificateEligibility.js';
import { loadClassCertificateParts } from '../lib/classCertificateParts.js';
import { buildCertificatePdfBuffer } from '../lib/certificatePdf.js';

const r = Router();

function questionCount(row) {
  const q = row?.questions;
  return Array.isArray(q) ? q.length : 0;
}

function paymentOk(status) {
  return status === 'approved' || status == null;
}

async function loadCourseCertificateParts(studentId, courseId) {
  const [{ data: lecRows, error: lErr }, { data: quizRows, error: qErr }] = await Promise.all([
    supabaseAdmin.from('course_lectures').select('id').eq('course_id', courseId),
    supabaseAdmin.from('course_quizzes').select('id, questions').eq('course_id', courseId),
  ]);
  if (lErr) throw new Error(lErr.message);
  if (qErr) throw new Error(qErr.message);

  const lectureIds = (lecRows || []).map((x) => x.id).filter(Boolean);
  let completed = new Set();
  if (lectureIds.length > 0) {
    const { data: prog, error: pErr } = await supabaseAdmin
      .from('course_lecture_progress')
      .select('course_lecture_id')
      .eq('student_id', studentId)
      .in('course_lecture_id', lectureIds);
    if (pErr) throw new Error(pErr.message);
    completed = new Set((prog || []).map((p) => p.course_lecture_id));
  }

  const { data: attRows, error: aErr } = await supabaseAdmin
    .from('quiz_attempts')
    .select('quiz_id, percent, total, submitted_at')
    .eq('student_id', studentId)
    .eq('course_id', courseId);
  if (aErr) throw new Error(aErr.message);

  const attemptMap = latestAttemptsByQuizId(attRows || []);
  const quizzesMeta = (quizRows || []).map((row) => ({ id: row.id, questionCount: questionCount(row) }));

  const lecEval = lecturesCompleted(lectureIds, completed);
  const qzEval = quizzesPassed(quizzesMeta, attemptMap);
  const scheduleOk = true;
  const eligible = lecEval.ok && qzEval.ok && scheduleOk;

  return {
    lecEval,
    qzEval,
    scheduleOk,
    scheduleApplicable: false,
    eligible,
    schedulesCount: 0,
  };
}

r.get('/me/status', requireAuth, requireRole('student'), async (req, res) => {
  try {
    const studentId = req.user.id;
    const items = [];

    const { data: enrollments, error: eErr } = await supabaseAdmin
      .from('enrollments')
      .select(
        `
        id,
        payment_status,
        course_id,
        courses ( id, title, slug )
      `,
      )
      .eq('student_id', studentId)
      .order('enrolled_at', { ascending: false });
    if (eErr) return res.status(500).json({ error: eErr.message });

    for (const row of enrollments || []) {
      if (!paymentOk(row.payment_status)) continue;
      const c = row.courses;
      if (!c?.id) continue;
      const parts = await loadCourseCertificateParts(studentId, c.id);
      items.push({
        kind: 'course',
        course_slug: c.slug,
        course_title: c.title,
        lectures: { done: parts.lecEval.done, total: parts.lecEval.total },
        quizzes: { passed: parts.qzEval.passed, total: parts.qzEval.total },
        schedule: {
          applicable: false,
          ok: true,
          detail: null,
          sessions: parts.schedulesCount,
        },
        eligible: parts.eligible,
      });
    }

    const { data: memberships, error: mErr } = await supabaseAdmin
      .from('class_students')
      .select(
        `
        payment_status,
        classes ( id, name, slug, course:courses!classes_course_id_fkey ( id, title, slug ) )
      `,
      )
      .eq('student_id', studentId);
    if (mErr) return res.status(500).json({ error: mErr.message });

    for (const m of memberships || []) {
      if (m.payment_status !== 'approved') continue;
      const klass = m.classes;
      if (!klass?.id) continue;
      const course = klass.course;
      const parts = await loadClassCertificateParts(studentId, klass.id);
      items.push({
        kind: 'class',
        course_slug: course?.slug ?? null,
        course_title: course?.title ?? null,
        class_slug: klass.slug,
        class_name: klass.name,
        lectures: { done: parts.lecEval.done, total: parts.lecEval.total },
        quizzes: { passed: parts.qzEval.passed, total: parts.qzEval.total },
        schedule: {
          applicable: parts.scheduleApplicable,
          ok: parts.scheduleOk,
          sessions: parts.schedulesCount,
        },
        eligible: parts.eligible,
      });
    }

    res.json({ items });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Error' });
  }
});

r.get('/course/:slug/pdf', requireAuth, requireRole('student'), async (req, res) => {
  try {
    const slug = req.params.slug;
    const { data: course, error: cErr } = await supabaseAdmin
      .from('courses')
      .select('id, title, slug, published')
      .eq('slug', slug)
      .maybeSingle();
    if (cErr) return res.status(500).json({ error: cErr.message });
    if (!course?.published) return res.status(404).json({ error: 'Course not found' });

    const { data: enr, error: nErr } = await supabaseAdmin
      .from('enrollments')
      .select('id, payment_status')
      .eq('student_id', req.user.id)
      .eq('course_id', course.id)
      .maybeSingle();
    if (nErr) return res.status(500).json({ error: nErr.message });
    if (!enr || !paymentOk(enr.payment_status)) {
      return res.status(403).json({ error: 'NOT_ENROLLED' });
    }

    const parts = await loadCourseCertificateParts(req.user.id, course.id);
    if (!parts.eligible) {
      return res.status(403).json({ error: 'CERTIFICATE_NOT_ELIGIBLE' });
    }

    const dateLine = `Ngày cấp: ${new Date().toLocaleDateString('vi-VN', { dateStyle: 'long' })}`;
    const buf = await buildCertificatePdfBuffer({
      studentName: req.user.full_name?.trim() || 'Học viên',
      titleLine: `Khóa học: ${course.title}`,
      scopeLine: 'Hình thức: học trực tuyến (ghi danh khóa)',
      dateLine,
    });

    const filename = `chung-chi-${course.slug}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buf);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Error' });
  }
});

r.get('/class/:courseSlug/:classSlug/pdf', requireAuth, requireRole('student'), async (req, res) => {
  try {
    const { courseSlug, classSlug } = req.params;
    const { data: klass, error: kErr } = await supabaseAdmin
      .from('classes')
      .select(
        `
        id, name, slug,
        course:courses!classes_course_id_fkey ( id, title, slug, published )
      `,
      )
      .eq('slug', classSlug)
      .maybeSingle();
    if (kErr) return res.status(500).json({ error: kErr.message });
    if (!klass) return res.status(404).json({ error: 'Class not found' });
    const cr = klass.course;
    if (courseSlug && courseSlug !== '_' && cr?.slug !== courseSlug) {
      return res.status(404).json({ error: 'Class not found' });
    }

    const { data: mem, error: mErr } = await supabaseAdmin
      .from('class_students')
      .select('id')
      .eq('class_id', klass.id)
      .eq('student_id', req.user.id)
      .eq('payment_status', 'approved')
      .maybeSingle();
    if (mErr) return res.status(500).json({ error: mErr.message });
    if (!mem) return res.status(403).json({ error: 'NOT_IN_CLASS' });

    const parts = await loadClassCertificateParts(req.user.id, klass.id);
    if (!parts.eligible) {
      return res.status(403).json({ error: 'CERTIFICATE_NOT_ELIGIBLE' });
    }

    const dateLine = `Ngày cấp: ${new Date().toLocaleDateString('vi-VN', { dateStyle: 'long' })}`;
    const courseTitle = cr?.title || 'Khóa học';
    const buf = await buildCertificatePdfBuffer({
      studentName: req.user.full_name?.trim() || 'Học viên',
      titleLine: `${courseTitle}`,
      scopeLine: `Lớp: ${klass.name}`,
      dateLine,
    });

    const safe = `${classSlug}`.replace(/[^a-zA-Z0-9_-]+/g, '-');
    const filename = `chung-chi-lop-${safe}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buf);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Error' });
  }
});

export default r;
