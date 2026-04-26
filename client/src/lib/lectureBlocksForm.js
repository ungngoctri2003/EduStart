function blockId() {
  return globalThis.crypto?.randomUUID?.() ?? `b-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Một khối bài giảng (form + API phần tử blocks). */
export function newLectureBlock() {
  return { _id: blockId(), title: '', content: '', video_url: '' };
}

/**
 * @param {{ blocks?: unknown, content?: unknown, video_url?: unknown }} lec - hàng bài giảng từ API
 */
export function blocksFromLectureForForm(lec) {
  const raw = lec?.blocks;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((b) => ({
      _id: blockId(),
      title: b?.title != null ? String(b.title) : '',
      content: b?.content != null ? String(b.content) : '',
      video_url: b?.video_url != null ? String(b.video_url) : '',
    }));
  }
  const c = lec?.content != null ? String(lec.content) : '';
  const v = lec?.video_url != null ? String(lec.video_url) : '';
  if (c.trim() || v.trim()) {
    return [{ _id: blockId(), title: '', content: c, video_url: v }];
  }
  return [newLectureBlock()];
}

/** Chuẩn hóa gửi API (bỏ `_id`) — cùng quy ước với admin `addLecture` / class-lecture. */
export function normalizeBlocksForApi(blocks) {
  return (Array.isArray(blocks) ? blocks : [])
    .map((b) => ({
      title: (b?.title || '').trim() || null,
      content: (b?.content || '').trim() || null,
      video_url: (b?.video_url || '').trim() || null,
    }))
    .filter((x) => x.title || x.content || x.video_url);
}

export function countLectureBlocks(lec) {
  const raw = lec?.blocks;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.filter((b) => b && (b.title || b.content || b.video_url)).length || raw.length;
  }
  if (lec?.content || lec?.video_url) return 1;
  return 0;
}
