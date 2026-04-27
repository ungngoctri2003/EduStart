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
  Divider,
  FormControlLabel,
  Paper,
  Radio,
  RadioGroup,
  Rating,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { BookOpen, ChevronRight, ClipboardList, ListVideo, MessageCircle, Star } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/useAuth';
import { ImageReveal, ScrollSection } from '../motion/ScrollBlock';
import { COURSE_DETAIL, PAYMENT, COMMON, ERR } from '../strings/vi';

function stripEnrollSearch(pathname, search) {
  const sp = new URLSearchParams(search);
  sp.delete('enroll');
  const q = sp.toString();
  return q ? `${pathname}?${q}` : pathname;
}

export function CourseDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { session, profile } = useAuth();
  const [course, setCourse] = useState(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [myEnrollments, setMyEnrollments] = useState(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  const [nonStudentDialogOpen, setNonStudentDialogOpen] = useState(false);
  const [learnTab, setLearnTab] = useState(0);
  const autoEnrollRunning = useRef(false);
  const [reviewBundle, setReviewBundle] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewErr, setReviewErr] = useState('');
  const [reviewFormMsg, setReviewFormMsg] = useState('');
  const [formRating, setFormRating] = useState(5);
  const [formComment, setFormComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [paymentChoiceOpen, setPaymentChoiceOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [paymentNote, setPaymentNote] = useState('');
  const reduce = useReducedMotion() ?? false;

  const isStudent = profile?.role === 'student';
  const courseId = course?.id;
  const courseEnrollment =
    Boolean(courseId) && Array.isArray(myEnrollments)
      ? myEnrollments.find((r) => r.course_id === courseId || r.courses?.id === courseId) ?? null
      : null;
  const hasApprovedAccess =
    Boolean(courseEnrollment) &&
    (courseEnrollment.payment_status === 'approved' || courseEnrollment.payment_status == null);
  const hasPendingEnrollment = courseEnrollment?.payment_status === 'pending';
  const hasRejectedEnrollment = courseEnrollment?.payment_status === 'rejected';

  const fetchLearnContent = useCallback(async () => {
    if (!slug || !session?.access_token || !isStudent) return;
    setContentLoading(true);
    try {
      const data = await apiFetch(`/api/learn/courses/${encodeURIComponent(slug)}`, {}, session.access_token);
      setCourse((prev) => (prev ? { ...prev, lectures: data.lectures || [], quizzes: data.quizzes || [] } : prev));
    } catch (e) {
      if (e.status === 403 && e.data?.error === 'NOT_ENROLLED') {
        setCourse((prev) => (prev ? { ...prev, lectures: [], quizzes: [] } : prev));
      }
    } finally {
      setContentLoading(false);
    }
  }, [slug, session?.access_token, isStudent]);

  const refreshMyEnrollments = useCallback(async () => {
    if (!session?.access_token || !isStudent) {
      setMyEnrollments([]);
      return;
    }
    try {
      const data = await apiFetch('/api/enrollments/me', {}, session.access_token);
      setMyEnrollments(data || []);
    } catch {
      setMyEnrollments([]);
    }
  }, [session?.access_token, isStudent]);

  useEffect(() => {
    let cancelled = false;
    setErr('');
    (async () => {
      try {
        const data = await apiFetch(`/api/courses/${encodeURIComponent(slug)}`);
        if (!cancelled) {
          setCourse(data);
        }
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
      if (!courseId || !session || !isStudent) {
        if (!cancelled) setMyEnrollments(session && !isStudent ? [] : null);
        return;
      }
      try {
        const data = await apiFetch('/api/enrollments/me', {}, session.access_token);
        if (!cancelled) setMyEnrollments(data || []);
      } catch {
        if (!cancelled) setMyEnrollments([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId, session?.access_token, session, isStudent]);

  useEffect(() => {
    if (!hasApprovedAccess || !isStudent || !slug || !session?.access_token) return;
    void fetchLearnContent();
  }, [hasApprovedAccess, isStudent, slug, session?.access_token, fetchLearnContent]);

  useEffect(() => {
    return () => {
      autoEnrollRunning.current = false;
    };
  }, [slug]);

  useEffect(() => {
    if (location.hash === '#lectures-section') setLearnTab(0);
    if (location.hash === '#quizzes-section') setLearnTab(1);
  }, [location.hash]);

  const loadReviews = useCallback(async () => {
    if (!slug) return;
    setReviewErr('');
    setReviewLoading(true);
    try {
      const data = await apiFetch(
        `/api/courses/${encodeURIComponent(slug)}/reviews?limit=40`,
        {},
        session?.access_token ?? null,
      );
      setReviewBundle(data);
      if (data?.myReview) {
        setFormRating(data.myReview.rating);
        setFormComment(data.myReview.comment || '');
      } else {
        setFormRating(5);
        setFormComment('');
      }
    } catch (e) {
      setReviewErr(e.message || ERR.LOAD);
      setReviewBundle(null);
    } finally {
      setReviewLoading(false);
    }
  }, [slug, session?.access_token]);

  useEffect(() => {
    if (!slug) return;
    void loadReviews();
  }, [slug, loadReviews]);

  const submitReview = useCallback(async () => {
    if (!session?.access_token || !slug) return;
    setReviewFormMsg('');
    setReviewSubmitting(true);
    try {
      await apiFetch(
        `/api/learn/courses/${encodeURIComponent(slug)}/reviews`,
        {
          method: 'PUT',
          body: JSON.stringify({ rating: formRating, comment: formComment.trim() ? formComment.trim() : null }),
        },
        session.access_token,
      );
      setReviewFormMsg(COURSE_DETAIL.REVIEW_SAVED);
      await loadReviews();
    } catch (e) {
      setReviewFormMsg(e.data?.error || e.message || COURSE_DETAIL.REVIEW_ERR);
    } finally {
      setReviewSubmitting(false);
    }
  }, [session?.access_token, slug, formRating, formComment, loadReviews]);

  useEffect(() => {
    if (searchParams.get('enroll') !== '1' || !courseId || !session || !isStudent) return;
    if (myEnrollments === null) return;
    if (autoEnrollRunning.current) return;
    autoEnrollRunning.current = true;

    const cleanPath = stripEnrollSearch(location.pathname, location.search);
    const row = myEnrollments.find((r) => r.course_id === courseId || r.courses?.id === courseId);

    (async () => {
      try {
        if (row?.payment_status === 'approved' || (row && row.payment_status == null)) {
          navigate(cleanPath, { replace: true });
          return;
        }
        if (row?.payment_status === 'pending') {
          setMsg(PAYMENT.PENDING_MSG);
          navigate(cleanPath, { replace: true });
          return;
        }
        setPaymentMethod('bank_transfer');
        setPaymentNote('');
        setPaymentChoiceOpen(true);
        navigate(cleanPath, { replace: true });
      } finally {
        autoEnrollRunning.current = false;
      }
    })();
  }, [searchParams, courseId, session, isStudent, myEnrollments, location.pathname, location.search, navigate]);

  const returnPathForAuth = slug ? `/courses/${slug}?enroll=1` : '/dashboard';

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
    setPaymentMethod('bank_transfer');
    setPaymentNote('');
    setPaymentChoiceOpen(true);
  }

  async function confirmPaymentEnroll() {
    setMsg('');
    if (!session) {
      setEnrollDialogOpen(true);
      return;
    }
    if (!isStudent) {
      setNonStudentDialogOpen(true);
      return;
    }
    if (!course?.id) return;
    setEnrolling(true);
    try {
      const res = await apiFetch(
        '/api/enrollments',
        {
          method: 'POST',
          body: JSON.stringify({
            course_id: course.id,
            payment_method: paymentMethod,
            payment_note: paymentNote.trim() ? paymentNote.trim() : null,
          }),
        },
        session.access_token,
      );
      const st = res?.payment_status;
      if (st === 'approved') {
        setMsg(COURSE_DETAIL.ENROLL_SUCCESS);
        await refreshMyEnrollments();
        await fetchLearnContent();
      } else {
        setMsg(PAYMENT.PENDING_MSG);
        await refreshMyEnrollments();
      }
      setPaymentChoiceOpen(false);
    } catch (e) {
      if (e.status === 409) {
        const st = e.data?.payment_status;
        if (st === 'approved') {
          setMsg(COURSE_DETAIL.ENROLL_SUCCESS);
          await refreshMyEnrollments();
          await fetchLearnContent();
          setPaymentChoiceOpen(false);
        } else if (st === 'pending') {
          setMsg(PAYMENT.ALREADY_PENDING);
          await refreshMyEnrollments();
          setPaymentChoiceOpen(false);
        } else {
          setMsg(e.data?.error || e.message || ERR.ENROLL_FAILED);
        }
      } else {
        setMsg(e.data?.error || e.message || ERR.ENROLL_FAILED);
      }
    } finally {
      setEnrolling(false);
    }
  }

  if (err || !course) {
    return (
      <>
        <PageHeader
          title={COURSE_DETAIL.TITLE_FALLBACK}
          crumbs={[{ label: COURSE_DETAIL.CRUMB, to: '/courses' }, { label: slug || '', active: true }]}
        />
        <Box className="container mx-auto max-w-2xl px-4 py-16">
          {!course && !err ? (
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
          <Button component={Link} to="/courses" variant="text" color="primary" sx={{ mt: 2, px: 0 }}>
            {COURSE_DETAIL.BACK}
          </Button>
        </Box>
      </>
    );
  }

  const enrollOk = msg === COURSE_DETAIL.ENROLL_SUCCESS;
  const enrollPendingInfo = msg === PAYMENT.PENDING_MSG || msg === PAYMENT.ALREADY_PENDING;
  const lectures = Array.isArray(course.lectures) ? course.lectures : [];
  const quizzes = Array.isArray(course.quizzes) ? course.quizzes : [];
  const locked = !hasApprovedAccess || !isStudent;
  const showContent = isStudent && hasApprovedAccess && !contentLoading;
  const showContentSpinner = isStudent && hasApprovedAccess && contentLoading;
  const lockedLearnHint = hasPendingEnrollment ? PAYMENT.PENDING_COURSE_LOCK : COURSE_DETAIL.LOCKED_HINT;
  const lockedQuizHint = hasPendingEnrollment ? PAYMENT.PENDING_COURSE_LOCK : COURSE_DETAIL.LOCKED_QUIZZES;

  return (
    <>
      <PageHeader title={course.title} crumbs={[{ label: COURSE_DETAIL.CRUMB, to: '/courses' }, { label: course.title, active: true }]} />
      <div className="container mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-10 md:grid-cols-2">
          <ImageReveal reduced={reduce} className="min-w-0">
            <Box
              className="h-full min-h-0 overflow-hidden rounded-2xl"
              sx={{ border: 1, borderColor: 'divider', boxShadow: (t) => t.shadows[3] }}
            >
              <Box
                component="img"
                src={course.thumbnail_url || '/img/course-1.png'}
                alt=""
                sx={{ width: '100%', height: '100%', minHeight: 200, objectFit: 'cover', display: 'block' }}
              />
            </Box>
          </ImageReveal>
          <ScrollSection reduced={reduce} className="min-w-0">
            <h2 className="font-display text-3xl font-bold text-primary">{course.title}</h2>
            <p className="mt-4 text-base-content/80">{course.description || COURSE_DETAIL.NO_DESC}</p>
            <p className="mt-4 text-sm text-base-content/70">
              <strong>{COURSE_DETAIL.LEVEL}:</strong> {course.level || '—'} · <strong>{COURSE_DETAIL.DURATION}:</strong>{' '}
              {course.duration_hours != null ? `${course.duration_hours} ${COMMON.HOURS}` : '—'}
            </p>
            <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1} sx={{ mt: 1.5, rowGap: 1 }}>
              {course.review_avg != null ? (
                <Chip
                  size="small"
                  icon={<Star className="h-3.5 w-3.5" aria-hidden style={{ color: 'var(--mui-palette-warning-main)' }} />}
                  label={`${COURSE_DETAIL.RATING}: ${course.review_avg}`}
                  variant="outlined"
                />
              ) : null}
              {Number(course.review_count) > 0 ? (
                <Chip
                  size="small"
                  label={`${course.review_count} ${COURSE_DETAIL.REVIEW_VOTES}`}
                  variant="outlined"
                />
              ) : null}
              {course.enrollment_count != null && course.enrollment_count > 0 ? (
                <Chip
                  size="small"
                  label={`${COURSE_DETAIL.ENROLLMENT_LABEL}: ${course.enrollment_count}`}
                  variant="outlined"
                />
              ) : null}
            </Stack>
            {msg ? (
              <Alert severity={enrollOk ? 'success' : enrollPendingInfo ? 'info' : 'warning'} sx={{ mt: 2 }}>
                {msg}
              </Alert>
            ) : null}
            {isStudent && hasPendingEnrollment && !msg ? (
              <Alert severity="warning" sx={{ mt: 2 }}>
                {PAYMENT.PENDING_MSG}
              </Alert>
            ) : null}
            {isStudent && hasRejectedEnrollment && !msg ? (
              <Alert severity="warning" sx={{ mt: 2 }}>
                {PAYMENT.REJECTED_HINT}
              </Alert>
            ) : null}
            <Stack direction="row" spacing={2} sx={{ mt: 3 }} flexWrap="wrap" useFlexGap>
              {isStudent && hasApprovedAccess ? (
                <Button type="button" variant="outlined" color="primary" component={Link} to={`/dashboard/student`}>
                  {COURSE_DETAIL.GO_DASHBOARD}
                </Button>
              ) : null}
              {isStudent && hasApprovedAccess ? (
                <Button type="button" variant="text" color="primary" href="#course-learn" sx={{ alignSelf: 'center' }}>
                  {COURSE_DETAIL.GO_STUDY}
                </Button>
              ) : null}
              {isStudent && !hasApprovedAccess && !hasPendingEnrollment ? (
                <Button type="button" variant="contained" color="primary" disabled={enrolling} onClick={openEnrollFlow}>
                  {enrolling ? <CircularProgress size={22} color="inherit" sx={{ mr: 1 }} /> : null}
                  {enrolling ? COURSE_DETAIL.ENROLLING : COURSE_DETAIL.ENROLL}
                </Button>
              ) : null}
            </Stack>
          </ScrollSection>
        </div>

        <ScrollSection reduced={reduce} className="w-full" as="section">
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2, sm: 3 },
              borderRadius: 3,
              border: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
            }}
          >
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }} flexWrap="wrap">
              <MessageCircle className="h-6 w-6 shrink-0 text-primary" aria-hidden />
              <Typography component="h2" variant="h5" className="font-display" sx={{ fontWeight: 800 }}>
                {COURSE_DETAIL.SECTION_REVIEWS}
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {COURSE_DETAIL.REVIEWS_LEAD}
            </Typography>
            {reviewErr ? (
              <Alert severity="warning" sx={{ mb: 2 }}>
                {reviewErr}
              </Alert>
            ) : null}
            {reviewLoading && !reviewBundle ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 2 }}>
                <CircularProgress size={24} />
                <Typography color="text.secondary">{COMMON.LOADING}</Typography>
              </Box>
            ) : null}
            {reviewBundle ? (
              <>
                <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1} sx={{ mb: 2, rowGap: 1 }}>
                  {reviewBundle.summary?.review_avg != null && (
                    <Chip
                      size="small"
                      icon={<Star className="h-3.5 w-3.5" style={{ color: 'var(--mui-palette-warning-main)' }} aria-hidden />}
                      label={`${COURSE_DETAIL.RATING}: ${reviewBundle.summary.review_avg}`}
                      variant="outlined"
                    />
                  )}
                  <Chip
                    size="small"
                    label={`${reviewBundle.summary?.review_count ?? 0} ${COURSE_DETAIL.REVIEW_VOTES}`}
                    variant="outlined"
                  />
                </Stack>
                {isStudent && hasApprovedAccess ? (
                  <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2, bgcolor: 'action.hover' }}>
                    <Typography fontWeight={700} sx={{ mb: 1.5 }}>
                      {COURSE_DETAIL.YOUR_REVIEW}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                      {COURSE_DETAIL.STARS}
                    </Typography>
                    <Rating
                      name="course-review-rating"
                      value={formRating}
                      onChange={(_, v) => setFormRating(v ?? 5)}
                      size="large"
                      sx={{ mb: 1.5 }}
                    />
                    <TextField
                      fullWidth
                      multiline
                      minRows={3}
                      label={COURSE_DETAIL.COMMENT}
                      value={formComment}
                      onChange={(e) => setFormComment(e.target.value)}
                    />
                    {reviewFormMsg ? (
                      <Alert severity={reviewFormMsg === COURSE_DETAIL.REVIEW_SAVED ? 'success' : 'error'} sx={{ mt: 2 }}>
                        {reviewFormMsg}
                      </Alert>
                    ) : null}
                    <Button
                      type="button"
                      variant="contained"
                      color="primary"
                      disabled={reviewSubmitting}
                      onClick={() => void submitReview()}
                      sx={{ mt: 2 }}
                    >
                      {reviewSubmitting ? COURSE_DETAIL.SAVING_REVIEW : COURSE_DETAIL.SUBMIT_REVIEW}
                    </Button>
                  </Paper>
                ) : isStudent && !hasApprovedAccess ? (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    {COURSE_DETAIL.REVIEW_MUST_ENROLL}
                  </Alert>
                ) : !session ? (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    {COURSE_DETAIL.REVIEW_GUEST}
                  </Alert>
                ) : (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    {COURSE_DETAIL.ONLY_STUDENT}
                  </Alert>
                )}
                {reviewBundle.items?.length > 0 ? (
                  <Stack spacing={1.5}>
                    {reviewBundle.items.map((rv) => (
                      <Paper
                        key={rv.id}
                        variant="outlined"
                        sx={{ p: 2, borderRadius: 2, bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.06 : 0.04) }}
                      >
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1}>
                          <Typography fontWeight={700}>{rv.author_name}</Typography>
                          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ color: 'warning.main' }}>
                            {Array.from({ length: rv.rating }).map((_, i) => (
                              <Star key={i} className="h-4 w-4 fill-current" aria-hidden />
                            ))}
                          </Stack>
                        </Stack>
                        {rv.comment ? (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            {rv.comment}
                          </Typography>
                        ) : null}
                        <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: 'block' }}>
                          {rv.created_at ? new Date(rv.created_at).toLocaleString('vi-VN') : ''}
                        </Typography>
                      </Paper>
                    ))}
                  </Stack>
                ) : !reviewLoading ? (
                  <Typography color="text.secondary" sx={{ py: 1 }}>
                    {COURSE_DETAIL.NO_REVIEWS}
                  </Typography>
                ) : null}
              </>
            ) : null}
          </Paper>
        </ScrollSection>

        <Divider sx={{ my: 6 }} />

        <ScrollSection reduced={reduce} className="mx-auto w-full max-w-[920px]">
        <Box
          id="course-learn"
          component="section"
          sx={{
            scrollMarginTop: { xs: 72, md: 96 },
            mb: 6,
            width: 1,
          }}
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
                id="lectures-tab"
                aria-controls="lectures-section"
                label={COURSE_DETAIL.SECTION_LECTURES}
                href="#lectures-section"
                onClick={(e) => {
                  e.preventDefault();
                  setLearnTab(0);
                  window.history.replaceState(null, '', '#lectures-section');
                }}
              />
              <Tab
                id="quizzes-tab"
                aria-controls="quizzes-section"
                label={COURSE_DETAIL.SECTION_QUIZZES}
                href="#quizzes-section"
                onClick={(e) => {
                  e.preventDefault();
                  setLearnTab(1);
                  window.history.replaceState(null, '', '#quizzes-section');
                }}
              />
            </Tabs>

            <Box
              id="lectures-section"
              role="tabpanel"
              aria-labelledby="lectures-tab"
              hidden={learnTab !== 0}
              sx={{ display: learnTab === 0 ? 'block' : 'none', p: { xs: 2, sm: 2.5, md: 3 } }}
            >
              <Paper
                elevation={0}
                sx={(theme) => ({
                  p: { xs: 2, md: 2.5 },
                  mb: 2.5,
                  borderRadius: 2,
                  border: `1px solid ${theme.palette.divider}`,
                  background:
                    theme.palette.mode === 'dark'
                      ? alpha(theme.palette.primary.main, 0.12)
                      : `linear-gradient(125deg, ${alpha(theme.palette.primary.main, 0.09)} 0%, ${alpha(theme.palette.primary.light, 0.04)} 48%, ${alpha(theme.palette.background.paper, 1)} 100%)`,
                })}
              >
                <Stack direction="row" spacing={2} alignItems="flex-start">
                  <Box
                    sx={(theme) => ({
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 48,
                      height: 48,
                      borderRadius: 2,
                      flexShrink: 0,
                      color: 'primary.main',
                      bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.2 : 0.14),
                    })}
                  >
                    <BookOpen className="h-6 w-6" aria-hidden />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography component="h2" variant="h5" className="font-display" sx={{ fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.25 }}>
                      {COURSE_DETAIL.SECTION_LECTURES}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                      {COURSE_DETAIL.LECTURES_SUBTITLE}
                    </Typography>
                    {showContent && lectures.length > 0 ? (
                      <Chip
                        size="small"
                        icon={<ListVideo className="h-3.5 w-3.5" aria-hidden />}
                        label={`${lectures.length} bài`}
                        sx={{ mt: 1.25, fontWeight: 700 }}
                        color="primary"
                        variant="outlined"
                      />
                    ) : null}
                  </Box>
                </Stack>
              </Paper>

              {showContentSpinner ? (
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    borderStyle: 'dashed',
                    bgcolor: 'action.hover',
                  }}
                >
                  <CircularProgress size={28} />
                  <Typography color="text.secondary" fontWeight={500}>
                    {COMMON.LOADING}
                  </Typography>
                </Paper>
              ) : null}
              {locked && !showContentSpinner ? (
                <Alert severity="info" sx={{ borderRadius: 2 }}>
                  {lockedLearnHint}
                </Alert>
              ) : null}
              {showContent && lectures.length === 0 ? (
                <Paper
                  elevation={0}
                  sx={{
                    py: 5,
                    px: 2,
                    textAlign: 'center',
                    borderRadius: 2,
                    borderStyle: 'dashed',
                    bgcolor: 'action.hover',
                  }}
                >
                  <ListVideo className="mx-auto mb-2 h-10 w-10 opacity-35" aria-hidden />
                  <Typography color="text.secondary">{COURSE_DETAIL.NO_LECTURES}</Typography>
                </Paper>
              ) : null}
              {showContent && lectures.length > 0 ? (
                <Stack spacing={1.25}>
                  {lectures.map((lec, li) => {
                    const blocks = Array.isArray(lec.blocks) ? lec.blocks : [];
                    const nBlocks = blocks.length;
                    const to = `/courses/${encodeURIComponent(slug)}/lecture/${encodeURIComponent(lec.id)}`;
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
                          boxShadow: theme.palette.mode === 'dark' ? 'none' : `0 1px 2px ${alpha(theme.palette.common.black, 0.04)}`,
                          transition: 'box-shadow 0.2s, border-color 0.2s, background-color 0.2s',
                          '&:hover': {
                            borderColor: alpha(theme.palette.primary.main, 0.45),
                            boxShadow: theme.palette.mode === 'dark' ? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.35)}` : `0 8px 24px ${alpha(theme.palette.primary.main, 0.12)}`,
                            bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.06 : 0.03),
                          },
                        })}
                      >
                        <Box
                          sx={{
                            px: 2,
                            py: 1.25,
                            minHeight: 64,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                          }}
                        >
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
                          {nBlocks > 0 ? (
                            <Chip label={nBlocks} size="small" sx={{ fontWeight: 800, display: { xs: 'none', sm: 'flex' } }} />
                          ) : null}
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
              aria-labelledby="quizzes-tab"
              hidden={learnTab !== 1}
              sx={{ display: learnTab === 1 ? 'block' : 'none', p: { xs: 2, sm: 2.5, md: 3 } }}
            >
              <Paper
                elevation={0}
                sx={(theme) => ({
                  p: { xs: 2, md: 2.5 },
                  mb: 2.5,
                  borderRadius: 2,
                  border: `1px solid ${theme.palette.divider}`,
                  background:
                    theme.palette.mode === 'dark'
                      ? alpha(theme.palette.primary.main, 0.12)
                      : `linear-gradient(125deg, ${alpha(theme.palette.primary.main, 0.09)} 0%, ${alpha(theme.palette.primary.light, 0.04)} 48%, ${alpha(theme.palette.background.paper, 1)} 100%)`,
                })}
              >
                <Stack direction="row" spacing={2} alignItems="flex-start">
                  <Box
                    sx={(theme) => ({
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 48,
                      height: 48,
                      borderRadius: 2,
                      flexShrink: 0,
                      color: 'primary.main',
                      bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.2 : 0.14),
                    })}
                  >
                    <ClipboardList className="h-6 w-6" aria-hidden />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography component="h2" variant="h5" className="font-display" sx={{ fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.25 }}>
                      {COURSE_DETAIL.SECTION_QUIZZES}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                      {COURSE_DETAIL.QUIZZES_SUBTITLE}
                    </Typography>
                    {showContent && quizzes.length > 0 ? (
                      <Chip
                        size="small"
                        icon={<ClipboardList className="h-3.5 w-3.5" aria-hidden />}
                        label={`${quizzes.length} bài`}
                        sx={{ mt: 1.25, fontWeight: 700 }}
                        color="primary"
                        variant="outlined"
                      />
                    ) : null}
                  </Box>
                </Stack>
              </Paper>

              {showContentSpinner ? (
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    borderStyle: 'dashed',
                    bgcolor: 'action.hover',
                  }}
                >
                  <CircularProgress size={28} />
                  <Typography color="text.secondary" fontWeight={500}>
                    {COMMON.LOADING}
                  </Typography>
                </Paper>
              ) : null}
              {locked && !showContentSpinner ? (
                <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
                  {lockedQuizHint}
                </Alert>
              ) : null}
              {showContent && quizzes.length === 0 ? (
                <Paper
                  elevation={0}
                  sx={{
                    py: 5,
                    px: 2,
                    textAlign: 'center',
                    borderRadius: 2,
                    borderStyle: 'dashed',
                    bgcolor: 'action.hover',
                  }}
                >
                  <ClipboardList className="mx-auto mb-2 h-10 w-10 opacity-35" aria-hidden />
                  <Typography color="text.secondary">{COURSE_DETAIL.NO_QUIZZES}</Typography>
                </Paper>
              ) : null}
              {showContent && quizzes.length > 0 ? (
                <Stack spacing={1.25}>
                  {quizzes.map((quiz, qIdx) => {
                    const nQ = (quiz.questions || []).length;
                    const to = `/courses/${encodeURIComponent(slug)}/quiz/${encodeURIComponent(quiz.id)}`;
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
                          boxShadow: theme.palette.mode === 'dark' ? 'none' : `0 1px 2px ${alpha(theme.palette.common.black, 0.04)}`,
                          transition: 'box-shadow 0.2s, border-color 0.2s, background-color 0.2s',
                          '&:hover': {
                            borderColor: alpha(theme.palette.primary.main, 0.45),
                            boxShadow: theme.palette.mode === 'dark' ? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.35)}` : `0 8px 24px ${alpha(theme.palette.primary.main, 0.12)}`,
                            bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.06 : 0.03),
                          },
                        })}
                      >
                        <Box
                          sx={{
                            px: 2,
                            py: 1.25,
                            minHeight: 64,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                          }}
                        >
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
                            {qIdx + 1}
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 700, typography: 'subtitle1' }}>{quiz.title}</Typography>
                            {quiz.description ? (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }} noWrap>
                                {quiz.description}
                              </Typography>
                            ) : null}
                            {nQ > 0 ? (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                                {COURSE_DETAIL.QUIZ_Q_COUNT.replace('{n}', String(nQ))}
                              </Typography>
                            ) : null}
                          </Box>
                          {nQ > 0 ? (
                            <Chip label={nQ} size="small" sx={{ fontWeight: 800, display: { xs: 'none', sm: 'flex' } }} />
                          ) : null}
                          <ChevronRight className="h-5 w-5 shrink-0 opacity-55" aria-hidden />
                        </Box>
                      </Paper>
                    );
                  })}
                </Stack>
              ) : null}
            </Box>
          </Paper>
        </Box>
        </ScrollSection>
      </div>

      <Dialog open={enrollDialogOpen} onClose={() => setEnrollDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{COURSE_DETAIL.DIALOG_AUTH_TITLE}</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            {COURSE_DETAIL.DIALOG_AUTH_BODY}
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Button onClick={() => setEnrollDialogOpen(false)}>{COMMON.CANCEL}</Button>
          <Button variant="outlined" component={Link} to="/login" state={{ from: returnPathForAuth }} onClick={() => setEnrollDialogOpen(false)}>
            {COURSE_DETAIL.DIALOG_LOGIN}
          </Button>
          <Button variant="contained" component={Link} to="/signup" state={{ from: returnPathForAuth }} onClick={() => setEnrollDialogOpen(false)}>
            {COURSE_DETAIL.DIALOG_SIGNUP}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={nonStudentDialogOpen} onClose={() => setNonStudentDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{COURSE_DETAIL.DIALOG_ROLE_TITLE}</DialogTitle>
        <DialogContent>
          <Alert severity="warning">{COURSE_DETAIL.ONLY_STUDENT}</Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setNonStudentDialogOpen(false)}>{COMMON.CANCEL}</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={paymentChoiceOpen}
        onClose={() => !enrolling && setPaymentChoiceOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{PAYMENT.DIALOG_TITLE}</DialogTitle>
        <DialogContent>
          <RadioGroup value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <FormControlLabel value="cash" control={<Radio />} label={PAYMENT.METHOD_CASH} />
            <FormControlLabel value="bank_transfer" control={<Radio />} label={PAYMENT.METHOD_BANK} />
            <FormControlLabel value="momo" control={<Radio />} label={PAYMENT.METHOD_MOMO} />
            <FormControlLabel value="vnpay" control={<Radio />} label={PAYMENT.METHOD_VNPAY} />
          </RadioGroup>
          <TextField
            fullWidth
            size="small"
            margin="dense"
            label={PAYMENT.NOTE_LABEL}
            helperText={PAYMENT.NOTE_HELPER}
            value={paymentNote}
            onChange={(e) => setPaymentNote(e.target.value)}
            sx={{ mt: 1.5 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Button onClick={() => setPaymentChoiceOpen(false)} disabled={enrolling}>
            {COMMON.CANCEL}
          </Button>
          <Button variant="contained" onClick={() => void confirmPaymentEnroll()} disabled={enrolling}>
            {enrolling ? <CircularProgress size={22} color="inherit" sx={{ mr: 1 }} /> : null}
            {PAYMENT.CONFIRM}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
