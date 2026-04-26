import { useEffect, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Box,
  Button,
  IconButton,
  Collapse,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Menu as MenuIcon, X, User, LogOut, LayoutDashboard, Moon, Sun } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { useColorMode } from '../context/ColorModeContext';
import { NAV } from '../strings/vi';

const navEase = 'cubic-bezier(0.33, 1, 0.68, 1)';
const navTransition = [
  `background-color 0.32s ${navEase}`,
  `color 0.28s ${navEase}`,
  `box-shadow 0.32s ${navEase}`,
  `transform 0.22s ${navEase}`,
].join(', ');

const navButtonSx = {
  fontFamily: "'Outfit', ui-sans-serif, system-ui, sans-serif",
  fontWeight: 600,
  letterSpacing: '0.02em',
  minHeight: 44,
  px: { xs: 1.5, md: 2 },
  fontSize: { xs: '0.95rem', md: '1.05rem' },
  borderRadius: 2,
  bgcolor: 'transparent',
  color: 'text.primary',
  boxShadow: 'none',
  transition: navTransition,
  transform: 'translateZ(0)',
  '&:hover': {
    bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
    boxShadow: 'none',
    transform: 'translateY(-1px)',
  },
  '&:active': {
    transform: 'translateY(0)',
    transitionDuration: '0.12s',
  },
  '&.active': {
    bgcolor: 'primary.main',
    color: 'primary.contrastText',
    boxShadow: 2,
    transform: 'translateY(0)',
    '&:hover': {
      bgcolor: 'primary.dark',
      boxShadow: 3,
    },
  },
};

const signOutButtonSx = {
  ...navButtonSx,
  '&.active': {},
  '&:hover': {
    bgcolor: (t) => alpha(t.palette.error.main, 0.12),
    boxShadow: 'none',
    transform: 'translateY(-1px)',
  },
};

export function Navbar() {
  const { profile, signOut } = useAuth();
  const { mode, toggleColorMode } = useColorMode();
  const theme = useTheme();
  const isLg = useMediaQuery(theme.breakpoints.up('lg'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const dashPath =
    profile?.role === 'admin' ? '/dashboard/admin' : profile?.role === 'teacher' ? '/dashboard/teacher' : '/dashboard/student';

  const closeMobile = () => setMobileOpen(false);

  const themeToggle = (
    <IconButton
      type="button"
      color="inherit"
      aria-label={mode === 'dark' ? NAV.THEME_LIGHT : NAV.THEME_DARK}
      onClick={toggleColorMode}
      sx={{
        color: 'text.primary',
        borderRadius: 2,
        transition: `background-color 0.25s ${navEase}, transform 0.22s ${navEase}`,
        '&:hover': {
          bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
        },
      }}
    >
      {mode === 'dark' ? <Sun className="h-[22px] w-[22px]" aria-hidden /> : <Moon className="h-[22px] w-[22px]" aria-hidden />}
    </IconButton>
  );

  const navItems = (
    <>
      <Button component={NavLink} to="/" end sx={navButtonSx} onClick={closeMobile}>
        {NAV.HOME}
      </Button>
      <Button component={NavLink} to="/about" sx={navButtonSx} onClick={closeMobile}>
        {NAV.ABOUT}
      </Button>
      <Button component={NavLink} to="/courses" sx={navButtonSx} onClick={closeMobile}>
        {NAV.COURSES}
      </Button>
      <Button component={NavLink} to="/classes" sx={navButtonSx} onClick={closeMobile}>
        {NAV.CLASSES}
      </Button>
      <Button component={NavLink} to="/team" sx={navButtonSx} onClick={closeMobile}>
        {NAV.TEAM}
      </Button>
      <Button component={NavLink} to="/testimonials" sx={navButtonSx} onClick={closeMobile}>
        {NAV.TESTIMONIALS}
      </Button>
      <Button component={NavLink} to="/contact" sx={navButtonSx} onClick={closeMobile}>
        {NAV.CONTACT}
      </Button>
      {profile ? (
        <>
          <Button component={NavLink} to={dashPath} sx={navButtonSx} onClick={closeMobile} startIcon={<LayoutDashboard size={18} />}>
            {NAV.DASHBOARD}
          </Button>
          <Button
            color="error"
            sx={signOutButtonSx}
            onClick={() => signOut()}
            startIcon={<LogOut size={18} />}
          >
            {NAV.SIGN_OUT}
          </Button>
        </>
      ) : (
        <Button component={NavLink} to="/login" sx={navButtonSx} onClick={closeMobile} startIcon={<User size={18} />}>
          {NAV.SIGN_IN}
        </Button>
      )}
    </>
  );

  return (
    <AppBar
      position="sticky"
      color="inherit"
      elevation={0}
      sx={{
        zIndex: (t) => t.zIndex.drawer + 1,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: (t) => alpha(t.palette.background.paper, 0.86),
        backdropFilter: 'blur(12px) saturate(1.2)',
        backgroundImage: (t) =>
          `linear-gradient(180deg, ${alpha(t.palette.background.paper, 0.98)} 0%, ${alpha(t.palette.background.paper, 0.88)} 100%)`,
        boxShadow: (t) =>
          scrolled
            ? `0 4px 20px ${alpha(t.palette.common.black, t.palette.mode === 'dark' ? 0.45 : 0.1)}`
            : `0 1px 0 ${alpha(t.palette.common.black, t.palette.mode === 'dark' ? 0.2 : 0.04)}`,
        transition: `border-color 0.28s ${navEase}, box-shadow 0.28s ${navEase}`,
      }}
    >
      <Toolbar
        sx={{
          minHeight: { xs: 56, md: 64 },
          px: { xs: 1.5, md: 2.5 },
          gap: 1,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
          <Button
            component={Link}
            to="/"
            onClick={closeMobile}
            sx={{
              textTransform: 'none',
              gap: { xs: 1.25, md: 1.5 },
              fontFamily: "'Outfit', ui-sans-serif, system-ui, sans-serif",
              fontWeight: 800,
              fontSize: { xs: '1.35rem', md: '1.75rem' },
              letterSpacing: '-0.02em',
              color: 'text.primary',
              borderRadius: 2,
              transition: `opacity 0.25s ${navEase}, transform 0.28s ${navEase}`,
              '&:hover': { opacity: 0.92, transform: 'scale(1.01)' },
              '&:active': { transform: 'scale(0.995)', transitionDuration: '0.1s' },
            }}
          >
            <Box
              component="img"
              src="/img/icon.png"
              alt=""
              sx={{
                width: { xs: 40, md: 48 },
                height: { xs: 40, md: 48 },
                borderRadius: 2,
                objectFit: 'cover',
                boxShadow: 2,
                border: 1,
                borderColor: 'divider',
                transition: `box-shadow 0.3s ${navEase}, transform 0.3s ${navEase}`,
                '.MuiButtonBase-root:hover &': {
                  boxShadow: 4,
                  transform: 'rotate(-2deg) scale(1.03)',
                },
              }}
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            Edu
            <Box
              component="span"
              sx={{
                background: (t) => `linear-gradient(135deg, ${t.palette.primary.main}, ${t.palette.secondary.main})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Start
            </Box>
          </Button>
        </Box>

        {isLg ? (
          <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
            {navItems}
            {themeToggle}
          </Box>
        ) : (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0, ml: 'auto' }}>
              <IconButton
                type="button"
                aria-label={mobileOpen ? NAV.CLOSE_MENU : NAV.OPEN_MENU}
                aria-expanded={mobileOpen}
                onClick={() => setMobileOpen((v) => !v)}
                sx={{
                  color: 'text.primary',
                  borderRadius: 2,
                  transition: `background-color 0.25s ${navEase}, transform 0.22s ${navEase}`,
                  '&:hover': {
                    bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
                    transform: 'scale(1.06)',
                  },
                }}
              >
                {mobileOpen ? <X size={22} /> : <MenuIcon size={22} />}
              </IconButton>
              {themeToggle}
            </Box>
            <Collapse in={mobileOpen} timeout={280} unmountOnExit sx={{ width: '100%' }}>
              <Box
                sx={{
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  gap: 0.5,
                  pb: 1,
                  borderTop: 1,
                  borderColor: 'divider',
                  pt: 1,
                }}
              >
                {navItems}
              </Box>
            </Collapse>
          </>
        )}
      </Toolbar>
    </AppBar>
  );
}
