import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Box, Button, Chip, CircularProgress, Divider, Paper, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { LectureContentBlocks } from '../components/LectureContentBlocks';
import { PageHeader } from '../components/PageHeader';
import { toast } from 'sonner';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/useAuth';
import { CLASSROOM, COMMON, DASH_STUDENT, LECTURE_DETAIL, PAGE } from '../strings/vi';

export function ClassLectureDetail() {
  const { courseSlug, classSlug, lectureId } = useParams();
  const { session } = useAuth();
  const [pack, setPack] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [markSaving, setMarkSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setErr('');
    setLoading(true);
    (async () => {
      try {
        const data = await apiFetch(
          `/api/class-learn/courses/${encodeURIComponent(courseSlug)}/classes/${encodeURIComponent(classSlug)}`,
          {},
          session?.access_token,
        );
        if (!cancelled) setPack(data);
      } catch (e) {
        if (!cancelled) {
          if (e.status === 403) setErr(CLASSROOM.LOCKED);
          else setErr(e.message || COMMON.LOADING);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courseSlug, classSlug, session?.access_token]);

  const cls = pack?.class;
  const lectures = Array.isArray(pack?.lectures) ? pack.lectures : [];
  const lecture = lectures.find((l) => String(l.id) === String(lectureId));
  const idx = lectures.findIndex((l) => String(l.id) === String(lectureId));
  const completedLectureIds = new Set(Array.isArray(pack?.completed_lecture_ids) ? pack.completed_lecture_ids : []);
  const lectureCompleted = Boolean(lecture && completedLectureIds.has(lecture.id));
  const prevLec = idx > 0 ? lectures[idx - 1] : null;
  const nextLec = idx >= 0 && idx < lectures.length - 1 ? lectures[idx + 1] : null;
  const backHref = '/dashboard/student#my-classes';

  if (loading && !pack) {
    return (
      <Box className="flex min-h-[40vh] items-center justify-center">
        <CircularProgress />
      </Box>
    );
  }

  if (err || !cls) {
    return (
      <>
        <PageHeader
          title={CLASSROOM.LECTURE_NOT_FOUND}
          crumbs={[
            { label: PAGE.HOME_CRUMB, to: '/' },
            { label: DASH_STUDENT.TITLE, to: '/dashboard/student' },
            { label: CLASSROOM.CRUMB, active: true },
          ]}
        />
        <Box className="container mx-auto max-w-2xl px-4 py-10">
          <Alert severity="warning">{err || CLASSROOM.LECTURE_NOT_FOUND}</Alert>
          <Button component={Link} to="/dashboard/student" sx={{ mt: 2 }}>
            {DASH_STUDENT.TITLE}
          </Button>
        </Box>
      </>
    );
  }

  const progressLabel =
    idx >= 0 && lectures.length > 0
      ? LECTURE_DETAIL.LECTURE_PROGRESS.replace('{current}', String(idx + 1)).replace('{total}', String(lectures.length))
      : null;

  return (
    <>
      <PageHeader
        title={lecture?.title || CLASSROOM.CRUMB}
        crumbs={[
          { label: PAGE.HOME_CRUMB, to: '/' },
          { label: DASH_STUDENT.TITLE, to: '/dashboard/student' },
          { label: cls.name, active: !lecture },
          ...(lecture ? [{ label: lecture.title, active: true }] : []),
        ]}
      />
      <Box component="main" className="container mx-auto px-4" sx={{ maxWidth: 800, py: { xs: 3, md: 5 } }}>
        <Button
          component={Link}
          to={backHref}
          variant="text"
          color="inherit"
          startIcon={<ChevronLeft className="h-4 w-4" />}
          sx={{ mb: 2, fontWeight: 700 }}
        >
          {DASH_STUDENT.TITLE}
        </Button>

        {!lecture ? (
          <Alert severity="warning">{CLASSROOM.LECTURE_NOT_FOUND}</Alert>
        ) : (
          <>
            <Paper
              elevation={0}
              sx={(theme) => ({
                p: { xs: 2.75, sm: 3.5 },
                mb: 3,
                borderRadius: 3,
                border: `1px solid ${theme.palette.divider}`,
                bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.primary.main, 0.08) : alpha(theme.palette.primary.main, 0.04),
              })}
            >
              <Typography variant="overline" sx={{ fontWeight: 800, color: 'primary.main' }}>
                {cls.name}
              </Typography>
              <Typography variant="h4" className="font-display" sx={{ fontWeight: 800, mt: 1 }}>
                {lecture.title}
              </Typography>
              {progressLabel ? (
                <Chip label={progressLabel} size="small" sx={{ mt: 2, fontWeight: 700 }} />
              ) : null}
            </Paper>
            <Divider sx={{ mb: 3 }} />
            <LectureContentBlocks blocks={lecture.blocks} lectureTitle={lecture.title} />
            <Stack direction="row" alignItems="center" flexWrap="wrap" useFlexGap spacing={1.5} sx={{ mt: 3 }}>
              {lectureCompleted ? (
                <Chip label={LECTURE_DETAIL.LECTURE_COMPLETED} color="success" variant="outlined" sx={{ fontWeight: 700 }} />
              ) : (
                <Button
                  variant="contained"
                  color="primary"
                  disabled={markSaving || !session?.access_token}
                  onClick={() => {
                    void (async () => {
                      setMarkSaving(true);
                      try {
                        await apiFetch(
                          `/api/class-learn/courses/${encodeURIComponent(courseSlug)}/classes/${encodeURIComponent(classSlug)}/lectures/${encodeURIComponent(lecture.id)}/complete`,
                          { method: 'POST', body: JSON.stringify({}) },
                          session.access_token,
                        );
                        setPack((prev) => {
                          if (!prev) return prev;
                          const raw = prev.completed_lecture_ids || [];
                          const next = [...raw.filter((id) => id !== lecture.id), lecture.id];
                          return { ...prev, completed_lecture_ids: next };
                        });
                      } catch (e) {
                        toast.error(e.message || LECTURE_DETAIL.COMPLETE_ERROR);
                      } finally {
                        setMarkSaving(false);
                      }
                    })();
                  }}
                >
                  {markSaving ? COMMON.LOADING : LECTURE_DETAIL.MARK_COMPLETE}
                </Button>
              )}
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between" sx={{ mt: 4 }}>
              {prevLec ? (
                <Button
                  component={Link}
                  to={`/courses/${encodeURIComponent(courseSlug)}/classroom/${encodeURIComponent(classSlug)}/lecture/${encodeURIComponent(prevLec.id)}`}
                  variant="outlined"
                  startIcon={<ChevronLeft className="h-4 w-4" />}
                >
                  {LECTURE_DETAIL.PREV}
                </Button>
              ) : (
                <span />
              )}
              {nextLec ? (
                <Button
                  component={Link}
                  to={`/courses/${encodeURIComponent(courseSlug)}/classroom/${encodeURIComponent(classSlug)}/lecture/${encodeURIComponent(nextLec.id)}`}
                  variant="outlined"
                  endIcon={<ChevronRight className="h-4 w-4" />}
                >
                  {LECTURE_DETAIL.NEXT}
                </Button>
              ) : null}
            </Stack>
          </>
        )}
      </Box>
    </>
  );
}
