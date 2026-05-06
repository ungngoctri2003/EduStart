-- Seed dữ liệu lớp học (classes + học sinh + bài giảng + quiz + lịch).
-- Chạy sau khi đã apply migrations (kể cả user_role teacher).
-- Điều kiện: trong bảng public.profiles cần có ít nhất một user role = teacher và một vài user role = student
-- (tạo qua Bảng quản trị hoặc Supabase Auth + profiles).
-- An toàn khi chạy lại: lớp theo slug dùng ON CONFLICT DO NOTHING; nội dung con chỉ thêm khi chưa tồn tại.
-- course_id trỏ tới public.courses (seed.sql) — đồng bộ thêm cuối file nếu cần.

-- ---------------------------------------------------------------------------
-- Lớp 1: Lập trình Web cơ bản → khóa lap-trinh-web-co-ban
-- ---------------------------------------------------------------------------
INSERT INTO public.classes (name, slug, description, teacher_id, status, starts_at, ends_at, created_by, image_url, course_id)
SELECT
  'Lập trình Web cơ bản',
  'lop-lap-trinh-web-co-ban',
  'Thực hành HTML, CSS và JavaScript. Phù hợp người mới bắt đầu.',
  t.id,
  'active',
  (now() AT TIME ZONE 'UTC') - interval '7 days',
  (now() AT TIME ZONE 'UTC') + interval '90 days',
  COALESCE(a.id, t.id),
  '/img/course-1.png',
  co.id
FROM (SELECT id FROM public.profiles WHERE role = 'teacher' ORDER BY created_at ASC LIMIT 1) AS t
LEFT JOIN LATERAL (SELECT id FROM public.profiles WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1) AS a ON true
CROSS JOIN public.courses co
WHERE co.slug = 'lap-trinh-web-co-ban'
  AND EXISTS (SELECT 1 FROM public.profiles WHERE role = 'teacher' LIMIT 1)
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
    'Mang laptop đã cài VS Code.'
  ),
  (
    1,
    'Buổi 2 — CSS & Flexbox',
    (now() AT TIME ZONE 'UTC') + interval '9 days',
    (now() AT TIME ZONE 'UTC') + interval '9 days' + interval '2 hours',
    'Phòng lab A1',
    NULL,
    NULL
  )
) AS v(sort_order, title, starts_at, ends_at, location, meeting_url, notes)
WHERE c.slug = 'lop-lap-trinh-web-co-ban'
  AND NOT EXISTS (
    SELECT 1 FROM public.class_schedules s
    WHERE s.class_id = c.id AND s.title = v.title AND s.sort_order = v.sort_order
  );

-- ---------------------------------------------------------------------------
-- Lớp 2: Tiếng Anh giao tiếp (khóa tieng-anh-giao-tiep)
-- ---------------------------------------------------------------------------
INSERT INTO public.classes (name, slug, description, teacher_id, status, starts_at, ends_at, created_by, image_url, course_id)
SELECT
  'Tiếng Anh giao tiếp A2',
  'lop-tieng-anh-giao-tiep-a2',
  'Ôn phát âm, từ vựng và hội thoại hàng ngày.',
  t.id,
  'active',
  (now() AT TIME ZONE 'UTC'),
  (now() AT TIME ZONE 'UTC') + interval '120 days',
  COALESCE(a.id, t.id),
  '/img/course-2.png',
  co.id
FROM (SELECT id FROM public.profiles WHERE role = 'teacher' ORDER BY created_at ASC LIMIT 1) AS t
LEFT JOIN LATERAL (SELECT id FROM public.profiles WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1) AS a ON true
CROSS JOIN public.courses co
WHERE co.slug = 'tieng-anh-giao-tiep'
  AND EXISTS (SELECT 1 FROM public.profiles WHERE role = 'teacher' LIMIT 1)
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

-- ---------------------------------------------------------------------------
-- Bài làm quiz mẫu (chỉ thêm nếu chưa có bản ghi cùng học sinh + quiz)
-- ---------------------------------------------------------------------------
INSERT INTO public.class_quiz_attempts (student_id, quiz_id, class_id, correct, total, percent, submitted_at)
SELECT cs.student_id, q.id, c.id, 2, 2, 100, now() - interval '3 days'
FROM public.classes c
JOIN public.class_quizzes q ON q.class_id = c.id AND q.title = 'Kiểm tra nhanh HTML & CSS'
JOIN public.class_students cs ON cs.class_id = c.id
WHERE c.slug = 'lop-lap-trinh-web-co-ban'
  AND NOT EXISTS (
    SELECT 1 FROM public.class_quiz_attempts a
    WHERE a.student_id = cs.student_id AND a.quiz_id = q.id
  )
ORDER BY cs.joined_at
LIMIT 1;

INSERT INTO public.class_quiz_attempts (student_id, quiz_id, class_id, correct, total, percent, submitted_at)
SELECT cs.student_id, q.id, c.id, 1, 2, 50, now() - interval '1 day'
FROM public.classes c
JOIN public.class_quizzes q ON q.class_id = c.id AND q.title = 'Kiểm tra nhanh HTML & CSS'
JOIN public.class_students cs ON cs.class_id = c.id
WHERE c.slug = 'lop-lap-trinh-web-co-ban'
  AND NOT EXISTS (
    SELECT 1 FROM public.class_quiz_attempts a
    WHERE a.student_id = cs.student_id AND a.quiz_id = q.id
  )
ORDER BY cs.joined_at
LIMIT 1;

INSERT INTO public.class_quiz_attempts (student_id, quiz_id, class_id, correct, total, percent, submitted_at)
SELECT cs.student_id, q.id, c.id, 1, 1, 100, now() - interval '12 hours'
FROM public.classes c
JOIN public.class_quizzes q ON q.class_id = c.id AND q.title = 'Quiz từ vựng A2'
JOIN public.class_students cs ON cs.class_id = c.id
WHERE c.slug = 'lop-tieng-anh-giao-tiep-a2'
  AND NOT EXISTS (
    SELECT 1 FROM public.class_quiz_attempts a
    WHERE a.student_id = cs.student_id AND a.quiz_id = q.id
  )
ORDER BY cs.joined_at
LIMIT 1;

-- ---------------------------------------------------------------------------
-- Lớp 3: Python cho người mới (khóa intro-to-python)
-- ---------------------------------------------------------------------------
INSERT INTO public.classes (name, slug, description, teacher_id, status, starts_at, ends_at, created_by, image_url, course_id)
SELECT
  'Python cho người mới',
  'lop-python-cho-nguoi-moi',
  'Cú pháp cơ bản, biến, vòng lặp và hàm. Có bài tập nhỏ cuối mỗi buổi.',
  t.id,
  'active',
  (now() AT TIME ZONE 'UTC') - interval '3 days',
  (now() AT TIME ZONE 'UTC') + interval '60 days',
  COALESCE(a.id, t.id),
  '/img/course-3.png',
  co.id
FROM (SELECT id FROM public.profiles WHERE role = 'teacher' ORDER BY created_at ASC LIMIT 1) AS t
LEFT JOIN LATERAL (SELECT id FROM public.profiles WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1) AS a ON true
CROSS JOIN public.courses co
WHERE co.slug = 'intro-to-python'
  AND EXISTS (SELECT 1 FROM public.profiles WHERE role = 'teacher' LIMIT 1)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.class_students (class_id, student_id)
SELECT c.id, s.id
FROM public.classes c
CROSS JOIN LATERAL (
  SELECT id FROM public.profiles WHERE role = 'student' ORDER BY created_at ASC LIMIT 3
) AS s
WHERE c.slug = 'lop-python-cho-nguoi-moi'
ON CONFLICT (class_id, student_id) DO NOTHING;

INSERT INTO public.class_lectures (class_id, title, content, video_url, blocks, sort_order, published)
SELECT c.id, v.title, v.content, v.video_url, v.blocks::jsonb, v.sort_order, v.published
FROM public.classes c
CROSS JOIN (VALUES
  (
    0,
    'Giới thiệu Python và môi trường',
    'Cài Python 3.x và chạy REPL hoặc VS Code.',
    NULL,
    '[{"title": "Bài tập", "content": "In ra dòng chữ Hello, EduStart!", "video_url": ""}]',
    true
  ),
  (
    1,
    'Biến, kiểu dữ liệu và vòng lặp for',
    NULL,
    NULL,
    '[{"title": null, "content": "Ôn list, range() và vòng for.", "video_url": ""}]',
    true
  ),
  (
    2,
    'Hàm (def) và phạm vi biến',
    NULL,
    NULL,
    '[]',
    true
  )
) AS v(sort_order, title, content, video_url, blocks, published)
WHERE c.slug = 'lop-python-cho-nguoi-moi'
  AND NOT EXISTS (
    SELECT 1 FROM public.class_lectures cl
    WHERE cl.class_id = c.id AND cl.title = v.title AND cl.sort_order = v.sort_order
  );

INSERT INTO public.class_quizzes (class_id, title, description, questions, sort_order)
SELECT
  c.id,
  'Quiz Python cơ bản',
  'Kiểm tra nhanh kiến thức buổi đầu (seed).',
  '[
    {
      "question": "Hàm nào in ra màn hình trong Python 3?",
      "options": ["print()", "echo()", "console.log()", "say()"],
      "correctIndex": 0
    },
    {
      "question": "Từ khóa nào dùng để định nghĩa hàm?",
      "options": ["function", "def", "fn", "lambda"],
      "correctIndex": 1
    }
  ]'::jsonb,
  0
FROM public.classes c
WHERE c.slug = 'lop-python-cho-nguoi-moi'
  AND NOT EXISTS (
    SELECT 1 FROM public.class_quizzes q WHERE q.class_id = c.id AND q.title = 'Quiz Python cơ bản'
  );

INSERT INTO public.class_schedules (class_id, title, starts_at, ends_at, location, meeting_url, notes, sort_order)
SELECT c.id, v.title, v.starts_at, v.ends_at, v.location, v.meeting_url, v.notes, v.sort_order
FROM public.classes c
CROSS JOIN (VALUES
  (
    0,
    'Buổi 1 — Cài đặt & cú pháp',
    (now() AT TIME ZONE 'UTC') + interval '1 day',
    (now() AT TIME ZONE 'UTC') + interval '1 day' + interval '2 hours',
    'Lab B2',
    NULL,
    'Mang máy đã cài Python 3.11+.',
    0
  ),
  (
    1,
    'Buổi 2 — Vòng lặp & hàm',
    (now() AT TIME ZONE 'UTC') + interval '8 days',
    (now() AT TIME ZONE 'UTC') + interval '8 days' + interval '2 hours',
    'Lab B2',
    'https://meet.example.com/lop-python-2',
    NULL,
    1
  )
) AS v(sort_order, title, starts_at, ends_at, location, meeting_url, notes)
WHERE c.slug = 'lop-python-cho-nguoi-moi'
  AND NOT EXISTS (
    SELECT 1 FROM public.class_schedules s
    WHERE s.class_id = c.id AND s.title = v.title AND s.sort_order = v.sort_order
  );

-- Đồng bộ course_id nếu lớp đã tồn tại trước khi seed có cột course_id.
UPDATE public.classes cl
SET course_id = co.id
FROM public.courses co
WHERE cl.slug = 'lop-lap-trinh-web-co-ban' AND co.slug = 'lap-trinh-web-co-ban';

UPDATE public.classes cl
SET course_id = co.id
FROM public.courses co
WHERE cl.slug = 'lop-tieng-anh-giao-tiep-a2' AND co.slug = 'tieng-anh-giao-tiep';

UPDATE public.classes cl
SET course_id = co.id
FROM public.courses co
WHERE cl.slug = 'lop-python-cho-nguoi-moi' AND co.slug = 'intro-to-python';
