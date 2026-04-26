/**
 * Form state for class/course quiz UI: 4 lựa chọn A–D + đáp án đúng.
 * API lưu: { question, options: [a,b,c,d], correctIndex: 0..3 }.
 */

export function newQuizFormRow() {
  return {
    _id: globalThis.crypto?.randomUUID?.() ?? `q-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    question: '',
    a: '',
    b: '',
    c: '',
    d: '',
    correct: 0,
  };
}

/**
 * @param {unknown} questions — trường `questions` từ API
 */
export function quizFormRowsFromApi(questions) {
  const raw = Array.isArray(questions) ? questions : [];
  if (raw.length === 0) return [newQuizFormRow()];
  return raw.map((q) => {
    const row = newQuizFormRow();
    const opts = Array.isArray(q?.options) ? q.options : [];
    return {
      ...row,
      question: q?.question != null ? String(q.question) : '',
      a: opts[0] != null ? String(opts[0]) : '',
      b: opts[1] != null ? String(opts[1]) : '',
      c: opts[2] != null ? String(opts[2]) : '',
      d: opts[3] != null ? String(opts[3]) : '',
      correct:
        typeof q?.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex <= 3
          ? q.correctIndex
          : 0,
    };
  });
}

/**
 * @returns {{ questions: Array<{ question: string, options: string[], correctIndex: number }> } | { error: 'NEED_QUESTION' | 'OPTIONS_REQUIRED' }}
 */
export function buildQuizPayloadFromFormRows(rows) {
  const built = rows
    .filter((row) => (row.question || '').trim())
    .map((row) => {
      const options = [row.a, row.b, row.c, row.d].map((s) => (s != null ? String(s).trim() : ''));
      const correct = Number(row.correct);
      const correctIndex = correct >= 0 && correct <= 3 ? correct : 0;
      return { question: row.question.trim(), options, correctIndex };
    });
  if (built.length === 0) {
    return { error: 'NEED_QUESTION' };
  }
  for (const q of built) {
    if (q.options.some((o) => !o)) {
      return { error: 'OPTIONS_REQUIRED' };
    }
  }
  return { questions: built };
}
