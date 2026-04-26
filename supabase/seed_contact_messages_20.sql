-- 20 tin liên hệ mẫu (bảng contact_messages) — chạy thủ công trong Supabase SQL Editor.
-- created_at gán sẵn (trải theo nhiều ngày) để dễ xem sắp xếp trong quản trị.

INSERT INTO public.contact_messages (name, email, subject, message, created_at)
VALUES
  (
    'Lâm Thế Vinh',
    'lam.vinh.88@gmail.com',
    'Hỏi về lộ trình lập trình cho người mới',
    'Chào EduStart, em năm nay 28 tuổi, đang muốn chuyển hướng sang IT. Trang web có tư vấn lộ trình cá nhân hoặc buổi tư vấn ngắn không ạ? Em cảm ơn.',
    '2026-01-08 10:20:00+07'
  ),
  (
    'Công ty TNHH Sáng Tạo Việt',
    'lienhe@sangtaoviet.vn',
    'Đề xuất hợp tác đào tạo nội bộ',
    'Chúng tôi là doanh nghiệp 40 nhân ở TP.HCM, muốn hỏi gói đào tạo kỹ năng mềm & thuyết trình theo hình thức tại công ty. Nhờ bộ phận liên hệ gửi brochure và báo giá sơ bộ. Trân trọng.',
    '2026-01-10 14:45:00+07'
  ),
  (
    'Phan Thu Trang',
    'trangphan.k12@gmail.com',
    'Lỗi không xem được video bài 3',
    'Dạ em học khóa web cơ bản, bài 3 báo lỗi 403. Em đã thử trình duyệt khác và xóa cache. Bạn hỗ trợ em kiểm tra tài khoản hội viên với ạ. Tài khoản email này.',
    '2026-01-12 16:10:00+07'
  ),
  (
    'Hoàng Minh Quân',
    'hmquan.works@outlook.com',
    'Cảm ơn và góp ý nhỏ về bài tập',
    'Khóa rất ổn, chỉ góp ý: phần quiz nên thêm 2 câu tình huống. Cảm ơn đội ngũ, tôi sẽ giới thiệu bạn bè.',
    '2026-01-15 08:30:00+07'
  ),
  (
    'Bùi Thanh Tâm',
    'buitam.student@yopmail.com',
    NULL,
    'Cho em hỏi có hỗ trợ nộp học phí theo tháng không ạ, em chưa đủ trả một lần. Em xin tư vấn qua email.',
    '2026-01-16 19:00:00+07'
  ),
  (
    'Nguyễn Như Ý',
    'nhuy.nguyen.93@gmail.com',
    'Xin tài liệu demo trước khi đăng ký',
    'Mình quan tâm khóa dữ liệu với Python. Có bản PDF hoặc video demo 5 phút nào gửi tham khảo được không? Cảm ơn team.',
    '2026-01-18 11:15:00+07'
  ),
  (
    'Lê Mạnh Cường',
    'lmcuong.ceo@tiny-startup.com',
    'Mời tham gia talk cố định hàng tháng',
    'Team em tổ chức meetup founder tại Hà Nội, muốn mời 1 diễn giả từ EduStart chia sẻ về xu hướng edtech. Có mức thù lao và lịch trống 02/2026 không?',
    '2026-01-20 09:50:00+07'
  ),
  (
    'Đỗ Khánh My',
    'dokm.yenbai@gmail.com',
    'Hỏi tốc độ tải bài ở vùng dữ liệu mạng yếu',
    'Nhà em ở vùng cao, mạng 3G hay giật. Có bản tải xuống bài audio không, hoặc chất lượng thấp hơn để tiết kiệm dung lượng? Mong được hồi âm.',
    '2026-01-22 20:30:00+07'
  ),
  (
    'Võ Sơn Tùng',
    'tungvo.design@gmail.com',
    'Portfolio submission — ứng tuyển cộng tác nội dung',
    'Tôi gửi kèm link portfolio (Figma) trong nội dung: https://example.com/pfolio — tôi ứng tuyển vị trí biên tập hình thức cộng tác part-time, mong được xem xét. Zalo: 0xxx nếu cần.',
    '2026-01-25 12:00:00+07'
  ),
  (
    'Hội phụ huynh lớp 10A1 — THPT Lê Lợi',
    'ph.10a1leloi@edu.local',
    'Đề nghị xác nhận hợp tác tư vấn hướng nghiệp',
    'Nhà trường dự kiến buổi tư vấn cho 120 học sinh. Xin báo giá gói 2 giờ trực tuyến + tài liệu kèm. Liên hệ cô Hằng phụ trách (số trên mạng xã hội trường).',
    '2026-01-27 15:25:00+07'
  ),
  (
    'Châu Bảo Lộc',
    'cbaoloc.1999@icloud.com',
    'Sai tên trên chứng nhận',
    'Em hoàn thành khóa tháng 12 nhưng certificate ghi nhầm chữ cái đầu tên. Làm thủ tục cấp lại thế nào? Em gửi kèm mã hóa đơn: EDU-2025-1192. Cảm ơn.',
    '2026-02-01 10:10:00+07'
  ),
  (
    'Mai Bảo Hân',
    'mbhan.ux@gmail.com',
    'Chủ đề: xin cấp mã ưu đãi trả góp',
    'Mình thấy bài quảng cáo trên Facebook nói trả góp 0% 3 tháng với thẻ V. Mình cần mã ưu đãi sẽ dùng ở bước thanh toán, nhờ bạn hỗ trợ gửi lại. Cảm ơn nhiều.',
    '2026-02-02 18:40:00+07'
  ),
  (
    'Trịnh Công Sơn (không phải nhạc sĩ)',
    'tcs.legal@gmail.com',
    'Yêu cầu xóa dữ liệu cá nhân theo hướng dẫn',
    'Nhờ xác nhận email này đã được xóa khỏi danh sách newsletter và không gửi thêm ưu đãi. Tôi vẫn giữ tài khoản học. Cảm ơn (GDPR-style request).',
    '2026-02-04 13:00:00+07'
  ),
  (
    'Lý Bích Ngà',
    'lybinga.hue@gmail.com',
    'Góp ý giao diện ứng dụng trên iPad cũ',
    'Dùng iPad 2018, phần menu bên trái hơi nhỏ, khó bấm. Nếu có bản ưu tiên nút to hơn thì tốt. Cảm ơn team product.',
    '2026-02-05 22:10:00+07'
  ),
  (
    'Phan Đức Anh',
    'pducanh.eng@student.edu.vn',
    'Cần hóa đơn đỏ',
    'Tôi mua khóa cho công ty, cần xuất hóa đơn GTGT. Đã gửi mã số thuế qua mục hồ sơ nhưng chưa thấy phản hồi. Xin kiểm tra giúp.',
    '2026-02-08 08:55:00+07'
  ),
  (
    'Cafe startup — Đinh Tiên Hoàng, Huế',
    'hello@cafestartup.hue',
    'Đăng ký workshop offline (nếu có)',
    'Mình mở quán, muốn hỏi EduStart có tổ chức workshop tại miền Trung năm 2026 không, hoặc ghi danh sách chờ. Cảm ơn.',
    '2026-02-10 17:20:00+07'
  ),
  (
    'Nguyễn Tấn Lộc',
    'ntloc.blind@protonmail.com',
    'Yêu cầu hỗ trợ truy cập bằng trình đọc màn hình',
    'Tôi sử dụng NVDA. Một số bài thi bị lỗi thứ tự thông báo. Có tài liệu hướng dẫn phím tắt không, hoặc hỗ trợ kỹ thuật? Xin cảm ơn.',
    '2026-02-12 10:30:00+07'
  ),
  (
    'Trần Diệp Anh',
    'tdiepanh@corp-mail.vn',
    'Tài trợ học bổng cho 5 suất',
    'Bên em muốn tài trợ 5 suất cho học viên hoàn cảnh khó khăn. Xin quy trình hợp tác, tiêu chí duyệt và liên hệ bộ phận CSR.',
    '2026-02-14 14:00:00+07'
  ),
  (
    'Bạch Dương Thảo',
    'bduongthao+spam@gmail.com',
    'This is a test from automated checker — vui lòng bỏ qua',
    'Auto-test message for deliverability. Nếu đọc dòng này thì bỏ qua hoặc xóa. Xin lỗi nếu gây phiền.',
    '2026-02-15 06:00:00+07'
  ),
  (
    'Võ Khánh Hà',
    'vkha.law@gmail.com',
    'Clarify terms of service — section 4.2',
    'I need clarification on refund policy for bundle purchases. English reply is OK. Thank you.',
    '2026-02-16 11:45:00+07'
  );
