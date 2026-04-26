-- 10 đánh giá mẫu (bảng testimonials) — chạy thủ công trong Supabase SQL Editor.
-- Cần migration có cột author_email (20260426120000_testimonials_author_email.sql).

INSERT INTO public.testimonials (author_name, author_title, content, image_url, rating, sort_order, author_email)
VALUES
  (
    'Phạm Ngọc An',
    'Nhân viên marketing',
    'Khóa học bố trí hợp lý, anh hướng dẫn tận tình. Tôi tự tin hơn hẳn khi làm slide và thuyết trình trước sếp. Cảm ơn EduStart!',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=faces&auto=format',
    5,
    1,
    'ngocan.pham@gmail.com'
  ),
  (
    'Lê Hải Yến',
    'Sinh viên năm 3',
    'Bài giảng dễ hiểu, bài tập sát thực tế. App xem bài ổn, không bị nghẽn. Nên có thêm câu hỏi ôn tập cuối mỗi chương thì tuyệt vời.',
    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=faces&auto=format',
    4,
    2,
    'haiyen.le.02@student.vn'
  ),
  (
    'Trương Văn Hùng',
    'Kỹ sư xây dựng chuyển nghề',
    'Học online mà cảm giác như lớp offline: tương tác ổn, đồng cảm với người bận rộn. Tôi đã hoàn thành lộ trình web đúng hẹn với công ty.',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=faces&auto=format',
    5,
    3,
    'hung.truong.wrk@gmail.com'
  ),
  (
    'Nguyễn Thảo Mi',
    'Giáo viên tiếng Anh',
    'Tôi tìm thêm tài liệu để bồi dưỡng nghề; khóa tại đây từ vựng sát theo tình huống, không chung chung. Điểm cộng: phát âm rõ, có transcript.',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=faces&auto=format',
    4,
    4,
    'mii.nguyen.teacher@outlook.com'
  ),
  (
    'Đặng Quốc Bảo',
    'Freelance designer',
    'UI gọn, xem bài bằng điện thoại ổn. Phần feedback sau quiz giúp tôi biết chỗ yếu — một tuần sau làm bài tốt hơn hẳn. Recommend cho bạn cùng team.',
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop&crop=faces&auto=format',
    5,
    5,
    'dang.quoc.bao@pm.me'
  ),
  (
    'Võ Thị Mỹ Duyên',
    'Mẹ bỉm sữa, học lại sau 5 năm',
    'Ban đầu lo không theo nổi, nhưng bài cắt ngắn, xem lại được nhiều lần. Cộng đồng học viên ủng hộ, không cảm thấy cô đơn. Cảm ơn vì môi trường tử tế.',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=faces&auto=format',
    5,
    6,
    'mduyenvo@gmail.com'
  ),
  (
    'Huỳnh Anh Khoa',
    'Lập trình viên intern',
    'Lộ trình code đi từ cơ bản, không nhảy cóc. Tài liệu bổ trợ cập nhật. Bản thân tôi xin được việc sau 4 tháng — một phần nhờ project trong khóa.',
    'https://images.unsplash.com/photo-1504257432389-52343af06ae3?w=200&h=200&fit=crop&crop=faces&auto=format',
    4,
    7,
    'khoa.huynh.dev@gmail.com'
  ),
  (
    'Mai Hương Giang',
    'Nhân sự tổng hợp',
    'Cần kỹ năng mềm để dẫn họp nội bộ. Khóa ở đây dễ áp dụng ngay sáng hôm sau. Chỉ mong thêm bài tập tình huống hóc búa hơn.',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&crop=faces&auto=format',
    4,
    8,
    'huonggiang.mai@company.vn'
  ),
  (
    'Lý Công Thành',
    'Học sinh lớp 12, ôn thi tốt nghiệp',
    'Bài thầy cô tóm tắt dễ nhớ, có mind map. Tôi từ 5 điểm lên 8 ở phần tự chọn. Web chạy mượt dù ở quê mạng chậm.',
    NULL,
    5,
    9,
    NULL
  ),
  (
    'Trần Bảo Ngọc',
    'Chủ shop online',
    'Học quản lý số liệu và mô tả sản phẩm — áp dụng luôn cho Facebook và Shopee. Tư vấn từ đội ngũ nhiệt tình qua góp ý sau bài. Rất ổn.',
    'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&h=200&fit=crop&crop=faces&auto=format',
    5,
    10,
    'bngoc.tran.shop@gmail.com'
  );
