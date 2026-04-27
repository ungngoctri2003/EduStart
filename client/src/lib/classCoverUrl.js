const DEFAULT_CLASS_COVER = '/img/banner-3.jpg';

/** Ảnh bìa lớp: `image_url` từ API hoặc ảnh mặc định. */
export function classCoverUrl(klass) {
  const u = klass?.image_url != null ? String(klass.image_url).trim() : '';
  return u || DEFAULT_CLASS_COVER;
}
