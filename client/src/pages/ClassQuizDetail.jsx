import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/useAuth';
import { CLASSROOM, COMMON, COURSE_DETAIL, DASH_STUDENT, PAGE, QUIZ_DETAIL } from '../strings/vi';

export function ClassQuizDetail() {
  const { slug, quizId } = useParams();
  const { session } = useAuth();
  const [pack, setPack] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState([]);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setErr('');
    setLoading(true);
    (async () => {
      try {
        const data = await apiFetch(`/api/class-learn/classes/${encodeURIComponent(slug)}`, {}, session?.access_token);
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
  }, [slug, session?.access_token]);

  const cls = pack?.class;
  const quizzes = Array.isArray(pack?.quizzes) ? pack.quizzes : [];
  const quiz = quizzes.find((q) => String(q.id) === String(quizId));
  const idx = quizzes.findIndex((q) => String(q.id) === String(quizId));
  const prevQ = idx > 0 ? quizzes[idx - 1] : null;
  const nextQ = idx >= 0 && idx < quizzes.length - 1 ? quizzes[idx + 1] : null;
  const nQ = (quiz?.questions || []).length;

  useEffect(() => {
    setAnswers([]);
    setResult(null);
  }, [quizId]);

  function setAnswerForQuestion(questionIndex, optionIndex) {
    setAnswers((prev) => {
      const cur = [...prev];
      while (cur.length < nQ) cur.push(-1);
      cur[questionIndex] = optionIndex;
      return cur;
    });
  }

  async function submitQuiz() {
    if (!slug || !quiz || !session?.access_token) return;
    const raw = answers;
    const arr = Array.from({ length: nQ }, (_, i) => (typeof raw[i] === 'number' ? raw[i] : -1));
    setSubmitting(true);
    try {
      const res = await apiFetch(
        `/api/class-learn/classes/${encodeURIComponent(slug)}/quizzes/${encodeURIComponent(quiz.id)}/submit`,
        { method: 'POST', body: JSON.stringify({ answers: arr }) },
        session.access_token,
      );
      setResult(res);
    } catch (e) {
      setResult({ error: e.data?.error || e.message || COURSE_DETAIL.QUIZ_SUBMIT_ERR });
    } finally {
      setSubmitting(false);
    }
  }

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
          title={CLASSROOM.QUIZ_NOT_FOUND}
          crumbs={[
            { label: PAGE.HOME_CRUMB, to: '/' },
            { label: DASH_STUDENT.TITLE, to: '/dashboard/student' },
            { label: CLASSROOM.CRUMB, active: true },
          ]}
        />
        <Box className="container mx-auto max-w-2xl px-4 py-10">
          <Alert severity="warning">{err || CLASSROOM.QUIZ_NOT_FOUND}</Alert>
          <Button component={Link} to="/dashboard/student" sx={{ mt: 2 }}>
            {DASH_STUDENT.TITLE}
          </Button>
        </Box>
      </>
    );
  }

  const progressLabel =
    idx >= 0 && quizzes.length > 0
      ? QUIZ_DETAIL.QUIZ_PROGRESS.replace('{current}', String(idx + 1)).replace('{total}', String(quizzes.length))
      : null;

  return (
    <>
      <PageHeader
        title={quiz?.title || CLASSROOM.CRUMB}
        crumbs={[
          { label: PAGE.HOME_CRUMB, to: '/' },
          { label: DASH_STUDENT.TITLE, to: '/dashboard/student' },
          { label: cls.name, active: !quiz },
          ...(quiz ? [{ label: quiz.title, active: true }] : []),
        ]}
      />
      <Box component="main" className="container mx-auto px-4" sx={{ maxWidth: 800, py: { xs: 3, md: 5 } }}>
        <Button
          component={Link}
          to="/dashboard/student#my-classes"
          variant="text"
          color="inherit"
          startIcon={<ChevronLeft className="h-4 w-4" />}
          sx={{ mb: 2, fontWeight: 700 }}
        >
          {DASH_STUDENT.TITLE}
        </Button>

        {!quiz ? (
          <Alert severity="warning">{CLASSROOM.QUIZ_NOT_FOUND}</Alert>
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
                {quiz.title}
              </Typography>
              {quiz.description ? (
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  {quiz.description}
                </Typography>
              ) : null}
              {progressLabel ? <Chip label={progressLabel} size="small" sx={{ mt: 2, fontWeight: 700 }} /> : null}
            </Paper>

            {result?.error ? (
              <Alert severity="error" sx={{ mb: 2 }}>
                {result.error}
              </Alert>
            ) : null}
            {result && !result.error ? (
              <Alert severity="success" sx={{ mb: 2 }}>
                {CLASSROOM.RESULT}: {result.correct}/{result.total} ({result.percent}%)
              </Alert>
            ) : null}

            <Stack spacing={3}>
              {(quiz.questions || []).map((q, qi) => (
                <Paper key={qi} elevation={0} sx={{ p: 2, borderRadius: 2, border: 1, borderColor: 'divider' }}>
                  <Typography fontWeight={700} sx={{ mb: 1.5 }}>
                    {qi + 1}. {q.question}
                  </Typography>
                  <FormControl component="fieldset" fullWidth>
                    <RadioGroup
                      value={answers[qi] ?? ''}
                      onChange={(e) => setAnswerForQuestion(qi, Number(e.target.value))}
                    >
                      {(q.options || []).map((opt, oi) => (
                        <FormControlLabel key={oi} value={oi} control={<Radio />} label={opt} />
                      ))}
                    </RadioGroup>
                  </FormControl>
                </Paper>
              ))}
            </Stack>

            <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
              <Button variant="contained" onClick={() => void submitQuiz()} disabled={submitting || nQ === 0}>
                {CLASSROOM.SUBMIT}
              </Button>
            </Stack>

            <Divider sx={{ my: 4 }} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between">
              {prevQ ? (
                <Button
                  component={Link}
                  to={`/classroom/${encodeURIComponent(slug)}/quiz/${encodeURIComponent(prevQ.id)}`}
                  variant="outlined"
                  startIcon={<ChevronLeft className="h-4 w-4" />}
                >
                  {QUIZ_DETAIL.PREV}
                </Button>
              ) : (
                <span />
              )}
              {nextQ ? (
                <Button
                  component={Link}
                  to={`/classroom/${encodeURIComponent(slug)}/quiz/${encodeURIComponent(nextQ.id)}`}
                  variant="outlined"
                  endIcon={<ChevronRight className="h-4 w-4" />}
                >
                  {QUIZ_DETAIL.NEXT}
                </Button>
              ) : null}
            </Stack>
          </>
        )}
      </Box>
    </>
  );
}
