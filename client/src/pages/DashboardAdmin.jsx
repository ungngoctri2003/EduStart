import { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../components/PageHeader';
import { useAuth } from '../context/useAuth';
import { apiFetch } from '../lib/api';
import { DASH_ADMIN } from '../strings/vi';
import { COMMON } from '../strings/vi';
import { ERR } from '../strings/vi';

const TAB_KEYS = ['users', 'courses'];

function newLectureBlock() {
  return { title: '', content: '', video_url: '' };
}

function newQuizQuestion() {
  return {
    _id: globalThis.crypto?.randomUUID?.() ?? `q-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    question: '',
    a: '',
    b: '',
    c: '',
    d: '',
    correct: 0,
  };
}

function countLectureBlocks(lec) {
  const raw = lec.blocks;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.filter((b) => b && (b.title || b.content || b.video_url)).length || raw.length;
  }
  if (lec.content || lec.video_url) return 1;
  return 0;
}

const INITIAL_USER_FORM = { email: '', password: '', full_name: '', role: 'student' };

function ZebraTable({ children }) {
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, boxShadow: 1 }}>
      <Table size="small">
        {children}
      </Table>
    </TableContainer>
  );
}

export function DashboardAdmin() {
  const { session, user } = useAuth();
  const token = session?.access_token;
  const [tab, setTab] = useState('users');

  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [courses, setCourses] = useState([]);

  const [courseForm, setCourseForm] = useState({
    title: '',
    slug: '',
    description: '',
    thumbnail_url: '/img/course-1.png',
    category_id: '',
    published: true,
    price_cents: 0,
    duration_hours: '',
    level: DASH_ADMIN.LEVEL_DEFAULT,
    rating: '',
    learners_count: '',
  });

  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [courseSubTab, setCourseSubTab] = useState('lectures');
  const [lectures, setLectures] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [lectureForm, setLectureForm] = useState(() => ({ title: '', blocks: [newLectureBlock()] }));
  const [quizForm, setQuizForm] = useState(() => ({ title: '', description: '', questions: [newQuizQuestion()] }));

  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [userEditingId, setUserEditingId] = useState(null);
  const [userForm, setUserForm] = useState(() => ({ ...INITIAL_USER_FORM }));

  const loadUsersCourses = useCallback(async () => {
    if (!token) return;
    const [u, ca, cr] = await Promise.all([
      apiFetch('/api/admin/users', {}, token),
      apiFetch('/api/categories'),
      apiFetch('/api/admin/courses', {}, token),
    ]);
    setUsers(u || []);
    setCategories(ca || []);
    setCourses(cr || []);
  }, [token]);

  const loadLecturesQuizzes = useCallback(async () => {
    if (!token || !selectedCourseId) {
      setLectures([]);
      setQuizzes([]);
      return;
    }
    const [lec, qz] = await Promise.all([
      apiFetch(`/api/admin/courses/${selectedCourseId}/lectures`, {}, token),
      apiFetch(`/api/admin/courses/${selectedCourseId}/quizzes`, {}, token),
    ]);
    setLectures(lec || []);
    setQuizzes(qz || []);
  }, [token, selectedCourseId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!token) return;
        await loadUsersCourses();
      } catch (e) {
        if (!cancelled) toast.error(e.message || ERR.LOAD_FAILED);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, loadUsersCourses]);

  useEffect(() => {
    if (courses.length === 0) {
      setSelectedCourseId('');
      return;
    }
    setSelectedCourseId((prev) => {
      if (prev && courses.some((c) => c.id === prev)) return prev;
      return courses[0].id;
    });
  }, [courses]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!token || !selectedCourseId) return;
        await loadLecturesQuizzes();
      } catch (e) {
        if (!cancelled) toast.error(e.message || ERR.LOAD_FAILED);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, selectedCourseId, loadLecturesQuizzes]);

  function openCreateUser() {
    setUserEditingId(null);
    setUserForm({ ...INITIAL_USER_FORM });
    setUserDialogOpen(true);
  }

  function openEditUser(u) {
    setUserEditingId(u.id);
    setUserForm({
      email: u.email || '',
      password: '',
      full_name: u.full_name || '',
      role: u.role || 'student',
    });
    setUserDialogOpen(true);
  }

  async function submitUserForm(e) {
    e.preventDefault();
    const isCreate = !userEditingId;
    if (!userForm.email.trim()) {
      toast.error(DASH_ADMIN.EMAIL_REQUIRED);
      return;
    }
    if (isCreate && !userForm.password) {
      toast.error(DASH_ADMIN.PASSWORD_REQUIRED);
      return;
    }
    try {
      if (isCreate) {
        await apiFetch(
          '/api/admin/users',
          {
            method: 'POST',
            body: JSON.stringify({
              email: userForm.email.trim(),
              password: userForm.password,
              full_name: userForm.full_name.trim() || null,
              role: userForm.role,
            }),
          },
          token,
        );
        toast.success(DASH_ADMIN.USER_CREATED);
      } else {
        const body = {
          email: userForm.email.trim(),
          full_name: userForm.full_name.trim() || null,
          role: userForm.role,
        };
        if (userForm.password) body.password = userForm.password;
        await apiFetch(`/api/admin/users/${userEditingId}`, { method: 'PATCH', body: JSON.stringify(body) }, token);
        toast.success(DASH_ADMIN.USER_UPDATED);
      }
      setUserDialogOpen(false);
      await loadUsersCourses();
    } catch (err) {
      toast.error(err.data?.error || err.message);
    }
  }

  async function deleteUserRow(userId) {
    if (userId === user?.id) {
      toast.error(DASH_ADMIN.CANNOT_DELETE_SELF);
      return;
    }
    if (!confirm(DASH_ADMIN.CONFIRM_DEL_USER)) return;
    try {
      await apiFetch(`/api/admin/users/${userId}`, { method: 'DELETE' }, token);
      toast.success(DASH_ADMIN.TOAST_DELETED);
      await loadUsersCourses();
    } catch (err) {
      toast.error(err.data?.error || err.message);
    }
  }

  async function addCourse(e) {
    e.preventDefault();
    try {
      await apiFetch(
        '/api/admin/courses',
        {
          method: 'POST',
          body: JSON.stringify({
            title: courseForm.title,
            slug: courseForm.slug,
            description: courseForm.description || null,
            thumbnail_url: courseForm.thumbnail_url || null,
            category_id: courseForm.category_id || null,
            published: courseForm.published,
            price_cents: Number(courseForm.price_cents) || 0,
            duration_hours: courseForm.duration_hours === '' ? null : Number(courseForm.duration_hours),
            level: courseForm.level || null,
            rating: courseForm.rating === '' ? null : Number(courseForm.rating),
            learners_count: courseForm.learners_count || null,
          }),
        },
        token,
      );
      toast.success(DASH_ADMIN.COURSE_CREATED);
      await loadUsersCourses();
    } catch (e) {
      toast.error(e.data?.error || e.message);
    }
  }

  async function deleteCourse(id) {
    if (!confirm(DASH_ADMIN.CONFIRM_DEL_COURSE)) return;
    try {
      await apiFetch(`/api/admin/courses/${id}`, { method: 'DELETE' }, token);
      toast.success(DASH_ADMIN.TOAST_DELETED);
      await loadUsersCourses();
    } catch (e) {
      toast.error(e.data?.error || e.message);
    }
  }

  async function addLecture(e) {
    e.preventDefault();
    if (!selectedCourseId) return;
    const blocks = lectureForm.blocks
      .map((b) => ({
        title: (b.title || '').trim() || null,
        content: (b.content || '').trim() || null,
        video_url: (b.video_url || '').trim() || null,
      }))
      .filter((b) => b.title || b.content || b.video_url);
    if (!blocks.length) {
      toast.error(DASH_ADMIN.LECTURE_BLOCKS_EMPTY);
      return;
    }
    try {
      await apiFetch(
        `/api/admin/courses/${selectedCourseId}/lectures`,
        {
          method: 'POST',
          body: JSON.stringify({
            title: lectureForm.title,
            blocks,
          }),
        },
        token,
      );
      setLectureForm({ title: '', blocks: [newLectureBlock()] });
      toast.success(DASH_ADMIN.TOAST_LECTURE_ADDED);
      await loadLecturesQuizzes();
    } catch (e) {
      toast.error(e.data?.error || e.message);
    }
  }

  async function deleteLecture(id) {
    if (!confirm(DASH_ADMIN.CONFIRM_DEL_LECTURE)) return;
    try {
      await apiFetch(`/api/admin/lectures/${id}`, { method: 'DELETE' }, token);
      toast.success(DASH_ADMIN.TOAST_DELETED);
      await loadLecturesQuizzes();
    } catch (e) {
      toast.error(e.data?.error || e.message);
    }
  }

  async function addQuiz(e) {
    e.preventDefault();
    if (!selectedCourseId) return;
    const built = quizForm.questions
      .filter((row) => (row.question || '').trim())
      .map((row) => {
        const options = [row.a, row.b, row.c, row.d].map((s) => (s != null ? String(s).trim() : ''));
        const correct = Number(row.correct);
        const correctIndex = correct >= 0 && correct <= 3 ? correct : 0;
        return { question: row.question.trim(), options, correctIndex };
      });
    if (!built.length) {
      toast.error(DASH_ADMIN.QUIZ_NEED_QUESTION);
      return;
    }
    for (const q of built) {
      if (q.options.some((o) => !o)) {
        toast.error(DASH_ADMIN.QUIZ_OPTIONS_REQUIRED);
        return;
      }
    }
    try {
      await apiFetch(
        `/api/admin/courses/${selectedCourseId}/quizzes`,
        {
          method: 'POST',
          body: JSON.stringify({
            title: quizForm.title,
            description: quizForm.description || null,
            questions: built,
          }),
        },
        token,
      );
      setQuizForm({ title: '', description: '', questions: [newQuizQuestion()] });
      toast.success(DASH_ADMIN.TOAST_QUIZ_ADDED);
      await loadLecturesQuizzes();
    } catch (e) {
      toast.error(e.data?.error || e.message);
    }
  }

  async function deleteQuiz(id) {
    if (!confirm(DASH_ADMIN.CONFIRM_DEL_QUIZ)) return;
    try {
      await apiFetch(`/api/admin/quizzes/${id}`, { method: 'DELETE' }, token);
      toast.success(DASH_ADMIN.TOAST_DELETED);
      await loadLecturesQuizzes();
    } catch (e) {
      toast.error(e.data?.error || e.message);
    }
  }

  const rowSx = { '&:nth-of-type(odd)': { bgcolor: 'action.hover' } };

  return (
    <>
      <PageHeader title={DASH_ADMIN.TITLE} crumbs={[{ label: DASH_ADMIN.CRUMB, active: true }]} />
      <div className="container mx-auto max-w-6xl px-4 py-12">
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ mt: 2, bgcolor: 'action.hover', borderRadius: 2, px: 0.5, minHeight: 48 }}
        >
          {TAB_KEYS.map((k) => (
            <Tab key={k} value={k} label={DASH_ADMIN.TABS[k]} sx={{ textTransform: 'none', fontWeight: 600 }} />
          ))}
        </Tabs>

        <Box sx={{ mt: 4 }}>
          {tab === 'users' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box>
                <Button variant="contained" size="small" onClick={openCreateUser}>
                  {DASH_ADMIN.BTN_ADD_USER}
                </Button>
              </Box>
              <ZebraTable>
                <TableHead>
                  <TableRow>
                    <TableCell>{DASH_ADMIN.TH_NAME}</TableCell>
                    <TableCell>{DASH_ADMIN.TH_EMAIL}</TableCell>
                    <TableCell>{DASH_ADMIN.TH_ROLE}</TableCell>
                    <TableCell align="right">{DASH_ADMIN.TH_ACTIONS}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id} sx={rowSx}>
                      <TableCell>{u.full_name || '—'}</TableCell>
                      <TableCell>{u.email || '—'}</TableCell>
                      <TableCell>{u.role}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap">
                          <Button type="button" variant="outlined" size="small" onClick={() => openEditUser(u)}>
                            {DASH_ADMIN.BTN_EDIT}
                          </Button>
                          <Button
                            type="button"
                            variant="outlined"
                            color="error"
                            size="small"
                            disabled={u.id === user?.id}
                            onClick={() => deleteUserRow(u.id)}
                          >
                            {COMMON.DELETE}
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </ZebraTable>
            </Box>
          )}

          {tab === 'courses' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Card variant="outlined" component="form" onSubmit={addCourse}>
                <CardContent sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
                  <TextField
                    size="small"
                    label={DASH_ADMIN.LABEL_COURSE_TITLE}
                    required
                    value={courseForm.title}
                    onChange={(e) => setCourseForm((f) => ({ ...f, title: e.target.value }))}
                  />
                  <TextField
                    size="small"
                    label="Slug"
                    required
                    value={courseForm.slug}
                    onChange={(e) => setCourseForm((f) => ({ ...f, slug: e.target.value }))}
                  />
                  <TextField
                    size="small"
                    label={DASH_ADMIN.LABEL_COURSE_DESC}
                    multiline
                    rows={2}
                    value={courseForm.description}
                    onChange={(e) => setCourseForm((f) => ({ ...f, description: e.target.value }))}
                    sx={{ gridColumn: { md: '1 / -1' } }}
                  />
                  <FormControl size="small">
                    <InputLabel id="cat-select">{DASH_ADMIN.LABEL_CATEGORY}</InputLabel>
                    <Select
                      labelId="cat-select"
                      label={DASH_ADMIN.LABEL_CATEGORY}
                      value={courseForm.category_id}
                      onChange={(e) => setCourseForm((f) => ({ ...f, category_id: e.target.value }))}
                    >
                      <MenuItem value="">—</MenuItem>
                      {categories.map((c) => (
                        <MenuItem key={c.id} value={c.id}>
                          {c.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField
                    size="small"
                    label={DASH_ADMIN.LABEL_THUMB}
                    value={courseForm.thumbnail_url}
                    onChange={(e) => setCourseForm((f) => ({ ...f, thumbnail_url: e.target.value }))}
                    sx={{ gridColumn: { md: '1 / -1' } }}
                  />
                  <TextField
                    size="small"
                    type="number"
                    label={DASH_ADMIN.LABEL_PRICE_CENTS}
                    value={courseForm.price_cents}
                    onChange={(e) => setCourseForm((f) => ({ ...f, price_cents: e.target.value }))}
                  />
                  <TextField
                    size="small"
                    label={DASH_ADMIN.LABEL_DURATION_H}
                    value={courseForm.duration_hours}
                    onChange={(e) => setCourseForm((f) => ({ ...f, duration_hours: e.target.value }))}
                  />
                  <TextField
                    size="small"
                    label={DASH_ADMIN.LABEL_LEVEL}
                    value={courseForm.level}
                    onChange={(e) => setCourseForm((f) => ({ ...f, level: e.target.value }))}
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={courseForm.published}
                        onChange={(e) => setCourseForm((f) => ({ ...f, published: e.target.checked }))}
                        color="primary"
                      />
                    }
                    label={DASH_ADMIN.LABEL_PUBLISHED}
                    sx={{ gridColumn: { md: '1 / -1' } }}
                  />
                  <Box sx={{ gridColumn: { md: '1 / -1' } }}>
                    <Button type="submit" variant="contained" color="primary" size="small">
                      {DASH_ADMIN.ADD_COURSE}
                    </Button>
                  </Box>
                </CardContent>
              </Card>
              <ZebraTable>
                <TableHead>
                  <TableRow>
                    <TableCell>{DASH_ADMIN.TH_COURSE_TITLE}</TableCell>
                    <TableCell>{DASH_ADMIN.TH_COURSE_SLUG}</TableCell>
                    <TableCell>{DASH_ADMIN.TH_COURSE_PUBLISHED}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {courses.map((c) => (
                    <TableRow key={c.id} sx={rowSx}>
                      <TableCell>{c.title}</TableCell>
                      <TableCell>
                        <Typography component="code" variant="caption">
                          {c.slug}
                        </Typography>
                      </TableCell>
                      <TableCell>{c.published ? COMMON.YES : COMMON.NO}</TableCell>
                      <TableCell>
                        <Button type="button" variant="outlined" color="error" size="small" onClick={() => deleteCourse(c.id)}>
                          {COMMON.DELETE}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </ZebraTable>

              <Divider sx={{ my: 1 }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {DASH_ADMIN.COURSE_CONTENT}
              </Typography>
              <FormControl size="small" sx={{ maxWidth: 420 }}>
                <InputLabel id="pick-course">{DASH_ADMIN.PICK_COURSE}</InputLabel>
                <Select
                  labelId="pick-course"
                  label={DASH_ADMIN.PICK_COURSE}
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  disabled={courses.length === 0}
                >
                  {courses.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.title}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {selectedCourseId ? (
                <>
                  <Tabs
                    value={courseSubTab}
                    onChange={(_, v) => setCourseSubTab(v)}
                    sx={{ borderBottom: 1, borderColor: 'divider' }}
                  >
                    <Tab value="lectures" label={DASH_ADMIN.SUBTAB_LECTURES} sx={{ textTransform: 'none', fontWeight: 600 }} />
                    <Tab value="quizzes" label={DASH_ADMIN.SUBTAB_QUIZZES} sx={{ textTransform: 'none', fontWeight: 600 }} />
                  </Tabs>

                  {courseSubTab === 'lectures' && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                      <Paper component="form" variant="outlined" onSubmit={addLecture} sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <TextField
                          size="small"
                          label={DASH_ADMIN.LECTURE_TITLE}
                          required
                          value={lectureForm.title}
                          onChange={(e) => setLectureForm((f) => ({ ...f, title: e.target.value }))}
                        />
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          {DASH_ADMIN.LECTURE_BLOCKS}
                        </Typography>
                        {lectureForm.blocks.map((blk, idx) => (
                          <Paper
                            key={idx}
                            variant="outlined"
                            sx={{ p: 2, pt: lectureForm.blocks.length > 1 ? 4 : 2, position: 'relative' }}
                          >
                            {lectureForm.blocks.length > 1 ? (
                              <IconButton
                                type="button"
                                size="small"
                                aria-label={DASH_ADMIN.REMOVE_LECTURE_BLOCK}
                                onClick={() =>
                                  setLectureForm((f) => ({
                                    ...f,
                                    blocks: f.blocks.filter((_, i) => i !== idx),
                                  }))
                                }
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
                                  const next = [...lectureForm.blocks];
                                  next[idx] = { ...next[idx], title: e.target.value };
                                  setLectureForm((f) => ({ ...f, blocks: next }));
                                }}
                              />
                              <TextField
                                size="small"
                                label={DASH_ADMIN.LECTURE_BLOCK_CONTENT}
                                multiline
                                minRows={2}
                                value={blk.content}
                                onChange={(e) => {
                                  const next = [...lectureForm.blocks];
                                  next[idx] = { ...next[idx], content: e.target.value };
                                  setLectureForm((f) => ({ ...f, blocks: next }));
                                }}
                              />
                              <TextField
                                size="small"
                                label={DASH_ADMIN.LECTURE_BLOCK_VIDEO}
                                value={blk.video_url}
                                onChange={(e) => {
                                  const next = [...lectureForm.blocks];
                                  next[idx] = { ...next[idx], video_url: e.target.value };
                                  setLectureForm((f) => ({ ...f, blocks: next }));
                                }}
                              />
                            </Stack>
                          </Paper>
                        ))}
                        <Button
                          type="button"
                          variant="outlined"
                          size="small"
                          sx={{ alignSelf: 'flex-start' }}
                          onClick={() => setLectureForm((f) => ({ ...f, blocks: [...f.blocks, newLectureBlock()] }))}
                        >
                          {DASH_ADMIN.ADD_LECTURE_BLOCK}
                        </Button>
                        <Button type="submit" variant="contained" color="primary" size="small" sx={{ alignSelf: 'flex-start' }}>
                          {DASH_ADMIN.ADD_LECTURE}
                        </Button>
                      </Paper>
                      <ZebraTable>
                        <TableHead>
                          <TableRow>
                            <TableCell>{DASH_ADMIN.TH_LECTURE_TITLE}</TableCell>
                            <TableCell>{DASH_ADMIN.TH_LECTURE_BLOCKS}</TableCell>
                            <TableCell />
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {lectures.map((lec) => (
                            <TableRow key={lec.id} sx={rowSx}>
                              <TableCell>{lec.title}</TableCell>
                              <TableCell>{countLectureBlocks(lec)}</TableCell>
                              <TableCell>
                                <Button type="button" variant="outlined" color="error" size="small" onClick={() => deleteLecture(lec.id)}>
                                  {COMMON.DELETE}
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </ZebraTable>
                    </Box>
                  )}

                  {courseSubTab === 'quizzes' && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                      <Paper component="form" variant="outlined" onSubmit={addQuiz} sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <TextField
                          size="small"
                          label={DASH_ADMIN.QUIZ_TITLE}
                          required
                          value={quizForm.title}
                          onChange={(e) => setQuizForm((f) => ({ ...f, title: e.target.value }))}
                        />
                        <TextField
                          size="small"
                          label={DASH_ADMIN.QUIZ_DESC}
                          value={quizForm.description}
                          onChange={(e) => setQuizForm((f) => ({ ...f, description: e.target.value }))}
                        />
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          {DASH_ADMIN.QUIZ_QUESTIONS_SECTION}
                        </Typography>
                        {quizForm.questions.map((row, qIdx) => (
                          <Paper
                            key={row._id}
                            variant="outlined"
                            sx={{ p: 2, pt: quizForm.questions.length > 1 ? 4 : 2, position: 'relative' }}
                          >
                            {quizForm.questions.length > 1 ? (
                              <IconButton
                                type="button"
                                size="small"
                                aria-label={DASH_ADMIN.REMOVE_QUIZ_QUESTION}
                                onClick={() =>
                                  setQuizForm((f) => ({
                                    ...f,
                                    questions: f.questions.filter((_, i) => i !== qIdx),
                                  }))
                                }
                                sx={{ position: 'absolute', top: 8, right: 8 }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </IconButton>
                            ) : null}
                            <Stack spacing={1.5}>
                              <TextField
                                size="small"
                                label={`${qIdx + 1}. ${DASH_ADMIN.QUIZ_QUESTION_TEXT}`}
                                required
                                value={row.question}
                                onChange={(e) => {
                                  const next = [...quizForm.questions];
                                  next[qIdx] = { ...next[qIdx], question: e.target.value };
                                  setQuizForm((f) => ({ ...f, questions: next }));
                                }}
                              />
                              <TextField
                                size="small"
                                label={DASH_ADMIN.QUIZ_OPTION_A}
                                value={row.a}
                                onChange={(e) => {
                                  const next = [...quizForm.questions];
                                  next[qIdx] = { ...next[qIdx], a: e.target.value };
                                  setQuizForm((f) => ({ ...f, questions: next }));
                                }}
                              />
                              <TextField
                                size="small"
                                label={DASH_ADMIN.QUIZ_OPTION_B}
                                value={row.b}
                                onChange={(e) => {
                                  const next = [...quizForm.questions];
                                  next[qIdx] = { ...next[qIdx], b: e.target.value };
                                  setQuizForm((f) => ({ ...f, questions: next }));
                                }}
                              />
                              <TextField
                                size="small"
                                label={DASH_ADMIN.QUIZ_OPTION_C}
                                value={row.c}
                                onChange={(e) => {
                                  const next = [...quizForm.questions];
                                  next[qIdx] = { ...next[qIdx], c: e.target.value };
                                  setQuizForm((f) => ({ ...f, questions: next }));
                                }}
                              />
                              <TextField
                                size="small"
                                label={DASH_ADMIN.QUIZ_OPTION_D}
                                value={row.d}
                                onChange={(e) => {
                                  const next = [...quizForm.questions];
                                  next[qIdx] = { ...next[qIdx], d: e.target.value };
                                  setQuizForm((f) => ({ ...f, questions: next }));
                                }}
                              />
                              <FormControl component="fieldset" variant="standard">
                                <Typography component="legend" variant="caption" sx={{ mb: 0.5, fontWeight: 600 }}>
                                  {DASH_ADMIN.QUIZ_CORRECT}
                                </Typography>
                                <RadioGroup
                                  row
                                  value={String(row.correct)}
                                  onChange={(e) => {
                                    const next = [...quizForm.questions];
                                    next[qIdx] = { ...next[qIdx], correct: Number(e.target.value) };
                                    setQuizForm((f) => ({ ...f, questions: next }));
                                  }}
                                >
                                  {['A', 'B', 'C', 'D'].map((lab, oi) => (
                                    <FormControlLabel key={lab} value={String(oi)} control={<Radio size="small" />} label={lab} />
                                  ))}
                                </RadioGroup>
                              </FormControl>
                            </Stack>
                          </Paper>
                        ))}
                        <Button
                          type="button"
                          variant="outlined"
                          size="small"
                          sx={{ alignSelf: 'flex-start' }}
                          onClick={() => setQuizForm((f) => ({ ...f, questions: [...f.questions, newQuizQuestion()] }))}
                        >
                          {DASH_ADMIN.ADD_QUIZ_QUESTION}
                        </Button>
                        <Button type="submit" variant="contained" color="primary" size="small" sx={{ alignSelf: 'flex-start' }}>
                          {DASH_ADMIN.ADD_QUIZ}
                        </Button>
                      </Paper>
                      <ZebraTable>
                        <TableHead>
                          <TableRow>
                            <TableCell>{DASH_ADMIN.TH_QUIZ_TITLE}</TableCell>
                            <TableCell>{DASH_ADMIN.QUIZ_DESC}</TableCell>
                            <TableCell />
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {quizzes.map((q) => (
                            <TableRow key={q.id} sx={rowSx}>
                              <TableCell>{q.title}</TableCell>
                              <TableCell sx={{ maxWidth: 280 }}>
                                <Typography variant="body2" color="text.secondary" noWrap title={q.description || ''}>
                                  {q.description || '—'}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Button type="button" variant="outlined" color="error" size="small" onClick={() => deleteQuiz(q.id)}>
                                  {COMMON.DELETE}
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </ZebraTable>
                    </Box>
                  )}
                </>
              ) : (
                <Typography color="text.secondary">{DASH_ADMIN.PICK_COURSE}</Typography>
              )}
            </Box>
          )}
        </Box>
      </div>

      <Dialog open={userDialogOpen} onClose={() => setUserDialogOpen(false)} fullWidth maxWidth="sm" component="form" onSubmit={submitUserForm}>
        <DialogTitle>{userEditingId ? DASH_ADMIN.USER_DIALOG_EDIT : DASH_ADMIN.USER_DIALOG_CREATE}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            required
            autoComplete="off"
            size="small"
            label={COMMON.EMAIL}
            type="email"
            value={userForm.email}
            onChange={(e) => setUserForm((f) => ({ ...f, email: e.target.value }))}
            margin="dense"
          />
          <TextField
            required={!userEditingId}
            autoComplete="new-password"
            size="small"
            label={COMMON.PASSWORD}
            type="password"
            value={userForm.password}
            onChange={(e) => setUserForm((f) => ({ ...f, password: e.target.value }))}
            helperText={userEditingId ? DASH_ADMIN.PW_LEAVE_BLANK : undefined}
            margin="dense"
          />
          <TextField
            size="small"
            label={DASH_ADMIN.TH_NAME}
            value={userForm.full_name}
            onChange={(e) => setUserForm((f) => ({ ...f, full_name: e.target.value }))}
            margin="dense"
          />
          <FormControl size="small" margin="dense" sx={{ minWidth: 200 }}>
            <InputLabel id="user-form-role">{DASH_ADMIN.TH_ROLE}</InputLabel>
            <Select
              labelId="user-form-role"
              label={DASH_ADMIN.TH_ROLE}
              value={userForm.role}
              onChange={(e) => setUserForm((f) => ({ ...f, role: e.target.value }))}
            >
              <MenuItem value="student">{DASH_ADMIN.ROLE_STUDENT}</MenuItem>
              <MenuItem value="admin">{DASH_ADMIN.ROLE_ADMIN}</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button type="button" onClick={() => setUserDialogOpen(false)}>
            {COMMON.CANCEL}
          </Button>
          <Button type="submit" variant="contained">
            {COMMON.SAVE}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
