import { Link } from 'react-router-dom';
import { BookOpen, LayoutList, School, Users } from 'lucide-react';
import { Box, Breadcrumbs, Divider, Link as MuiLink, Paper, Tab, Tabs, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { DASH_ADMIN, PAGE } from '../../strings/vi';

const TAB_KEYS = ['users', 'classes', 'courses', 'content'];

const TAB_ICONS = {
  users: <Users size={18} strokeWidth={2} aria-hidden />,
  classes: <School size={18} strokeWidth={2} aria-hidden />,
  courses: <BookOpen size={18} strokeWidth={2} aria-hidden />,
  content: <LayoutList size={18} strokeWidth={2} aria-hidden />,
};

/**
 * @param {string} tab
 * @param {(v: string) => void} onTabChange
 * @param {string} [headerTitle] — khi có: tiêu đề + breadcrumb trong cùng khối Paper (không dùng PageHeader cam)
 * @param {{ label: string, to?: string, active?: boolean }[]} [headerCrumbs]
 * @param {import('react').ReactNode} children — tab panel content
 */
export function AdminShell({ tab, onTabChange, headerTitle, headerCrumbs = [], children }) {
  const showHeader = Boolean(headerTitle);

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: { xs: 2, sm: 3 },
        overflow: 'hidden',
        bgcolor: 'background.paper',
        boxShadow: (t) => t.shadows[2],
      }}
    >
      {showHeader ? (
        <Box
          sx={{
            px: { xs: 2, sm: 3 },
            pt: { xs: 2.5, sm: 3 },
            pb: { xs: 2, sm: 2.25 },
            borderBottom: 1,
            borderColor: 'divider',
            background: (t) =>
              `linear-gradient(180deg, ${alpha(t.palette.primary.main, 0.06)} 0%, ${t.palette.background.paper} 72%)`,
          }}
        >
          <Breadcrumbs
            sx={{
              '& .MuiBreadcrumbs-separator': { color: 'text.disabled', fontSize: '0.75rem' },
            }}
          >
            <MuiLink component={Link} to="/" underline="hover" sx={{ color: 'text.secondary', fontWeight: 500, fontSize: '0.8125rem' }}>
              {PAGE.HOME_CRUMB}
            </MuiLink>
            {headerCrumbs.map((c) =>
              c.to && !c.active ? (
                <MuiLink
                  key={c.label}
                  component={Link}
                  to={c.to}
                  underline="hover"
                  sx={{ color: 'text.secondary', fontWeight: 500, fontSize: '0.8125rem' }}
                >
                  {c.label}
                </MuiLink>
              ) : (
                <Typography key={c.label} sx={{ color: 'text.primary', fontWeight: 600, fontSize: '0.8125rem' }}>
                  {c.label}
                </Typography>
              ),
            )}
          </Breadcrumbs>
          <Typography
            component="h1"
            variant="h4"
            className="font-display"
            sx={{
              mt: 1.25,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
              fontSize: { xs: '1.35rem', sm: '1.5rem', md: '1.625rem' },
              color: 'text.primary',
            }}
          >
            {headerTitle}
          </Typography>
        </Box>
      ) : null}

      <Tabs
        value={tab}
        onChange={(_, v) => onTabChange(v)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        TabIndicatorProps={{
          sx: {
            height: 3,
            borderRadius: '3px 3px 0 0',
            bgcolor: 'primary.main',
          },
        }}
        sx={{
          minHeight: 52,
          px: { xs: 0.5, sm: 1 },
          bgcolor: 'background.paper',
          borderBottom: showHeader ? 0 : 1,
          borderColor: 'divider',
          '& .MuiTab-root': {
            minHeight: 52,
            textTransform: 'none',
            fontWeight: 700,
            fontSize: { xs: '0.8125rem', sm: '0.9375rem' },
            gap: 1,
            color: 'text.secondary',
            '&.Mui-selected': { color: 'primary.main' },
          },
        }}
      >
        {TAB_KEYS.map((k) => (
          <Tab key={k} value={k} icon={TAB_ICONS[k]} iconPosition="start" label={DASH_ADMIN.TABS[k]} disableRipple={false} />
        ))}
      </Tabs>
      <Divider />
      <Box sx={{ p: { xs: 2, sm: 3 } }}>{children}</Box>
    </Paper>
  );
}
