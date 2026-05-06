import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Box, Button, Chip, CircularProgress, Divider, Paper, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { LectureContentBlocks } from '../components/LectureContentBlocks';
import { PageHeader } from '../components/PageHeader';
import { toast } from 'sonner';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/useAuth';
import { COMMON, COURSE_DETAIL, ERR, LECTURE_DETAIL } from '../strings/vi';

export function LectureDetail() {
  const { slug, lectureId } = useParams();
  const { session, profile } = useAuth();
  const [course, setCourse] = useState(null);
  const [err, setErr] = useState('');
  const [myEnrollments, setMyEnrollments] = useState(null);
  const [classMemberships, setClassMemberships] = useState(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [lectureMarkSaving, setLectureMarkSaving] = useState(false);

  const isStudent = profile?.role === 'student';
  const courseId = course?.id;
  const hasEnrollAccess =
    Boolean(courseId) &&
    Array.isArray(myEnrollments) &&
    myEnrollments.some(
      (r) =>
        (r.course_id === courseId || r.courses?.id === courseId) &&
        (r.payment_status === 'approved' || r.payment_status == null),
    );
  const hasClassCourseAccess =
    Boolean(courseId) &&
    Array.isArray(classMemberships) &&
    classMemberships.some(
      (m) =>
        (m.class?.course?.id === courseId || m.class?.course?.slug === slug) &&
        (m.payment_status === 'approved' || m.payment_status == null),
    );
  const isEnrolled = hasEnrollAccess || hasClassCourseAccess;

  const fetchLearnContent = useCallback(async () => {
    if (!slug || !session?.access_token || !isStudent) return;
    setContentLoading(true);
    try {
      const data = await apiFetch(`/api/learn/courses/${encodeURIComponent(slug)}`, {}, session.access_token);
      setCourse((prev) =>
        prev
          ? {
              ...prev,
              lectures: data.lectures || [],
              quizzes: data.quizzes || [],
              completed_lecture_ids: data.completed_lecture_ids || [],
            }
          : prev,
      );
    } catch (e) {
      if (e.status === 403 && e.data?.error === 'NOT_ENROLLED') {
        setCourse((prev) => (prev ? { ...prev, lectures: [], quizzes: [] } : prev));
      }
    } finally {
      setContentLoading(false);
    }
  }, [slug, session?.access_token, isStudent]);

  useEffect(() => {
    let cancelled = false;
    setErr('');
    (async () => {
      try {
        const data = await apiFetch(`/api/courses/${encodeURIComponent(slug)}`);
        if (!cancelled) setCourse(data);
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
    let cancelled = false;
    (async () => {
      if (!session?.access_token || !isStudent) {
        if (!cancelled) setClassMemberships(session && !isStudent ? [] : null);
        return;
      }
      try {
        const data = await apiFetch('/api/class-learn/me', {}, session.access_token);
        if (!cancelled) setClassMemberships(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setClassMemberships([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.access_token, session, isStudent]);

  useEffect(() => {
    if (!isEnrolled || !isStudent || !slug || !session?.access_token) return;
    void fetchLearnContent();
  }, [isEnrolled, isStudent, slug, session?.access_token, fetchLearnContent]);

  const locked = !isEnrolled || !isStudent;
  const showContent = isStudent && isEnrolled && !contentLoading;
  const showContentSpinner = isStudent && isEnrolled && contentLoading;
  const lectures = Array.isArray(course?.lectures) ? course.lectures : [];
  const lecture = lectures.find((l) => String(l.id) === String(lectureId));
  const idx = lectures.findIndex((l) => String(l.id) === String(lectureId));
  const completedLectureIds = new Set(Array.isArray(course?.completed_lecture_ids) ? course.completed_lecture_ids : []);
  const lectureCompleted = Boolean(lecture && completedLectureIds.has(lecture.id));
  const prevLec = idx > 0 ? lectures[idx - 1] : null;
  const nextLec = idx >= 0 && idx < lectures.length - 1 ? lectures[idx + 1] : null;

  if (err || !course) {
    return (
      <>
        <PageHeader
          title={COURSE_DETAIL.TITLE_FALLBACK}
          crumbs={[
            { label: COURSE_DETAIL.CRUMB, to: '/courses' },
            { label: slug || '', to: slug ? `/courses/${encodeURIComponent(slug)}` : '/courses' },
            { label: LECTURE_DETAIL.NOT_FOUND, active: true },
          ]}
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

  const courseLink = `/courses/${encodeURIComponent(slug)}#lectures-section`;
  const progressLabel =
    idx >= 0 && lectures.length > 0
      ? LECTURE_DETAIL.LECTURE_PROGRESS.replace('{current}', String(idx + 1)).replace('{total}', String(lectures.length))
      : null;

  return (
    <>
      <PageHeader
        title={lecture?.title || COURSE_DETAIL.SECTION_LECTURES}
        crumbs={[
          { label: COURSE_DETAIL.CRUMB, to: '/courses' },
          { label: course.title, to: `/courses/${encodeURIComponent(slug)}` },
          { label: lecture?.title || '…', active: true },
        ]}
      />
      <Box
        component="main"
        className="container mx-auto px-4"
        sx={{
          maxWidth: 800,
          width: 1,
          mx: 'auto',
          py: { xs: 3, md: 5 },
          pb: { xs: 6, md: 8 },
        }}
      >
        <Button
          component={Link}
          to={courseLink}
          variant="text"
          color="inherit"
          startIcon={<ChevronLeft className="h-4 w-4" aria-hidden />}
          sx={{
            mb: 2.5,
            px: 0.75,
            py: 0.5,
            fontWeight: 700,
            fontSize: '0.9375rem',
            color: 'text.secondary',
            '&:hover': { color: 'primary.main', bgcolor: (t) => alpha(t.palette.primary.main, 0.06) },
          }}
        >
          {LECTURE_DETAIL.BACK_TO_COURSE}
        </Button>

        {showContentSpinner ? (
          <Paper
            elevation={0}
            sx={{
              p: 4,
              borderRadius: 3,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              borderStyle: 'dashed',
              bgcolor: 'action.hover',
            }}
          >
            <CircularProgress size={28} />
            <Typography color="text.secondary" sx={{ fontWeight: 500 }}>
              {COMMON.LOADING}
            </Typography>
          </Paper>
        ) : null}

        {locked && !showContentSpinner ? (
          <Alert severity="info" sx={{ borderRadius: 2 }}>
            {COURSE_DETAIL.LOCKED_HINT}
          </Alert>
        ) : null}

        {showContent && !lecture ? (
          <Alert severity="warning" sx={{ borderRadius: 2 }}>
            {LECTURE_DETAIL.NOT_FOUND}
          </Alert>
        ) : null}

        {showContent && lecture ? (
          <>
            <Paper
              elevation={0}
              sx={(theme) => ({
                p: { xs: 2.75, sm: 3.5, md: 4 },
                mb: { xs: 3, md: 4 },
                borderRadius: 3,
                border: `1px solid ${theme.palette.divider}`,
                background:
                  theme.palette.mode === 'dark'
                    ? alpha(theme.palette.primary.main, 0.1)
                    : `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.07)} 0%, ${alpha(theme.palette.primary.light, 0.04)} 42%, ${theme.palette.background.paper} 100%)`,
                boxShadow: theme.palette.mode === 'dark' ? 'none' : theme.shadows[3],
              })}
            >
              <Typography
                component="p"
                variant="overline"
                sx={{
                  display: 'block',
                  fontWeight: 800,
                  letterSpacing: '0.12em',
                  color: 'primary.main',
                  mb: 1,
                  lineHeight: 1.5,
                }}
              >
                {course.title}
              </Typography>
              <Typography
                component="h1"
                className="font-display"
                sx={{
                  fontWeight: 800,
                  fontSize: { xs: '1.65rem', sm: '2rem', md: '2.375rem' },
                  lineHeight: 1.22,
                  letterSpacing: '-0.035em',
                  color: 'text.primary',
                }}
              >
                {lecture.title}
              </Typography>
              {progressLabel ? (
                <Stack direction="row" alignItems="center" flexWrap="wrap" useFlexGap spacing={1.5} sx={{ mt: 2.5 }}>
                                   <Chip
                    label={progressLabel}
                    size="small"
                    sx={(t) => ({
                      fontWeight: 800,
                      letterSpacing: '0.02em',
                      height: 28,
                      borderRadius: 2,
                      bgcolor: alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.22 : 0.14),
                      color: t.palette.mode === 'dark' ? t.palette.primary.light : t.palette.secondary.main,
                      border: `1px solid ${alpha(t.palette.primary.main, 0.35)}`,
                      '& .MuiChip-label': { px: 1.25 },
                    })}
                  />
                </Stack>
              ) : null}
            </Paper>

            <Divider
              sx={(theme) => ({
                mb: { xs: 3, md: 4 },
                borderColor: alpha(theme.palette.divider, 0.85),
              })}
            />

            <LectureContentBlocks blocks={lecture.blocks} lectureTitle={lecture.title} />

            <Stack direction="row" alignItems="center" flexWrap="wrap" useFlexGap spacing={1.5} sx={{ mt: 3 }}>
              {lectureCompleted ? (
                <Chip label={LECTURE_DETAIL.LECTURE_COMPLETED} color="success" variant="outlined" sx={{ fontWeight: 700 }} />
              ) : (
                <Button
                  variant="contained"
                  color="primary"
                  disabled={lectureMarkSaving || !session?.access_token}
                  onClick={() => {
                    void (async () => {
                      setLectureMarkSaving(true);
                      try {
                        await apiFetch(
                          `/api/learn/courses/${encodeURIComponent(slug)}/lectures/${encodeURIComponent(lecture.id)}/complete`,
                          { method: 'POST', body: JSON.stringify({}) },
                          session.access_token,
                        );
                        setCourse((prev) => {
                          if (!prev) return prev;
                          const raw = prev.completed_lecture_ids || [];
                          const next = [...raw.filter((id) => id !== lecture.id), lecture.id];
                          return { ...prev, completed_lecture_ids: next };
                        });
                      } catch (e) {
                        toast.error(e.message || LECTURE_DETAIL.COMPLETE_ERROR);
                      } finally {
                        setLectureMarkSaving(false);
                      }
                    })();
                  }}
                >
                  {lectureMarkSaving ? COMMON.LOADING : LECTURE_DETAIL.MARK_COMPLETE}
                </Button>
              )}
            </Stack>

            {(prevLec || nextLec) && (
              <Paper
                elevation={0}
                sx={(theme) => ({
                  mt: { xs: 4, md: 5 },
                  pt: 3,
                  borderTop: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                  borderRadius: 0,
                  bgcolor: 'transparent',
                })}
              >
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between">
                  {prevLec ? (
                    <Button
                      component={Link}
                      to={`/courses/${encodeURIComponent(slug)}/lecture/${encodeURIComponent(prevLec.id)}`}
                      variant="outlined"
                      color="primary"
                      size="large"
                      startIcon={<ChevronLeft className="h-5 w-5" aria-hidden />}
                      sx={{
                        alignSelf: { xs: 'stretch', sm: 'flex-start' },
                        py: 1.25,
                        px: 2,
                        fontWeight: 700,
                        borderRadius: 2,
                        borderWidth: 2,
                      }}
                    >
                      {LECTURE_DETAIL.PREV}
                    </Button>
                  ) : (
                    <span />
                  )}
                  {nextLec ? (
                    <Button
                      component={Link}
                      to={`/courses/${encodeURIComponent(slug)}/lecture/${encodeURIComponent(nextLec.id)}`}
                      variant="contained"
                      color="primary"
                      size="large"
                      endIcon={<ChevronRight className="h-5 w-5" aria-hidden />}
                      sx={{
                        alignSelf: { xs: 'stretch', sm: 'flex-end' },
                        py: 1.25,
                        px: 2,
                        fontWeight: 700,
                        borderRadius: 2,
                        boxShadow: (t) => `0 8px 24px ${alpha(t.palette.primary.main, 0.35)}`,
                      }}
                    >
                      {LECTURE_DETAIL.NEXT}
                    </Button>
                  ) : null}
                </Stack>
              </Paper>
            )}
          </>
        ) : null}
      </Box>
    </>
  );
}
