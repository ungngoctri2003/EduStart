-- Optional seed (run once after migration). Paths assume static files served at /img/...
INSERT INTO public.categories (name, slug, image_url, sort_order) VALUES
  ('Microsoft Excel', 'microsoft-excel', '/img/cat1.png', 1),
  ('AWS', 'aws', '/img/cat2.png', 2),
  ('Python', 'python', '/img/cat3.png', 3),
  ('Java', 'java', '/img/cat4.png', 4)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.courses (title, slug, description, thumbnail_url, published, price_cents, duration_hours, level, rating, learners_count, category_id)
SELECT 'Intro to Python', 'intro-to-python', 'Learn Python basics.', '/img/course-1.png', true, 0, 2.0, 'Beginner', 4.5, '10K+', c.id
FROM public.categories c WHERE c.slug = 'python' LIMIT 1
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.testimonials (author_name, author_title, content, rating, sort_order) VALUES
  ('Alex K.', 'Student', 'Great platform and courses!', 5, 1),
  ('Sam R.', 'Professional', 'Clear explanations and practical examples.', 5, 2);

-- Lớp học: chạy `supabase db reset` sẽ nạp file này bằng psql (hỗ trợ \ir).
-- Trong Supabase Dashboard → SQL Editor, nếu \ir lỗi, chạy riêng nội dung `supabase/seed_classes.sql`.
\ir seed_classes.sql
