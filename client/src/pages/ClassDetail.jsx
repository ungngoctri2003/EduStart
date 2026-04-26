import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Calendar, CalendarDays, ChevronRight, ClipboardList, GraduationCap, ListVideo, Users } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/useAuth';
import { ImageReveal, ScrollSection } from '../motion/ScrollBlock';
import { CLASS_DETAIL, COURSE_DETAIL } from '../strings/vi';
import { COMMON } from '../strings/vi';
import { ERR } from '../strings/vi';

function stripEnrollSearch(pathname, search) {
  const sp = new URLSearchParams(search);
  sp.delete('enroll');
  const q = sp.toString();
  return q ? `${pathname}?${q}` : pathname;
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

export function ClassDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { session, profile } = useAuth();
  const [klass, setKlass] = useState(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [myClasses, setMyClasses] = useState(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  const [nonStudentDialogOpen, setNonStudentDialogOpen] = useState(false);
  const [learnTab, setLearnTab] = useState(0);
  const [learnPack, setLearnPack] = useState({ lectures: [], quizzes: [], schedules: [] });
  const autoEnrollRunning = useRef(false);
  const reduce = useReducedMotion() ?? false;

  const isStudent = profile?.role === 'student';
  const classId = klass?.id;
  const isInClass =
    Boolean(classId) && Array.isArray(myClasses) && myClasses.some((m) => m.class?.id === classId);

  const fetchLearnContent = useCallback(async () => {
    if (!slug || !session?.access_token || !isStudent) return;
    setContentLoading(true);
    try {
      const data = await apiFetch(`/api/class-learn/classes/${encodeURIComponent(slug)}`, {}, session.access_token);
      setLearnPack({
        lectures: data.lectures || [],
        quizzes: data.quizzes || [],
        schedules: data.schedules || [],
      });
    } catch (e) {
      if (e.status === 403 && e.data?.error === 'NOT_IN_CLASS') {
        setLearnPack({ lectures: [], quizzes: [], schedules: [] });
      }
    } finally {
      setContentLoading(false);
    }
  }, [slug, session?.access_token, isStudent]);

  const refreshMyClasses = useCallback(async () => {
    if (!session?.access_token || !isStudent) {
      setMyClasses([]);
      return;
    }
    try {
      const data = await apiFetch('/api/class-learn/me', {}, session.access_token);
      setMyClasses(data || []);
    } catch {
      setMyClasses([]);
    }
  }, [session?.access_token, isStudent]);

  useEffect(() => {
    let cancelled = false;
    setErr('');
    (async () => {
      try {
        const data = await apiFetch(`/api/classes/${encodeURIComponent(slug)}`);
        if (!cancelled) setKlass(data);
      } catch (e) {
        if (!cancelled) setErr(e.message || ERR.NOT_FOUND);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!classId || !session || !isStudent) {
        if (!cancelled) setMyClasses(session && !isStudent ? [] : null);
        return;
      }
      try {
        const data = await apiFetch('/api/class-learn/me', {}, session.access_token);
        if (!cancelled) setMyClasses(data || []);
      } catch {
        if (!cancelled) setMyClasses([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [classId, session?.access_token, session, isStudent]);

  useEffect(() => {
    if (!isInClass || !isStudent || !slug || !session?.access_token) return;
    void fetchLearnContent();
  }, [isInClass, isStudent, slug, session?.access_token, fetchLearnContent]);

  useEffect(() => {
    return () => {
      autoEnrollRunning.current = false;
    };
  }, [slug]);

  useEffect(() => {
    if (location.hash === '#lectures-section') setLearnTab(0);
    if (location.hash === '#quizzes-section') setLearnTab(1);
    if (location.hash === '#schedules-section') setLearnTab(2);
  }, [location.hash]);

  useEffect(() => {
    if (searchParams.get('enroll') !== '1' || !classId || !session || !isStudent) return;
    if (myClasses === null) return;
    if (autoEnrollRunning.current) return;
    autoEnrollRunning.current = true;

    const cleanPath = stripEnrollSearch(location.pathname, location.search);
    const joined = myClasses.some((m) => m.class?.id === classId);

    (async () => {
      try {
        if (!joined) {
          try {
            await apiFetch(
              '/api/class-enrollments',
              { method: 'POST', body: JSON.stringify({ class_id: classId }) },
              session.access_token,
            );
            setMsg(CLASS_DETAIL.ENROLL_SUCCESS);
          } catch (e) {
            if (e.status === 409) {
              setMsg(CLASS_DETAIL.ENROLL_SUCCESS);
            } else {
              setMsg(e.data?.error || e.message || ERR.ENROLL_CLASS_FAILED);
            }
          }
          await refreshMyClasses();
        }
        navigate(cleanPath, { replace: true });
      } finally {
        autoEnrollRunning.current = false;
      }
    })();
  }, [searchParams, classId, session, isStudent, myClasses, location.pathname, location.search, navigate, refreshMyClasses]);

  const returnPathForAuth = slug ? `/classes/${slug}?enroll=1` : '/dashboard';

  function openEnrollFlow() {
    setMsg('');
    if (!session) {
      setEnrollDialogOpen(true);
      return;
    }
    if (!isStudent) {
      setNonStudentDialogOpen(true);
      return;
    }
    void enroll();
  }

  async function enroll() {
    setMsg('');
    if (!session) {
      setEnrollDialogOpen(true);
      return;
    }
    if (!isStudent) {
      setNonStudentDialogOpen(true);
      return;
    }
    if (!klass?.id) return;
    setEnrolling(true);
    try {
      await apiFetch(
        '/api/class-enrollments',
        { method: 'POST', body: JSON.stringify({ class_id: klass.id }) },
        session.access_token,
      );
      setMsg(CLASS_DETAIL.ENROLL_SUCCESS);
      await refreshMyClasses();
      await fetchLearnContent();
    } catch (e) {
      if (e.status === 409) {
        setMsg(CLASS_DETAIL.ENROLL_SUCCESS);
        await refreshMyClasses();
        await fetchLearnContent();
      } else {
        setMsg(e.data?.error || e.message || ERR.ENROLL_CLASS_FAILED);
      }
    } finally {
      setEnrolling(false);
    }
  }

  if (err || !klass) {
    return (
      <>
        <PageHeader
          title={CLASS_DETAIL.TITLE_FALLBACK}
          crumbs={[{ label: CLASS_DETAIL.CRUMB, to: '/classes' }, { label: slug || '', active: true }]}
        />
        <Box className="container mx-auto max-w-2xl px-4 py-16">
          {!klass && !err ? (
            <Paper
              elevation={0}
              sx={{
                p: 5,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                borderStyle: 'dashed',
              }}
            >
              <CircularProgress size={32} />
              <Typography color="text.secondary" fontWeight={500}>
                {COMMON.LOADING}
              </Typography>
            </Paper>
          ) : (
            <Alert severity="warning" sx={{ borderRadius: 2 }}>
              {err || COMMON.LOADING}
            </Alert>
          )}
          <Button component={Link} to="/classes" variant="text" color="primary" sx={{ mt: 2, px: 0 }}>
            {CLASS_DETAIL.BACK}
          </Button>
        </Box>
      </>
    );
  }

  const enrollOk = msg === CLASS_DETAIL.ENROLL_SUCCESS;
  const lectures = learnPack.lectures;
  const quizzes = learnPack.quizzes;
  const schedules = learnPack.schedules;
  const locked = !isInClass || !isStudent;
  const showContent = isStudent && isInClass && !contentLoading;
  const showContentSpinner = isStudent && isInClass && contentLoading;
  const teacherName = klass.teacher_name;

  return (
    <>
      <PageHeader
        title={klass.name}
        crumbs={[{ label: CLASS_DETAIL.CRUMB, to: '/classes' }, { label: klass.name, active: true }]}
      />
      <div className="container mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-10 md:grid-cols-2">
          <ImageReveal reduced={reduce} className="min-w-0">
            <Box
              className="h-full min-h-0 overflow-hidden rounded-2xl"
              sx={{ border: 1, borderColor: 'divider', boxShadow: (t) => t.shadows[3] }}
            >
              <Box
                component="img"
                src="/img/banner-3.jpg"
                alt=""
                sx={{ width: '100%', height: '100%', minHeight: 200, objectFit: 'cover', display: 'block' }}
              />
            </Box>
          </ImageReveal>
          <ScrollSection reduced={reduce} className="min-w-0">
            <h2 className="font-display text-3xl font-bold text-primary">{klass.name}</h2>
            <p className="mt-4 text-base-content/80">{klass.description || CLASS_DETAIL.NO_DESC}</p>
            <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1} sx={{ mt: 1.5, rowGap: 1 }}>
              {teacherName ? (
                <Chip
                  size="small"
                  icon={<GraduationCap className="h-3.5 w-3.5" aria-hidden />}
                  label={`${CLASS_DETAIL.TEACHER}: ${teacherName}`}
                  variant="outlined"
                />
              ) : null}
              {klass.starts_at != null ? (
                <Chip
                  size="small"
                  icon={<Calendar className="h-3.5 w-3.5" aria-hidden />}
                  label={`${CLASS_DETAIL.STARTS}: ${fmtDateTime(klass.starts_at)}`}
                  variant="outlined"
                />
              ) : null}
              {klass.ends_at != null ? (
                <Chip
                  size="small"
                  label={`${CLASS_DETAIL.ENDS}: ${fmtDateTime(klass.ends_at)}`}
                  variant="outlined"
                />
              ) : null}
              <Chip
                size="small"
                icon={<Users className="h-3.5 w-3.5" aria-hidden />}
                label={`${CLASS_DETAIL.STUDENTS}: ${klass.student_count != null ? String(klass.student_count) : '—'}`}
                variant="outlined"
              />
            </Stack>
            {msg ? (
              <Alert severity={enrollOk ? 'success' : 'info'} sx={{ mt: 2 }}>
                {msg}
              </Alert>
            ) : null}
            <Stack direction="row" spacing={2} sx={{ mt: 3 }} flexWrap="wrap" useFlexGap>
              {isStudent && isInClass ? (
                <Button type="button" variant="outlined" color="primary" component={Link} to="/dashboard/student#my-classes">
                  {CLASS_DETAIL.GO_DASHBOARD}
                </Button>
              ) : null}
              {isStudent && isInClass ? (
                <Button type="button" variant="text" color="primary" href="#class-learn" sx={{ alignSelf: 'center' }}>
                  {CLASS_DETAIL.GO_STUDY}
                </Button>
              ) : (
                <Button type="button" variant="contained" color="primary" disabled={enrolling} onClick={openEnrollFlow}>
                  {enrolling ? <CircularProgress size={22} color="inherit" sx={{ mr: 1 }} /> : null}
                  {enrolling ? CLASS_DETAIL.ENROLLING : CLASS_DETAIL.ENROLL}
                </Button>
              )}
            </Stack>
          </ScrollSection>
        </div>

        <ScrollSection reduced={reduce} className="mx-auto mt-10 w-full max-w-[920px]">
          <Box
            id="class-learn"
            component="section"
            sx={{ scrollMarginTop: { xs: 72, md: 96 }, mb: 6, width: 1 }}
          >
            <Paper
              elevation={0}
              sx={{
                borderRadius: 3,
                overflow: 'hidden',
                bgcolor: 'background.paper',
                boxShadow: (t) => t.shadows[2],
              }}
            >
              <Tabs
                value={learnTab}
                onChange={(_, v) => setLearnTab(v)}
                variant="fullWidth"
                sx={(theme) => ({
                  minHeight: 52,
                  borderBottom: `1px solid ${theme.palette.divider}`,
                  bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.06 : 0.04),
                  '& .MuiTab-root': { py: 1.5, fontWeight: 700, typography: 'body1' },
                })}
              >
                <Tab
                  id="class-lectures-tab"
                  aria-controls="lectures-section"
                  label={CLASS_DETAIL.SECTION_LECTURES}
                  onClick={() => {
                    setLearnTab(0);
                    window.history.replaceState(null, '', '#lectures-section');
                  }}
                />
                <Tab
                  id="class-quizzes-tab"
                  aria-controls="quizzes-section"
                  label={CLASS_DETAIL.SECTION_QUIZZES}
                  onClick={() => {
                    setLearnTab(1);
                    window.history.replaceState(null, '', '#quizzes-section');
                  }}
                />
                <Tab
                  id="class-schedules-tab"
                  aria-controls="schedules-section"
                  label={CLASS_DETAIL.SCHEDULES_TITLE}
                  onClick={() => {
                    setLearnTab(2);
                    window.history.replaceState(null, '', '#schedules-section');
                  }}
                />
              </Tabs>

              <Box
                id="lectures-section"
                role="tabpanel"
                hidden={learnTab !== 0}
                sx={{ display: learnTab === 0 ? 'block' : 'none', p: { xs: 2, sm: 2.5, md: 3 } }}
              >
                {showContentSpinner ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
                    <CircularProgress size={28} />
                    <Typography color="text.secondary">{COMMON.LOADING}</Typography>
                  </Box>
                ) : null}
                {locked && !showContentSpinner ? (
                  <Alert severity="info" sx={{ borderRadius: 2 }}>
                    {CLASS_DETAIL.LOCKED_HINT}
                  </Alert>
                ) : null}
                {showContent && lectures.length === 0 ? (
                  <Paper elevation={0} sx={{ py: 4, textAlign: 'center', borderStyle: 'dashed', borderRadius: 2 }}>
                    <ListVideo className="mx-auto mb-2 h-10 w-10 opacity-35" aria-hidden />
                    <Typography color="text.secondary">{CLASS_DETAIL.NO_LECTURES}</Typography>
                  </Paper>
                ) : null}
                {showContent && lectures.length > 0 ? (
                  <Stack spacing={1.25}>
                    {lectures.map((lec, li) => {
                      const blocks = Array.isArray(lec.blocks) ? lec.blocks : [];
                      const nBlocks = blocks.length;
                      const to = `/classroom/${encodeURIComponent(slug)}/lecture/${encodeURIComponent(lec.id)}`;
                      return (
                        <Paper
                          key={lec.id}
                          component={Link}
                          to={to}
                          elevation={0}
                          sx={(theme) => ({
                            border: `1px solid ${theme.palette.divider}`,
                            borderRadius: 2,
                            textDecoration: 'none',
                            color: 'inherit',
                            display: 'block',
                            '&:hover': {
                              borderColor: alpha(theme.palette.primary.main, 0.45),
                              bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.06 : 0.03),
                            },
                          })}
                        >
                          <Box sx={{ px: 2, py: 1.25, display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Box
                              sx={(theme) => ({
                                width: 36,
                                height: 36,
                                borderRadius: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 800,
                                fontSize: '0.875rem',
                                flexShrink: 0,
                                bgcolor: alpha(theme.palette.primary.main, 0.15),
                                color: 'primary.main',
                              })}
                            >
                              {li + 1}
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography sx={{ fontWeight: 700, typography: 'subtitle1' }}>{lec.title}</Typography>
                              {nBlocks > 0 ? (
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                                  {COURSE_DETAIL.LECTURE_PARTS.replace('{n}', String(nBlocks))}
                                </Typography>
                              ) : null}
                            </Box>
                            <ChevronRight className="h-5 w-5 shrink-0 opacity-55" aria-hidden />
                          </Box>
                        </Paper>
                      );
                    })}
                  </Stack>
                ) : null}
              </Box>

              <Box
                id="quizzes-section"
                role="tabpanel"
                hidden={learnTab !== 1}
                sx={{ display: learnTab === 1 ? 'block' : 'none', p: { xs: 2, sm: 2.5, md: 3 } }}
              >
                {locked && !showContentSpinner ? (
                  <Alert severity="info" sx={{ borderRadius: 2 }}>
                    {CLASS_DETAIL.LOCKED_QUIZZES}
                  </Alert>
                ) : null}
                {showContent && quizzes.length === 0 ? (
                  <Paper elevation={0} sx={{ py: 4, textAlign: 'center', borderStyle: 'dashed', borderRadius: 2 }}>
                    <ClipboardList className="mx-auto mb-2 h-10 w-10 opacity-35" aria-hidden />
                    <Typography color="text.secondary">{CLASS_DETAIL.NO_QUIZZES}</Typography>
                  </Paper>
                ) : null}
                {showContent && quizzes.length > 0 ? (
                  <Stack spacing={1.25}>
                    {quizzes.map((quiz, qIdx) => {
                      const nQ = Array.isArray(quiz.questions) ? quiz.questions.length : 0;
                      const to = `/classroom/${encodeURIComponent(slug)}/quiz/${encodeURIComponent(quiz.id)}`;
                      return (
                        <Paper
                          key={quiz.id}
                          component={Link}
                          to={to}
                          elevation={0}
                          sx={(theme) => ({
                            border: `1px solid ${theme.palette.divider}`,
                            borderRadius: 2,
                            textDecoration: 'none',
                            color: 'inherit',
                            display: 'block',
                            '&:hover': {
                              borderColor: alpha(theme.palette.primary.main, 0.45),
                              bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.06 : 0.03),
                            },
                          })}
                        >
                          <Box sx={{ px: 2, py: 1.25, display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Box
                              sx={(theme) => ({
                                width: 36,
                                height: 36,
                                borderRadius: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 800,
                                fontSize: '0.875rem',
                                flexShrink: 0,
                                bgcolor: alpha(theme.palette.secondary?.main || theme.palette.primary.main, 0.15),
                                color: 'secondary.main',
                              })}
                            >
                              {qIdx + 1}
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography sx={{ fontWeight: 700, typography: 'subtitle1' }}>{quiz.title}</Typography>
                              {nQ > 0 ? (
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                                  {CLASS_DETAIL.QUIZ_Q_COUNT.replace('{n}', String(nQ))}
                                </Typography>
                              ) : null}
                            </Box>
                            <ChevronRight className="h-5 w-5 shrink-0 opacity-55" aria-hidden />
                          </Box>
                        </Paper>
                      );
                    })}
                  </Stack>
                ) : null}
              </Box>

              <Box
                id="schedules-section"
                role="tabpanel"
                hidden={learnTab !== 2}
                sx={{ display: learnTab === 2 ? 'block' : 'none', p: { xs: 2, sm: 2.5, md: 3 } }}
              >
                {locked && !showContentSpinner ? (
                  <Alert severity="info" sx={{ borderRadius: 2 }}>
                    {CLASS_DETAIL.LOCKED_SCHEDULE}
                  </Alert>
                ) : null}
                {showContent && schedules.length === 0 ? (
                  <Typography color="text.secondary">{CLASS_DETAIL.SCHEDULE_TBA}</Typography>
                ) : null}
                {showContent && schedules.length > 0 ? (
                  <Stack spacing={1.5}>
                    {schedules.map((s) => (
                      <Paper key={s.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                          <CalendarDays className="h-5 w-5 text-primary" aria-hidden />
                          <Typography fontWeight={800}>{s.title}</Typography>
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          {fmtDateTime(s.starts_at)}
                          {s.ends_at ? ` — ${fmtDateTime(s.ends_at)}` : ''}
                        </Typography>
                        {s.location ? (
                          <Typography variant="body2" sx={{ mt: 0.5 }}>
                            {s.location}
                          </Typography>
                        ) : null}
                        {s.meeting_url ? (
                          <Button size="small" href={s.meeting_url} target="_blank" rel="noreferrer" sx={{ mt: 1 }}>
                            Link
                          </Button>
                        ) : null}
                      </Paper>
                    ))}
                  </Stack>
                ) : null}
              </Box>
            </Paper>
          </Box>
        </ScrollSection>
      </div>

      <Dialog open={enrollDialogOpen} onClose={() => setEnrollDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{CLASS_DETAIL.DIALOG_AUTH_TITLE}</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            {CLASS_DETAIL.DIALOG_AUTH_BODY}
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Button onClick={() => setEnrollDialogOpen(false)}>{COMMON.CANCEL}</Button>
          <Button variant="outlined" component={Link} to="/login" state={{ from: returnPathForAuth }} onClick={() => setEnrollDialogOpen(false)}>
            {CLASS_DETAIL.DIALOG_LOGIN}
          </Button>
          <Button variant="contained" component={Link} to="/signup" state={{ from: returnPathForAuth }} onClick={() => setEnrollDialogOpen(false)}>
            {CLASS_DETAIL.DIALOG_SIGNUP}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={nonStudentDialogOpen} onClose={() => setNonStudentDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{CLASS_DETAIL.DIALOG_ROLE_TITLE}</DialogTitle>
        <DialogContent>
          <Alert severity="warning">{CLASS_DETAIL.ONLY_STUDENT}</Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setNonStudentDialogOpen(false)}>{COMMON.CANCEL}</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
