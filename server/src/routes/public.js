import { Router } from 'express';
import { supabaseAdmin } from '../supabase.js';

const r = Router();

function sortContentRows(rows) {
  if (!rows?.length) return [];
  return [...rows].sort((a, b) => {
    const o = (a.sort_order ?? 0) - (b.sort_order ?? 0);
    if (o !== 0) return o;
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return ta - tb;
  });
}

function normalizeLectureBlocks(row) {
  const raw = Array.isArray(row.blocks) ? row.blocks : [];
  const cleaned = raw
    .map((b) => ({
      title: b?.title != null && String(b.title).trim() ? String(b.title).trim() : null,
      content: b?.content != null && String(b.content).trim() ? String(b.content).trim() : '',
      video_url: b?.video_url != null && String(b.video_url).trim() ? String(b.video_url).trim() : '',
    }))
    .filter((b) => b.title || b.content || b.video_url);
  if (cleaned.length) return cleaned;
  const c = row.content != null && String(row.content).trim() ? String(row.content).trim() : '';
  const v = row.video_url != null && String(row.video_url).trim() ? String(row.video_url).trim() : '';
  if (c || v) return [{ title: null, content: c, video_url: v }];
  return [];
}

function toPublicQuiz(row) {
  const raw = Array.isArray(row.questions) ? row.questions : [];
  const questions = raw.map((q) => ({
    question: q?.question ?? '',
    options: Array.isArray(q?.options) ? q.options : [],
  }));
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    sort_order: row.sort_order,
    questions,
  };
}

r.get('/courses', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('courses')
    .select('*, categories(id, name, slug)')
    .eq('published', true)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

r.post('/courses/:slug/quizzes/:quizId/submit', async (req, res) => {
  const { slug, quizId } = req.params;
  const answers = req.body?.answers;
  if (!Array.isArray(answers)) {
    return res.status(400).json({ error: 'answers must be an array' });
  }

  const { data: course, error: cErr } = await supabaseAdmin
    .from('courses')
    .select('id, slug, published')
    .eq('slug', slug)
    .single();
  if (cErr || !course) return res.status(404).json({ error: 'Course not found' });
  if (!course.published) return res.status(404).json({ error: 'Course not found' });

  const { data: quiz, error: qErr } = await supabaseAdmin
    .from('course_quizzes')
    .select('id, course_id, questions')
    .eq('id', quizId)
    .single();
  if (qErr || !quiz) return res.status(404).json({ error: 'Quiz not found' });
  if (quiz.course_id !== course.id) return res.status(404).json({ error: 'Quiz not found' });

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
  res.json({ correct, total, percent });
});

r.get('/courses/:slug', async (req, res) => {
  const { data: course, error } = await supabaseAdmin
    .from('courses')
    .select('*, categories(id, name, slug)')
    .eq('slug', req.params.slug)
    .single();
  if (error || !course) return res.status(404).json({ error: 'Course not found' });
  if (!course.published) return res.status(404).json({ error: 'Course not found' });

  const [{ data: lectureRows, error: lErr }, { data: quizRows, error: zErr }] = await Promise.all([
    supabaseAdmin.from('course_lectures').select('*').eq('course_id', course.id),
    supabaseAdmin.from('course_quizzes').select('*').eq('course_id', course.id),
  ]);
  if (lErr) return res.status(500).json({ error: lErr.message });
  if (zErr) return res.status(500).json({ error: zErr.message });

  const lectures = sortContentRows(lectureRows || []).map((row) => ({
    id: row.id,
    title: row.title,
    sort_order: row.sort_order,
    blocks: normalizeLectureBlocks(row),
  }));
  const quizzes = sortContentRows(quizRows || []).map(toPublicQuiz);

  res.json({ ...course, lectures, quizzes });
});

r.get('/categories', async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

r.get('/team', async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from('team_members')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

r.get('/testimonials', async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from('testimonials')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

export default r;
