import { Link } from 'react-router-dom';
import { Box, Breadcrumbs, Link as MuiLink, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { PAGE } from '../strings/vi';

const crumbLinkSxHero = {
  color: 'primary.contrastText',
  opacity: 0.92,
  fontWeight: 500,
  fontSize: { xs: '0.8125rem', sm: '0.875rem' },
};

const crumbCurrentSxHero = {
  color: 'primary.contrastText',
  fontWeight: 600,
  fontSize: { xs: '0.8125rem', sm: '0.875rem' },
  opacity: 0.95,
};

const crumbLinkSxCompact = {
  color: 'text.secondary',
  fontWeight: 500,
  fontSize: '0.8125rem',
  '&:hover': { color: 'primary.main' },
};

const crumbCurrentSxCompact = {
  color: 'text.primary',
  fontWeight: 600,
  fontSize: '0.8125rem',
};

/**
 * @param {string} title
 * @param {{ label: string, to?: string, active?: boolean }[]} [crumbs]
 * @param {'compact' | 'hero'} [variant] — compact (mặc định): thanh trắng + breadcrumb, đồng bộ public & dashboard; hero: banner cam (chỉ khi cần nổi bật)
 */
export function PageHeader({ title, crumbs = [], variant = 'compact' }) {
  const isCompact = variant !== 'hero';

  const breadcrumbBlock = (
    <Breadcrumbs
      sx={{
        justifyContent: isCompact ? 'flex-start' : 'center',
        '& .MuiBreadcrumbs-separator': {
          color: isCompact ? 'text.disabled' : 'primary.contrastText',
          opacity: isCompact ? 1 : 0.65,
          fontSize: '0.75rem',
        },
      }}
    >
      <MuiLink component={Link} to="/" underline="hover" sx={isCompact ? crumbLinkSxCompact : crumbLinkSxHero}>
        {PAGE.HOME_CRUMB}
      </MuiLink>
      {crumbs.map((c) =>
        c.to && !c.active ? (
          <MuiLink key={c.label} component={Link} to={c.to} underline="hover" sx={isCompact ? crumbLinkSxCompact : crumbLinkSxHero}>
            {c.label}
          </MuiLink>
        ) : (
          <Typography key={c.label} sx={isCompact ? crumbCurrentSxCompact : crumbCurrentSxHero}>
            {c.label}
          </Typography>
        ),
      )}
    </Breadcrumbs>
  );

  if (isCompact) {
    return (
      <Box
        component="section"
        sx={{
          bgcolor: 'background.paper',
          color: 'text.primary',
          borderBottom: 1,
          borderColor: 'divider',
          boxShadow: (t) => `0 1px 0 ${alpha(t.palette.common.black, 0.04)}`,
        }}
      >
        <Box
          className="container relative mx-auto max-w-6xl"
          sx={{
            px: { xs: 2, sm: 3 },
            py: { xs: 2.5, sm: 3 },
            background: (t) =>
              `linear-gradient(180deg, ${alpha(t.palette.primary.main, 0.07)} 0%, ${t.palette.background.paper} 64%)`,
            borderLeft: { xs: 'none', sm: (t) => `4px solid ${t.palette.primary.main}` },
            borderTop: { xs: (t) => `3px solid ${t.palette.primary.main}`, sm: 'none' },
          }}
        >
          {breadcrumbBlock}
          <Typography
            component="h1"
            variant="h4"
            className="font-display"
            sx={{
              mt: 1.25,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
              fontSize: { xs: '1.35rem', sm: '1.5rem', md: '1.75rem' },
              color: 'text.primary',
            }}
          >
            {title}
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      component="section"
      className="relative overflow-hidden"
      sx={{
        bgcolor: 'primary.main',
        color: 'primary.contrastText',
        borderBottom: 1,
        borderColor: (t) => alpha(t.palette.common.black, 0.08),
        boxShadow: (t) => `inset 0 -1px 0 ${alpha(t.palette.common.black, 0.06)}`,
      }}
    >
      <Box
        className="pointer-events-none absolute inset-0"
        sx={{
          opacity: 0.18,
          backgroundImage: (t) =>
            `radial-gradient(circle at 18% 28%, ${alpha(t.palette.common.white, 0.95)}, transparent 42%),
             radial-gradient(circle at 82% 72%, ${alpha(t.palette.common.white, 0.55)}, transparent 38%)`,
        }}
      />
      <Box className="container relative mx-auto max-w-6xl px-4 py-7 text-center md:py-9">
        {breadcrumbBlock}
        <Typography
          component="h1"
          className="font-display"
          sx={{
            mt: 2,
            fontWeight: 800,
            lineHeight: 1.12,
            letterSpacing: '-0.02em',
            textShadow: '0 1px 2px rgba(0,0,0,0.08)',
            fontSize: { xs: '1.75rem', sm: '2rem', md: '2.25rem', lg: '2.5rem' },
          }}
        >
          {title}
        </Typography>
      </Box>
    </Box>
  );
}
