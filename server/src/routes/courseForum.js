import { Router } from 'express';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../supabase.js';

const r = Router();

function sanitizeBodyText(value, { min = 1, max = 4000 } = {}) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (text.length < min) return null;
  return text.slice(0, max);
}

function resolveAuthor(req, guestNameRaw) {
  if (req.user?.id) {
    const fallback = req.user.full_name?.trim() || req.user.email || 'Học viên';
    return { author_id: req.user.id, author_name: fallback };
  }
  const guest = sanitizeBodyText(guestNameRaw, { min: 2, max: 80 });
  if (!guest) return { error: 'guest_name is required (2-80 chars) for anonymous posting' };
  return { author_id: null, author_name: guest };
}

async function loadPublishedCourseBySlug(slug) {
  const { data, error } = await supabaseAdmin
    .from('courses')
    .select('id, slug, title, published')
    .eq('slug', slug)
    .maybeSingle();
  if (error) return { error: error.message, status: 500 };
  if (!data || !data.published) return { error: 'Course not found', status: 404 };
  return { course: data };
}

r.get('/courses/:slug/posts', optionalAuth, async (req, res) => {
  const limit = Math.min(50, Math.max(1, Number.parseInt(String(req.query.limit || '20'), 10) || 20));
  const offset = Math.max(0, Number.parseInt(String(req.query.offset || '0'), 10) || 0);
  const end = offset + limit - 1;
  try {
    const gate = await loadPublishedCourseBySlug(req.params.slug);
    if (gate.error) return res.status(gate.status).json({ error: gate.error });

    const { data: posts, error } = await supabaseAdmin
      .from('course_forum_posts')
      .select('id, course_id, author_id, author_name, content, created_at, updated_at, deleted_at')
      .eq('course_id', gate.course.id)
      .order('created_at', { ascending: false })
      .range(offset, end);
    if (error) return res.status(500).json({ error: error.message });

    const postIds = (posts || []).map((p) => p.id);
    let commentCounts = new Map();
    if (postIds.length > 0) {
      const { data: comments, error: cErr } = await supabaseAdmin
        .from('course_forum_comments')
        .select('post_id')
        .in('post_id', postIds);
      if (cErr) return res.status(500).json({ error: cErr.message });
      commentCounts = new Map();
      for (const row of comments || []) {
        commentCounts.set(row.post_id, (commentCounts.get(row.post_id) || 0) + 1);
      }
    }

    const items = (posts || []).map((row) => ({
      ...row,
      comment_count: commentCounts.get(row.id) || 0,
      can_edit: Boolean(req.user?.id && row.author_id && row.author_id === req.user.id),
    }));
    res.json({ items, limit, offset });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Internal error' });
  }
});

r.get('/courses/:slug/posts/:postId/comments', optionalAuth, async (req, res) => {
  try {
    const gate = await loadPublishedCourseBySlug(req.params.slug);
    if (gate.error) return res.status(gate.status).json({ error: gate.error });

    const { data: post, error: pErr } = await supabaseAdmin
      .from('course_forum_posts')
      .select('id, course_id')
      .eq('id', req.params.postId)
      .eq('course_id', gate.course.id)
      .maybeSingle();
    if (pErr) return res.status(500).json({ error: pErr.message });
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const { data: comments, error } = await supabaseAdmin
      .from('course_forum_comments')
      .select('id, post_id, course_id, author_id, author_name, parent_comment_id, content, created_at, updated_at, deleted_at')
      .eq('course_id', gate.course.id)
      .eq('post_id', post.id)
      .order('created_at', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });

    const items = (comments || []).map((row) => ({
      ...row,
      can_edit: Boolean(req.user?.id && row.author_id && row.author_id === req.user.id),
    }));
    res.json({ items });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Internal error' });
  }
});

r.post('/courses/:slug/posts', optionalAuth, async (req, res) => {
  try {
    const gate = await loadPublishedCourseBySlug(req.params.slug);
    if (gate.error) return res.status(gate.status).json({ error: gate.error });

    const content = sanitizeBodyText(req.body?.content, { min: 2, max: 6000 });
    if (!content) return res.status(400).json({ error: 'content is required (2-6000 chars)' });
    const author = resolveAuthor(req, req.body?.guest_name);
    if (author.error) return res.status(400).json({ error: author.error });

    const { data, error } = await supabaseAdmin
      .from('course_forum_posts')
      .insert({
        course_id: gate.course.id,
        author_id: author.author_id,
        author_name: author.author_name,
        content,
      })
      .select('id, course_id, author_id, author_name, content, created_at, updated_at, deleted_at')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Internal error' });
  }
});

r.post('/courses/:slug/posts/:postId/comments', optionalAuth, async (req, res) => {
  try {
    const gate = await loadPublishedCourseBySlug(req.params.slug);
    if (gate.error) return res.status(gate.status).json({ error: gate.error });

    const { data: post, error: pErr } = await supabaseAdmin
      .from('course_forum_posts')
      .select('id, course_id')
      .eq('id', req.params.postId)
      .eq('course_id', gate.course.id)
      .maybeSingle();
    if (pErr) return res.status(500).json({ error: pErr.message });
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const content = sanitizeBodyText(req.body?.content, { min: 1, max: 4000 });
    if (!content) return res.status(400).json({ error: 'content is required (1-4000 chars)' });
    const author = resolveAuthor(req, req.body?.guest_name);
    if (author.error) return res.status(400).json({ error: author.error });

    let parentCommentId = req.body?.parent_comment_id || null;
    if (parentCommentId) {
      const { data: parent, error: parErr } = await supabaseAdmin
        .from('course_forum_comments')
        .select('id')
        .eq('id', parentCommentId)
        .eq('post_id', post.id)
        .eq('course_id', gate.course.id)
        .maybeSingle();
      if (parErr) return res.status(500).json({ error: parErr.message });
      if (!parent) return res.status(400).json({ error: 'Invalid parent_comment_id' });
    } else {
      parentCommentId = null;
    }

    const { data, error } = await supabaseAdmin
      .from('course_forum_comments')
      .insert({
        post_id: post.id,
        course_id: gate.course.id,
        author_id: author.author_id,
        author_name: author.author_name,
        parent_comment_id: parentCommentId,
        content,
      })
      .select('id, post_id, course_id, author_id, author_name, parent_comment_id, content, created_at, updated_at, deleted_at')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Internal error' });
  }
});

r.patch('/posts/:postId', requireAuth, async (req, res) => {
  const content = sanitizeBodyText(req.body?.content, { min: 2, max: 6000 });
  if (!content) return res.status(400).json({ error: 'content is required (2-6000 chars)' });
  const { data: post, error: pErr } = await supabaseAdmin
    .from('course_forum_posts')
    .select('id, author_id, deleted_at')
    .eq('id', req.params.postId)
    .maybeSingle();
  if (pErr) return res.status(500).json({ error: pErr.message });
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (!post.author_id || post.author_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  if (post.deleted_at) return res.status(400).json({ error: 'Post already deleted' });
  const { data, error } = await supabaseAdmin
    .from('course_forum_posts')
    .update({ content })
    .eq('id', post.id)
    .select('id, content, updated_at')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

r.patch('/comments/:commentId', requireAuth, async (req, res) => {
  const content = sanitizeBodyText(req.body?.content, { min: 1, max: 4000 });
  if (!content) return res.status(400).json({ error: 'content is required (1-4000 chars)' });
  const { data: item, error: pErr } = await supabaseAdmin
    .from('course_forum_comments')
    .select('id, author_id, deleted_at')
    .eq('id', req.params.commentId)
    .maybeSingle();
  if (pErr) return res.status(500).json({ error: pErr.message });
  if (!item) return res.status(404).json({ error: 'Comment not found' });
  if (!item.author_id || item.author_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  if (item.deleted_at) return res.status(400).json({ error: 'Comment already deleted' });
  const { data, error } = await supabaseAdmin
    .from('course_forum_comments')
    .update({ content })
    .eq('id', item.id)
    .select('id, content, updated_at')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

r.delete('/posts/:postId', requireAuth, async (req, res) => {
  const { data: post, error: pErr } = await supabaseAdmin
    .from('course_forum_posts')
    .select('id, author_id, deleted_at')
    .eq('id', req.params.postId)
    .maybeSingle();
  if (pErr) return res.status(500).json({ error: pErr.message });
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (!post.author_id || post.author_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  if (post.deleted_at) return res.json({ ok: true });
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('course_forum_posts')
    .update({ deleted_at: now, content: null })
    .eq('id', post.id);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
});

r.delete('/comments/:commentId', requireAuth, async (req, res) => {
  const { data: item, error: pErr } = await supabaseAdmin
    .from('course_forum_comments')
    .select('id, author_id, deleted_at')
    .eq('id', req.params.commentId)
    .maybeSingle();
  if (pErr) return res.status(500).json({ error: pErr.message });
  if (!item) return res.status(404).json({ error: 'Comment not found' });
  if (!item.author_id || item.author_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  if (item.deleted_at) return res.json({ ok: true });
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('course_forum_comments')
    .update({ deleted_at: now, content: null })
    .eq('id', item.id);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
});

export default r;
