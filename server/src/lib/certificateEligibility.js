/** Minimum score (latest attempt) to count quiz as passed for certificate. */
export const MIN_QUIZ_PASS_PERCENT = 70;

/**
 * @param {Array<{ ends_at?: string | null, starts_at: string }>} schedules
 * @param {number} nowMs
 */
export function scheduleAllCompleted(schedules, nowMs) {
  if (!schedules?.length) return true;
  return schedules.every((s) => {
    const t = s.ends_at ? new Date(s.ends_at).getTime() : new Date(s.starts_at).getTime();
    return !Number.isNaN(t) && t <= nowMs;
  });
}

/**
 * @param {string[]} lectureIds
 * @param {Set<string>} completedLectureIds
 */
export function lecturesCompleted(lectureIds, completedLectureIds) {
  const total = lectureIds.length;
  if (total === 0) return { done: 0, total: 0, ok: true };
  let done = 0;
  for (const id of lectureIds) {
    if (completedLectureIds.has(id)) done += 1;
  }
  return { done, total, ok: done === total };
}

/**
 * @param {Array<{ id: string, questionCount: number }>} quizzes
 * @param {Map<string, { percent: number, total: number, submitted_at: string }>} latestAttemptByQuizId
 */
export function quizzesPassed(quizzes, latestAttemptByQuizId) {
  const total = quizzes.length;
  if (total === 0) return { passed: 0, required: 0, ok: true };
  let passed = 0;
  for (const q of quizzes) {
    if (q.questionCount === 0) {
      passed += 1;
      continue;
    }
    const att = latestAttemptByQuizId.get(q.id);
    if (!att) continue;
    if (att.total === 0) {
      passed += 1;
      continue;
    }
    if (att.percent >= MIN_QUIZ_PASS_PERCENT) passed += 1;
  }
  const ok = passed === total;
  return { passed, total, ok };
}

/**
 * Build map quiz_id -> latest attempt (by submitted_at).
 * @param {Array<{ quiz_id: string, percent: number, total: number, submitted_at: string }>} attempts
 */
export function latestAttemptsByQuizId(attempts) {
  const map = new Map();
  for (const a of attempts) {
    if (!a.quiz_id) continue;
    const prev = map.get(a.quiz_id);
    const t = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
    if (!prev || t >= new Date(prev.submitted_at).getTime()) {
      map.set(a.quiz_id, {
        percent: a.percent ?? 0,
        total: a.total ?? 0,
        submitted_at: a.submitted_at,
      });
    }
  }
  return map;
}
