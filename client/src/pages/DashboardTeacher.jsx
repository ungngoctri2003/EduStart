import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  CircularProgress,
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
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { AdminDataTable, adminBodyRowSx, adminHeaderCellSx } from '../components/admin/AdminDataTable';
import { AdminSectionCard } from '../components/admin/AdminSectionCard';
import { useAuth } from '../context/useAuth';
import { apiFetch } from '../lib/api';
import { newQuizFormRow, quizFormRowsFromApi, buildQuizPayloadFromFormRows } from '../lib/classQuizForm.js';
import { newLectureBlock, blocksFromLectureForForm, normalizeBlocksForApi } from '../lib/lectureBlocksForm.js';
import { AdminLectureBlocksEditor } from '../components/admin/AdminLectureBlocksEditor.jsx';
import { COMMON, DASH_ADMIN, DASH_TEACHER, PAGE } from '../strings/vi';

const SUB_TABS = ['overview', 'lectures', 'quizzes', 'students', 'schedule', 'attempts'];

export function DashboardTeacher() {
  const theme = useTheme();
  const chartPrimary = theme.palette.primary.main;
  const chartSecondary = theme.palette.secondary.main;
  const { session, profile } = useAuth();
  const token = session?.access_token;
  const [classes, setClasses] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [dashStats, setDashStats] = useState(null);
  const [dashStatsLoading, setDashStatsLoading] = useState(false);
  const [slug, setSlug] = useState('');
  const [subTab, setSubTab] = useState('overview');
  const [packLoading, setPackLoading] = useState(false);
  const [klass, setKlass] = useState(null);
  const [lectures, setLectures] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [overviewForm, setOverviewForm] = useState({
    name: '',
    description: '',
    image_url: '',
    status: 'active',
    starts_at: '',
    ends_at: '',
  });

  const [lecDialog, setLecDialog] = useState(false);
  const [lecEditing, setLecEditing] = useState(null);
  const [lecForm, setLecForm] = useState(() => ({
    title: '',
    blocks: [newLectureBlock()],
    published: true,
    sort_order: 0,
  }));

  const [quizDialog, setQuizDialog] = useState(false);
  const [quizEditing, setQuizEditing] = useState(null);
  const [quizForm, setQuizForm] = useState({ title: '', description: '', questions: [newQuizFormRow()], sort_order: 0 });

  const [schDialog, setSchDialog] = useState(false);
  const [schEditing, setSchEditing] = useState(null);
  const [schForm, setSchForm] = useState({
    title: '',
    starts_at: '',
    ends_at: '',
    location: '',
    meeting_url: '',
    notes: '',
    sort_order: 0,
  });

  const [studentQuery, setStudentQuery] = useState('');
  const [studentOpts, setStudentOpts] = useState([]);
  const [roster, setRoster] = useState([]);

  const [attempts, setAttempts] = useState([]);

  const loadClasses = useCallback(async () => {
    if (!token) return;
    setLoadingList(true);
    try {
      const data = await apiFetch('/api/teacher/classes', {}, token);
      const list = Array.isArray(data) ? data : [];
      setClasses(list);
      setSlug((prev) => {
        if (prev && list.some((c) => c.slug === prev)) return prev;
        return list[0]?.slug || '';
      });
    } catch (e) {
      toast.error(e.message || DASH_TEACHER.LOAD_ERROR);
    } finally {
      setLoadingList(false);
    }
  }, [token]);

  const loadPack = useCallback(async () => {
    if (!token || !slug) {
      setKlass(null);
      setLectures([]);
      setQuizzes([]);
      setSchedules([]);
      return;
    }
    setPackLoading(true);
    try {
      const data = await apiFetch(`/api/teacher/classes/${encodeURIComponent(slug)}/content`, {}, token);
      setKlass(data.class || null);
      setLectures(data.lectures || []);
      setQuizzes(data.quizzes || []);
      setSchedules(data.schedules || []);
      if (data.class) {
        setOverviewForm({
          name: data.class.name || '',
          description: data.class.description || '',
          image_url: data.class.image_url || '',
          status: data.class.status || 'active',
          starts_at: data.class.starts_at ? String(data.class.starts_at).slice(0, 16) : '',
          ends_at: data.class.ends_at ? String(data.class.ends_at).slice(0, 16) : '',
        });
      }
    } catch (e) {
      toast.error(e.message || DASH_TEACHER.LOAD_ERROR);
    } finally {
      setPackLoading(false);
    }
  }, [token, slug]);

  const loadRoster = useCallback(async () => {
    if (!token || !slug) return;
    const data = await apiFetch(
      `/api/teacher/classes/${encodeURIComponent(slug)}/students?page=1&pageSize=500`,
      {},
      token,
    );
    setRoster(data.items || []);
  }, [token, slug]);

  const loadAttempts = useCallback(async () => {
    if (!token || !slug) return;
    const data = await apiFetch(
      `/api/teacher/classes/${encodeURIComponent(slug)}/quiz-attempts?page=1&pageSize=500`,
      {},
      token,
    );
    setAttempts(data.items || []);
  }, [token, slug]);

  useEffect(() => {
    void loadClasses();
  }, [loadClasses]);

  useEffect(() => {
    if (!token) {
      setDashStats(null);
      return undefined;
    }
    let cancelled = false;
    setDashStatsLoading(true);
    void (async () => {
      try {
        const data = await apiFetch('/api/teacher/dashboard-stats', {}, token);
        if (!cancelled) {
          setDashStats(data);
        }
      } catch (e) {
        if (!cancelled) {
          setDashStats(null);
          toast.error(e.message || DASH_TEACHER.STATS_LOAD_ERROR);
        }
      } finally {
        if (!cancelled) setDashStatsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    void loadPack();
  }, [loadPack]);

  useEffect(() => {
    if (subTab !== 'students' || !slug) return;
    void loadRoster();
  }, [subTab, slug, loadRoster]);

  useEffect(() => {
    if (subTab !== 'attempts' || !slug) return;
    void loadAttempts();
  }, [subTab, slug, loadAttempts]);

  useEffect(() => {
    let cancelled = false;
    const q = studentQuery.trim();
    if (q.length < 2 || !token) {
      setStudentOpts([]);
      return () => {
        cancelled = true;
      };
    }
    const t = setTimeout(() => {
      void (async () => {
        try {
          const data = await apiFetch(
            `/api/teacher/student-lookup?q=${encodeURIComponent(q)}`,
            {},
            token,
          );
          if (!cancelled) setStudentOpts(Array.isArray(data) ? data : []);
        } catch {
          if (!cancelled) setStudentOpts([]);
        }
      })();
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [studentQuery, token]);

  const greeting = useMemo(() => {
    const name = profile?.full_name?.trim();
    if (name) return `Xin chào, ${name}`;
    return 'Xin chào';
  }, [profile?.full_name]);

  const studentsByClassBars = useMemo(() => {
    const rows = dashStats?.byClass;
    if (!Array.isArray(rows)) return [];
    return rows.map((c) => ({
      name: c.name || '—',
      count: c.students ?? 0,
    }));
  }, [dashStats?.byClass]);

  async function saveOverview(e) {
    e.preventDefault();
    if (!slug) return;
    try {
      await apiFetch(
        `/api/teacher/classes/${encodeURIComponent(slug)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            name: overviewForm.name.trim(),
            description: overviewForm.description.trim() || null,
            image_url: overviewForm.image_url.trim() || null,
            status: overviewForm.status,
            starts_at: overviewForm.starts_at || null,
            ends_at: overviewForm.ends_at || null,
          }),
        },
        token,
      );
      toast.success(COMMON.SAVE);
      await loadPack();
      await loadClasses();
    } catch (err) {
      toast.error(err.data?.error || err.message);
    }
  }

  async function addStudentRow(row) {
    if (!row?.id || !slug) return;
    try {
      await apiFetch(
        `/api/teacher/classes/${encodeURIComponent(slug)}/students`,
        { method: 'POST', body: JSON.stringify({ student_id: row.id }) },
        token,
      );
      toast.success('Đã thêm học sinh');
      setStudentQuery('');
      setStudentOpts([]);
      await loadRoster();
    } catch (err) {
      toast.error(err.data?.error || err.message);
    }
  }

  async function removeStudent(id) {
    if (!slug) return;
    try {
      await apiFetch(`/api/teacher/classes/${encodeURIComponent(slug)}/students/${id}`, { method: 'DELETE' }, token);
      toast.success('Đã xóa học sinh');
      await loadRoster();
    } catch (err) {
      toast.error(err.data?.error || err.message);
    }
  }

  function openNewLecture() {
    setLecEditing(null);
    setLecForm({ title: '', blocks: [newLectureBlock()], published: true, sort_order: 0 });
    setLecDialog(true);
  }

  function openEditLecture(row) {
    setLecEditing(row);
    setLecForm({
      title: row.title || '',
      blocks: blocksFromLectureForForm(row),
      published: row.published !== false,
      sort_order: row.sort_order ?? 0,
    });
    setLecDialog(true);
  }

  async function saveLecture(e) {
    e.preventDefault();
    if (!slug || !lecForm.title.trim()) {
      toast.error(DASH_ADMIN.LECTURE_TITLE_REQUIRED);
      return;
    }
    const blocks = normalizeBlocksForApi(lecForm.blocks);
    if (!blocks.length) {
      toast.error(DASH_ADMIN.LECTURE_BLOCKS_EMPTY);
      return;
    }
    try {
      if (!lecEditing) {
        await apiFetch(
          `/api/teacher/classes/${encodeURIComponent(slug)}/lectures`,
          {
            method: 'POST',
            body: JSON.stringify({
              title: lecForm.title.trim(),
              blocks,
              sort_order: Number(lecForm.sort_order) || 0,
              published: lecForm.published,
            }),
          },
          token,
        );
      } else {
        await apiFetch(
          `/api/teacher/lectures/${lecEditing.id}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              title: lecForm.title.trim(),
              blocks,
              sort_order: Number(lecForm.sort_order) || 0,
              published: lecForm.published,
            }),
          },
          token,
        );
      }
      setLecDialog(false);
      await loadPack();
    } catch (err) {
      toast.error(err.data?.error || err.message);
    }
  }

  async function deleteLecture(id) {
    if (!confirm('Xóa bài giảng?')) return;
    try {
      await apiFetch(`/api/teacher/lectures/${id}`, { method: 'DELETE' }, token);
      await loadPack();
    } catch (err) {
      toast.error(err.data?.error || err.message);
    }
  }

  function openNewQuiz() {
    setQuizEditing(null);
    setQuizForm({ title: '', description: '', questions: [newQuizFormRow()], sort_order: 0 });
    setQuizDialog(true);
  }

  function openEditQuiz(row) {
    setQuizEditing(row);
    setQuizForm({
      title: row.title || '',
      description: row.description || '',
      questions: quizFormRowsFromApi(row.questions),
      sort_order: row.sort_order ?? 0,
    });
    setQuizDialog(true);
  }

  async function saveQuiz(e) {
    e.preventDefault();
    if (!slug || !quizForm.title.trim()) return;
    const built = buildQuizPayloadFromFormRows(quizForm.questions);
    if (built.error === 'NEED_QUESTION') {
      toast.error(DASH_ADMIN.QUIZ_NEED_QUESTION);
      return;
    }
    if (built.error === 'OPTIONS_REQUIRED') {
      toast.error(DASH_ADMIN.QUIZ_OPTIONS_REQUIRED);
      return;
    }
    const questions = built.questions;
    try {
      if (!quizEditing) {
        await apiFetch(
          `/api/teacher/classes/${encodeURIComponent(slug)}/quizzes`,
          {
            method: 'POST',
            body: JSON.stringify({
              title: quizForm.title.trim(),
              description: quizForm.description.trim() || null,
              questions,
              sort_order: Number(quizForm.sort_order) || 0,
            }),
          },
          token,
        );
      } else {
        await apiFetch(
          `/api/teacher/quizzes/${quizEditing.id}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              title: quizForm.title.trim(),
              description: quizForm.description.trim() || null,
              questions,
              sort_order: Number(quizForm.sort_order) || 0,
            }),
          },
          token,
        );
      }
      setQuizDialog(false);
      await loadPack();
    } catch (err) {
      toast.error(err.data?.error || err.message);
    }
  }

  async function deleteQuiz(id) {
    if (!confirm('Xóa bài kiểm tra?')) return;
    try {
      await apiFetch(`/api/teacher/quizzes/${id}`, { method: 'DELETE' }, token);
      await loadPack();
    } catch (err) {
      toast.error(err.data?.error || err.message);
    }
  }

  function openNewSchedule() {
    setSchEditing(null);
    setSchForm({
      title: '',
      starts_at: '',
      ends_at: '',
      location: '',
      meeting_url: '',
      notes: '',
      sort_order: 0,
    });
    setSchDialog(true);
  }

  function openEditSchedule(row) {
    setSchEditing(row);
    setSchForm({
      title: row.title || '',
      starts_at: row.starts_at ? String(row.starts_at).slice(0, 16) : '',
      ends_at: row.ends_at ? String(row.ends_at).slice(0, 16) : '',
      location: row.location || '',
      meeting_url: row.meeting_url || '',
      notes: row.notes || '',
      sort_order: row.sort_order ?? 0,
    });
    setSchDialog(true);
  }

  async function saveSchedule(e) {
    e.preventDefault();
    if (!slug || !schForm.title.trim() || !schForm.starts_at) return;
    try {
      if (!schEditing) {
        await apiFetch(
          `/api/teacher/classes/${encodeURIComponent(slug)}/schedules`,
          {
            method: 'POST',
            body: JSON.stringify({
              title: schForm.title.trim(),
              starts_at: schForm.starts_at,
              ends_at: schForm.ends_at || null,
              location: schForm.location.trim() || null,
              meeting_url: schForm.meeting_url.trim() || null,
              notes: schForm.notes.trim() || null,
              sort_order: Number(schForm.sort_order) || 0,
            }),
          },
          token,
        );
      } else {
        await apiFetch(
          `/api/teacher/schedules/${schEditing.id}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              title: schForm.title.trim(),
              starts_at: schForm.starts_at,
              ends_at: schForm.ends_at || null,
              location: schForm.location.trim() || null,
              meeting_url: schForm.meeting_url.trim() || null,
              notes: schForm.notes.trim() || null,
              sort_order: Number(schForm.sort_order) || 0,
            }),
          },
          token,
        );
      }
      setSchDialog(false);
      await loadPack();
    } catch (err) {
      toast.error(err.data?.error || err.message);
    }
  }

  async function deleteSchedule(id) {
    if (!confirm('Xóa lịch học?')) return;
    try {
      await apiFetch(`/api/teacher/schedules/${id}`, { method: 'DELETE' }, token);
      await loadPack();
    } catch (err) {
      toast.error(err.data?.error || err.message);
    }
  }

  if (loadingList) {
    return (
      <Box className="flex min-h-[40vh] items-center justify-center">
        <CircularProgress />
      </Box>
    );
  }

  const s = dashStats?.summary;

  return (
    <>
      <PageHeader
        title={DASH_TEACHER.TITLE}
        crumbs={[
          { label: PAGE.HOME_CRUMB, to: '/' },
          { label: COMMON.DASH_CRUMB, to: '/dashboard' },
          { label: DASH_TEACHER.CRUMB, active: true },
        ]}
      />
      <Box className="container mx-auto max-w-6xl px-4 py-6">
        <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5 }} className="font-display">
          {greeting}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {DASH_TEACHER.LEAD}
        </Typography>

        <Box sx={{ mb: 3 }}>
          <AdminSectionCard title={DASH_TEACHER.STATS_SECTION}>
            {dashStatsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
                    gap: 2,
                    mb: 3,
                  }}
                >
                  <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>
                      {DASH_TEACHER.STATS_CLASSES}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
                      {s?.classCount ?? 0}
                    </Typography>
                  </Paper>
                  <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>
                      {DASH_TEACHER.STATS_ENROLLMENTS}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
                      {s?.studentEnrollments ?? 0}
                    </Typography>
                  </Paper>
                  <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>
                      {DASH_TEACHER.STATS_LECTURES}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
                      {s?.lectureCount ?? 0}
                    </Typography>
                  </Paper>
                  <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>
                      {DASH_TEACHER.STATS_QUIZZES}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
                      {s?.quizCount ?? 0}
                    </Typography>
                  </Paper>
                  <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>
                      {DASH_TEACHER.STATS_SCHEDULES}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
                      {s?.scheduleCount ?? 0}
                    </Typography>
                  </Paper>
                  <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>
                      {DASH_TEACHER.STATS_ATTEMPTS}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
                      {s?.attemptCount ?? 0}
                    </Typography>
                  </Paper>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2, maxWidth: 720 }}>
                  {DASH_TEACHER.STATS_ENROLLMENTS_HINT}
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                    gap: 2,
                    minHeight: 280,
                  }}
                >
                  <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, bgcolor: 'background.paper' }}>
                    <Typography variant="subtitle1" className="font-display" sx={{ fontWeight: 800, mb: 1.5 }}>
                      {DASH_TEACHER.CHART_STUDENTS_BY_CLASS}
                    </Typography>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={studentsByClassBars} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" interval={0} angle={-28} textAnchor="end" height={56} tick={{ fontSize: 10 }} />
                        <YAxis allowDecimals={false} width={36} />
                        <RechartsTooltip />
                        <Bar
                          dataKey="count"
                          name={DASH_TEACHER.CHART_LEGEND_STUDENTS}
                          fill={chartPrimary}
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </Paper>
                  <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, bgcolor: 'background.paper' }}>
                    <Typography variant="subtitle1" className="font-display" sx={{ fontWeight: 800, mb: 1.5 }}>
                      {DASH_TEACHER.CHART_ATTEMPTS_30D}
                    </Typography>
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={dashStats?.attemptsByDay || []} margin={{ top: 8, right: 16, left: 0, bottom: 48 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="day" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" height={52} />
                        <YAxis allowDecimals={false} width={36} />
                        <RechartsTooltip />
                        <Line
                          type="monotone"
                          dataKey="count"
                          name={DASH_TEACHER.CHART_LEGEND_ATTEMPTS}
                          stroke={chartSecondary}
                          strokeWidth={2}
                          dot
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </Paper>
                </Box>
              </>
            )}
          </AdminSectionCard>
        </Box>

        {classes.length === 0 ? (
          <Paper sx={{ p: 4, borderRadius: 2 }}>
            <Typography>{DASH_TEACHER.NO_CLASSES}</Typography>
          </Paper>
        ) : (
          <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              <FormControl size="small" sx={{ minWidth: 260 }}>
                <InputLabel id="pick-class">{DASH_TEACHER.SELECT_CLASS}</InputLabel>
                <Select
                  labelId="pick-class"
                  label={DASH_TEACHER.SELECT_CLASS}
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setSubTab('overview');
                  }}
                >
                  {classes.map((c) => (
                    <MenuItem key={c.id} value={c.slug}>
                      {c.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <Tabs
              value={subTab}
              onChange={(_, v) => setSubTab(v)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ px: 1, borderBottom: 1, borderColor: 'divider' }}
            >
              {SUB_TABS.map((k) => (
                <Tab
                  key={k}
                  value={k}
                  label={
                    k === 'overview'
                      ? DASH_TEACHER.TAB_OVERVIEW
                      : k === 'lectures'
                        ? DASH_TEACHER.TAB_LECTURES
                        : k === 'quizzes'
                          ? DASH_TEACHER.TAB_QUIZZES
                          : k === 'students'
                            ? DASH_TEACHER.TAB_STUDENTS
                            : k === 'schedule'
                              ? DASH_TEACHER.TAB_SCHEDULE
                              : DASH_TEACHER.TAB_ATTEMPTS
                  }
                />
              ))}
            </Tabs>
            <Box sx={{ p: 2 }}>
              {packLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <>
                  {subTab === 'overview' && klass && (
                    <Box component="form" onSubmit={saveOverview}>
                      <Stack spacing={2} sx={{ maxWidth: 560 }}>
                        <TextField
                          label="Tên lớp"
                          value={overviewForm.name}
                          onChange={(e) => setOverviewForm((f) => ({ ...f, name: e.target.value }))}
                          size="small"
                          required
                        />
                        <TextField
                          label="Mô tả"
                          value={overviewForm.description}
                          onChange={(e) => setOverviewForm((f) => ({ ...f, description: e.target.value }))}
                          size="small"
                          multiline
                          minRows={2}
                        />
                        <TextField
                          label={DASH_TEACHER.CLASS_COVER_URL}
                          value={overviewForm.image_url}
                          onChange={(e) => setOverviewForm((f) => ({ ...f, image_url: e.target.value }))}
                          size="small"
                          helperText={DASH_TEACHER.CLASS_COVER_HINT}
                          fullWidth
                        />
                        <FormControl size="small">
                          <InputLabel>Trạng thái</InputLabel>
                          <Select
                            label="Trạng thái"
                            value={overviewForm.status}
                            onChange={(e) => setOverviewForm((f) => ({ ...f, status: e.target.value }))}
                          >
                            <MenuItem value="active">Đang mở</MenuItem>
                            <MenuItem value="archived">Lưu trữ</MenuItem>
                          </Select>
                        </FormControl>
                        <TextField
                          label="Bắt đầu"
                          type="datetime-local"
                          value={overviewForm.starts_at}
                          onChange={(e) => setOverviewForm((f) => ({ ...f, starts_at: e.target.value }))}
                          size="small"
                          InputLabelProps={{ shrink: true }}
                        />
                        <TextField
                          label="Kết thúc"
                          type="datetime-local"
                          value={overviewForm.ends_at}
                          onChange={(e) => setOverviewForm((f) => ({ ...f, ends_at: e.target.value }))}
                          size="small"
                          InputLabelProps={{ shrink: true }}
                        />
                        <Button type="submit" variant="contained">
                          {COMMON.SAVE}
                        </Button>
                      </Stack>
                    </Box>
                  )}

                  {subTab === 'lectures' && (
                    <Stack spacing={2}>
                      <Button variant="contained" onClick={openNewLecture}>
                        {DASH_TEACHER.BTN_ADD_LECTURE}
                      </Button>
                      <AdminDataTable>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={adminHeaderCellSx}>Tiêu đề</TableCell>
                            <TableCell sx={adminHeaderCellSx}>Xuất bản</TableCell>
                            <TableCell align="right" sx={adminHeaderCellSx}>
                              Thao tác
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {lectures.map((row) => (
                            <TableRow key={row.id} sx={adminBodyRowSx}>
                              <TableCell>{row.title}</TableCell>
                              <TableCell>{row.published ? COMMON.YES : COMMON.NO}</TableCell>
                              <TableCell align="right">
                                <Button size="small" onClick={() => openEditLecture(row)}>
                                  Sửa
                                </Button>
                                <Button size="small" color="error" onClick={() => deleteLecture(row.id)}>
                                  {COMMON.DELETE}
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </AdminDataTable>
                    </Stack>
                  )}

                  {subTab === 'quizzes' && (
                    <Stack spacing={2}>
                      <Button variant="contained" onClick={openNewQuiz}>
                        {DASH_TEACHER.BTN_ADD_QUIZ}
                      </Button>
                      <Typography variant="caption" color="text.secondary">
                        {DASH_TEACHER.QUIZ_FORM_HINT}
                      </Typography>
                      <AdminDataTable>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={adminHeaderCellSx}>Tiêu đề</TableCell>
                            <TableCell align="right" sx={adminHeaderCellSx}>
                              Thao tác
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {quizzes.map((row) => (
                            <TableRow key={row.id} sx={adminBodyRowSx}>
                              <TableCell>{row.title}</TableCell>
                              <TableCell align="right">
                                <Button size="small" onClick={() => openEditQuiz(row)}>
                                  Sửa
                                </Button>
                                <Button size="small" color="error" onClick={() => deleteQuiz(row.id)}>
                                  {COMMON.DELETE}
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </AdminDataTable>
                    </Stack>
                  )}

                  {subTab === 'students' && (
                    <Stack spacing={2}>
                      <Autocomplete
                        options={studentOpts}
                        getOptionLabel={(o) => `${o.full_name || ''} ${o.email || ''}`.trim() || o.id}
                        inputValue={studentQuery}
                        onInputChange={(_, v) => setStudentQuery(v)}
                        onChange={(_, v) => {
                          if (v) void addStudentRow(v);
                        }}
                        renderInput={(params) => <TextField {...params} label={DASH_TEACHER.STUDENT_SEARCH} size="small" />}
                      />
                      <AdminDataTable>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={adminHeaderCellSx}>Tên</TableCell>
                            <TableCell sx={adminHeaderCellSx}>Email</TableCell>
                            <TableCell align="right" sx={adminHeaderCellSx}>
                              Xóa
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {roster.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={3}>
                                <Typography color="text.secondary">{DASH_TEACHER.ROSTER_EMPTY}</Typography>
                              </TableCell>
                            </TableRow>
                          ) : (
                            roster.map((r) => (
                              <TableRow key={r.id} sx={adminBodyRowSx}>
                                <TableCell>{r.student?.full_name || '—'}</TableCell>
                                <TableCell>{r.student?.email || '—'}</TableCell>
                                <TableCell align="right">
                                  <Button size="small" color="error" onClick={() => removeStudent(r.student_id)}>
                                    {COMMON.DELETE}
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </AdminDataTable>
                    </Stack>
                  )}

                  {subTab === 'schedule' && (
                    <Stack spacing={2}>
                      <Button variant="contained" onClick={openNewSchedule}>
                        {DASH_TEACHER.BTN_ADD_SCHEDULE}
                      </Button>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Tiêu đề</TableCell>
                            <TableCell>Bắt đầu</TableCell>
                            <TableCell align="right">Thao tác</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {schedules.map((row) => (
                            <TableRow key={row.id}>
                              <TableCell>{row.title}</TableCell>
                              <TableCell>{row.starts_at ? new Date(row.starts_at).toLocaleString() : '—'}</TableCell>
                              <TableCell align="right">
                                <Button size="small" onClick={() => openEditSchedule(row)}>
                                  Sửa
                                </Button>
                                <Button size="small" color="error" onClick={() => deleteSchedule(row.id)}>
                                  Xóa
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Stack>
                  )}

                  {subTab === 'attempts' && (
                    <Stack spacing={2}>
                      <AdminDataTable>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={adminHeaderCellSx}>Học sinh</TableCell>
                            <TableCell sx={adminHeaderCellSx}>Bài kiểm tra</TableCell>
                            <TableCell sx={adminHeaderCellSx}>Điểm</TableCell>
                            <TableCell sx={adminHeaderCellSx}>Thời gian</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {attempts.map((a) => (
                            <TableRow key={a.id} sx={adminBodyRowSx}>
                              <TableCell>{a.student_name || a.student_email || a.student_id}</TableCell>
                              <TableCell>{a.quiz_title || '—'}</TableCell>
                              <TableCell>
                                {a.correct}/{a.total} ({a.percent}%)
                              </TableCell>
                              <TableCell>{a.submitted_at ? new Date(a.submitted_at).toLocaleString() : '—'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </AdminDataTable>
                    </Stack>
                  )}
                </>
              )}
            </Box>
          </Paper>
        )}
      </Box>

      <Dialog open={lecDialog} onClose={() => setLecDialog(false)} fullWidth maxWidth="md" component="form" onSubmit={saveLecture}>
        <DialogTitle>{lecEditing ? DASH_ADMIN.LECTURE_DIALOG_EDIT : DASH_ADMIN.LECTURE_DIALOG_ADD}</DialogTitle>
        <Divider />
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField
            size="small"
            label={DASH_ADMIN.LECTURE_TITLE}
            value={lecForm.title}
            onChange={(e) => setLecForm((f) => ({ ...f, title: e.target.value }))}
            required
            fullWidth
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              size="small"
              type="number"
              label={DASH_ADMIN.CLASS_LECTURE_SORT}
              value={lecForm.sort_order}
              onChange={(e) => setLecForm((f) => ({ ...f, sort_order: e.target.value === '' ? 0 : Number(e.target.value) }))}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={lecForm.published}
                  onChange={(e) => setLecForm((f) => ({ ...f, published: e.target.checked }))}
                />
              }
              label={DASH_ADMIN.CLASS_LECTURE_PUBLISHED}
            />
          </Stack>
          <AdminLectureBlocksEditor blocks={lecForm.blocks} onBlocksChange={(next) => setLecForm((f) => ({ ...f, blocks: next }))} />
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={() => setLecDialog(false)}>
            {COMMON.CANCEL}
          </Button>
          <Button type="submit" variant="contained">
            {COMMON.SAVE}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={quizDialog} onClose={() => setQuizDialog(false)} fullWidth maxWidth="md" component="form" onSubmit={saveQuiz}>
        <DialogTitle>{quizEditing ? DASH_ADMIN.QUIZ_DIALOG_EDIT : DASH_ADMIN.QUIZ_DIALOG_ADD}</DialogTitle>
        <Divider />
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2, maxHeight: 'min(85vh, 720px)', overflow: 'auto' }}>
          <TextField
            size="small"
            label={DASH_ADMIN.QUIZ_TITLE}
            value={quizForm.title}
            onChange={(e) => setQuizForm((f) => ({ ...f, title: e.target.value }))}
            required
            fullWidth
          />
          <TextField
            size="small"
            label={DASH_ADMIN.QUIZ_DESC}
            value={quizForm.description}
            onChange={(e) => setQuizForm((f) => ({ ...f, description: e.target.value }))}
            fullWidth
            multiline
            minRows={2}
          />
          <TextField
            size="small"
            label={DASH_ADMIN.CLASS_LECTURE_SORT}
            type="number"
            value={quizForm.sort_order}
            onChange={(e) => setQuizForm((f) => ({ ...f, sort_order: e.target.value }))}
            sx={{ maxWidth: 200 }}
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
                  fullWidth
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
                  fullWidth
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
                  fullWidth
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
                  fullWidth
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
                  fullWidth
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
            onClick={() => setQuizForm((f) => ({ ...f, questions: [...f.questions, newQuizFormRow()] }))}
          >
            {DASH_ADMIN.ADD_QUIZ_QUESTION}
          </Button>
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={() => setQuizDialog(false)}>
            {COMMON.CANCEL}
          </Button>
          <Button type="submit" variant="contained">
            {COMMON.SAVE}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={schDialog} onClose={() => setSchDialog(false)} fullWidth maxWidth="sm" component="form" onSubmit={saveSchedule}>
        <DialogTitle>{schEditing ? 'Sửa lịch học' : 'Thêm lịch học'}</DialogTitle>
        <Divider />
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField
            label={DASH_TEACHER.SCHEDULE_TITLE}
            value={schForm.title}
            onChange={(e) => setSchForm((f) => ({ ...f, title: e.target.value }))}
            required
          />
          <TextField
            label={DASH_TEACHER.SCHEDULE_START}
            type="datetime-local"
            value={schForm.starts_at}
            onChange={(e) => setSchForm((f) => ({ ...f, starts_at: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            required
          />
          <TextField
            label={DASH_TEACHER.SCHEDULE_END}
            type="datetime-local"
            value={schForm.ends_at}
            onChange={(e) => setSchForm((f) => ({ ...f, ends_at: e.target.value }))}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label={DASH_TEACHER.SCHEDULE_LOCATION}
            value={schForm.location}
            onChange={(e) => setSchForm((f) => ({ ...f, location: e.target.value }))}
          />
          <TextField
            label={DASH_TEACHER.SCHEDULE_URL}
            value={schForm.meeting_url}
            onChange={(e) => setSchForm((f) => ({ ...f, meeting_url: e.target.value }))}
          />
          <TextField
            label={DASH_TEACHER.SCHEDULE_NOTES}
            value={schForm.notes}
            onChange={(e) => setSchForm((f) => ({ ...f, notes: e.target.value }))}
            multiline
            minRows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={() => setSchDialog(false)}>
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
