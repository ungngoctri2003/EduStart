import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Link as MuiLink,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tab,
  Tabs,
  Typography,
  TextField,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
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
import { ChevronDown, Award } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../components/PageHeader';
import { AdminSectionCard } from '../components/admin/AdminSectionCard';
import { useAuth } from '../context/useAuth';
import { apiFetch, apiFetchBinary } from '../lib/api';
import { classCoverUrl } from '../lib/classCoverUrl';
import { COMMON, COURSE_DETAIL, DASH_STUDENT, ERR } from '../strings/vi';

function mapClassRefundSubmitError(code) {
  if (code === 'REASON_TOO_SHORT') return DASH_STUDENT.REFUND_ERR_SHORT;
  if (code === 'REASON_TOO_LONG') return DASH_STUDENT.REFUND_ERR_LONG;
  if (code === 'REFUND_REQUEST_PENDING') return DASH_STUDENT.REFUND_ERR_PENDING;
  return null;
}

const STUDENT_TAB_KEYS = ['overview', 'certificates'];

function formatQuizScoreShort(correct, total, percent) {
  return DASH_STUDENT.QUIZ_SCORE_SHORT.replace('{correct}', String(correct))
    .replace('{total}', String(total))
    .replace('{percent}', String(percent));
}

function toLocalYMD(iso) {
  const x = new Date(iso);
  if (Number.isNaN(x.getTime())) return null;
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

function lastNLocalDayKeys(n) {
  const keys = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const dt = new Date(base);
    dt.setDate(dt.getDate() - i);
    keys.push(
      `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`,
    );
  }
  return keys;
}

export function DashboardStudent() {
  const theme = useTheme();
  const chartPrimary = theme.palette.primary.main;
  const chartSecondary = theme.palette.secondary.main;
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
  const [refundDlgOpen, setRefundDlgOpen] = useState(false);
  const [refundMembershipId, setRefundMembershipId] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [learnAccordionExpandedId, setLearnAccordionExpandedId] = useState(null);
  const learnAccordionAutoOpenedRef = useRef(false);
  const learnAccordionUserToggledRef = useRef(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const tab = useMemo(() => {
    const t = searchParams.get('tab');
    return STUDENT_TAB_KEYS.includes(t) ? t : 'overview';
  }, [searchParams]);
  const setTab = useCallback(
    (v) => {
      if (!STUDENT_TAB_KEYS.includes(v)) return;
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (v === 'overview') next.delete('tab');
          else next.set('tab', v);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const [certItems, setCertItems] = useState([]);
  const [certLoading, setCertLoading] = useState(false);

  useEffect(() => {
    if (tab !== 'certificates' || !session?.access_token) {
      if (!session?.access_token) setCertItems([]);
      return undefined;
    }
    let cancelled = false;
    setCertLoading(true);
    void (async () => {
      try {
        const data = await apiFetch('/api/certificates/me/status', {}, session.access_token);
        if (!cancelled) setCertItems(Array.isArray(data?.items) ? data.items : []);
      } catch (e) {
        if (!cancelled) {
          setCertItems([]);
          toast.error(e.message || DASH_STUDENT.CERT_LOAD_ERROR);
        }
      } finally {
        if (!cancelled) setCertLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, session?.access_token]);

  useEffect(() => {
    learnAccordionAutoOpenedRef.current = false;
    learnAccordionUserToggledRef.current = false;
    setLearnAccordionExpandedId(null);
  }, [session?.access_token]);

  useEffect(() => {
    if (learnLoading || rows.length === 0 || learnAccordionAutoOpenedRef.current || learnAccordionUserToggledRef.current) {
      return;
    }
    for (const r of rows) {
      const slug = r.courses?.slug;
      if (!slug) continue;
      const pack = learnBySlug[slug];
      if (!pack) continue;
      const nLec = pack.lectures?.length ?? 0;
      const nQz = pack.quizzes?.length ?? 0;
      if (nLec > 0 || nQz > 0) {
        setLearnAccordionExpandedId(r.id);
        learnAccordionAutoOpenedRef.current = true;
        return;
      }
    }
    learnAccordionAutoOpenedRef.current = true;
  }, [learnLoading, rows, learnBySlug]);

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

  const loadClassMemberships = useCallback(async () => {
    if (!session?.access_token) {
      setClassMemberships([]);
      return;
    }
    setClassMembershipsLoading(true);
    try {
      const data = await apiFetch('/api/class-learn/me', {}, session.access_token);
      setClassMemberships(Array.isArray(data) ? data : []);
    } catch (e) {
      setClassMemberships([]);
      toast.error(e.message || DASH_STUDENT.LOAD_CLASSES_ERROR);
    } finally {
      setClassMembershipsLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    void loadClassMemberships();
  }, [loadClassMemberships]);

  const submitClassRefund = useCallback(async () => {
    if (!session?.access_token || !refundMembershipId) return;
    setRefundSubmitting(true);
    try {
      await apiFetch(
        '/api/class-refunds',
        {
          method: 'POST',
          body: JSON.stringify({ class_student_id: refundMembershipId, reason: refundReason }),
        },
        session.access_token,
      );
      toast.success(DASH_STUDENT.REFUND_SENT);
      setRefundDlgOpen(false);
      setRefundReason('');
      await loadClassMemberships();
    } catch (err) {
      const mapped = mapClassRefundSubmitError(err.data?.error);
      toast.error(mapped || err.message || DASH_STUDENT.REFUND_ERR_GENERIC);
    } finally {
      setRefundSubmitting(false);
    }
  }, [session?.access_token, refundMembershipId, refundReason, loadClassMemberships]);

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
      _courseSlug: a.course_slug,
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

  const chartAttemptsBySource = useMemo(() => {
    const map = new Map();
    for (const a of allQuizAttempts) {
      const lab = String(a._label || '—').trim() || '—';
      map.set(lab, (map.get(lab) || 0) + 1);
    }
    return [...map.entries()]
      .sort((x, y) => y[1] - x[1])
      .map(([name, count]) => ({
        name: name.length > 22 ? `${name.slice(0, 20)}…` : name,
        count,
      }));
  }, [allQuizAttempts]);

  const chartAttemptsByDay = useMemo(() => {
    const dayKeys = lastNLocalDayKeys(30);
    const byDay = Object.fromEntries(dayKeys.map((k) => [k, 0]));
    for (const a of allQuizAttempts) {
      const ymd = a.submitted_at ? toLocalYMD(a.submitted_at) : null;
      if (ymd && Object.prototype.hasOwnProperty.call(byDay, ymd)) {
        byDay[ymd] += 1;
      }
    }
    return dayKeys.map((k) => {
      const [, mo, d] = k.split('-');
      return { day: `${d}/${mo}`, count: byDay[k] };
    });
  }, [allQuizAttempts]);

  const hasEnrollments = rows.length > 0;
  const attemptMetricsLoading = attemptsLoading || classAttemptsLoading;

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
                  {a._kind === 'classroom' && a._slug && a.quiz_id && a._courseSlug ? (
                    <MuiLink
                      component={Link}
                      to={`/courses/${encodeURIComponent(a._courseSlug)}/classroom/${encodeURIComponent(a._slug)}/quiz/${encodeURIComponent(a.quiz_id)}`}
                      fontWeight={600}
                      variant="body2"
                    >
                      {a.quiz_title || '—'}
                    </MuiLink>
                  ) : a._kind === 'classroom' && a._slug && a.quiz_id ? (
                    <Typography variant="body2">{a.quiz_title || '—'}</Typography>
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

        <Paper
          elevation={0}
          sx={{
            mb: 3,
            borderRadius: 2,
            border: 1,
            borderColor: 'divider',
            overflow: 'hidden',
          }}
        >
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              px: 1,
              bgcolor: (t) => alpha(t.palette.primary.main, 0.04),
              '& .MuiTab-root': { fontWeight: 700, textTransform: 'none', minHeight: 48 },
            }}
          >
            <Tab value="overview" label={DASH_STUDENT.TAB_OVERVIEW} />
            <Tab value="certificates" label={DASH_STUDENT.TAB_CERTIFICATES} />
          </Tabs>
        </Paper>

        {tab === 'overview' ? (
        <>
        {loadFailed ? (
          <Alert severity="error" sx={{ mb: 3 }}>
            {DASH_STUDENT.LOAD_ENROLLMENTS_ERROR}
          </Alert>
        ) : null}

        <Box sx={{ mb: 3 }}>
          <AdminSectionCard overline={DASH_STUDENT.STATS_SECTION_SUB} title={DASH_STUDENT.STATS_SECTION}>
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
                  {DASH_STUDENT.STAT_MY_CLASSES}
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
                  {classMembershipsLoading ? '—' : classMemberships.length}
                </Typography>
              </Paper>
              <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={700}>
                  {DASH_STUDENT.STAT_COURSES}
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
                  {rows.length}
                </Typography>
              </Paper>
              <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={700}>
                  {DASH_STUDENT.STAT_LECTURES}
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
                  {learnLoading && hasEnrollments ? '—' : totals.lectures}
                </Typography>
              </Paper>
              <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={700}>
                  {DASH_STUDENT.STAT_QUIZZES}
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
                  {learnLoading && hasEnrollments ? '—' : totals.quizzes}
                </Typography>
              </Paper>
              <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={700}>
                  {DASH_STUDENT.STAT_QUIZ_ATTEMPTS}
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
                  {attemptMetricsLoading ? '—' : quizAttemptStats.count}
                </Typography>
              </Paper>
              <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={700}>
                  {DASH_STUDENT.STAT_QUIZ_AVG}
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
                  {attemptMetricsLoading ? '—' : quizAttemptStats.count ? `${quizAttemptStats.avgPercent}%` : '—'}
                </Typography>
              </Paper>
            </Box>
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
                  {DASH_STUDENT.CHART_ATTEMPTS_BY_SOURCE}
                </Typography>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartAttemptsBySource} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" interval={0} angle={-28} textAnchor="end" height={56} tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} width={36} />
                    <RechartsTooltip />
                    <Bar
                      dataKey="count"
                      name={DASH_STUDENT.CHART_LEGEND_ATTEMPT_COUNT}
                      fill={chartPrimary}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
              <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, bgcolor: 'background.paper' }}>
                <Typography variant="subtitle1" className="font-display" sx={{ fontWeight: 800, mb: 1.5 }}>
                  {DASH_STUDENT.CHART_ATTEMPTS_30D}
                </Typography>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={chartAttemptsByDay} margin={{ top: 8, right: 16, left: 0, bottom: 48 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" height={52} />
                    <YAxis allowDecimals={false} width={36} />
                    <RechartsTooltip />
                    <Line
                      type="monotone"
                      dataKey="count"
                      name={DASH_STUDENT.CHART_LEGEND_ATTEMPT_COUNT}
                      stroke={chartSecondary}
                      strokeWidth={2}
                      dot
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Paper>
            </Box>
          </AdminSectionCard>
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
              <Button component={Link} to="/courses" variant="outlined" color="primary" sx={{ mt: 2 }}>
                {DASH_STUDENT.CTA_BROWSE_CLASSES}
              </Button>
            </Paper>
          ) : (
            <Stack spacing={2}>
              {classMemberships.map((m) => {
                const c = m.class;
                const courseSlug = c.course?.slug;
                if (!c?.slug || !courseSlug) return null;
                const nLec = m.counts?.lectures ?? 0;
                const nQz = m.counts?.quizzes ?? 0;
                const doneCert = Boolean(m.certificate_eligible);
                const paid = m.payment_status === 'approved';
                const refunded = m.payment_status === 'refunded';
                const ref = m.refund_request;
                const refPending = ref?.status === 'pending';
                const refRejected = ref?.status === 'rejected' && paid && !refPending;
                const canLearn = paid && !refunded && nLec > 0;
                const showRefundBtn = paid && !refunded && !refPending;
                return (
                  <Paper key={m.membership_id || c.id} elevation={0} sx={{ p: 2, borderRadius: 2, border: 1, borderColor: 'divider' }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ sm: 'center' }}>
                      <Stack direction="row" spacing={2} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
                        <Box
                          component="img"
                          src={classCoverUrl(c)}
                          alt=""
                          sx={{
                            width: 88,
                            height: 56,
                            borderRadius: 1,
                            objectFit: 'cover',
                            flexShrink: 0,
                            bgcolor: 'action.hover',
                          }}
                        />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography fontWeight={800}>{c.name}</Typography>
                          <Typography variant="caption" color="text.secondary" component="span" sx={{ display: 'block', mt: 0.25 }}>
                            {DASH_STUDENT.CHIP_LECTURES.replace('{n}', String(nLec))} · {DASH_STUDENT.CHIP_QUIZZES.replace('{n}', String(nQz))}
                          </Typography>
                          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
                            {refunded ? (
                              <Chip size="small" color="default" variant="outlined" label={DASH_STUDENT.REFUND_MEMBERSHIP_REFUNDED} />
                            ) : null}
                            {refPending ? (
                              <Chip size="small" color="warning" label={DASH_STUDENT.REFUND_PENDING_BADGE} sx={{ fontWeight: 700 }} />
                            ) : null}
                            {doneCert ? (
                              <>
                                <Chip size="small" color="success" variant="filled" label={DASH_STUDENT.CLASS_STATUS_COMPLETED} sx={{ fontWeight: 700 }} />
                                <Chip
                                  size="small"
                                  variant="outlined"
                                  color="primary"
                                  icon={<Award style={{ width: 14, height: 14 }} aria-hidden />}
                                  label={DASH_STUDENT.CLASS_CERT_BADGE}
                                />
                              </>
                            ) : null}
                            {refRejected ? (
                              <Chip size="small" variant="outlined" label={DASH_STUDENT.REFUND_LAST_REJECTED} />
                            ) : null}
                          </Stack>
                        </Box>
                      </Stack>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {showRefundBtn ? (
                          <Button
                            variant="outlined"
                            size="small"
                            color="primary"
                            onClick={() => {
                              setRefundMembershipId(m.membership_id || '');
                              setRefundReason('');
                              setRefundDlgOpen(true);
                            }}
                          >
                            {DASH_STUDENT.REFUND_BTN}
                          </Button>
                        ) : null}
                        <Button
                          variant="outlined"
                          size="small"
                          disabled={!canLearn}
                          onClick={() => {
                            void (async () => {
                              try {
                                const pack = await apiFetch(
                                  `/api/class-learn/courses/${encodeURIComponent(courseSlug)}/classes/${encodeURIComponent(c.slug)}`,
                                  {},
                                  session?.access_token,
                                );
                                const first = pack?.lectures?.[0];
                                if (first?.id) {
                                  window.location.assign(
                                    `/courses/${encodeURIComponent(courseSlug)}/classroom/${encodeURIComponent(c.slug)}/lecture/${encodeURIComponent(first.id)}`,
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

        <Stack spacing={3} sx={{ mt: 3 }}>
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
                  {rows.map((r) => {
                    const slug = r.courses?.slug;
                    if (!slug) return null;
                    const pack = learnBySlug[slug];
                    const lectures = pack?.lectures || [];
                    const quizzes = pack?.quizzes || [];
                    const courseTitle = r.courses?.title || slug;
                    return (
                      <Accordion
                        key={`acc-${r.id}`}
                        expanded={learnAccordionExpandedId === r.id}
                        onChange={(_, isExpanded) => {
                          learnAccordionUserToggledRef.current = true;
                          setLearnAccordionExpandedId(isExpanded ? r.id : null);
                        }}
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

            {quizHistoryBlock}
        </Stack>
        </>
        ) : null}

        {tab === 'certificates' ? (
          <Box sx={{ pb: 2 }}>
            <AdminSectionCard overline={DASH_STUDENT.CERT_SECTION_SUB} title={DASH_STUDENT.CERT_SECTION_TITLE}>
              {certLoading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 3 }}>
                  <CircularProgress size={22} color="primary" />
                  <Typography variant="body2" color="text.secondary">
                    {COMMON.LOADING}
                  </Typography>
                </Box>
              ) : null}
              {!certLoading && certItems.length === 0 ? (
                <Typography color="text.secondary" variant="body2" sx={{ py: 2 }}>
                  {DASH_STUDENT.CERT_EMPTY}
                </Typography>
              ) : null}
              {!certLoading && certItems.length > 0 ? (
                <Box sx={{ overflowX: 'auto' }}>
                  <Table size="small" sx={{ minWidth: 720 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>{DASH_STUDENT.CERT_TH_SCOPE}</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>{DASH_STUDENT.CERT_TH_LECTURES}</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>{DASH_STUDENT.CERT_TH_QUIZZES}</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>{DASH_STUDENT.CERT_TH_SCHEDULE}</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>{DASH_STUDENT.CERT_TH_STATUS}</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="right">
                          {DASH_STUDENT.CERT_TH_ACTION}
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {certItems.map((item, idx) => {
                        const kindLabel = item.kind === 'class' ? DASH_STUDENT.CERT_KIND_CLASS : DASH_STUDENT.CERT_KIND_COURSE;
                        const scope =
                          item.kind === 'class'
                            ? [item.class_name, item.course_title].filter(Boolean).join(' · ') || '—'
                            : item.course_title || '—';
                        const sched = item.schedule;
                        let schedLabel = DASH_STUDENT.CERT_SCHEDULE_NA;
                        if (sched?.applicable) {
                          if ((sched.sessions ?? 0) === 0) schedLabel = DASH_STUDENT.CERT_SCHEDULE_EMPTY;
                          else schedLabel = sched.ok ? DASH_STUDENT.CERT_SCHEDULE_OK : DASH_STUDENT.CERT_SCHEDULE_WAIT;
                        }
                        return (
                          <TableRow key={`${item.kind}-${item.course_slug || ''}-${item.class_slug || idx}`}>
                            <TableCell sx={{ maxWidth: 260 }}>
                              <Typography variant="body2" fontWeight={600}>
                                {scope}
                              </Typography>
                              <Chip size="small" label={kindLabel} variant="outlined" sx={{ mt: 0.75 }} />
                            </TableCell>
                            <TableCell>{`${item.lectures?.done ?? 0}/${item.lectures?.total ?? 0}`}</TableCell>
                            <TableCell>{`${item.quizzes?.passed ?? 0}/${item.quizzes?.total ?? 0}`}</TableCell>
                            <TableCell>{schedLabel}</TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                color={item.eligible ? 'success' : 'default'}
                                label={item.eligible ? DASH_STUDENT.CERT_STATUS_ELIGIBLE : DASH_STUDENT.CERT_STATUS_PENDING}
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Button
                                size="small"
                                variant="contained"
                                color="primary"
                                disabled={!item.eligible || !session?.access_token}
                                onClick={() => {
                                  void (async () => {
                                    try {
                                      if (item.kind === 'course' && item.course_slug) {
                                        await apiFetchBinary(
                                          `/api/certificates/course/${encodeURIComponent(item.course_slug)}/pdf`,
                                          {
                                            accessToken: session.access_token,
                                            filename: `chung-chi-${item.course_slug}.pdf`,
                                          },
                                        );
                                      } else if (item.kind === 'class' && item.class_slug) {
                                        const cs = item.course_slug || '_';
                                        await apiFetchBinary(
                                          `/api/certificates/class/${encodeURIComponent(cs)}/${encodeURIComponent(item.class_slug)}/pdf`,
                                          {
                                            accessToken: session.access_token,
                                            filename: `chung-chi-lop-${item.class_slug}.pdf`,
                                          },
                                        );
                                      }
                                    } catch (e) {
                                      toast.error(e.message || DASH_STUDENT.CERT_DOWNLOAD_ERR);
                                    }
                                  })();
                                }}
                              >
                                {DASH_STUDENT.CERT_DOWNLOAD}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Box>
              ) : null}
            </AdminSectionCard>
          </Box>
        ) : null}
      </Box>

      <Dialog
        open={refundDlgOpen}
        onClose={() => {
          if (!refundSubmitting) setRefundDlgOpen(false);
        }}
        maxWidth="sm"
        fullWidth
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submitClassRefund();
          }}
        >
          <DialogTitle>{DASH_STUDENT.REFUND_DIALOG_TITLE}</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {DASH_STUDENT.REFUND_DIALOG_LEAD}
            </Typography>
            <TextField
              autoFocus
              fullWidth
              multiline
              minRows={4}
              label={DASH_STUDENT.REFUND_REASON_LABEL}
              placeholder={DASH_STUDENT.REFUND_REASON_HELPER}
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              disabled={refundSubmitting}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button type="button" onClick={() => setRefundDlgOpen(false)} disabled={refundSubmitting}>
              {COMMON.CANCEL}
            </Button>
            <Button type="submit" variant="contained" disabled={refundSubmitting}>
              {refundSubmitting ? COMMON.PLEASE_WAIT : DASH_STUDENT.REFUND_SEND}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}
