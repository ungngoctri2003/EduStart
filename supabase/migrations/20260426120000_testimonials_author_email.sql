-- Email từ form công khai: chỉ admin đọc qua /api/admin/testimonials, không trả ở GET /api/testimonials
ALTER TABLE public.testimonials
ADD COLUMN IF NOT EXISTS author_email TEXT;
