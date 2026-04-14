import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  Link as MuiLink,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from '@mui/material';
import { ChevronDown } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/useAuth';
import { COURSE_DETAIL } from '../strings/vi';
import { COMMON } from '../strings/vi';
import { ERR } from '../strings/vi';

function youtubeVideoId(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = u.pathname.replace(/^\//, '').split('/')[0];
      return id || null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (u.pathname.startsWith('/embed/')) {
        return u.pathname.split('/').filter(Boolean)[1] || null;
      }
      const v = u.searchParams.get('v');
      if (v) return v;
    }
  } catch {
    return null;
  }
  return null;
}

function formatQuizScore(template, correct, total, percent) {
  return template.replace('{correct}', String(correct)).replace('{total}', String(total)).replace('{percent}', String(percent));
}

export function CourseDetail() {
  const { slug } = useParams();
  const { session, profile } = useAuth();
  const [course, setCourse] = useState(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState(() => ({}));
  const [quizResults, setQuizResults] = useState(() => ({}));
  const [submittingQuizId, setSubmittingQuizId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch(`/api/courses/${encodeURIComponent(slug)}`);
        if (!cancelled) {
          setCourse(data);
          setQuizAnswers({});
          setQuizResults({});
        }
      } catch (e) {
        if (!cancelled) setErr(e.message || ERR.NOT_FOUND);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function enroll() {
    setMsg('');
    if (!session) {
      setMsg(COURSE_DETAIL.LOGIN_STUDENT);
      return;
    }
    if (profile?.role !== 'student') {
      setMsg(COURSE_DETAIL.ONLY_STUDENT);
      return;
    }
    setEnrolling(true);
    try {
      await apiFetch(
        '/api/enrollments',
        { method: 'POST', body: JSON.stringify({ course_id: course.id }) },
        session.access_token,
      );
      setMsg(COURSE_DETAIL.ENROLL_SUCCESS);
    } catch (e) {
      setMsg(e.data?.error || e.message || ERR.ENROLL_FAILED);
    } finally {
      setEnrolling(false);
    }
  }

  function setAnswerForQuiz(quizId, questionIndex, optionIndex) {
    setQuizAnswers((prev) => {
      const cur = prev[quizId] ? [...prev[quizId]] : [];
      const quiz = course?.quizzes?.find((q) => q.id === quizId);
      const len = quiz?.questions?.length ?? 0;
      while (cur.length < len) cur.push(-1);
      cur[questionIndex] = optionIndex;
      return { ...prev, [quizId]: cur };
    });
  }

  async function submitQuiz(quizId) {
    if (!course?.slug) return;
    const quiz = course.quizzes?.find((q) => q.id === quizId);
    if (!quiz) return;
    const n = quiz.questions?.length ?? 0;
    const raw = quizAnswers[quizId] || [];
    const answers = Array.from({ length: n }, (_, i) => (typeof raw[i] === 'number' ? raw[i] : -1));
    setSubmittingQuizId(quizId);
    try {
      const result = await apiFetch(
        `/api/courses/${encodeURIComponent(course.slug)}/quizzes/${encodeURIComponent(quizId)}/submit`,
        { method: 'POST', body: JSON.stringify({ answers }) },
      );
      setQuizResults((prev) => ({ ...prev, [quizId]: result }));
    } catch (e) {
      setQuizResults((prev) => ({
        ...prev,
        [quizId]: { error: e.data?.error || e.message || COURSE_DETAIL.QUIZ_SUBMIT_ERR },
      }));
    } finally {
      setSubmittingQuizId(null);
    }
  }

  if (err || !course) {
    return (
      <>
        <PageHeader
          title={COURSE_DETAIL.TITLE_FALLBACK}
          crumbs={[{ label: COURSE_DETAIL.CRUMB, to: '/courses' }, { label: slug || '', active: true }]}
        />
        <Box className="container mx-auto max-w-2xl px-4 py-12">
          <Alert severity="warning">{err || COMMON.LOADING}</Alert>
          <Button component={Link} to="/courses" variant="text" color="primary" sx={{ mt: 2, px: 0 }}>
            {COURSE_DETAIL.BACK}
          </Button>
        </Box>
      </>
    );
  }

  const enrollOk = msg === COURSE_DETAIL.ENROLL_SUCCESS;
  const lectures = Array.isArray(course.lectures) ? course.lectures : [];
  const quizzes = Array.isArray(course.quizzes) ? course.quizzes : [];

  return (
    <>
      <PageHeader title={course.title} crumbs={[{ label: COURSE_DETAIL.CRUMB, to: '/courses' }, { label: course.title, active: true }]} />
      <div className="container mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-10 md:grid-cols-2">
          <Box className="overflow-hidden rounded-2xl shadow-lg" sx={{ border: 1, borderColor: 'divider' }}>
            <Box component="img" src={course.thumbnail_url || '/img/course-1.png'} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </Box>
          <div>
            <h2 className="font-display text-3xl font-bold text-primary">{course.title}</h2>
            <p className="mt-4 text-base-content/80">{course.description || COURSE_DETAIL.NO_DESC}</p>
            <p className="mt-4 text-sm text-base-content/70">
              <strong>{COURSE_DETAIL.LEVEL}:</strong> {course.level || '—'} · <strong>{COURSE_DETAIL.DURATION}:</strong>{' '}
              {course.duration_hours != null ? `${course.duration_hours} ${COMMON.HOURS}` : '—'}
            </p>
            {msg ? (
              <Alert severity={enrollOk ? 'success' : 'info'} sx={{ mt: 2 }}>
                {msg}
              </Alert>
            ) : null}
            {profile?.role === 'student' ? (
              <Button type="button" variant="contained" color="primary" sx={{ mt: 3 }} disabled={enrolling} onClick={enroll}>
                {enrolling ? <CircularProgress size={22} color="inherit" sx={{ mr: 1 }} /> : null}
                {enrolling ? COURSE_DETAIL.ENROLLING : COURSE_DETAIL.ENROLL}
              </Button>
            ) : null}
            {!session ? (
              <Typography className="mt-4 text-sm">
                <MuiLink component={Link} to="/login" fontWeight={600}>
                  {COURSE_DETAIL.LOGIN_LINK}
                </MuiLink>
                {COURSE_DETAIL.LOGIN_SUFFIX}
              </Typography>
            ) : null}
          </div>
        </div>

        <Divider sx={{ my: 6 }} />

        <Typography component="h2" variant="h5" className="font-display" sx={{ fontWeight: 700, mb: 2 }}>
          {COURSE_DETAIL.SECTION_LECTURES}
        </Typography>
        {lectures.length === 0 ? (
          <Typography color="text.secondary" sx={{ mb: 4 }}>
            {COURSE_DETAIL.NO_LECTURES}
          </Typography>
        ) : (
          <Box sx={{ mb: 6 }}>
            {lectures.map((lec) => {
              const blocks = Array.isArray(lec.blocks) ? lec.blocks : [];
              return (
                <Accordion key={lec.id} disableGutters variant="outlined" sx={{ mb: 1, borderRadius: 1, '&:before': { display: 'none' } }}>
                  <AccordionSummary expandIcon={<ChevronDown className="h-5 w-5 shrink-0 opacity-70" aria-hidden />}>
                    <Typography sx={{ fontWeight: 600 }}>{lec.title}</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    {blocks.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        —
                      </Typography>
                    ) : (
                      <Stack spacing={2} divider={<Divider flexItem />}>
                        {blocks.map((blk, bi) => {
                          const yid = blk.video_url ? youtubeVideoId(blk.video_url) : null;
                          return (
                            <Box key={bi}>
                              {blk.title ? (
                                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                                  {blk.title}
                                </Typography>
                              ) : null}
                              {yid ? (
                                <Box
                                  sx={{
                                    position: 'relative',
                                    pb: '56.25%',
                                    height: 0,
                                    overflow: 'hidden',
                                    borderRadius: 1,
                                    mb: blk.content ? 2 : 0,
                                  }}
                                >
                                  <Box
                                    component="iframe"
                                    title={blk.title || lec.title}
                                    src={`https://www.youtube.com/embed/${yid}`}
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                    sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                                  />
                                </Box>
                              ) : blk.video_url ? (
                                <MuiLink
                                  href={blk.video_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  sx={{ display: 'inline-block', mb: blk.content ? 2 : 0 }}
                                >
                                  {COURSE_DETAIL.OPEN_VIDEO}
                                </MuiLink>
                              ) : null}
                              {blk.content ? (
                                <Typography component="div" sx={{ whiteSpace: 'pre-wrap', typography: 'body2' }}>
                                  {blk.content}
                                </Typography>
                              ) : null}
                              {!blk.content && !blk.video_url && !blk.title ? (
                                <Typography variant="body2" color="text.secondary">
                                  —
                                </Typography>
                              ) : null}
                            </Box>
                          );
                        })}
                      </Stack>
                    )}
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </Box>
        )}

        <Typography component="h2" variant="h5" className="font-display" sx={{ fontWeight: 700, mb: 2 }}>
          {COURSE_DETAIL.SECTION_QUIZZES}
        </Typography>
        {quizzes.length === 0 ? (
          <Typography color="text.secondary">{COURSE_DETAIL.NO_QUIZZES}</Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {quizzes.map((quiz) => {
              const answers = quizAnswers[quiz.id] || [];
              const res = quizResults[quiz.id];
              return (
                <Paper key={quiz.id} variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {quiz.title}
                  </Typography>
                  {quiz.description ? (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {quiz.description}
                    </Typography>
                  ) : null}
                  <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {(quiz.questions || []).map((q, qi) => (
                      <FormControl key={`${quiz.id}-q-${qi}`} component="fieldset" variant="standard" fullWidth>
                        <Typography component="legend" sx={{ mb: 1, fontWeight: 600, typography: 'body2' }}>
                          {qi + 1}. {q.question}
                        </Typography>
                        <RadioGroup
                          value={typeof answers[qi] === 'number' && answers[qi] >= 0 ? answers[qi] : ''}
                          onChange={(e) => setAnswerForQuiz(quiz.id, qi, Number(e.target.value))}
                        >
                          {(q.options || []).map((opt, oi) => (
                            <FormControlLabel
                              key={oi}
                              value={oi}
                              control={<Radio size="small" />}
                              label={`${String.fromCharCode(65 + oi)}. ${opt}`}
                            />
                          ))}
                        </RadioGroup>
                      </FormControl>
                    ))}
                  </Box>
                  <Button
                    type="button"
                    variant="contained"
                    color="primary"
                    size="small"
                    sx={{ mt: 2 }}
                    disabled={submittingQuizId === quiz.id}
                    onClick={() => submitQuiz(quiz.id)}
                  >
                    {submittingQuizId === quiz.id ? (
                      <>
                        <CircularProgress size={18} color="inherit" sx={{ mr: 1 }} />
                        {COURSE_DETAIL.SUBMITTING_QUIZ}
                      </>
                    ) : (
                      COURSE_DETAIL.SUBMIT_QUIZ
                    )}
                  </Button>
                  {res?.error ? (
                    <Alert severity="error" sx={{ mt: 2 }}>
                      {res.error}
                    </Alert>
                  ) : null}
                  {res && !res.error && typeof res.correct === 'number' ? (
                    <Alert severity="info" sx={{ mt: 2 }}>
                      {formatQuizScore(COURSE_DETAIL.QUIZ_SCORE, res.correct, res.total, res.percent)}
                    </Alert>
                  ) : null}
                </Paper>
              );
            })}
          </Box>
        )}
      </div>
    </>
  );
}
