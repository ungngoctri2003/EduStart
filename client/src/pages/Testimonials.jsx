import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { toast } from 'sonner';
import { Alert, Box, Button, Card, CardContent, CircularProgress, Rating, TextField, Typography } from '@mui/material';
import { DemoReviewsGrid } from '../components/DemoReviewsGrid';
import { PageHeader } from '../components/PageHeader';
import { ScrollSection } from '../motion/ScrollBlock';
import { apiFetch } from '../lib/api';
import { COMMON, CONTACT_PAGE, ERR, TESTI_PAGE } from '../strings/vi';

export function Testimonials() {
  const reduce = useReducedMotion() ?? false;
  const [items, setItems] = useState([]);
  const [err, setErr] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch('/api/testimonials');
        if (!cancelled) setItems(data || []);
      } catch (e) {
        if (!cancelled) setErr(e.message || ERR.LOAD_TESTIMONIALS);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmitReview(e) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !content.trim()) {
      toast.error(TESTI_PAGE.FORM_REQUIRED);
      return;
    }
    setSending(true);
    try {
      await apiFetch('/api/testimonials', {
        method: 'POST',
        body: JSON.stringify({
          author_name: name.trim(),
          author_title: role.trim() || null,
          content: content.trim(),
          rating,
          email: email.trim(),
        }),
      });
      const next = await apiFetch('/api/testimonials');
      setItems(Array.isArray(next) ? next : []);
      toast.success(TESTI_PAGE.FORM_SENT);
      setName('');
      setEmail('');
      setRole('');
      setRating(5);
      setContent('');
    } catch (err) {
      toast.error(err.data?.error || err.message || TESTI_PAGE.FORM_ERR);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <PageHeader title={TESTI_PAGE.TITLE} crumbs={[{ label: TESTI_PAGE.CRUMB, active: true }]} />
      <div className="container mx-auto max-w-6xl px-4 py-16">
        <ScrollSection reduced={reduce} className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">{TESTI_PAGE.KICKER}</p>
          <h2 className="font-display mt-2 text-3xl font-bold md:text-4xl">{TESTI_PAGE.H2}</h2>
        </ScrollSection>
        {err ? (
          <Alert severity="error" sx={{ mt: 4 }}>
            {err}
          </Alert>
        ) : null}

        <ScrollSection reduced={reduce} className="mt-10">
          <Card elevation={0} sx={{ boxShadow: (t) => t.shadows[2], border: 1, borderColor: 'divider', borderRadius: 3 }}>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <p className="text-sm font-semibold uppercase tracking-wide text-primary">{TESTI_PAGE.FORM_KICKER}</p>
              <Typography component="h2" variant="h5" className="font-display" sx={{ fontWeight: 800, mt: 1, mb: 1 }}>
                {TESTI_PAGE.FORM_TITLE}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, maxWidth: 640, mx: 'auto', textAlign: { xs: 'left', sm: 'center' } }}>
                {TESTI_PAGE.FORM_LEAD}
              </Typography>
              <Box
                component="form"
                onSubmit={onSubmitReview}
                sx={{ maxWidth: 560, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}
              >
                <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
                  <TextField
                    required
                    size="small"
                    label={CONTACT_PAGE.YOUR_NAME}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                  />
                  <TextField
                    required
                    size="small"
                    label={COMMON.EMAIL}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </Box>
                <TextField
                  size="small"
                  label={TESTI_PAGE.FORM_ROLE}
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                />
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    {TESTI_PAGE.FORM_RATING}
                  </Typography>
                  <Rating
                    name="testimonial-rating"
                    value={rating}
                    onChange={(_, v) => setRating(v ?? 5)}
                    size="large"
                  />
                </Box>
                <TextField
                  required
                  size="small"
                  label={TESTI_PAGE.FORM_CONTENT}
                  multiline
                  minRows={4}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={TESTI_PAGE.FORM_PLACEHOLDER}
                />
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  size="large"
                  disabled={sending}
                  startIcon={sending ? <CircularProgress size={20} color="inherit" /> : null}
                  sx={{ alignSelf: { sm: 'center' } }}
                >
                  {sending ? CONTACT_PAGE.SENDING : TESTI_PAGE.FORM_SUBMIT}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </ScrollSection>

        <Box sx={{ mt: 6 }}>
          <ScrollSection reduced={reduce}>
            <DemoReviewsGrid items={items} />
          </ScrollSection>
        </Box>
        {!err && items.length === 0 ? (
          <p className="mt-8 text-center text-base-content/60">{TESTI_PAGE.EMPTY}</p>
        ) : null}
      </div>
    </>
  );
}
