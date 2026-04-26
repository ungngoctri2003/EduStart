-- Seed dữ liệu lớp học (classes + học sinh + bài giảng + quiz + lịch).
-- Chạy sau khi đã apply migrations (kể cả user_role teacher).
-- Điều kiện: trong bảng public.profiles cần có ít nhất một user role = teacher và một vài user role = student
-- (tạo qua Bảng quản trị hoặc Supabase Auth + profiles).
-- An toàn khi chạy lại: lớp theo slug dùng ON CONFLICT DO NOTHING; nội dung con chỉ thêm khi chưa tồn tại.

-- ---------------------------------------------------------------------------
-- Lớp 1: Lập trình Web cơ bản
-- ---------------------------------------------------------------------------
INSERT INTO public.classes (name, slug, description, teacher_id, status, starts_at, ends_at, created_by)
SELECT
  'Lập trình Web cơ bản',
  'lop-lap-trinh-web-co-ban',
  'Thực hành HTML, CSS và JavaScript. Phù hợp người mới bắt đầu.',
  t.id,
  'active',
  (now() AT TIME ZONE 'UTC') - interval '7 days',
  (now() AT TIME ZONE 'UTC') + interval '90 days',
  COALESCE(a.id, t.id)
FROM (SELECT id FROM public.profiles WHERE role = 'teacher' ORDER BY created_at ASC LIMIT 1) AS t
LEFT JOIN LATERAL (SELECT id FROM public.profiles WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1) AS a ON true
WHERE EXISTS (SELECT 1 FROM public.profiles WHERE role = 'teacher' LIMIT 1)
ON CONFLICT (slug) DO NOTHING;

-- Gán tối đa 4 học sinh đầu tiên vào lớp 1
INSERT INTO public.class_students (class_id, student_id)
SELECT c.id, s.id
FROM public.classes c
CROSS JOIN LATERAL (
  SELECT id FROM public.profiles WHERE role = 'student' ORDER BY created_at ASC LIMIT 4
) AS s
WHERE c.slug = 'lop-lap-trinh-web-co-ban'
ON CONFLICT (class_id, student_id) DO NOTHING;

-- Bài giảng lớp 1
INSERT INTO public.class_lectures (class_id, title, content, video_url, blocks, sort_order, published)
SELECT c.id, v.title, v.content, v.video_url, v.blocks::jsonb, v.sort_order, v.published
FROM public.classes c
CROSS JOIN (VALUES
  (
    0,
    'Chào mừng và hướng dẫn',
    'Trong lớp này chúng ta sẽ làm quen với cấu trúc trang web và công cụ phát triển.',
    '',
    '[{"title": null, "content": "Hãy chuẩn bị trình duyệt Chrome hoặc Firefox và một editor code (VS Code).", "video_url": ""}]',
    true
  ),
  (
    1,
    'HTML: cấu trúc tài liệu',
    NULL,
    NULL,
    '[{"title": "Thẻ cơ bản", "content": "HTML mô tả khung xương của trang: thẻ html, head, body, các thẻ tiêu đề và đoạn văn.", "video_url": ""}]',
    true
  ),
  (
    2,
    'CSS: giao diện và bố cục',
    NULL,
    NULL,
    '[{"title": "Selectors", "content": "CSS chọn phần tử theo class, id và kế thừa style.", "video_url": ""},{"title": "Flexbox", "content": "Dùng flex để căn hàng và cột linh hoạt.", "video_url": ""}]',
    true
  )
) AS v(sort_order, title, content, video_url, blocks, published)
WHERE c.slug = 'lop-lap-trinh-web-co-ban'
  AND NOT EXISTS (
    SELECT 1 FROM public.class_lectures cl
    WHERE cl.class_id = c.id AND cl.title = v.title AND cl.sort_order = v.sort_order
  );

-- Quiz lớp 1
INSERT INTO public.class_quizzes (class_id, title, description, questions, sort_order)
SELECT
  c.id,
  'Kiểm tra nhanh HTML & CSS',
  'Trắc nghiệm ngắn (demo seed).',
  '[
    {
      "question": "Thẻ nào dùng cho đoạn văn trong HTML5?",
      "options": ["<p>", "<paragraph>", "<text>", "<para>"],
      "correctIndex": 0
    },
    {
      "question": "Thuộc tính CSS nào đổi màu chữ?",
      "options": ["text-color", "font-color", "color", "foreground"],
      "correctIndex": 2
    }
  ]'::jsonb,
  0
FROM public.classes c
WHERE c.slug = 'lop-lap-trinh-web-co-ban'
  AND NOT EXISTS (
    SELECT 1 FROM public.class_quizzes q WHERE q.class_id = c.id AND q.title = 'Kiểm tra nhanh HTML & CSS'
  );

-- Lịch học lớp 1
INSERT INTO public.class_schedules (class_id, title, starts_at, ends_at, location, meeting_url, notes, sort_order)
SELECT c.id, v.title, v.starts_at, v.ends_at, v.location, v.meeting_url, v.notes, v.sort_order
FROM public.classes c
CROSS JOIN (VALUES
  (
    0,
    'Buổi 1 — Làm quen & HTML',
    (now() AT TIME ZONE 'UTC') + interval '2 days',
    (now() AT TIME ZONE 'UTC') + interval '2 days' + interval '2 hours',
    'Phòng lab A1',
    'https://meet.example.com/lop-web-buoi-1',
    'Mang laptop đã cài VS Code.',
    0
  ),
  (
    1,
    'Buổi 2 — CSS & Flexbox',
    (now() AT TIME ZONE 'UTC') + interval '9 days',
    (now() AT TIME ZONE 'UTC') + interval '9 days' + interval '2 hours',
    'Phòng lab A1',
    NULL,
    NULL,
    1
  )
) AS v(sort_order, title, starts_at, ends_at, location, meeting_url, notes)
WHERE c.slug = 'lop-lap-trinh-web-co-ban'
  AND NOT EXISTS (
    SELECT 1 FROM public.class_schedules s
    WHERE s.class_id = c.id AND s.title = v.title AND s.sort_order = v.sort_order
  );

-- ---------------------------------------------------------------------------
-- Lớp 2: Tiếng Anh giao tiếp (lớp thứ hai, cùng giáo viên nếu chỉ có 1 GV)
-- ---------------------------------------------------------------------------
INSERT INTO public.classes (name, slug, description, teacher_id, status, starts_at, ends_at, created_by)
SELECT
  'Tiếng Anh giao tiếp A2',
  'lop-tieng-anh-giao-tiep-a2',
  'Ôn phát âm, từ vựng và hội thoại hàng ngày.',
  t.id,
  'active',
  (now() AT TIME ZONE 'UTC'),
  (now() AT TIME ZONE 'UTC') + interval '120 days',
  COALESCE(a.id, t.id)
FROM (SELECT id FROM public.profiles WHERE role = 'teacher' ORDER BY created_at ASC LIMIT 1) AS t
LEFT JOIN LATERAL (SELECT id FROM public.profiles WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1) AS a ON true
WHERE EXISTS (SELECT 1 FROM public.profiles WHERE role = 'teacher' LIMIT 1)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.class_students (class_id, student_id)
SELECT c.id, s.id
FROM public.classes c
CROSS JOIN LATERAL (
  SELECT id FROM public.profiles WHERE role = 'student' ORDER BY created_at ASC LIMIT 2
) AS s
WHERE c.slug = 'lop-tieng-anh-giao-tiep-a2'
ON CONFLICT (class_id, student_id) DO NOTHING;

INSERT INTO public.class_lectures (class_id, title, content, video_url, blocks, sort_order, published)
SELECT c.id, v.title, v.content, v.video_url, v.blocks::jsonb, v.sort_order, v.published
FROM public.classes c
CROSS JOIN (VALUES
  (
    0,
    'Ice breaking & mục tiêu lớp',
    'Làm quen và thống nhất lịch ôn tập.',
    '',
    '[]',
    true
  ),
  (
    1,
    'Chủ đề: Giới thiệu bản thân',
    NULL,
    NULL,
    '[{"title": null, "content": "Practice: Hello, my name is… I work/study at…", "video_url": ""}]',
    true
  )
) AS v(sort_order, title, content, video_url, blocks, published)
WHERE c.slug = 'lop-tieng-anh-giao-tiep-a2'
  AND NOT EXISTS (
    SELECT 1 FROM public.class_lectures cl
    WHERE cl.class_id = c.id AND cl.title = v.title AND cl.sort_order = v.sort_order
  );

INSERT INTO public.class_quizzes (class_id, title, description, questions, sort_order)
SELECT
  c.id,
  'Quiz từ vựng A2',
  'Chọn nghĩa đúng (seed).',
  '[
    {
      "question": "“Schedule” gần nghĩa nhất với:",
      "options": ["Lịch trình", "Ghế", "Cửa sổ", "Bút"],
      "correctIndex": 0
    }
  ]'::jsonb,
  0
FROM public.classes c
WHERE c.slug = 'lop-tieng-anh-giao-tiep-a2'
  AND NOT EXISTS (
    SELECT 1 FROM public.class_quizzes q WHERE q.class_id = c.id AND q.title = 'Quiz từ vựng A2'
  );

INSERT INTO public.class_schedules (class_id, title, starts_at, ends_at, location, meeting_url, notes, sort_order)
SELECT
  c.id,
  'Buổi học định kỳ',
  (now() AT TIME ZONE 'UTC') + interval '1 day',
  (now() AT TIME ZONE 'UTC') + interval '1 day' + interval '90 minutes',
  'Online',
  'https://meet.example.com/lop-english',
  'Vào đúng giờ, bật mic khi được gọi.',
  0
FROM public.classes c
WHERE c.slug = 'lop-tieng-anh-giao-tiep-a2'
  AND NOT EXISTS (
    SELECT 1 FROM public.class_schedules s
    WHERE s.class_id = c.id AND s.title = 'Buổi học định kỳ' AND s.sort_order = 0
  );
