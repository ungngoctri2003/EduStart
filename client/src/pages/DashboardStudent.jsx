import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CardMedia,
  Chip,
  CircularProgress,
  LinearProgress,
  Link as MuiLink,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Award, BookOpen, ChevronDown, ClipboardList, GraduationCap, History } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../components/PageHeader';
import { useAuth } from '../context/useAuth';
import { apiFetch } from '../lib/api';
import { COMMON, COURSE_DETAIL, COURSES_PAGE, DASH_STUDENT, ERR } from '../strings/vi';

function formatQuizScoreShort(correct, total, percent) {
  return DASH_STUDENT.QUIZ_SCORE_SHORT.replace('{correct}', String(correct))
    .replace('{total}', String(total))
    .replace('{percent}', String(percent));
}

function StatTile({ icon, label, value, loading }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.25,
        borderRadius: 2,
        height: '100%',
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
          borderColor: (t) => alpha(t.palette.primary.main, 0.35),
          boxShadow: (t) => t.shadows[2],
        },
      }}
    >
      <Stack direction="row" spacing={1.75} alignItems="flex-start">
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 44,
            height: 44,
            borderRadius: 2,
            flexShrink: 0,
            bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
            color: 'primary.main',
          }}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: 0.02, display: 'block' }}>
            {label}
          </Typography>
          <Typography
            variant="h5"
            sx={{
              fontFamily: "'Outfit', ui-sans-serif, system-ui, sans-serif",
              fontWeight: 800,
              mt: 0.35,
              lineHeight: 1.15,
            }}
          >
            {loading ? '—' : value}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

export function DashboardStudent() {
  const { session, profile } = useAuth();
  const [rows, setRows] = useState([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [learnBySlug, setLearnBySlug] = useState(() => ({}));
  const [learnLoading, setLearnLoading] = useState(false);
  const [quizAttempts, setQuizAttempts] = useState([]);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [classMemberships, setClassMemberships] = useState([]);
  const [classMembershipsLoading, setClassMembershipsLoading] = useState(false);
  const [classQuizAttempts, setClassQuizAttempts] = useState([]);
  const [classAttemptsLoading, setClassAttemptsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch('/api/enrollments/me', {}, session?.access_token);
        if (!cancelled) {
          setRows(data || []);
          setLoadFailed(false);
        }
      } catch (e) {
        if (!cancelled) {
          setLoadFailed(true);
          toast.error(e.message || ERR.LOAD_ENROLLMENTS);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.access_token]);

  useEffect(() => {
    let cancelled = false;
    if (!session?.access_token) {
      setQuizAttempts([]);
      setClassQuizAttempts([]);
      return () => {
        cancelled = true;
      };
    }
    void Promise.resolve().then(() => {
      if (!cancelled) setAttemptsLoading(true);
    });
    (async () => {
      try {
        const data = await apiFetch('/api/learn/quiz-attempts/me', {}, session.access_token);
        if (!cancelled) {
          setQuizAttempts(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        if (!cancelled) {
          setQuizAttempts([]);
          toast.error(e.message || ERR.LOAD_QUIZ_ATTEMPTS);
        }
      } finally {
        if (!cancelled) setAttemptsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.access_token]);

  useEffect(() => {
    let cancelled = false;
    if (!session?.access_token) {
      setClassMemberships([]);
      return () => {
        cancelled = true;
      };
    }
    void Promise.resolve().then(() => {
      if (!cancelled) setClassMembershipsLoading(true);
    });
    (async () => {
      try {
        const data = await apiFetch('/api/class-learn/me', {}, session.access_token);
        if (!cancelled) setClassMemberships(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!cancelled) {
          setClassMemberships([]);
          toast.error(e.message || DASH_STUDENT.LOAD_CLASSES_ERROR);
        }
      } finally {
        if (!cancelled) setClassMembershipsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.access_token]);

  useEffect(() => {
    let cancelled = false;
    if (!session?.access_token) {
      setClassQuizAttempts([]);
      return () => {
        cancelled = true;
      };
    }
    void Promise.resolve().then(() => {
      if (!cancelled) setClassAttemptsLoading(true);
    });
    (async () => {
      try {
        const data = await apiFetch('/api/class-learn/quiz-attempts/me', {}, session.access_token);
        if (!cancelled) setClassQuizAttempts(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) {
          setClassQuizAttempts([]);
        }
      } finally {
        if (!cancelled) setClassAttemptsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.access_token]);

  const slugsOrdered = useMemo(() => {
    const out = [];
    const seen = new Set();
    for (const r of rows) {
      const slug = r.courses?.slug;
      if (slug && !seen.has(slug)) {
        seen.add(slug);
        out.push(slug);
      }
    }
    return out;
  }, [rows]);

  useEffect(() => {
    if (!session?.access_token || slugsOrdered.length === 0) {
      let cancelledEmpty = false;
      void Promise.resolve().then(() => {
        if (cancelledEmpty) return;
        setLearnBySlug({});
        setLearnLoading(false);
      });
      return () => {
        cancelledEmpty = true;
      };
    }
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) setLearnLoading(true);
    });
    (async () => {
      const entries = await Promise.all(
        slugsOrdered.map(async (slug) => {
          try {
            const data = await apiFetch(`/api/learn/courses/${encodeURIComponent(slug)}`, {}, session.access_token);
            return [slug, { lectures: data?.lectures || [], quizzes: data?.quizzes || [], ok: true }];
          } catch {
            return [slug, { lectures: [], quizzes: [], ok: false }];
          }
        }),
      );
      if (cancelled) return;
      const next = {};
      for (const [slug, pack] of entries) {
        next[slug] = pack;
      }
      setLearnBySlug(next);
      setLearnLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.access_token, slugsOrdered]);

  const greeting = useMemo(() => {
    const name = profile?.full_name?.trim();
    if (name) return DASH_STUDENT.GREETING.replace('{name}', name);
    return DASH_STUDENT.GREETING_FALLBACK;
  }, [profile?.full_name]);

  const totals = useMemo(() => {
    let lectures = 0;
    let quizzes = 0;
    for (const slug of slugsOrdered) {
      const pack = learnBySlug[slug];
      if (!pack) continue;
      lectures += pack.lectures?.length ?? 0;
      quizzes += pack.quizzes?.length ?? 0;
    }
    return { lectures, quizzes };
  }, [slugsOrdered, learnBySlug]);

  const allQuizAttempts = useMemo(() => {
    const course = (quizAttempts || []).map((a) => ({
      ...a,
      _kind: 'course',
      _label: a.course_title,
      _slug: a.course_slug,
    }));
    const klass = (classQuizAttempts || []).map((a) => ({
      ...a,
      _kind: 'classroom',
      _label: a.class_name,
      _slug: a.class_slug,
    }));
    return [...klass, ...course].sort((x, y) => {
      const tx = x.submitted_at ? new Date(x.submitted_at).getTime() : 0;
      const ty = y.submitted_at ? new Date(y.submitted_at).getTime() : 0;
      return ty - tx;
    });
  }, [quizAttempts, classQuizAttempts]);

  const latestAttemptByQuizId = useMemo(() => {
    const map = new Map();
    for (const a of allQuizAttempts) {
      if (!a.quiz_id || map.has(a.quiz_id)) continue;
      map.set(a.quiz_id, a);
    }
    return map;
  }, [allQuizAttempts]);

  const quizAttemptStats = useMemo(() => {
    const n = allQuizAttempts.length;
    const avg = n === 0 ? 0 : Math.round(allQuizAttempts.reduce((s, a) => s + (a.percent ?? 0), 0) / n);
    return { count: n, avgPercent: avg };
  }, [allQuizAttempts]);

  const hasEnrollments = rows.length > 0;
  const statGridSx = {
    display: 'grid',
    gap: 2,
    gridTemplateColumns: {
      xs: 'repeat(2, minmax(0, 1fr))',
      sm: 'repeat(3, minmax(0, 1fr))',
      lg: 'repeat(5, minmax(0, 1fr))',
    },
  };

  const quizHistoryBlock = (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 2,
        border: 1,
        borderColor: 'divider',
        overflow: 'hidden',
        bgcolor: 'background.paper',
      }}
    >
      <Box sx={{ px: 2.5, py: 2, borderBottom: 1, borderColor: 'divider', bgcolor: (t) => alpha(t.palette.primary.main, 0.04) }}>
        <Typography variant="subtitle1" sx={{ fontFamily: "'Outfit', ui-sans-serif, system-ui, sans-serif", fontWeight: 700 }}>
          {DASH_STUDENT.SECTION_QUIZ_HISTORY}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
          {DASH_STUDENT.SECTION_QUIZ_HISTORY_SUB}
        </Typography>
      </Box>
      {attemptsLoading || classAttemptsLoading ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 3 }}>
          <CircularProgress size={22} color="primary" />
          <Typography variant="body2" color="text.secondary">
            {COMMON.LOADING}
          </Typography>
        </Box>
      ) : null}
      {!attemptsLoading && !classAttemptsLoading && allQuizAttempts.length === 0 ? (
        <Typography color="text.secondary" variant="body2" sx={{ p: 2.5 }}>
          {DASH_STUDENT.EMPTY_QUIZ_HISTORY}
        </Typography>
      ) : null}
      {!attemptsLoading && !classAttemptsLoading && allQuizAttempts.length > 0 ? (
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 280 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, bgcolor: 'action.hover', py: 1.25 }}>{DASH_STUDENT.TH_COURSE}</TableCell>
              <TableCell sx={{ fontWeight: 700, bgcolor: 'action.hover', py: 1.25 }}>{DASH_STUDENT.TH_QUIZ_NAME}</TableCell>
              <TableCell sx={{ fontWeight: 700, bgcolor: 'action.hover', py: 1.25 }}>{DASH_STUDENT.TH_QUIZ_SCORE}</TableCell>
              <TableCell sx={{ fontWeight: 700, bgcolor: 'action.hover', py: 1.25 }}>{DASH_STUDENT.TH_QUIZ_DATE}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {allQuizAttempts.slice(0, 25).map((a) => (
              <TableRow
                key={`${a._kind}-${a.id}`}
                sx={{
                  '&:nth-of-type(even)': { bgcolor: 'action.hover' },
                  '&:last-child td': { borderBottom: 0 },
                }}
              >
                <TableCell sx={{ maxWidth: 140, py: 1.25 }}>
                  <Typography variant="body2" noWrap title={a._label || undefined}>
                    {a._label || '—'}
                  </Typography>
                </TableCell>
                <TableCell sx={{ py: 1.25 }}>
                  {a._kind === 'classroom' && a._slug && a.quiz_id ? (
                    <MuiLink
                      component={Link}
                      to={`/classroom/${encodeURIComponent(a._slug)}/quiz/${encodeURIComponent(a.quiz_id)}`}
                      fontWeight={600}
                      variant="body2"
                    >
                      {a.quiz_title || '—'}
                    </MuiLink>
                  ) : a._kind === 'course' && a._slug && a.quiz_id ? (
                    <MuiLink component={Link} to={`/courses/${a._slug}/quiz/${encodeURIComponent(a.quiz_id)}`} fontWeight={600} variant="body2">
                      {a.quiz_title || '—'}
                    </MuiLink>
                  ) : (
                    <Typography variant="body2">{a.quiz_title || '—'}</Typography>
                  )}
                </TableCell>
                <TableCell sx={{ py: 1.25, whiteSpace: 'nowrap' }}>{formatQuizScoreShort(a.correct, a.total, a.percent)}</TableCell>
                <TableCell sx={{ py: 1.25, whiteSpace: 'nowrap', color: 'text.secondary', fontSize: '0.8125rem' }}>
                  {a.submitted_at ? new Date(a.submitted_at).toLocaleString() : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </Box>
      ) : null}
    </Paper>
  );

  return (
    <>
      <PageHeader title={DASH_STUDENT.TITLE} crumbs={[{ label: COMMON.DASH_CRUMB, active: true }]} />
      <Box
        component="div"
        className="container mx-auto max-w-6xl px-4"
        sx={{
          py: { xs: 3, md: 4 },
          pb: { xs: 6, md: 8 },
        }}
      >
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, sm: 3 },
            mb: 3,
            borderRadius: 2,
            border: 1,
            borderColor: 'divider',
            background: (t) =>
              `linear-gradient(135deg, ${alpha(t.palette.primary.main, 0.08)} 0%, ${alpha(t.palette.primary.main, 0.02)} 48%, ${t.palette.background.paper} 100%)`,
            boxShadow: (t) => `0 1px 0 ${alpha(t.palette.common.black, 0.04)}`,
          }}
        >
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ sm: 'flex-start' }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="h5"
                component="p"
                sx={{
                  fontFamily: "'Outfit', ui-sans-serif, system-ui, sans-serif",
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: 'text.primary',
                }}
              >
                {greeting}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, maxWidth: 520 }}>
                {DASH_STUDENT.LEAD}
              </Typography>
            </Box>
            <Button component={Link} to="/courses" variant="contained" color="primary" sx={{ flexShrink: 0, alignSelf: { xs: 'stretch', sm: 'center' } }}>
              {DASH_STUDENT.CTA_BROWSE_COURSES}
            </Button>
          </Stack>
        </Paper>

        {loadFailed ? (
          <Alert severity="error" sx={{ mb: 3 }}>
            {DASH_STUDENT.LOAD_ENROLLMENTS_ERROR}
          </Alert>
        ) : null}

        <Box sx={statGridSx}>
          <StatTile icon={<GraduationCap size={22} strokeWidth={2} aria-hidden />} label={DASH_STUDENT.STAT_COURSES} value={rows.length} loading={false} />
          <StatTile
            icon={<BookOpen size={22} strokeWidth={2} aria-hidden />}
            label={DASH_STUDENT.STAT_LECTURES}
            value={totals.lectures}
            loading={learnLoading && hasEnrollments}
          />
          <StatTile
            icon={<ClipboardList size={22} strokeWidth={2} aria-hidden />}
            label={DASH_STUDENT.STAT_QUIZZES}
            value={totals.quizzes}
            loading={learnLoading && hasEnrollments}
          />
          <StatTile
            icon={<History size={22} strokeWidth={2} aria-hidden />}
            label={DASH_STUDENT.STAT_QUIZ_ATTEMPTS}
            value={quizAttemptStats.count}
            loading={attemptsLoading || classAttemptsLoading}
          />
          <StatTile
            icon={<Award size={22} strokeWidth={2} aria-hidden />}
            label={DASH_STUDENT.STAT_QUIZ_AVG}
            value={quizAttemptStats.count ? `${quizAttemptStats.avgPercent}%` : '—'}
            loading={attemptsLoading || classAttemptsLoading}
          />
        </Box>

        <Box id="my-classes" sx={{ mt: 3 }}>
          <Typography variant="h6" component="h2" sx={{ fontFamily: "'Outfit', ui-sans-serif, system-ui, sans-serif", fontWeight: 700 }}>
            {DASH_STUDENT.SECTION_MY_CLASSES}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
            {DASH_STUDENT.SECTION_MY_CLASSES_SUB}
          </Typography>
          {classMembershipsLoading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 2 }}>
              <CircularProgress size={22} />
              <Typography variant="body2" color="text.secondary">
                {COMMON.LOADING}
              </Typography>
            </Box>
          ) : classMemberships.length === 0 ? (
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, border: 1, borderColor: 'divider' }}>
              <Typography color="text.secondary" variant="body2">
                {DASH_STUDENT.EMPTY_CLASSES}
              </Typography>
              <Typography color="text.secondary" variant="caption" sx={{ display: 'block', mt: 1 }}>
                {DASH_STUDENT.CTA_BROWSE_CLASSES_HINT}
              </Typography>
              <Button component={Link} to="/classes" variant="outlined" color="primary" sx={{ mt: 2 }}>
                {DASH_STUDENT.CTA_BROWSE_CLASSES}
              </Button>
            </Paper>
          ) : (
            <Stack spacing={2}>
              {classMemberships.map((m) => {
                const c = m.class;
                if (!c?.slug) return null;
                const nLec = m.counts?.lectures ?? 0;
                const nQz = m.counts?.quizzes ?? 0;
                return (
                  <Paper key={c.id} elevation={0} sx={{ p: 2, borderRadius: 2, border: 1, borderColor: 'divider' }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ sm: 'center' }}>
                      <Box>
                        <Typography fontWeight={800}>{c.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {DASH_STUDENT.CHIP_LECTURES.replace('{n}', String(nLec))} · {DASH_STUDENT.CHIP_QUIZZES.replace('{n}', String(nQz))}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Button
                          variant="outlined"
                          size="small"
                          disabled={nLec === 0}
                          onClick={() => {
                            void (async () => {
                              try {
                                const pack = await apiFetch(
                                  `/api/class-learn/classes/${encodeURIComponent(c.slug)}`,
                                  {},
                                  session?.access_token,
                                );
                                const first = pack?.lectures?.[0];
                                if (first?.id) {
                                  window.location.assign(
                                    `/classroom/${encodeURIComponent(c.slug)}/lecture/${encodeURIComponent(first.id)}`,
                                  );
                                } else {
                                  toast.error(DASH_STUDENT.EMPTY_LECTURES);
                                }
                              } catch {
                                toast.error(ERR.LOAD);
                              }
                            })();
                          }}
                        >
                          {DASH_STUDENT.CLASS_LINK_LEARN}
                        </Button>
                      </Stack>
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </Box>

        <Box
          sx={{
            mt: 3,
            display: 'grid',
            gap: 3,
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) minmax(300px, 380px)' },
            alignItems: 'start',
          }}
        >
          <Stack spacing={3}>
            <Box>
              <Typography variant="h6" component="h2" sx={{ fontFamily: "'Outfit', ui-sans-serif, system-ui, sans-serif", fontWeight: 700 }}>
                {DASH_STUDENT.MY_COURSES}
              </Typography>
              {!loadFailed && rows.length === 0 ? (
                <Paper
                  elevation={0}
                  sx={{
                    mt: 2,
                    p: 3,
                    borderRadius: 2,
                    border: 1,
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                    textAlign: { xs: 'center', sm: 'left' },
                  }}
                >
                  <Typography color="text.secondary" variant="body2">
                    {DASH_STUDENT.EMPTY}
                  </Typography>
                  <Typography color="text.secondary" variant="caption" sx={{ display: 'block', mt: 1 }}>
                    {DASH_STUDENT.CTA_BROWSE_COURSES_HINT}
                  </Typography>
                  <Button component={Link} to="/courses" variant="outlined" color="primary" sx={{ mt: 2 }}>
                    {COURSES_PAGE.ALL_COURSES}
                  </Button>
                </Paper>
              ) : null}
              {rows.length > 0 ? (
                <Stack spacing={2} sx={{ mt: 2 }}>
                  {rows.map((r) => {
                    const title = r.courses?.title || '—';
                    const slug = r.courses?.slug;
                    const thumb = r.courses?.thumbnail_url || '/img/course-1.png';
                    return (
                      <Card
                        key={r.id}
                        elevation={0}
                        sx={{
                          borderRadius: 2,
                          border: 1,
                          borderColor: 'divider',
                          overflow: 'hidden',
                          transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
                          '&:hover': { boxShadow: (t) => t.shadows[3], borderColor: (t) => alpha(t.palette.primary.main, 0.35) },
                        }}
                      >
                        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' } }}>
                          <Box
                            sx={{
                              width: { xs: '100%', sm: 168 },
                              flexShrink: 0,
                              aspectRatio: { xs: '16 / 9', sm: 'auto' },
                              minHeight: { sm: 132 },
                              bgcolor: 'action.hover',
                            }}
                          >
                            <CardMedia component="img" image={thumb} alt="" sx={{ height: '100%', width: '100%', objectFit: 'cover' }} />
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                            <CardContent sx={{ pb: 1, flex: 1 }}>
                              <Typography variant="subtitle1" sx={{ fontFamily: "'Outfit', ui-sans-serif, system-ui, sans-serif", fontWeight: 700 }}>
                                {title}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                {DASH_STUDENT.ENROLLED_ON}{' '}
                                {r.enrolled_at ? new Date(r.enrolled_at).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                              </Typography>
                            </CardContent>
                            <CardActions sx={{ px: 2, pb: 2, pt: 0, flexWrap: 'wrap', gap: 1 }}>
                              {slug ? (
                                <>
                                  <Button component={Link} to={`/courses/${slug}`} variant="contained" color="primary" size="small">
                                    {DASH_STUDENT.GO_STUDY}
                                  </Button>
                                  <Button component={Link} to={`/courses/${slug}#lectures-section`} variant="outlined" color="primary" size="small">
                                    {DASH_STUDENT.LINK_LECTURES}
                                  </Button>
                                  <Button component={Link} to={`/courses/${slug}#quizzes-section`} variant="outlined" color="primary" size="small">
                                    {DASH_STUDENT.LINK_QUIZZES}
                                  </Button>
                                </>
                              ) : null}
                            </CardActions>
                          </Box>
                        </Box>
                      </Card>
                    );
                  })}
                </Stack>
              ) : null}
            </Box>

            <Box>
              <Typography variant="h6" component="h2" sx={{ fontFamily: "'Outfit', ui-sans-serif, system-ui, sans-serif", fontWeight: 700 }}>
                {DASH_STUDENT.SECTION_LEARN_BY_COURSE}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 640 }}>
                {DASH_STUDENT.SECTION_LEARN_BY_COURSE_SUB}
              </Typography>
              {learnLoading && hasEnrollments ? <LinearProgress sx={{ mt: 2, borderRadius: 1, height: 6 }} color="primary" /> : null}
              {!hasEnrollments && !loadFailed ? (
                <Typography color="text.secondary" variant="body2" sx={{ mt: 2 }}>
                  {DASH_STUDENT.EMPTY_LEARN_HINT}
                </Typography>
              ) : null}
              {!learnLoading && hasEnrollments && totals.lectures === 0 && totals.quizzes === 0 ? (
                <Typography color="text.secondary" variant="body2" sx={{ mt: 2 }}>
                  {DASH_STUDENT.EMPTY_LEARN_ALL}
                </Typography>
              ) : null}
              {hasEnrollments ? (
                <Stack spacing={1.5} sx={{ mt: 2 }}>
                  {rows.map((r, index) => {
                    const slug = r.courses?.slug;
                    if (!slug) return null;
                    const pack = learnBySlug[slug];
                    const lectures = pack?.lectures || [];
                    const quizzes = pack?.quizzes || [];
                    const courseTitle = r.courses?.title || slug;
                    const defaultExpanded = index === 0 && (lectures.length > 0 || quizzes.length > 0);
                    return (
                      <Accordion
                        key={`acc-${r.id}`}
                        defaultExpanded={defaultExpanded}
                        disableGutters
                        elevation={0}
                        sx={{
                          borderRadius: 2,
                          border: 1,
                          borderColor: 'divider',
                          bgcolor: 'background.paper',
                          '&:before': { display: 'none' },
                          overflow: 'hidden',
                        }}
                      >
                        <AccordionSummary
                          expandIcon={<ChevronDown size={20} aria-hidden />}
                          sx={{
                            px: 2,
                            minHeight: 56,
                            '& .MuiAccordionSummary-content': { my: 1, alignItems: 'center', gap: 1, flexWrap: 'wrap' },
                          }}
                        >
                          <Typography sx={{ fontWeight: 700, flex: '1 1 auto', minWidth: 0 }}>{courseTitle}</Typography>
                          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap onClick={(e) => e.stopPropagation()}>
                            {lectures.length > 0 ? (
                              <Chip size="small" variant="outlined" label={DASH_STUDENT.CHIP_LECTURES.replace('{n}', String(lectures.length))} />
                            ) : null}
                            {quizzes.length > 0 ? (
                              <Chip size="small" variant="outlined" label={DASH_STUDENT.CHIP_QUIZZES.replace('{n}', String(quizzes.length))} />
                            ) : null}
                            {slug ? (
                              <Button component={Link} to={`/courses/${slug}`} size="small" variant="text" color="primary" sx={{ fontWeight: 600 }}>
                                {DASH_STUDENT.GO_STUDY}
                              </Button>
                            ) : null}
                          </Stack>
                        </AccordionSummary>
                        <AccordionDetails sx={{ px: 2, pb: 2, pt: 0, bgcolor: (t) => alpha(t.palette.common.black, 0.02) }}>
                          {learnLoading && !pack ? (
                            <Typography variant="body2" color="text.secondary">
                              {DASH_STUDENT.LOADING_LEARN}
                            </Typography>
                          ) : null}
                          {!learnLoading && lectures.length === 0 && quizzes.length === 0 ? (
                            <Typography variant="body2" color="text.secondary">
                              {DASH_STUDENT.EMPTY_COURSE_CONTENT}
                            </Typography>
                          ) : null}
                          {lectures.length > 0 ? (
                            <Box>
                              <Typography variant="subtitle2" color="text.primary" sx={{ fontWeight: 700 }}>
                                {DASH_STUDENT.SUBHEAD_LECTURES}
                              </Typography>
                              <Stack spacing={0.75} sx={{ mt: 1 }}>
                                {lectures.map((lec) => {
                                  const nBlocks = Array.isArray(lec.blocks) ? lec.blocks.length : 0;
                                  return (
                                    <Box
                                      key={lec.id}
                                      sx={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: 1,
                                        py: 1,
                                        px: 1.5,
                                        borderRadius: 1.5,
                                        bgcolor: 'background.paper',
                                        border: 1,
                                        borderColor: 'divider',
                                      }}
                                    >
                                      <MuiLink
                                        component={Link}
                                        to={`/courses/${slug}#lectures-section`}
                                        fontWeight={600}
                                        underline="hover"
                                        color="text.primary"
                                        variant="body2"
                                      >
                                        {lec.title || '—'}
                                      </MuiLink>
                                      {nBlocks > 0 ? (
                                        <Chip size="small" label={COURSE_DETAIL.LECTURE_PARTS.replace('{n}', String(nBlocks))} variant="outlined" />
                                      ) : null}
                                    </Box>
                                  );
                                })}
                              </Stack>
                            </Box>
                          ) : null}
                          {quizzes.length > 0 ? (
                            <Box sx={{ mt: lectures.length > 0 ? 2.5 : 0 }}>
                              <Typography variant="subtitle2" color="text.primary" sx={{ fontWeight: 700 }}>
                                {DASH_STUDENT.SUBHEAD_QUIZZES}
                              </Typography>
                              <Stack spacing={0.75} sx={{ mt: 1 }}>
                                {quizzes.map((quiz) => {
                                  const nQ = Array.isArray(quiz.questions) ? quiz.questions.length : 0;
                                  const last = latestAttemptByQuizId.get(quiz.id);
                                  return (
                                    <Box
                                      key={quiz.id}
                                      sx={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: 1,
                                        py: 1,
                                        px: 1.5,
                                        borderRadius: 1.5,
                                        bgcolor: 'background.paper',
                                        border: 1,
                                        borderColor: 'divider',
                                      }}
                                    >
                                      <Box sx={{ minWidth: 0 }}>
                                        <MuiLink
                                          component={Link}
                                          to={`/courses/${slug}/quiz/${encodeURIComponent(quiz.id)}`}
                                          fontWeight={600}
                                          underline="hover"
                                          color="text.primary"
                                          variant="body2"
                                        >
                                          {quiz.title || '—'}
                                        </MuiLink>
                                        {quiz.description ? (
                                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
                                            {quiz.description}
                                          </Typography>
                                        ) : null}
                                        {last ? (
                                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                                            {DASH_STUDENT.QUIZ_LAST_SCORE}: {formatQuizScoreShort(last.correct, last.total, last.percent)}
                                            {last.submitted_at ? ` · ${new Date(last.submitted_at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}` : ''}
                                          </Typography>
                                        ) : null}
                                      </Box>
                                      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                                        {nQ > 0 ? (
                                          <Chip size="small" label={COURSE_DETAIL.QUIZ_Q_COUNT.replace('{n}', String(nQ))} variant="outlined" />
                                        ) : null}
                                        {last ? (
                                          <Chip
                                            size="small"
                                            color="primary"
                                            variant="filled"
                                            label={formatQuizScoreShort(last.correct, last.total, last.percent)}
                                          />
                                        ) : null}
                                      </Stack>
                                    </Box>
                                  );
                                })}
                              </Stack>
                            </Box>
                          ) : null}
                        </AccordionDetails>
                      </Accordion>
                    );
                  })}
                </Stack>
              ) : null}
            </Box>

            <Box sx={{ display: { xs: 'block', lg: 'none' } }}>{quizHistoryBlock}</Box>
          </Stack>

          <Box sx={{ display: { xs: 'none', lg: 'block' }, position: 'sticky', top: 24, alignSelf: 'start' }}>{quizHistoryBlock}</Box>
        </Box>
      </Box>
    </>
  );
}
