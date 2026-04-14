import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Box, Button, IconButton, Typography } from '@mui/material';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { TeamMemberGrid } from '../components/TeamMemberGrid';
import { apiFetch } from '../lib/api';
import { HOME, TEAM_PAGE } from '../strings/vi';

const slides = [
  {
    image: '/img/carousel-1.jpg',
    kicker: HOME.SLIDE1_KICKER,
    title: HOME.SLIDE1_TITLE,
    text: HOME.SLIDE1_TEXT,
    primary: { to: '/about', label: HOME.READ_MORE },
    secondary: { to: '/signup', label: HOME.JOIN_NOW },
  },
  {
    image: '/img/carousel-2.jpg',
    kicker: HOME.SLIDE2_KICKER,
    title: HOME.SLIDE2_TITLE,
    text: HOME.SLIDE2_TEXT,
    primary: { to: '/courses', label: HOME.BROWSE_COURSES },
    secondary: null,
  },
];

const carouselBtnSx = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  zIndex: 20,
  color: 'primary.contrastText',
  border: '1px solid',
  borderColor: 'rgba(255,255,255,0.35)',
  bgcolor: 'rgba(0,0,0,0.15)',
  '&:hover': { bgcolor: 'rgba(0,0,0,0.28)' },
};

export function Home() {
  const [index, setIndex] = useState(0);
  const [teamPreview, setTeamPreview] = useState([]);

  useEffect(() => {
    const t = window.setInterval(() => setIndex((i) => (i + 1) % slides.length), 6500);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch('/api/team');
        const list = Array.isArray(data) ? data : [];
        if (!cancelled) setTeamPreview(list.slice(0, 4));
      } catch {
        if (!cancelled) setTeamPreview([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const slide = slides[index];
  const prev = () => setIndex((i) => (i - 1 + slides.length) % slides.length);
  const next = () => setIndex((i) => (i + 1) % slides.length);

  return (
    <>
      <Box
        component="section"
        className="relative mb-8 overflow-hidden"
        sx={{ minHeight: { xs: 480, md: 600 } }}
      >
        <Box component="img" src={slide.image} alt="" sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        <Box
          className="absolute inset-0"
          sx={{
            background: 'linear-gradient(to right, color-mix(in oklab, var(--color-base-content) 85%, transparent), color-mix(in oklab, var(--color-base-content) 50%, transparent))',
          }}
        />
        <Box
          className="relative z-10 mx-auto flex max-w-6xl flex-col justify-center px-4 py-16"
          sx={{ minHeight: { xs: 480, md: 600 } }}
        >
          <Typography
            component="p"
            className="mb-3 text-sm font-semibold uppercase tracking-wider"
            sx={{ color: 'primary.main' }}
          >
            {slide.kicker}
          </Typography>
          <Typography
            component="h1"
            className="font-display font-bold leading-tight text-base-100 md:text-5xl"
            sx={{ fontSize: { xs: '2.25rem', md: '3rem' }, maxWidth: { lg: '48rem' } }}
          >
            {slide.title}
          </Typography>
          <Typography component="p" className="mt-4 max-w-2xl text-lg" sx={{ color: 'rgba(255,255,255,0.9)' }}>
            {slide.text}
          </Typography>
          <Box className="mt-8 flex flex-wrap gap-3">
            <Button component={Link} to={slide.primary.to} variant="contained" color="primary" size="large">
              {slide.primary.label}
            </Button>
            {slide.secondary ? (
              <Button
                component={Link}
                to={slide.secondary.to}
                variant="outlined"
                size="large"
                sx={{
                  borderColor: 'rgba(255,255,255,0.85)',
                  color: 'primary.contrastText',
                  '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.12)', color: 'text.primary' },
                }}
              >
                {slide.secondary.label}
              </Button>
            ) : null}
          </Box>
        </Box>
        <IconButton type="button" aria-label={HOME.PREV_SLIDE} onClick={prev} sx={{ ...carouselBtnSx, left: 8 }}>
          <ChevronLeft className="h-8 w-8" />
        </IconButton>
        <IconButton type="button" aria-label={HOME.NEXT_SLIDE} onClick={next} sx={{ ...carouselBtnSx, right: 8 }}>
          <ChevronRight className="h-8 w-8" />
        </IconButton>
        <Box
          className="absolute bottom-4 left-1/2 z-20 flex gap-2"
          sx={{ transform: 'translateX(-50%)' }}
        >
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              className="h-2 w-2 rounded-full transition-colors"
              style={{
                background: i === index ? 'var(--mui-palette-primary-main)' : 'rgba(255,255,255,0.45)',
                border: 'none',
                cursor: 'pointer',
              }}
              aria-label={HOME.GO_SLIDE(i + 1)}
              onClick={() => setIndex(i)}
            />
          ))}
        </Box>
      </Box>

      <section className="container mx-auto max-w-6xl px-4 py-14 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">{HOME.SECTION_COURSES}</p>
        <h2 className="font-display mt-2 text-3xl font-bold text-base-content md:text-4xl">{HOME.POPULAR_COURSES}</h2>
        <Button component={Link} to="/courses" variant="contained" color="primary" size="large" sx={{ mt: 4, minWidth: 200 }}>
          {HOME.VIEW_ALL_COURSES}
        </Button>
      </section>

      {teamPreview.length > 0 ? (
        <section className="container mx-auto max-w-6xl px-4 py-14">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">{TEAM_PAGE.KICKER}</p>
            <h2 className="font-display mt-2 text-3xl font-bold text-base-content md:text-4xl">{TEAM_PAGE.H2}</h2>
          </div>
          <TeamMemberGrid members={teamPreview} />
          <div className="mt-8 text-center">
            <Button component={Link} to="/team" variant="outlined" color="primary" size="large">
              {HOME.VIEW_ALL_TEAM}
            </Button>
          </div>
        </section>
      ) : null}

      <Box
        component="section"
        className="relative bg-cover bg-center py-16"
        sx={{ backgroundImage: "url('/img/banner-3.jpg')" }}
      >
        <Box className="absolute inset-0" sx={{ bgcolor: 'color-mix(in oklab, var(--color-base-content) 75%, transparent)' }} />
        <div className="container relative z-10 mx-auto max-w-6xl px-4">
          <div className="grid items-center gap-10 md:grid-cols-2">
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl shadow-2xl">
              <img src="/img/banner-2.png" alt="" className="h-full w-full object-cover" />
            </div>
            <div>
              <h2 className="font-display text-3xl font-bold text-primary md:text-4xl">{HOME.INSTRUCTOR_TITLE}</h2>
              <p className="mt-4 text-base-100/90">{HOME.INSTRUCTOR_TEXT}</p>
              <Button
                component={Link}
                to="/instructor"
                variant="outlined"
                color="primary"
                size="large"
                sx={{ mt: 3, borderWidth: 2 }}
              >
                {HOME.START_TEACHING}
              </Button>
            </div>
          </div>
        </div>
      </Box>
    </>
  );
}
