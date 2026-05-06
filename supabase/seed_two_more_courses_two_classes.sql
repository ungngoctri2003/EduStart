-- Thêm 2 khóa học, mỗi khóa 2 lớp (course_id + nội dung lớp).
-- Cùng điều kiện với seed_course_with_two_classes.sql: categories + ít nhất 1 teacher.

-- ---------------------------------------------------------------------------
-- Khóa 1: Phân tích dữ liệu với Excel (category microsoft-excel)
-- ---------------------------------------------------------------------------
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
  'Phân tích dữ liệu với Excel',
  'phan-tich-du-lieu-excel',
  'PivotTable, biểu đồ, hàm thống kê và dashboard đơn giản. Thực hành trên file mẫu, phù hợp văn phòng và báo cáo nhanh.',
  '/img/cat1.png',
  true,
  2900000,
  20.0,
  'Beginner',
  4.7,
  '320+',
  c.id,
  t.id
FROM public.categories c
CROSS JOIN (
  SELECT id FROM public.profiles WHERE role = 'teacher' ORDER BY created_at ASC LIMIT 1
) AS t
WHERE c.slug = 'microsoft-excel'
  AND EXISTS (SELECT 1 FROM public.profiles WHERE role = 'teacher' LIMIT 1)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.course_lectures (course_id, title, content, video_url, blocks, sort_order)
SELECT co.id, v.title, v.content, v.video_url, v.blocks::jsonb, v.sort_order
FROM public.courses co
CROSS JOIN (VALUES
  (
    0,
    'Làm quen giao diện và nhập liệu hiệu quả',
    'Định dạng ô, bảng và kiểu dữ liệu cơ bản.',
    NULL,
    '[{"title": "Mẹo", "content": "Dùng Ctrl+T để chuyển vùng thành bảng.", "video_url": ""}]'::text
  ),
  (
    1,
    'Hàm SUMIFS, COUNTIFS, VLOOKUP/XLOOKUP',
    'Tra cứu và tổng hợp có điều kiện.',
    NULL,
    '[]'::text
  ),
  (
    2,
    'PivotTable và biểu đồ',
    'Tổng hợp nhanh và trực quan hóa.',
    NULL,
    '[]'::text
  )
) AS v(sort_order, title, content, video_url, blocks)
WHERE co.slug = 'phan-tich-du-lieu-excel'
  AND NOT EXISTS (
    SELECT 1 FROM public.course_lectures cl
    WHERE cl.course_id = co.id AND cl.title = v.title AND cl.sort_order = v.sort_order
  );

INSERT INTO public.course_quizzes (course_id, title, description, questions, sort_order)
SELECT
  co.id,
  'Quiz ôn tập Excel cơ bản',
  'Trắc nghiệm seed.',
  '[
    {"question": "Phím tắt Fill Down trong Excel (Windows) thường là?", "options": ["Ctrl+D", "Ctrl+R", "Alt+D", "Shift+D"], "correctIndex": 0},
    {"question": "PivotTable dùng để?", "options": ["Tổng hợp và nhóm dữ liệu", "Chỉ vẽ biểu đồ", "Mã hóa file", "Gửi email"], "correctIndex": 0}
  ]'::jsonb,
  0
FROM public.courses co
WHERE co.slug = 'phan-tich-du-lieu-excel'
  AND NOT EXISTS (
    SELECT 1 FROM public.course_quizzes q WHERE q.course_id = co.id AND q.title = 'Quiz ôn tập Excel cơ bản'
  );

INSERT INTO public.classes (
  name, slug, description, teacher_id, status, starts_at, ends_at, created_by, image_url, course_id, price_cents
)
SELECT
  'Excel ca sáng — K2/2026',
  'lop-excel-sang-k2-2026',
  'T2–T6, 8h30–10h30. Lab thực hành file doanh thu/chi phí.',
  t.id,
  'active',
  (now() AT TIME ZONE 'UTC') + interval '10 days',
  (now() AT TIME ZONE 'UTC') + interval '100 days',
  COALESCE(a.id, t.id),
  '/img/cat1.png',
  co.id,
  2900000
FROM public.courses co
CROSS JOIN (SELECT id FROM public.profiles WHERE role = 'teacher' ORDER BY created_at ASC LIMIT 1) AS t
LEFT JOIN LATERAL (SELECT id FROM public.profiles WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1) AS a ON true
WHERE co.slug = 'phan-tich-du-lieu-excel'
  AND EXISTS (SELECT 1 FROM public.profiles WHERE role = 'teacher' LIMIT 1)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.classes (
  name, slug, description, teacher_id, status, starts_at, ends_at, created_by, image_url, course_id, price_cents
)
SELECT
  'Excel cuối tuần — K2/2026',
  'lop-excel-cuoi-tuan-k2-2026',
  'Thứ 7–CN, 14h–17h. Phù hợp người đi làm.',
  t.id,
  'active',
  (now() AT TIME ZONE 'UTC') + interval '17 days',
  (now() AT TIME ZONE 'UTC') + interval '110 days',
  COALESCE(a.id, t.id),
  '/img/cat2.png',
  co.id,
  2900000
FROM public.courses co
CROSS JOIN (SELECT id FROM public.profiles WHERE role = 'teacher' ORDER BY created_at ASC LIMIT 1) AS t
LEFT JOIN LATERAL (SELECT id FROM public.profiles WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1) AS a ON true
WHERE co.slug = 'phan-tich-du-lieu-excel'
  AND EXISTS (SELECT 1 FROM public.profiles WHERE role = 'teacher' LIMIT 1)
ON CONFLICT (slug) DO NOTHING;

-- Lớp Excel sáng: nội dung + lịch
INSERT INTO public.class_lectures (class_id, title, content, video_url, blocks, sort_order, published)
SELECT c.id, v.title, v.content, v.video_url, v.blocks::jsonb, v.sort_order, v.published
FROM public.classes c
CROSS JOIN (VALUES
  (
    0,
    'Giới thiệu lớp và chỉ tiêu báo cáo',
    'Template file mẫu và cách nộp bài.',
    NULL,
    '[{"title": null, "content": "Tải workbook tuần 1 trong thư mục chia sẻ.", "video_url": ""}]',
    true
  ),
  (
    1,
    'Thực hành Pivot đầu tiên',
    NULL,
    NULL,
    '[{"title": "Bài tập", "content": "Tạo Pivot doanh thu theo tháng.", "video_url": ""}]',
    true
  )
) AS v(sort_order, title, content, video_url, blocks, published)
WHERE c.slug = 'lop-excel-sang-k2-2026'
  AND NOT EXISTS (
    SELECT 1 FROM public.class_lectures cl
    WHERE cl.class_id = c.id AND cl.title = v.title AND cl.sort_order = v.sort_order
  );

INSERT INTO public.class_quizzes (class_id, title, description, questions, sort_order)
SELECT
  c.id,
  'Quiz hàm điều kiện',
  'Ôn SUMIFS / COUNTIFS.',
  '[{"question": "Hàm nào tính tổng có nhiều điều kiện?", "options": ["SUMIFS", "SUM", "AVERAGE", "ROUND"], "correctIndex": 0}]'::jsonb,
  0
FROM public.classes c
WHERE c.slug = 'lop-excel-sang-k2-2026'
  AND NOT EXISTS (
    SELECT 1 FROM public.class_quizzes q WHERE q.class_id = c.id AND q.title = 'Quiz hàm điều kiện'
  );

INSERT INTO public.class_schedules (class_id, title, starts_at, ends_at, location, meeting_url, notes, sort_order)
SELECT c.id, v.title, v.starts_at, v.ends_at, v.location, v.meeting_url, v.notes, v.sort_order
FROM public.classes c
CROSS JOIN (VALUES
  (
    0,
    'Buổi 1 — Làm quen & bảng dữ liệu',
    (now() AT TIME ZONE 'UTC') + interval '12 days' + interval '8 hours' + interval '30 minutes',
    (now() AT TIME ZONE 'UTC') + interval '12 days' + interval '10 hours' + interval '30 minutes',
    'Phòng đào tạo / Zoom',
    'https://meet.example.com/excel-sang-1',
    'Mang laptop có Excel 365 hoặc 2019+.'
  ),
  (
    1,
    'Buổi 2 — Pivot & biểu đồ',
    (now() AT TIME ZONE 'UTC') + interval '14 days' + interval '8 hours' + interval '30 minutes',
    (now() AT TIME ZONE 'UTC') + interval '14 days' + interval '10 hours' + interval '30 minutes',
    'Phòng đào tạo / Zoom',
    NULL::text,
    NULL::text
  )
) AS v(sort_order, title, starts_at, ends_at, location, meeting_url, notes)
WHERE c.slug = 'lop-excel-sang-k2-2026'
  AND NOT EXISTS (
    SELECT 1 FROM public.class_schedules s
    WHERE s.class_id = c.id AND s.title = v.title AND s.sort_order = v.sort_order
  );

INSERT INTO public.class_lectures (class_id, title, content, video_url, blocks, sort_order, published)
SELECT c.id, v.title, v.content, v.video_url, v.blocks::jsonb, v.sort_order, v.published
FROM public.classes c
CROSS JOIN (VALUES
  (
    0,
    'Checklist học cuối tuần',
    'Ghi chú nhanh và ôn trước buổi.',
    NULL,
    '[]',
    true
  ),
  (
    1,
    'Dashboard mini',
    NULL,
    NULL,
    '[{"title": null, "content": "Ghép slicer + biểu đồ trên một sheet báo cáo.", "video_url": ""}]',
    true
  )
) AS v(sort_order, title, content, video_url, blocks, published)
WHERE c.slug = 'lop-excel-cuoi-tuan-k2-2026'
  AND NOT EXISTS (
    SELECT 1 FROM public.class_lectures cl
    WHERE cl.class_id = c.id AND cl.title = v.title AND cl.sort_order = v.sort_order
  );

INSERT INTO public.class_quizzes (class_id, title, description, questions, sort_order)
SELECT
  c.id,
  'Quiz định dạng & in ấn',
  'Seed.',
  '[{"question": "In vùng in (Print Area) dùng mục nào?", "options": ["Page Layout", "Review", "Data", "Draw"], "correctIndex": 0}]'::jsonb,
  0
FROM public.classes c
WHERE c.slug = 'lop-excel-cuoi-tuan-k2-2026'
  AND NOT EXISTS (
    SELECT 1 FROM public.class_quizzes q WHERE q.class_id = c.id AND q.title = 'Quiz định dạng & in ấn'
  );

INSERT INTO public.class_schedules (class_id, title, starts_at, ends_at, location, meeting_url, notes, sort_order)
SELECT c.id, v.title, v.starts_at, v.ends_at, v.location, v.meeting_url, v.notes, v.sort_order
FROM public.classes c
CROSS JOIN (VALUES
  (
    0,
    'Thứ 7 — Buổi 1',
    (now() AT TIME ZONE 'UTC') + interval '19 days' + interval '14 hours',
    (now() AT TIME ZONE 'UTC') + interval '19 days' + interval '17 hours',
    'Cơ sở HN',
    NULL::text,
    NULL::text
  ),
  (
    1,
    'Chủ nhật — Buổi 2',
    (now() AT TIME ZONE 'UTC') + interval '20 days' + interval '14 hours',
    (now() AT TIME ZONE 'UTC') + interval '20 days' + interval '17 hours',
    'Cơ sở HN',
    NULL::text,
    NULL::text
  )
) AS v(sort_order, title, starts_at, ends_at, location, meeting_url, notes)
WHERE c.slug = 'lop-excel-cuoi-tuan-k2-2026'
  AND NOT EXISTS (
    SELECT 1 FROM public.class_schedules s
    WHERE s.class_id = c.id AND s.title = v.title AND s.sort_order = v.sort_order
  );

-- ---------------------------------------------------------------------------
-- Khóa 2: Nhập môn AWS & triển khai cơ bản (category aws)
-- ---------------------------------------------------------------------------
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
  'Nhập môn AWS và triển khai cơ bản',
  'nhap-mon-aws-trien-khai-co-ban',
  'IAM, VPC, EC2, S3 và RDS ở mức giới thiệu. Thực hành console và CLI tối thiểu, phù hợp người mới chuyển sang cloud.',
  '/img/cat2.png',
  true,
  4900000,
  28.0,
  'Beginner',
  4.6,
  '180+',
  c.id,
  t.id
FROM public.categories c
CROSS JOIN (
  SELECT id FROM public.profiles WHERE role = 'teacher' ORDER BY created_at ASC LIMIT 1
) AS t
WHERE c.slug = 'aws'
  AND EXISTS (SELECT 1 FROM public.profiles WHERE role = 'teacher' LIMIT 1)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.course_lectures (course_id, title, content, video_url, blocks, sort_order)
SELECT co.id, v.title, v.content, v.video_url, v.blocks::jsonb, v.sort_order
FROM public.courses co
CROSS JOIN (VALUES
  (
    0,
    'Tài khoản AWS và IAM users/roles',
    'Nguyên tắc least privilege.',
    NULL,
    '[]'::text
  ),
  (
    1,
    'VPC, subnet công khai/riêng tư',
    'Ý tưởng routing và bảo mật mạng.',
    NULL,
    '[]'::text
  ),
  (
    2,
    'EC2 + S3 + RDS: luồng triển khai demo',
    'Khởi tạo máy, bucket và DB nhỏ.',
    NULL,
    '[]'::text
  )
) AS v(sort_order, title, content, video_url, blocks)
WHERE co.slug = 'nhap-mon-aws-trien-khai-co-ban'
  AND NOT EXISTS (
    SELECT 1 FROM public.course_lectures cl
    WHERE cl.course_id = co.id AND cl.title = v.title AND cl.sort_order = v.sort_order
  );

INSERT INTO public.course_quizzes (course_id, title, description, questions, sort_order)
SELECT
  co.id,
  'Quiz dịch vụ AWS cơ bản',
  'Seed.',
  '[
    {"question": "Dịch vụ lưu object tệp tin dùng chính là?", "options": ["S3", "RDS", "Lambda", "CloudFront"], "correctIndex": 0},
    {"question": "IAM policy gắn trực tiếp vào user được gọi là?", "options": ["Inline policy (thường gắn user/group/role)", "Bucket policy", "SCP", "WAF"], "correctIndex": 0}
  ]'::jsonb,
  0
FROM public.courses co
WHERE co.slug = 'nhap-mon-aws-trien-khai-co-ban'
  AND NOT EXISTS (
    SELECT 1 FROM public.course_quizzes q WHERE q.course_id = co.id AND q.title = 'Quiz dịch vụ AWS cơ bản'
  );

INSERT INTO public.classes (
  name, slug, description, teacher_id, status, starts_at, ends_at, created_by, image_url, course_id, price_cents
)
SELECT
  'AWS ca chiều — K2/2026',
  'lop-aws-chieu-k2-2026',
  'T3–T6, 14h–16h. Khơi gợi lab tuần.',
  t.id,
  'active',
  (now() AT TIME ZONE 'UTC') + interval '12 days',
  (now() AT TIME ZONE 'UTC') + interval '115 days',
  COALESCE(a.id, t.id),
  '/img/cat2.png',
  co.id,
  4900000
FROM public.courses co
CROSS JOIN (SELECT id FROM public.profiles WHERE role = 'teacher' ORDER BY created_at ASC LIMIT 1) AS t
LEFT JOIN LATERAL (SELECT id FROM public.profiles WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1) AS a ON true
WHERE co.slug = 'nhap-mon-aws-trien-khai-co-ban'
  AND EXISTS (SELECT 1 FROM public.profiles WHERE role = 'teacher' LIMIT 1)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.classes (
  name, slug, description, teacher_id, status, starts_at, ends_at, created_by, image_url, course_id, price_cents
)
SELECT
  'AWS bootcamp tối — K2/2026',
  'lop-aws-toi-k2-2026',
  'T2–T6, 20h–22h. Q&A sau mỗi buổi.',
  t.id,
  'active',
  (now() AT TIME ZONE 'UTC') + interval '25 days',
  (now() AT TIME ZONE 'UTC') + interval '125 days',
  COALESCE(a.id, t.id),
  '/img/course-2.png',
  co.id,
  4900000
FROM public.courses co
CROSS JOIN (SELECT id FROM public.profiles WHERE role = 'teacher' ORDER BY created_at ASC LIMIT 1) AS t
LEFT JOIN LATERAL (SELECT id FROM public.profiles WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1) AS a ON true
WHERE co.slug = 'nhap-mon-aws-trien-khai-co-ban'
  AND EXISTS (SELECT 1 FROM public.profiles WHERE role = 'teacher' LIMIT 1)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.class_lectures (class_id, title, content, video_url, blocks, sort_order, published)
SELECT c.id, v.title, v.content, v.video_url, v.blocks::jsonb, v.sort_order, v.published
FROM public.classes c
CROSS JOIN (VALUES
  (
    0,
    'Bootcamp AWS: lịch và tài nguyên',
    'Free tier, billing alarm và VPC mặc định.',
    NULL,
    '[{"title": null, "content": "Tạo alarm ngân sách 5 USD (demo).", "video_url": ""}]',
    true
  ),
  (
    1,
    'Lab EC2 đầu tiên',
    NULL,
    NULL,
    '[{"title": "Bài tập", "content": "SSH/SSM tới một instance và cài Nginx hello.", "video_url": ""}]',
    true
  )
) AS v(sort_order, title, content, video_url, blocks, published)
WHERE c.slug = 'lop-aws-chieu-k2-2026'
  AND NOT EXISTS (
    SELECT 1 FROM public.class_lectures cl
    WHERE cl.class_id = c.id AND cl.title = v.title AND cl.sort_order = v.sort_order
  );

INSERT INTO public.class_quizzes (class_id, title, description, questions, sort_order)
SELECT
  c.id,
  'Quiz VPC & subnet',
  'Seed.',
  '[{"question": "Subnet private thường không có gì?", "options": ["IGW trực tiếp", "IAM user", "S3 bucket", "RDS engine"], "correctIndex": 0}]'::jsonb,
  0
FROM public.classes c
WHERE c.slug = 'lop-aws-chieu-k2-2026'
  AND NOT EXISTS (
    SELECT 1 FROM public.class_quizzes q WHERE q.class_id = c.id AND q.title = 'Quiz VPC & subnet'
  );

INSERT INTO public.class_schedules (class_id, title, starts_at, ends_at, location, meeting_url, notes, sort_order)
SELECT c.id, v.title, v.starts_at, v.ends_at, v.location, v.meeting_url, v.notes, v.sort_order
FROM public.classes c
CROSS JOIN (VALUES
  (
    0,
    'Buổi 1 — IAM & tài khoản',
    (now() AT TIME ZONE 'UTC') + interval '14 days' + interval '14 hours',
    (now() AT TIME ZONE 'UTC') + interval '14 days' + interval '16 hours',
    'Online',
    'https://meet.example.com/aws-chieu-1',
    NULL::text
  ),
  (
    1,
    'Buổi 2 — VPC walkthrough',
    (now() AT TIME ZONE 'UTC') + interval '16 days' + interval '14 hours',
    (now() AT TIME ZONE 'UTC') + interval '16 days' + interval '16 hours',
    'Online',
    'https://meet.example.com/aws-chieu-2',
    NULL::text
  )
) AS v(sort_order, title, starts_at, ends_at, location, meeting_url, notes)
WHERE c.slug = 'lop-aws-chieu-k2-2026'
  AND NOT EXISTS (
    SELECT 1 FROM public.class_schedules s
    WHERE s.class_id = c.id AND s.title = v.title AND s.sort_order = v.sort_order
  );

INSERT INTO public.class_lectures (class_id, title, content, video_url, blocks, sort_order, published)
SELECT c.id, v.title, v.content, v.video_url, v.blocks::jsonb, v.sort_order, v.published
FROM public.classes c
CROSS JOIN (VALUES
  (
    0,
    'Ôn EC2 & user-data',
    'Khởi động nhanh và log.',
    NULL,
    '[]',
    true
  ),
  (
    1,
    'S3 versioning & policy đọc công khai (demo)',
    NULL,
    NULL,
    '[{"title": "Lưu ý", "content": "Chỉ bật public read trong môi trường lab.", "video_url": ""}]',
    true
  )
) AS v(sort_order, title, content, video_url, blocks, published)
WHERE c.slug = 'lop-aws-toi-k2-2026'
  AND NOT EXISTS (
    SELECT 1 FROM public.class_lectures cl
    WHERE cl.class_id = c.id AND cl.title = v.title AND cl.sort_order = v.sort_order
  );

INSERT INTO public.class_quizzes (class_id, title, description, questions, sort_order)
SELECT
  c.id,
  'Quiz S3 storage class (ý niệm)',
  'Seed.',
  '[{"question": "Lớp lưu trữ rẻ cho ít truy cập (theo ý niệm) thường là?", "options": ["Glacier / IA (khái niệm)", "Redis", "EBS only", "CloudTrail"], "correctIndex": 0}]'::jsonb,
  0
FROM public.classes c
WHERE c.slug = 'lop-aws-toi-k2-2026'
  AND NOT EXISTS (
    SELECT 1 FROM public.class_quizzes q WHERE q.class_id = c.id AND q.title = 'Quiz S3 storage class (ý niệm)'
  );

INSERT INTO public.class_schedules (class_id, title, starts_at, ends_at, location, meeting_url, notes, sort_order)
SELECT c.id, v.title, v.starts_at, v.ends_at, v.location, v.meeting_url, v.notes, v.sort_order
FROM public.classes c
CROSS JOIN (VALUES
  (
    0,
    'Tối — Buổi 1',
    (now() AT TIME ZONE 'UTC') + interval '26 days' + interval '20 hours',
    (now() AT TIME ZONE 'UTC') + interval '26 days' + interval '22 hours',
    'Online',
    'https://meet.example.com/aws-toi-1',
    NULL::text
  ),
  (
    1,
    'Tối — Buổi 2',
    (now() AT TIME ZONE 'UTC') + interval '28 days' + interval '20 hours',
    (now() AT TIME ZONE 'UTC') + interval '28 days' + interval '22 hours',
    'Online',
    'https://meet.example.com/aws-toi-2',
    NULL::text
  )
) AS v(sort_order, title, starts_at, ends_at, location, meeting_url, notes)
WHERE c.slug = 'lop-aws-toi-k2-2026'
  AND NOT EXISTS (
    SELECT 1 FROM public.class_schedules s
    WHERE s.class_id = c.id AND s.title = v.title AND s.sort_order = v.sort_order
  );
