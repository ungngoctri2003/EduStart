-- Public course forum: posts + nested comments (guest or signed-in).

CREATE TABLE public.course_forum_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses (id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE public.course_forum_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.course_forum_posts (id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses (id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  parent_comment_id UUID REFERENCES public.course_forum_comments (id) ON DELETE CASCADE,
  content TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_course_forum_posts_course_created
  ON public.course_forum_posts (course_id, created_at DESC);
CREATE INDEX idx_course_forum_comments_post_created
  ON public.course_forum_comments (post_id, created_at ASC);
CREATE INDEX idx_course_forum_comments_parent
  ON public.course_forum_comments (parent_comment_id);

CREATE TRIGGER course_forum_posts_updated_at
  BEFORE UPDATE ON public.course_forum_posts
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER course_forum_comments_updated_at
  BEFORE UPDATE ON public.course_forum_comments
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.course_forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_forum_comments ENABLE ROW LEVEL SECURITY;

-- Public read.
CREATE POLICY course_forum_posts_select_all
  ON public.course_forum_posts
  FOR SELECT
  USING (true);

CREATE POLICY course_forum_comments_select_all
  ON public.course_forum_comments
  FOR SELECT
  USING (true);

-- Public insert:
-- - guest: author_id is null, must provide author_name
-- - signed-in: author_id must match auth.uid()
CREATE POLICY course_forum_posts_insert_public
  ON public.course_forum_posts
  FOR INSERT
  WITH CHECK (
    (author_id IS NULL AND length(trim(author_name)) > 0)
    OR (author_id = auth.uid())
  );

CREATE POLICY course_forum_comments_insert_public
  ON public.course_forum_comments
  FOR INSERT
  WITH CHECK (
    (author_id IS NULL AND length(trim(author_name)) > 0)
    OR (author_id = auth.uid())
  );

-- Only signed-in owners can edit/delete their own rows.
CREATE POLICY course_forum_posts_update_own
  ON public.course_forum_posts
  FOR UPDATE
  USING (author_id IS NOT NULL AND author_id = auth.uid())
  WITH CHECK (author_id IS NOT NULL AND author_id = auth.uid());

CREATE POLICY course_forum_comments_update_own
  ON public.course_forum_comments
  FOR UPDATE
  USING (author_id IS NOT NULL AND author_id = auth.uid())
  WITH CHECK (author_id IS NOT NULL AND author_id = auth.uid());

CREATE POLICY course_forum_posts_delete_own
  ON public.course_forum_posts
  FOR DELETE
  USING (author_id IS NOT NULL AND author_id = auth.uid());

CREATE POLICY course_forum_comments_delete_own
  ON public.course_forum_comments
  FOR DELETE
  USING (author_id IS NOT NULL AND author_id = auth.uid());
