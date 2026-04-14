import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { supabaseAdmin } from '../supabase.js';

const r = Router();

r.use(requireAuth, requireRole('admin'));

r.get('/users', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, role, email, created_at')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

r.post('/users', async (req, res) => {
  const { email, password, full_name, role } = req.body || {};
  if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
    return res.status(400).json({ error: 'email and password required' });
  }
  const rVal = role && ['admin', 'student'].includes(role) ? role : 'student';
  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email: email.trim(),
    password,
    email_confirm: true,
    user_metadata: { full_name: typeof full_name === 'string' ? full_name : '' },
  });
  if (createErr) return res.status(400).json({ error: createErr.message });
  const uid = created.user.id;

  const profilePatch = { role: rVal };
  if (typeof full_name === 'string' && full_name.trim()) {
    profilePatch.full_name = full_name.trim();
  }
  const { error: upErr } = await supabaseAdmin.from('profiles').update(profilePatch).eq('id', uid);
  if (upErr) return res.status(500).json({ error: upErr.message });

  const { data: row, error: fetchErr } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, role, email, created_at')
    .eq('id', uid)
    .single();
  if (fetchErr || !row) return res.status(500).json({ error: fetchErr?.message || 'Profile fetch failed' });
  res.status(201).json(row);
});

r.patch('/users/:id', async (req, res) => {
  const { id } = req.params;
  const { full_name, role, email, password } = req.body || {};

  if (id === req.user.id && role === 'student' && req.user.role === 'admin') {
    return res.status(400).json({ error: 'Cannot remove own admin role' });
  }

  const authUpdate = {};
  if (typeof email === 'string' && email.trim()) authUpdate.email = email.trim();
  if (typeof password === 'string' && password.length > 0) authUpdate.password = password;
  if (Object.keys(authUpdate).length > 0) {
    const { error: auErr } = await supabaseAdmin.auth.admin.updateUserById(id, authUpdate);
    if (auErr) return res.status(400).json({ error: auErr.message });
  }

  const profilePatch = {};
  if (full_name !== undefined) {
    profilePatch.full_name = typeof full_name === 'string' && full_name.trim() ? full_name.trim() : null;
  }
  if (role !== undefined) {
    if (!['admin', 'student'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
    profilePatch.role = role;
  }
  if (Object.keys(profilePatch).length > 0) {
    const { error: pErr } = await supabaseAdmin.from('profiles').update(profilePatch).eq('id', id);
    if (pErr) return res.status(500).json({ error: pErr.message });
  }

  const { data: row, error: fetchErr } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, role, email, created_at')
    .eq('id', id)
    .single();
  if (fetchErr || !row) return res.status(404).json({ error: 'User not found' });
  res.json(row);
});

r.delete('/users/:id', async (req, res) => {
  const { id } = req.params;
  if (id === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete own account' });
  }
  const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
  if (error) return res.status(400).json({ error: error.message });
  res.status(204).send();
});

r.get('/contact-messages', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('contact_messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Categories CRUD
r.post('/categories', async (req, res) => {
  const { name, slug, image_url, sort_order } = req.body || {};
  if (!name || !slug) return res.status(400).json({ error: 'name and slug required' });
  const { data, error } = await supabaseAdmin
    .from('categories')
    .insert({
      name,
      slug,
      image_url: image_url ?? null,
      sort_order: sort_order ?? 0,
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

r.patch('/categories/:id', async (req, res) => {
  const { id } = req.params;
  const patch = {};
  for (const k of ['name', 'slug', 'image_url', 'sort_order']) {
    if (req.body[k] !== undefined) patch[k] = req.body[k];
  }
  const { data, error } = await supabaseAdmin
    .from('categories')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

r.delete('/categories/:id', async (req, res) => {
  const { error } = await supabaseAdmin.from('categories').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

// Courses (admin full)
r.get('/courses', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('courses')
    .select('*, categories(id, name, slug)')
    .order('updated_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

r.post('/courses', async (req, res) => {
  const body = req.body || {};
  if (!body.title || !body.slug) {
    return res.status(400).json({ error: 'title and slug required' });
  }
  const { data, error } = await supabaseAdmin
    .from('courses')
    .insert({
      title: body.title,
      slug: body.slug,
      description: body.description ?? null,
      thumbnail_url: body.thumbnail_url ?? null,
      category_id: body.category_id ?? null,
      teacher_id: body.teacher_id ?? null,
      published: !!body.published,
      price_cents: body.price_cents ?? 0,
      duration_hours: body.duration_hours ?? null,
      level: body.level ?? null,
      rating: body.rating ?? null,
      learners_count: body.learners_count ?? null,
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

r.patch('/courses/:id', async (req, res) => {
  const { id } = req.params;
  const allowed = [
    'title', 'slug', 'description', 'thumbnail_url', 'category_id', 'teacher_id',
    'published', 'price_cents', 'duration_hours', 'level', 'rating', 'learners_count',
  ];
  const patch = {};
  for (const k of allowed) {
    if (req.body[k] !== undefined) patch[k] = req.body[k];
  }
  const { data, error } = await supabaseAdmin
    .from('courses')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

r.delete('/courses/:id', async (req, res) => {
  const { error } = await supabaseAdmin.from('courses').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

// Course lectures
r.get('/courses/:courseId/lectures', async (req, res) => {
  const { courseId } = req.params;
  const { data, error } = await supabaseAdmin
    .from('course_lectures')
    .select('*')
    .eq('course_id', courseId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

r.post('/courses/:courseId/lectures', async (req, res) => {
  const { courseId } = req.params;
  const body = req.body || {};
  if (!body.title) return res.status(400).json({ error: 'title required' });
  let blocks = body.blocks;
  if (blocks !== undefined && !Array.isArray(blocks)) {
    return res.status(400).json({ error: 'blocks must be an array' });
  }
  if (Array.isArray(blocks) && blocks.length > 0) {
    blocks = blocks.map((b) => ({
      title: b?.title != null && String(b.title).trim() ? String(b.title).trim() : null,
      content: b?.content != null && String(b.content).trim() ? String(b.content).trim() : null,
      video_url: b?.video_url != null && String(b.video_url).trim() ? String(b.video_url).trim() : null,
    }));
  } else {
    blocks = [];
  }
  const useBlocks = blocks.some((b) => b.title || b.content || b.video_url);
  const { data, error } = await supabaseAdmin
    .from('course_lectures')
    .insert({
      course_id: courseId,
      title: body.title,
      content: useBlocks ? null : body.content ?? null,
      video_url: useBlocks ? null : body.video_url ?? null,
      blocks: useBlocks ? blocks : [],
      sort_order: body.sort_order ?? 0,
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

r.patch('/lectures/:id', async (req, res) => {
  const patch = {};
  for (const k of ['title', 'content', 'video_url', 'sort_order', 'blocks']) {
    if (req.body[k] !== undefined) {
      if (k === 'blocks') {
        if (!Array.isArray(req.body.blocks)) {
          return res.status(400).json({ error: 'blocks must be an array' });
        }
        patch.blocks = req.body.blocks.map((b) => ({
          title: b?.title != null && String(b.title).trim() ? String(b.title).trim() : null,
          content: b?.content != null && String(b.content).trim() ? String(b.content).trim() : null,
          video_url: b?.video_url != null && String(b.video_url).trim() ? String(b.video_url).trim() : null,
        }));
      } else {
        patch[k] = req.body[k];
      }
    }
  }
  if (
    patch.blocks !== undefined &&
    Array.isArray(patch.blocks) &&
    patch.blocks.some((b) => b.title || b.content || b.video_url)
  ) {
    patch.content = null;
    patch.video_url = null;
  }
  const { data, error } = await supabaseAdmin
    .from('course_lectures')
    .update(patch)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

r.delete('/lectures/:id', async (req, res) => {
  const { error } = await supabaseAdmin.from('course_lectures').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

// Course quizzes (questions: JSON array of { question, options[], correctIndex })
r.get('/courses/:courseId/quizzes', async (req, res) => {
  const { courseId } = req.params;
  const { data, error } = await supabaseAdmin
    .from('course_quizzes')
    .select('*')
    .eq('course_id', courseId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

r.post('/courses/:courseId/quizzes', async (req, res) => {
  const { courseId } = req.params;
  const body = req.body || {};
  if (!body.title) return res.status(400).json({ error: 'title required' });
  let questions = body.questions;
  if (questions === undefined) questions = [];
  if (!Array.isArray(questions)) return res.status(400).json({ error: 'questions must be an array' });
  const { data, error } = await supabaseAdmin
    .from('course_quizzes')
    .insert({
      course_id: courseId,
      title: body.title,
      description: body.description ?? null,
      questions,
      sort_order: body.sort_order ?? 0,
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

r.patch('/quizzes/:id', async (req, res) => {
  const patch = {};
  for (const k of ['title', 'description', 'questions', 'sort_order']) {
    if (req.body[k] !== undefined) {
      if (k === 'questions' && !Array.isArray(req.body[k])) {
        return res.status(400).json({ error: 'questions must be an array' });
      }
      patch[k] = req.body[k];
    }
  }
  const { data, error } = await supabaseAdmin
    .from('course_quizzes')
    .update(patch)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

r.delete('/quizzes/:id', async (req, res) => {
  const { error } = await supabaseAdmin.from('course_quizzes').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

// Team
r.post('/team', async (req, res) => {
  const { name, role_title, image_url, bio, sort_order } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const { data, error } = await supabaseAdmin
    .from('team_members')
    .insert({
      name,
      role_title: role_title ?? null,
      image_url: image_url ?? null,
      bio: bio ?? null,
      sort_order: sort_order ?? 0,
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

r.patch('/team/:id', async (req, res) => {
  const patch = {};
  for (const k of ['name', 'role_title', 'image_url', 'bio', 'sort_order']) {
    if (req.body[k] !== undefined) patch[k] = req.body[k];
  }
  const { data, error } = await supabaseAdmin
    .from('team_members')
    .update(patch)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

r.delete('/team/:id', async (req, res) => {
  const { error } = await supabaseAdmin.from('team_members').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

// Testimonials
r.post('/testimonials', async (req, res) => {
  const { author_name, author_title, content, image_url, rating, sort_order } = req.body || {};
  if (!author_name || !content) {
    return res.status(400).json({ error: 'author_name and content required' });
  }
  const { data, error } = await supabaseAdmin
    .from('testimonials')
    .insert({
      author_name,
      author_title: author_title ?? null,
      content,
      image_url: image_url ?? null,
      rating: rating ?? null,
      sort_order: sort_order ?? 0,
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

r.patch('/testimonials/:id', async (req, res) => {
  const patch = {};
  for (const k of ['author_name', 'author_title', 'content', 'image_url', 'rating', 'sort_order']) {
    if (req.body[k] !== undefined) patch[k] = req.body[k];
  }
  const { data, error } = await supabaseAdmin
    .from('testimonials')
    .update(patch)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

r.delete('/testimonials/:id', async (req, res) => {
  const { error } = await supabaseAdmin.from('testimonials').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

export default r;
