import { supabaseAdmin } from '../supabase.js';
import { normalizeLectureBlocks, sortContentRows, toPublicQuiz } from './courseContent.js';

/**
 * Lectures + quizzes for a class. Teacher/admin: all lectures. Students: published only.
 */
export async function loadClassLecturesAndQuizzes(classId, { publishedOnly } = { publishedOnly: false }) {
  let lecQ = supabaseAdmin.from('class_lectures').select('*').eq('class_id', classId);
  if (publishedOnly) lecQ = lecQ.eq('published', true);
  const [{ data: lectureRows, error: lErr }, { data: quizRows, error: zErr }] = await Promise.all([
    lecQ.order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
    supabaseAdmin
      .from('class_quizzes')
      .select('*')
      .eq('class_id', classId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
  ]);
  if (lErr) throw new Error(lErr.message);
  if (zErr) throw new Error(zErr.message);

  const lectures = sortContentRows(lectureRows || []).map((row) => ({
    id: row.id,
    title: row.title,
    sort_order: row.sort_order,
    published: row.published ?? true,
    blocks: normalizeLectureBlocks(row),
  }));
  const quizzes = sortContentRows(quizRows || []).map(toPublicQuiz);
  return { lectures, quizzes };
}

/** Teacher/admin: full quiz rows (includes correctIndex). */
export async function loadClassQuizzesFull(classId) {
  const { data: quizRows, error: zErr } = await supabaseAdmin
    .from('class_quizzes')
    .select('*')
    .eq('class_id', classId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (zErr) throw new Error(zErr.message);
  return sortContentRows(quizRows || []);
}

export async function loadClassTeacherContent(classId) {
  const [lecPack, quizzesFull, schedules] = await Promise.all([
    loadClassLecturesAndQuizzes(classId, { publishedOnly: false }),
    loadClassQuizzesFull(classId),
    loadClassSchedules(classId),
  ]);
  return { lectures: lecPack.lectures, quizzes: quizzesFull, schedules };
}

export async function loadClassSchedules(classId) {
  const { data, error } = await supabaseAdmin
    .from('class_schedules')
    .select('*')
    .eq('class_id', classId)
    .order('starts_at', { ascending: true })
    .order('sort_order', { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function scoreClassQuizSubmission(quizId, classId, answers) {
  const { data: quiz, error: qErr } = await supabaseAdmin
    .from('class_quizzes')
    .select('id, class_id, questions')
    .eq('id', quizId)
    .single();
  if (qErr || !quiz) return { error: 'Quiz not found', status: 404 };
  if (quiz.class_id !== classId) return { error: 'Quiz not found', status: 404 };

  const qs = Array.isArray(quiz.questions) ? quiz.questions : [];
  const total = qs.length;
  let correct = 0;
  for (let i = 0; i < total; i += 1) {
    const ci = qs[i]?.correctIndex;
    const picked = answers[i];
    if (typeof picked === 'number' && typeof ci === 'number' && picked === ci) {
      correct += 1;
    }
  }
  const percent = total === 0 ? 0 : Math.round((correct / total) * 100);
  return { correct, total, percent };
}

export async function insertClassQuizAttempt(studentId, quizId, classId, scores) {
  const { correct, total, percent } = scores;
  const { error } = await supabaseAdmin.from('class_quiz_attempts').insert({
    student_id: studentId,
    quiz_id: quizId,
    class_id: classId,
    correct,
    total,
    percent,
  });
  if (error) throw new Error(error.message);
}
