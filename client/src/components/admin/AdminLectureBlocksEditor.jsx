import { Button, IconButton, Paper, Stack, TextField, Typography } from '@mui/material';
import { Trash2 } from 'lucide-react';
import { newLectureBlock } from '../../lib/lectureBlocksForm.js';
import { DASH_ADMIN } from '../../strings/vi';

/**
 * Khối bài giảng (nội dung + video) — dùng chung form bài giảng khóa học & lớp học.
 * @param {Array<{ _id?: string, title: string, content: string, video_url: string }>} blocks
 * @param {(next: Array<typeof blocks[number]>) => void} onBlocksChange
 */
export function AdminLectureBlocksEditor({ blocks, onBlocksChange }) {
  const list = Array.isArray(blocks) && blocks.length > 0 ? blocks : [newLectureBlock()];

  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
        {DASH_ADMIN.LECTURE_BLOCKS}
      </Typography>
      {list.map((blk, idx) => (
        <Paper
          key={blk._id ?? idx}
          variant="outlined"
          sx={{ p: 2, pt: list.length > 1 ? 4 : 2, position: 'relative' }}
        >
          {list.length > 1 ? (
            <IconButton
              type="button"
              size="small"
              aria-label={DASH_ADMIN.REMOVE_LECTURE_BLOCK}
              onClick={() => onBlocksChange(list.filter((_, i) => i !== idx))}
              sx={{ position: 'absolute', top: 8, right: 8 }}
            >
              <Trash2 className="h-4 w-4" />
            </IconButton>
          ) : null}
          <Stack spacing={1.5}>
            <TextField
              size="small"
              label={DASH_ADMIN.LECTURE_BLOCK_TITLE}
              value={blk.title}
              onChange={(e) => {
                const next = [...list];
                next[idx] = { ...next[idx], title: e.target.value };
                onBlocksChange(next);
              }}
              fullWidth
            />
            <TextField
              size="small"
              label={DASH_ADMIN.LECTURE_BLOCK_CONTENT}
              multiline
              minRows={2}
              value={blk.content}
              onChange={(e) => {
                const next = [...list];
                next[idx] = { ...next[idx], content: e.target.value };
                onBlocksChange(next);
              }}
              fullWidth
            />
            <TextField
              size="small"
              label={DASH_ADMIN.LECTURE_BLOCK_VIDEO}
              value={blk.video_url}
              onChange={(e) => {
                const next = [...list];
                next[idx] = { ...next[idx], video_url: e.target.value };
                onBlocksChange(next);
              }}
              fullWidth
            />
          </Stack>
        </Paper>
      ))}
      <Button
        type="button"
        variant="outlined"
        size="small"
        sx={{ alignSelf: 'flex-start' }}
        onClick={() => onBlocksChange([...list, newLectureBlock()])}
      >
        {DASH_ADMIN.ADD_LECTURE_BLOCK}
      </Button>
    </Stack>
  );
}
