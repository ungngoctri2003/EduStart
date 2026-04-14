-- Optional multi-part lesson content per lecture (blocks of text + video)
ALTER TABLE public.course_lectures
  ADD COLUMN IF NOT EXISTS blocks JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.course_lectures.blocks IS 'Ordered array of { title?, content?, video_url? }; legacy content/video_url still supported when blocks is empty.';
