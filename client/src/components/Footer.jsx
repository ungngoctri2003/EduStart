import { Link } from 'react-router-dom';
import { MapPin, Phone, Mail, Share2, MessageCircle, PlayCircle, Link2 } from 'lucide-react';
import { Box, Button, Link as MuiLink, Stack, TextField, Typography } from '@mui/material';
import { FOOTER, NAV, SITE_CONTACT } from '../strings/vi';

const footerLinkSx = {
  color: 'inherit',
  opacity: 0.9,
  textDecoration: 'none',
  fontSize: '0.875rem',
  '&:hover': { textDecoration: 'underline', opacity: 1 },
};

export function Footer() {
  return (
    <Box
      component="footer"
      className="mt-auto"
      sx={{
        bgcolor: 'neutral.main',
        color: 'neutral.contrastText',
      }}
    >
      <Box
        className="container mx-auto max-w-6xl px-4 py-14"
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
          gap: 5,
        }}
      >
        <div>
          <Typography component="h3" className="font-display" sx={{ mb: 2, fontWeight: 700, fontSize: '1.125rem' }}>
            {FOOTER.QUICK_LINKS}
          </Typography>
          <Stack component="ul" spacing={1} sx={{ listStyle: 'none', m: 0, p: 0, opacity: 0.9, fontSize: '0.875rem' }}>
            <li>
              <MuiLink component={Link} to="/about" sx={footerLinkSx}>
                {NAV.ABOUT}
              </MuiLink>
            </li>
            <li>
              <MuiLink component={Link} to="/contact" sx={footerLinkSx}>
                {NAV.CONTACT}
              </MuiLink>
            </li>
            <li>
              <MuiLink href="#" sx={footerLinkSx}>
                {FOOTER.PRIVACY}
              </MuiLink>
            </li>
            <li>
              <MuiLink href="#" sx={footerLinkSx}>
                {FOOTER.TERMS}
              </MuiLink>
            </li>
          </Stack>
        </div>
        <div>
          <Typography component="h3" className="font-display" sx={{ mb: 2, fontWeight: 700, fontSize: '1.125rem' }}>
            {FOOTER.CONTACT_TITLE}
          </Typography>
          <Stack component="ul" spacing={1.5} sx={{ listStyle: 'none', m: 0, p: 0, opacity: 0.9, fontSize: '0.875rem' }}>
            <li style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <MapPin size={20} style={{ marginTop: 2, flexShrink: 0 }} color="var(--mui-palette-primary-main)" />
              <span>{FOOTER.ADDRESS}</span>
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Phone size={20} style={{ flexShrink: 0 }} color="var(--mui-palette-primary-main)" />
              <span>{SITE_CONTACT.PHONE}</span>
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Mail size={20} style={{ flexShrink: 0 }} color="var(--mui-palette-primary-main)" />
              <span>{SITE_CONTACT.EMAIL}</span>
            </li>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <IconCircleButton label={FOOTER.SHARE} href="#">
              <Share2 size={16} />
            </IconCircleButton>
            <IconCircleButton label={FOOTER.COMMUNITY} href="#">
              <MessageCircle size={16} />
            </IconCircleButton>
            <IconCircleButton label={FOOTER.VIDEO} href="#">
              <PlayCircle size={16} />
            </IconCircleButton>
            <IconCircleButton label={FOOTER.LINK} href="#">
              <Link2 size={16} />
            </IconCircleButton>
          </Stack>
        </div>
        <div>
          <Typography component="h3" className="font-display" sx={{ mb: 2, fontWeight: 700, fontSize: '1.125rem' }}>
            {FOOTER.NEWSLETTER}
          </Typography>
          <Typography sx={{ mb: 2, fontSize: '0.875rem', opacity: 0.9 }}>{FOOTER.NEWSLETTER_DESC}</Typography>
          <Box
            component="form"
            className="max-w-sm"
            sx={{ display: 'flex', width: '100%', gap: 0, alignItems: 'stretch' }}
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            <TextField
              type="email"
              placeholder={FOOTER.EMAIL_PLACEHOLDER}
              required
              size="small"
              sx={{
                flex: 1,
                '& .MuiOutlinedInput-root': {
                  borderTopRightRadius: 0,
                  borderBottomRightRadius: 0,
                },
              }}
            />
            <Button
              type="submit"
              variant="contained"
              color="primary"
              sx={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, px: 2, whiteSpace: 'nowrap' }}
            >
              {FOOTER.SUBSCRIBE}
            </Button>
          </Box>
        </div>
      </Box>
      <Box sx={{ borderTop: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
        <Box className="container mx-auto max-w-6xl px-4 py-3 text-center text-sm opacity-80">
          ©{' '}
          <MuiLink component={Link} to="/" sx={{ ...footerLinkSx, fontWeight: 500 }}>
            EduStart
          </MuiLink>
          . {FOOTER.COPYRIGHT}
        </Box>
      </Box>
    </Box>
  );
}

function IconCircleButton({ children, href, label }) {
  return (
    <Button
      component="a"
      href={href}
      aria-label={label}
      variant="outlined"
      size="small"
      sx={{
        minWidth: 0,
        p: 1,
        borderRadius: '50%',
        borderColor: 'rgba(255,255,255,0.35)',
        color: 'inherit',
        '&:hover': { borderColor: 'rgba(255,255,255,0.55)', bgcolor: 'rgba(255,255,255,0.06)' },
      }}
    >
      {children}
    </Button>
  );
}
