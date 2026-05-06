-- Khóa học catalog hoàn chỉnh + 2 lớp khai giảng (cùng course_id).
-- Chạy sau categories; cần ít nhất một profile role = teacher (giống seed_classes).
-- Idempotent: khóa theo slug ON CONFLICT DO NOTHING; lớp + nội dung con chỉ thêm khi chưa có.

INSERT INTO public.courses (
  title,
  slug,
  description,
  thumbnail_url,
  published,
  price_cents,
  duration_hours,
  level,
  rating,
  learners_count,
  category_id,
  teacher_id
)
SELECT
  'Lập trình Full-stack cơ bản (JavaScript)',
  'lap-trinh-fullstack-can-ban',
  'Khóa tổng hợp: nền tảng web (HTML/CSS), JavaScript hiện đại, nhập môn React và gọi API. Phù hợp người mới, có bài tập theo từng phần. Học viên đăng ký lớp riêng để học theo lịch, tương tác giáo viên và theo dõi tiến độ lớp.',
  '/img/course-1.png',
  true,
  0,
  42.0,
  'Beginner',
  4.8,
  '500+',
  c.id,
  t.id
FROM public.categories c
CROSS JOIN (
  SELECT id FROM public.profiles WHERE role = 'teacher' ORDER BY created_at ASC LIMIT 1
) AS t
WHERE c.slug = 'python'
  AND EXISTS (SELECT 1 FROM public.profiles WHERE role = 'teacher' LIMIT 1)
ON CONFLICT (slug) DO NOTHING;

-- Bài giảng khóa học (nội dung tự học / enroll course)
INSERT INTO public.course_lectures (course_id, title, content, video_url, blocks, sort_order)
SELECT co.id, v.title, v.content, v.video_url, v.blocks::jsonb, v.sort_order
FROM public.courses co
CROSS JOIN (VALUES
  (
    0,
    'Mở đầu: công cụ và môi trường',
    'Cài đặt VS Code, Git, Node.js LTS. Khái niệm client/server và quy trình dev hiện đại.',
    NULL,
    '[{"title": "Checklist", "content": "Tạo thư mục dự án, mở terminal tích hợp, chạy npm init khi bắt đầu module JS.", "video_url": ""}]'::text
  ),
  (
    1,
    'HTML & CSS: layout và component nhỏ',
    'Semantic HTML5, Flexbox, biến CSS và một trang landing đơn giản.',
    NULL,
    '[{"title": "Bài tập", "content": "Dựng khung hero + 3 thẻ feature responsive.", "video_url": ""}]'::text
  ),
  (
    2,
    'JavaScript: module, fetch và async',
    'ES modules, xử lý bất đồng bộ, gọi API JSON public và hiển thị dữ liệu.',
    NULL,
    '[]'::text
  )
) AS v(sort_order, title, content, video_url, blocks)
WHERE co.slug = 'lap-trinh-fullstack-can-ban'
  AND NOT EXISTS (
    SELECT 1 FROM public.course_lectures cl
    WHERE cl.course_id = co.id AND cl.title = v.title AND cl.sort_order = v.sort_order
  );

-- Quiz khóa học
INSERT INTO public.course_quizzes (course_id, title, description, questions, sort_order)
SELECT
  co.id,
  'Kiểm tra nhanh HTML & JS',
  'Trắc nghiệm ôn tập (seed demo).',
  '[
    {"question": "Thẻ semantic nào thường dùng cho vùng nội dung chính?", "options": ["<main>", "<sidebar>", "<box>", "<content>"], "correctIndex": 0},
    {"question": "Promise resolve được xử lý với?", "options": [".then()", ".catch()", ".finally() chỉ", "Không có"],
     "correctIndex": 0}
  ]'::jsonb,
  0
FROM public.courses co
WHERE co.slug = 'lap-trinh-fullstack-can-ban'
  AND NOT EXISTS (
    SELECT 1 FROM public.course_quizzes q WHERE q.course_id = co.id AND q.title = 'Kiểm tra nhanh HTML & JS'
  );

-- Lớp 1: ca sáng
INSERT INTO public.classes (
  name, slug, description, teacher_id, status, starts_at, ends_at, created_by, image_url, course_id, price_cents
)
SELECT
  'Full-stack ca sáng — K1/2026',
  'lop-fullstack-ca-sang-k1-2026',
  'Lịch sáng T2–T6, 9h–11h. Thực hành trực tiếp, code review hàng tuần.',
  t.id,
  'active',
  (now() AT TIME ZONE 'UTC') + interval '14 days',
  (now() AT TIME ZONE 'UTC') + interval '120 days',
  COALESCE(a.id, t.id),
  '/img/course-1.png',
  co.id,
  0
FROM public.courses co
CROSS JOIN (SELECT id FROM public.profiles WHERE role = 'teacher' ORDER BY created_at ASC LIMIT 1) AS t
LEFT JOIN LATERAL (SELECT id FROM public.profiles WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1) AS a ON true
WHERE co.slug = 'lap-trinh-fullstack-can-ban'
  AND EXISTS (SELECT 1 FROM public.profiles WHERE role = 'teacher' LIMIT 1)
ON CONFLICT (slug) DO NOTHING;

-- Lớp 2: ca tối
INSERT INTO public.classes (
  name, slug, description, teacher_id, status, starts_at, ends_at, created_by, image_url, course_id, price_cents
)
SELECT
  'Full-stack ca tối — K1/2026',
  'lop-fullstack-ca-toi-k1-2026',
  'Lịch tối T3–T7, 19h–21h. Phù hợp đi làm ban ngày.',
  t.id,
  'active',
  (now() AT TIME ZONE 'UTC') + interval '21 days',
  (now() AT TIME ZONE 'UTC') + interval '130 days',
  COALESCE(a.id, t.id),
  '/img/course-2.png',
  co.id,
  0
FROM public.courses co
CROSS JOIN (SELECT id FROM public.profiles WHERE role = 'teacher' ORDER BY created_at ASC LIMIT 1) AS t
LEFT JOIN LATERAL (SELECT id FROM public.profiles WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1) AS a ON true
WHERE co.slug = 'lap-trinh-fullstack-can-ban'
  AND EXISTS (SELECT 1 FROM public.profiles WHERE role = 'teacher' LIMIT 1)
ON CONFLICT (slug) DO NOTHING;

-- Nội dung lớp sáng
INSERT INTO public.class_lectures (class_id, title, content, video_url, blocks, sort_order, published)
SELECT c.id, v.title, v.content, v.video_url, v.blocks::jsonb, v.sort_order, v.published
FROM public.classes c
CROSS JOIN (VALUES
  (
    0,
    'Orientation & quy ước lớp',
    'Slack/Discord nhóm, nộp bài, điểm danh.',
    NULL,
    '[{"title": null, "content": "Đọc syllabus khóa và checklist tuần 1.", "video_url": ""}]',
    true
  ),
  (
    1,
    'Pair programming tuần 1',
    NULL,
    NULL,
    '[{"title": "Bài tập", "content": "Cặp đôi hoàn thành landing page nhỏ.", "video_url": ""}]',
    true
  )
) AS v(sort_order, title, content, video_url, blocks, published)
WHERE c.slug = 'lop-fullstack-ca-sang-k1-2026'
  AND NOT EXISTS (
    SELECT 1 FROM public.class_lectures cl
    WHERE cl.class_id = c.id AND cl.title = v.title AND cl.sort_order = v.sort_order
  );

INSERT INTO public.class_quizzes (class_id, title, description, questions, sort_order)
SELECT
  c.id,
  'Quiz tuần 1 — HTML semantics',
  'Kiểm tra nhanh sau buổi 2.',
  '[{"question": "Thuộc tính nào hỗ trợ gợi ý ô input?", "options": ["placeholder", "hint", "tip", "preview"], "correctIndex": 0}]'::jsonb,
  0
FROM public.classes c
WHERE c.slug = 'lop-fullstack-ca-sang-k1-2026'
  AND NOT EXISTS (
    SELECT 1 FROM public.class_quizzes q WHERE q.class_id = c.id AND q.title = 'Quiz tuần 1 — HTML semantics'
  );

INSERT INTO public.class_schedules (class_id, title, starts_at, ends_at, location, meeting_url, notes, sort_order)
SELECT c.id, v.title, v.starts_at, v.ends_at, v.location, v.meeting_url, v.notes, v.sort_order
FROM public.classes c
CROSS JOIN (VALUES
  (
    0,
    'Buổi 1 — Orientation',
    (now() AT TIME ZONE 'UTC') + interval '16 days' + interval '9 hours',
    (now() AT TIME ZONE 'UTC') + interval '16 days' + interval '11 hours',
    'Phòng Lab Online',
    'https://meet.example.com/fullstack-sang-1',
    'Chuẩn bị VS Code.'
  ),
  (
    1,
    'Buổi 2 — HTML/CSS checkpoint',
    (now() AT TIME ZONE 'UTC') + interval '18 days' + interval '9 hours',
    (now() AT TIME ZONE 'UTC') + interval '18 days' + interval '11 hours',
    'Phòng Lab Online',
    NULL::text,
    NULL::text
  )
) AS v(sort_order, title, starts_at, ends_at, location, meeting_url, notes)
WHERE c.slug = 'lop-fullstack-ca-sang-k1-2026'
  AND NOT EXISTS (
    SELECT 1 FROM public.class_schedules s
    WHERE s.class_id = c.id AND s.title = v.title AND s.sort_order = v.sort_order
  );

-- Nội dung lớp tối
INSERT INTO public.class_lectures (class_id, title, content, video_url, blocks, sort_order, published)
SELECT c.id, v.title, v.content, v.video_url, v.blocks::jsonb, v.sort_order, v.published
FROM public.classes c
CROSS JOIN (VALUES
  (
    0,
    'Orientation ca tối',
    'Lịch học tối, timezone và cách xem recording.',
    NULL,
    '[]',
    true
  ),
  (
    1,
    'Thực hành DOM & sự kiện',
    NULL,
    NULL,
    '[{"title": null, "content": "Viết script lắng nghe click, đổi nội dung một thẻ.", "video_url": ""}]',
    true
  )
) AS v(sort_order, title, content, video_url, blocks, published)
WHERE c.slug = 'lop-fullstack-ca-toi-k1-2026'
  AND NOT EXISTS (
    SELECT 1 FROM public.class_lectures cl
    WHERE cl.class_id = c.id AND cl.title = v.title AND cl.sort_order = v.sort_order
  );

INSERT INTO public.class_quizzes (class_id, title, description, questions, sort_order)
SELECT
  c.id,
  'Quiz DOM cơ bản',
  'Chọn đáp án đúng (seed).',
  '[{"question": "Phương thức nào chọn phần tử theo id?", "options": ["document.querySelector(\"#x\")", "document.byId", "getId()", "selectId()"], "correctIndex": 0}]'::jsonb,
  0
FROM public.classes c
WHERE c.slug = 'lop-fullstack-ca-toi-k1-2026'
  AND NOT EXISTS (
    SELECT 1 FROM public.class_quizzes q WHERE q.class_id = c.id AND q.title = 'Quiz DOM cơ bản'
  );

INSERT INTO public.class_schedules (class_id, title, starts_at, ends_at, location, meeting_url, notes, sort_order)
SELECT c.id, v.title, v.starts_at, v.ends_at, v.location, v.meeting_url, v.notes, v.sort_order
FROM public.classes c
CROSS JOIN (VALUES
  (
    0,
    'Buổi 1 — Orientation (tối)',
    (now() AT TIME ZONE 'UTC') + interval '22 days' + interval '19 hours',
    (now() AT TIME ZONE 'UTC') + interval '22 days' + interval '21 hours',
    'Online',
    'https://meet.example.com/fullstack-toi-1',
    NULL::text
  ),
  (
    1,
    'Buổi 2 — DOM & events',
    (now() AT TIME ZONE 'UTC') + interval '24 days' + interval '19 hours',
    (now() AT TIME ZONE 'UTC') + interval '24 days' + interval '21 hours',
    'Online',
    'https://meet.example.com/fullstack-toi-2',
    NULL::text
  )
) AS v(sort_order, title, starts_at, ends_at, location, meeting_url, notes)
WHERE c.slug = 'lop-fullstack-ca-toi-k1-2026'
  AND NOT EXISTS (
    SELECT 1 FROM public.class_schedules s
    WHERE s.class_id = c.id AND s.title = v.title AND s.sort_order = v.sort_order
  );
