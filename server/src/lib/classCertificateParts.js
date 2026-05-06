import { supabaseAdmin } from '../supabase.js';
import { loadClassLecturesAndQuizzes, loadClassSchedules } from './classContent.js';
import {
  latestAttemptsByQuizId,
  lecturesCompleted,
  quizzesPassed,
  scheduleAllCompleted,
} from './certificateEligibility.js';

function questionCount(row) {
  const q = row?.questions;
  return Array.isArray(q) ? q.length : 0;
}

export async function loadClassCertificateParts(studentId, classId) {
  const [{ lectures }, schedules] = await Promise.all([
    loadClassLecturesAndQuizzes(classId, { publishedOnly: true }),
    loadClassSchedules(classId),
  ]);

  const lectureIds = (lectures || []).map((l) => l.id).filter(Boolean);
  let completed = new Set();
  if (lectureIds.length > 0) {
    const { data: prog, error: pErr } = await supabaseAdmin
      .from('class_lecture_progress')
      .select('class_lecture_id')
      .eq('student_id', studentId)
      .in('class_lecture_id', lectureIds);
    if (pErr) throw new Error(pErr.message);
    completed = new Set((prog || []).map((p) => p.class_lecture_id));
  }

  const { data: quizRowsRaw, error: qErr } = await supabaseAdmin
    .from('class_quizzes')
    .select('id, questions')
    .eq('class_id', classId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (qErr) throw new Error(qErr.message);

  const { data: attRows, error: aErr } = await supabaseAdmin
    .from('class_quiz_attempts')
    .select('quiz_id, percent, total, submitted_at')
    .eq('student_id', studentId)
    .eq('class_id', classId);
  if (aErr) throw new Error(aErr.message);

  const attemptMap = latestAttemptsByQuizId(attRows || []);
  const quizzesMeta = (quizRowsRaw || []).map((row) => ({ id: row.id, questionCount: questionCount(row) }));

  const lecEval = lecturesCompleted(lectureIds, completed);
  const qzEval = quizzesPassed(quizzesMeta, attemptMap);
  const nowMs = Date.now();
  const scheduleOk = scheduleAllCompleted(schedules, nowMs);
  const eligible = lecEval.ok && qzEval.ok && scheduleOk;

  return {
    lecEval,
    qzEval,
    scheduleOk,
    scheduleApplicable: true,
    eligible,
    schedulesCount: (schedules || []).length,
  };
}
