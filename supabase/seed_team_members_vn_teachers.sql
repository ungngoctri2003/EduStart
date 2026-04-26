-- Chèn 8 giảng viên (mẫu) — chạy thủ công một lần trong Supabase SQL Editor.
-- Nếu đã chạy rồi, xóa hoặc đổi tên để tránh trùng dữ liệu nếu cần.

INSERT INTO public.team_members (name, role_title, image_url, bio, sort_order)
VALUES
  (
    'TS. Nguyễn Minh Tuấn',
    'Giảng viên Toán & Tư duy logic',
    'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&h=400&fit=crop&crop=faces&auto=format',
    'Thạc sĩ Toán ứng dụng, hơn 10 năm kinh nghiệm luyện thi và hỗ trợ học viên nền tảng suy luận. Phong cách chậm rãi, nhiều ví dụ thực tế.',
    1
  ),
  (
    'Cô Trần Thu Hà',
    'Chuyên gia Tiếng Anh giao tiếp',
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop&crop=faces&auto=format',
    'Tốt nghiệp Sư phạm Ngoại ngữ, từng làm việc tại các trung tâm uy tín. Chú trọng phát âm, phản xạ và tự tin giao tiếp hàng ngày.',
    2
  ),
  (
    'ThS. Lê Hoàng Nam',
    'Giảng viên Lập trình Web & Backend',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=faces&auto=format',
    'Kỹ sư phần mềm chuyển sang đào tạo, đồng hành học viên từ HTML/CSS đến Node.js và cơ sở dữ liệu. Luôn cập nhật xu hướng công nghiệp.',
    3
  ),
  (
    'PGS.TS. Phạm Đức Thịnh',
    'Cố vấn phương pháp học tập',
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=faces&auto=format',
    'Nghiên cứu giáo dục và tâm lý học đường; hỗ trợ định hướng lộ trình, kỹ năng tự học và quản lý thời gian cho học viên trưởng thành.',
    4
  ),
  (
    'ThS. Hoàng Phương Linh',
    'Giảng viên Khoa học dữ liệu & Python',
    'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop&crop=faces&auto=format',
    'Chuyên phân tích dữ liệu và trực quan hóa; giúp học viên làm quen Python, pandas và tư duy ra quyết định dựa trên số liệu.',
    5
  ),
  (
    'ThS. Vũ Bảo Châu',
    'Giảng viên Thiết kế UX/UI & Figma',
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop&crop=faces&auto=format',
    'Từng làm sản phẩm tại startup và studio; dạy tư duy người dùng, wireframe, prototype và làm việc với đội dev — phù hợp lộ trình nghề digital.',
    6
  ),
  (
    'CN. Đỗ Mạnh Quân',
    'Giảng viên Kỹ năng mềm & Thuyết trình',
    'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&h=400&fit=crop&crop=faces&auto=format',
    'Cử nhân Tâm lý, chứng chỉ coaching; tập trung giao tiếp, thuyết phục và tự tin trước đám đông cho học viên đi làm, phỏng vấn, pitch ý tưởng.',
    7
  ),
  (
    'Cô Bùi Lan Anh',
    'Giảng viên Văn & Viết sáng tạo',
    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=faces&auto=format',
    'Báo chí và biên tập sách thiếu nhi; dẫn lớp luyện phân tích tác phẩm, viết luận và cảm thụ ngôn ngữ — nhẹ nhàng, nhiều bài tập sáng tạo.',
    8
  );
