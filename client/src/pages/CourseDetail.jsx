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
  Rating,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { GraduationCap, MessageCircle, Star } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { ClassCatalogCard } from '../components/ClassCatalogCard';
import { apiFetch } from '../lib/api';
import { useStudentCatalogAccess } from '../hooks/useStudentCatalogAccess';
import { useAuth } from '../context/useAuth';
import { ImageReveal, ScrollSection } from '../motion/ScrollBlock';
import { COURSE_DETAIL, PAYMENT, COMMON, ERR } from '../strings/vi';
import { formatVndFromPriceCentsOrFree } from '../utils/money.js';

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
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  const [nonStudentDialogOpen, setNonStudentDialogOpen] = useState(false);
  const autoEnrollRunning = useRef(false);
  const [reviewBundle, setReviewBundle] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewErr, setReviewErr] = useState('');
  const [reviewFormMsg, setReviewFormMsg] = useState('');
  const [formRating, setFormRating] = useState(5);
  const [formComment, setFormComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [courseClasses, setCourseClasses] = useState([]);
  const [courseClassesLoading, setCourseClassesLoading] = useState(false);
  const reduce = useReducedMotion() ?? false;
  const { classPaymentById } = useStudentCatalogAccess();

  const isStudent = profile?.role === 'student';
  const courseId = course?.id;
  const courseEnrollment =
    Boolean(courseId) && Array.isArray(myEnrollments)
      ? myEnrollments.find((r) => r.course_id === courseId || r.courses?.id === courseId) ?? null
      : null;
  const enrollApproved =
    Boolean(courseEnrollment) &&
    (courseEnrollment.payment_status === 'approved' || courseEnrollment.payment_status == null);
  const hasScheduledClasses = !courseClassesLoading && courseClasses.length > 0;
  const classApprovedForCourse =
    Boolean(courseId) &&
    courseClasses.some((k) => {
      const st = classPaymentById.get(k.id);
      return st === 'approved' || st == null;
    });
  const hasCourseAccess = enrollApproved || classApprovedForCourse;

  const anyPendingPayment =
    courseEnrollment?.payment_status === 'pending' ||
    courseClasses.some((k) => classPaymentById.get(k.id) === 'pending');
  const anyRejectedPayment =
    courseEnrollment?.payment_status === 'rejected' ||
    courseClasses.some((k) => classPaymentById.get(k.id) === 'rejected');

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
    if (!slug) {
      setCourseClasses([]);
      setCourseClassesLoading(false);
      return () => {
        cancelled = true;
      };
    }
    setCourseClassesLoading(true);
    (async () => {
      try {
        const data = await apiFetch(`/api/courses/${encodeURIComponent(slug)}/classes`);
        if (!cancelled) setCourseClasses(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setCourseClasses([]);
      } finally {
        if (!cancelled) setCourseClassesLoading(false);
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
    return () => {
      autoEnrollRunning.current = false;
    };
  }, [slug]);

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
    if (courseClassesLoading) return;
    if (autoEnrollRunning.current) return;
    autoEnrollRunning.current = true;

    const cleanPath = stripEnrollSearch(location.pathname, location.search);
    const row = myEnrollments.find((r) => r.course_id === courseId || r.courses?.id === courseId);

    (async () => {
      try {
        if (courseClasses.length > 0) {
          navigate(cleanPath, { replace: true });
          return;
        }
        if (row?.payment_status === 'approved' || (row && row.payment_status == null)) {
          navigate(cleanPath, { replace: true });
          return;
        }
        if (row?.payment_status === 'pending') {
          setMsg(PAYMENT.PENDING_MSG);
          navigate(cleanPath, { replace: true });
          return;
        }
        try {
          await apiFetch(
            '/api/enrollments',
            { method: 'POST', body: JSON.stringify({ course_id: courseId }) },
            session.access_token,
          );
          setMsg(COURSE_DETAIL.ENROLL_SUCCESS);
          await refreshMyEnrollments();
        } catch (e) {
          setMsg(e.data?.message || e.data?.error || e.message || ERR.ENROLL_FAILED);
        }
        navigate(cleanPath, { replace: true });
      } finally {
        autoEnrollRunning.current = false;
      }
    })();
  }, [
    searchParams,
    courseId,
    session,
    isStudent,
    myEnrollments,
    courseClassesLoading,
    courseClasses.length,
    location.pathname,
    location.search,
    navigate,
    refreshMyEnrollments,
  ]);

  const enrollViaCourseOnly = !courseClassesLoading && courseClasses.length === 0;
  const returnPathForAuth = slug ? `/courses/${slug}${enrollViaCourseOnly ? '?enroll=1' : ''}` : '/dashboard';

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
    void confirmCourseEnroll();
  }

  async function confirmCourseEnroll() {
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
      const res = await apiFetch('/api/enrollments', { method: 'POST', body: JSON.stringify({ course_id: course.id }) }, session.access_token);
      const st = res?.payment_status;
      if (st === 'approved' || st == null) {
        setMsg(COURSE_DETAIL.ENROLL_SUCCESS);
        await refreshMyEnrollments();
      } else {
        setMsg(PAYMENT.PENDING_MSG);
        await refreshMyEnrollments();
      }
    } catch (e) {
      if (e.status === 409) {
        const st = e.data?.payment_status;
        if (st === 'approved') {
          setMsg(COURSE_DETAIL.ENROLL_SUCCESS);
          await refreshMyEnrollments();
        } else if (st === 'pending') {
          setMsg(PAYMENT.ALREADY_PENDING);
          await refreshMyEnrollments();
        } else {
          setMsg(e.data?.message || e.data?.error || e.message || ERR.ENROLL_FAILED);
        }
      } else {
        setMsg(e.data?.message || e.data?.error || e.message || ERR.ENROLL_FAILED);
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
              {hasScheduledClasses ? (
                <>
                  {' '}
                  · <strong>{COMMON.FEE_LABEL}:</strong> {COURSE_DETAIL.FEE_VIA_CLASS}
                </>
              ) : (
                <>
                  {' '}
                  · <strong>{COMMON.FEE_LABEL}:</strong> {formatVndFromPriceCentsOrFree(course.price_cents, COMMON.FREE)}
                </>
              )}
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
            {isStudent && !hasCourseAccess && anyPendingPayment && !msg ? (
              <Alert severity="warning" sx={{ mt: 2 }}>
                {PAYMENT.PENDING_MSG}
              </Alert>
            ) : null}
            {isStudent && !hasCourseAccess && anyRejectedPayment && !anyPendingPayment && !msg ? (
              <Alert severity="warning" sx={{ mt: 2 }}>
                {PAYMENT.REJECTED_HINT}
              </Alert>
            ) : null}
            <Stack direction="row" spacing={2} sx={{ mt: 3 }} flexWrap="wrap" useFlexGap>
              {isStudent && hasCourseAccess ? (
                <Button type="button" variant="outlined" color="primary" component={Link} to={`/dashboard/student`}>
                  {COURSE_DETAIL.GO_DASHBOARD}
                </Button>
              ) : null}
              {isStudent && hasCourseAccess && !courseClassesLoading && courseClasses.length > 0 ? (
                <Button type="button" variant="text" color="primary" href="#course-classes-section" sx={{ alignSelf: 'center' }}>
                  {COURSE_DETAIL.NAV_TO_CLASSES}
                </Button>
              ) : null}
              {isStudent && !hasCourseAccess && !anyPendingPayment && !courseClassesLoading && courseClasses.length === 0 ? (
                <Button type="button" variant="contained" color="primary" disabled={enrolling} onClick={openEnrollFlow}>
                  {enrolling ? <CircularProgress size={22} color="inherit" sx={{ mr: 1 }} /> : null}
                  {enrolling ? COURSE_DETAIL.ENROLLING : COURSE_DETAIL.ENROLL}
                </Button>
              ) : null}
            </Stack>
          </ScrollSection>
        </div>

        <ScrollSection reduced={reduce} className="w-full" as="section" id="course-classes-section">
          <Paper
            elevation={0}
            sx={{
              mt: { xs: 5, md: 6 },
              p: { xs: 2.25, sm: 3 },
              borderRadius: 3,
              border: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
              boxShadow: (t) => (t.palette.mode === 'dark' ? 'none' : `0 1px 3px ${alpha(t.palette.common.black, 0.06)}`),
            }}
          >
            <Stack
              direction="row"
              alignItems="flex-start"
              justifyContent="space-between"
              flexWrap="wrap"
              useFlexGap
              spacing={2}
              sx={{ gap: 2, mb: 2 }}
            >
              <Stack direction="row" spacing={2} alignItems="center" sx={{ minWidth: 0, flex: '1 1 240px' }}>
                <Box
                  sx={{
                    p: 1.25,
                    borderRadius: 2.5,
                    bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.18 : 0.12),
                    color: 'primary.main',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <GraduationCap className="h-7 w-7" aria-hidden />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="overline" color="primary" sx={{ fontWeight: 800, letterSpacing: '0.09em', lineHeight: 1.2, display: 'block' }}>
                    {COURSE_DETAIL.CLASSES_SECTION_OVERLINE}
                  </Typography>
                  <Typography component="h2" variant="h5" className="font-display" sx={{ fontWeight: 800, mt: 0.25 }}>
                    {COURSE_DETAIL.SECTION_CLASSES}
                  </Typography>
                </Box>
              </Stack>
              {!courseClassesLoading && courseClasses.length > 0 ? (
                <Chip
                  label={COURSE_DETAIL.CLASSES_OPEN_BADGE.replace('{n}', String(courseClasses.length))}
                  color="primary"
                  variant="outlined"
                  size="small"
                  sx={{ fontWeight: 700, flexShrink: 0 }}
                />
              ) : null}
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, maxWidth: '48rem', lineHeight: 1.65 }}>
              {COURSE_DETAIL.CLASSES_LEAD}
            </Typography>
            {courseClassesLoading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 2 }}>
                <CircularProgress size={24} />
                <Typography color="text.secondary">{COMMON.LOADING}</Typography>
              </Box>
            ) : null}
            {!courseClassesLoading && courseClasses.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {COURSE_DETAIL.NO_CLASSES}
              </Typography>
            ) : null}
            {!courseClassesLoading && courseClasses.length > 0 ? (
              <Box
                sx={{
                  display: 'grid',
                  gap: 2.5,
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                }}
              >
                {courseClasses.map((k) => (
                  <ClassCatalogCard
                    key={k.id}
                    klass={k}
                    courseSlug={k.course_slug ?? slug}
                    paymentStatus={classPaymentById.get(k.id) ?? null}
                  />
                ))}
              </Box>
            ) : null}
          </Paper>
        </ScrollSection>

        <ScrollSection reduced={reduce} className="w-full" as="section">
          <Paper
            elevation={0}
            sx={{
              mt: { xs: 5, md: 6 },
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
                {isStudent && hasCourseAccess ? (
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
                ) : isStudent && !hasCourseAccess ? (
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

    </>
  );
}
