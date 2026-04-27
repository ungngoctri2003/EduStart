-- Ảnh bìa lớp học (URL tuyệt đối hoặc đường dẫn tĩnh như /img/...).
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN public.classes.image_url IS 'Cover image URL for the class (optional).';
