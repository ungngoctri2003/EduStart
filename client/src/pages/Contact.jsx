import { useState } from 'react';
import { toast } from 'sonner';
import { MapPin, Phone, Mail } from 'lucide-react';
import { Box, Button, Card, CardContent, CircularProgress, TextField, Typography } from '@mui/material';
import { PageHeader } from '../components/PageHeader';
import { apiFetch } from '../lib/api';
import { CONTACT_PAGE, COMMON, ERR, SITE_CONTACT } from '../strings/vi';

function IconTile({ children }) {
  return (
    <Box
      sx={{
        flexShrink: 0,
        width: 48,
        height: 48,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 2,
        bgcolor: 'primary.main',
        color: 'primary.contrastText',
      }}
    >
      {children}
    </Box>
  );
}

export function Contact() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setSending(true);
    try {
      await apiFetch('/api/contact', {
        method: 'POST',
        body: JSON.stringify({ name, email, subject, message }),
      });
      toast.success(CONTACT_PAGE.SENT_OK);
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
    } catch (err) {
      toast.error(err.data?.error || err.message || ERR.SEND_FAILED);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <PageHeader title={CONTACT_PAGE.TITLE} crumbs={[{ label: CONTACT_PAGE.CRUMB, active: true }]} />
      <div className="container mx-auto max-w-6xl px-4 py-12">
        <h2 className="font-display text-center text-3xl font-bold">{CONTACT_PAGE.H2}</h2>
        <div className="mt-12 grid gap-12 lg:grid-cols-2">
          <div>
            <h3 className="font-display text-xl font-semibold">{CONTACT_PAGE.H3}</h3>
            <p className="mt-3 text-base-content/80">{CONTACT_PAGE.INTRO}</p>
            <Box component="ul" sx={{ mt: 4, listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box component="li" sx={{ display: 'flex', gap: 2 }}>
                <IconTile>
                  <MapPin className="h-5 w-5" />
                </IconTile>
                <div>
                  <p className="font-semibold">{CONTACT_PAGE.OFFICE}</p>
                  <p className="text-sm text-base-content/70">{CONTACT_PAGE.OFFICE_ADDR}</p>
                </div>
              </Box>
              <Box component="li" sx={{ display: 'flex', gap: 2 }}>
                <IconTile>
                  <Phone className="h-5 w-5" />
                </IconTile>
                <div>
                  <p className="font-semibold">{CONTACT_PAGE.MOBILE}</p>
                  <p className="text-sm text-base-content/70">{SITE_CONTACT.PHONE}</p>
                </div>
              </Box>
              <Box component="li" sx={{ display: 'flex', gap: 2 }}>
                <IconTile>
                  <Mail className="h-5 w-5" />
                </IconTile>
                <div>
                  <p className="font-semibold">{COMMON.EMAIL}</p>
                  <p className="text-sm text-base-content/70">{SITE_CONTACT.EMAIL}</p>
                </div>
              </Box>
            </Box>
          </div>
          <Card component="form" onSubmit={onSubmit} variant="outlined" sx={{ boxShadow: 3 }}>
            <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
                <TextField label={CONTACT_PAGE.YOUR_NAME} required fullWidth value={name} onChange={(e) => setName(e.target.value)} />
                <TextField
                  label={COMMON.EMAIL}
                  type="email"
                  required
                  fullWidth
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Box>
              <TextField label={CONTACT_PAGE.SUBJECT} fullWidth value={subject} onChange={(e) => setSubject(e.target.value)} />
              <TextField
                label={CONTACT_PAGE.MESSAGE}
                required
                fullWidth
                multiline
                rows={6}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <Button type="submit" variant="contained" color="primary" fullWidth size="large" disabled={sending}>
                {sending ? <CircularProgress size={22} color="inherit" sx={{ mr: 1 }} /> : null}
                {sending ? CONTACT_PAGE.SENDING : CONTACT_PAGE.SEND}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
