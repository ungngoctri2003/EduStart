import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  IconButton,
  Paper,
  Typography,
} from '@mui/material';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Globe,
  GraduationCap,
  Handshake,
  Monitor,
} from 'lucide-react';
import { CourseCatalogCard } from '../components/CourseCatalogCard';
import { TeamMemberGrid } from '../components/TeamMemberGrid';
import { apiFetch } from '../lib/api';
import {
  EASE_NAV,
  getHeroBg,
  getHeroStaggerRoot,
  getHomeHeroSectionProps,
  heroBlock,
  heroLine,
  imageReveal,
  sectionInView,
  sectionInViewDramatic,
  staggerGrid,
  staggerItem,
} from '../motion/variants';
import { COURSES_PAGE, ERR, HOME, TEAM_PAGE } from '../strings/vi';

const MotionBox = motion.create(Box);
const inView = { once: true, amount: 0.2 };

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
    secondary: { to: '/classes', label: HOME.BROWSE_CLASSES },
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

const featureIcons = [GraduationCap, Handshake, Globe, Monitor];

const featureCopy = [
  { title: HOME.FEATURE1_TITLE, text: HOME.FEATURE1_TEXT },
  { title: HOME.FEATURE2_TITLE, text: HOME.FEATURE2_TEXT },
  { title: HOME.FEATURE3_TITLE, text: HOME.FEATURE3_TEXT },
  { title: HOME.FEATURE4_TITLE, text: HOME.FEATURE4_TEXT },
];

const FEATURED_COURSE_COUNT = 6;

export function Home() {
  const [index, setIndex] = useState(0);
  const [teamPreview, setTeamPreview] = useState([]);
  const [categoriesPreview, setCategoriesPreview] = useState([]);
  const [featuredCourses, setFeaturedCourses] = useState([]);
  const [catalogErr, setCatalogErr] = useState('');
  const [strongHeroEntry, setStrongHeroEntry] = useState(true);
  const reduceMotion = useReducedMotion() ?? false;

  useEffect(() => {
    const t = window.setInterval(() => setIndex((i) => (i + 1) % slides.length), 6500);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => setStrongHeroEntry(false), 4200);
    return () => window.clearTimeout(id);
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [c, cat] = await Promise.all([apiFetch('/api/courses'), apiFetch('/api/categories')]);
        if (cancelled) return;
        const courses = Array.isArray(c) ? c : [];
        const categories = Array.isArray(cat) ? cat : [];
        setFeaturedCourses(courses.slice(0, FEATURED_COURSE_COUNT));
        setCategoriesPreview(categories.slice(0, 8));
        setCatalogErr('');
      } catch (e) {
        if (!cancelled) {
          setCatalogErr(e.message || ERR.LOAD);
          setFeaturedCourses([]);
          setCategoriesPreview([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const slide = slides[index];
  const prev = () => setIndex((i) => (i - 1 + slides.length) % slides.length);
  const next = () => setIndex((i) => (i + 1) % slides.length);

  const hLine = heroLine(reduceMotion);
  const hBlock = heroBlock(reduceMotion);
  const sec = sectionInView(reduceMotion);
  const sGrid = staggerGrid(reduceMotion);
  const sItem = staggerItem(reduceMotion);
  const imgRe = imageReveal(reduceMotion);
  const secDram = sectionInViewDramatic(reduceMotion);
  const heroStagger = getHeroStaggerRoot(reduceMotion, { strongEntry: strongHeroEntry });

  return (
    <>
      <MotionBox
        component="section"
        className="relative mb-8 overflow-hidden"
        sx={{ minHeight: { xs: 480, md: 600 } }}
        {...getHomeHeroSectionProps(reduceMotion)}
      >
        <AnimatePresence mode="wait" initial={false}>
          <MotionBox
            key={index}
            component="div"
            className="absolute inset-0"
            initial="initial"
            animate="animate"
            exit="exit"
            variants={getHeroBg(reduceMotion)}
          >
            <motion.img
              key={slide.image}
              src={slide.image}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              initial={reduceMotion ? false : { scale: 1.14, filter: 'brightness(0.75)' }}
              animate={{ scale: 1, filter: 'brightness(1)' }}
              transition={{ duration: 1.2, ease: EASE_NAV }}
            />
          </MotionBox>
        </AnimatePresence>
        {!reduceMotion && (
          <>
            <motion.div
              className="pointer-events-none absolute -right-32 top-0 z-[1] h-72 w-72 rounded-full bg-primary/25 blur-3xl"
              aria-hidden
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 0.5, scale: 1 }}
              transition={{ duration: 1.4, ease: EASE_NAV, delay: 0.2 }}
            />
            <motion.div
              className="pointer-events-none absolute -left-24 bottom-0 z-[1] h-64 w-64 rounded-full bg-white/10 blur-3xl"
              aria-hidden
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              transition={{ duration: 1.1, delay: 0.35, ease: EASE_NAV }}
            />
            <motion.div
              className="pointer-events-none absolute left-1/2 top-1/3 z-[1] h-40 w-40 -translate-x-1/2 rounded-full bg-primary/15 blur-2xl"
              aria-hidden
              animate={{ y: [0, -12, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            />
          </>
        )}
        <motion.div
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{
            background: 'linear-gradient(to right, color-mix(in oklab, var(--color-base-content) 85%, transparent), color-mix(in oklab, var(--color-base-content) 50%, transparent))',
          }}
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.65, delay: 0.08, ease: EASE_NAV }}
        />
        <Box
          className="relative z-10 mx-auto max-w-6xl px-4 py-16"
          sx={{ minHeight: { xs: 480, md: 600 } }}
        >
          <motion.div
            key={index}
            className="flex h-full min-h-0 flex-col justify-center"
            initial="hidden"
            animate="visible"
            variants={heroStagger}
          >
            <MotionBox
              component="p"
              variants={hLine}
              className="mb-3 text-sm font-semibold uppercase tracking-wider"
              sx={{ color: 'primary.main' }}
            >
              {slide.kicker}
            </MotionBox>
            <MotionBox
              component="h1"
              variants={hLine}
              className="font-display font-bold leading-tight text-white md:text-5xl"
              sx={{ fontSize: { xs: '2.25rem', md: '3rem' }, maxWidth: { lg: '48rem' } }}
            >
              {slide.title}
            </MotionBox>
            <MotionBox
              component="p"
              variants={hLine}
              className="mt-4 max-w-2xl text-lg"
              sx={{ color: 'rgba(255,255,255,0.9)' }}
            >
              {slide.text}
            </MotionBox>
            <MotionBox component="div" variants={hBlock} className="mt-8 flex flex-wrap gap-3">
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
            </MotionBox>
          </motion.div>
        </Box>
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.55, duration: 0.45, ease: EASE_NAV }}
          className="absolute z-20"
          style={{ top: '50%', left: 8, transform: 'translateY(-50%)' }}
        >
          <IconButton type="button" aria-label={HOME.PREV_SLIDE} onClick={prev} sx={carouselBtnSx}>
            <ChevronLeft className="h-8 w-8" />
          </IconButton>
        </motion.div>
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.55, duration: 0.45, ease: EASE_NAV }}
          className="absolute z-20"
          style={{ top: '50%', right: 8, transform: 'translateY(-50%)' }}
        >
          <IconButton type="button" aria-label={HOME.NEXT_SLIDE} onClick={next} sx={carouselBtnSx}>
            <ChevronRight className="h-8 w-8" />
          </IconButton>
        </motion.div>
        <Box className="absolute bottom-8 left-1/2 z-20 flex gap-2" sx={{ transform: 'translateX(-50%)' }}>
          {slides.map((_, i) => (
            <motion.button
              key={i}
              type="button"
              className="h-2.5 w-2.5 rounded-full transition-colors"
              style={{
                background: i === index ? 'var(--mui-palette-primary-main)' : 'rgba(255,255,255,0.45)',
                border: 'none',
                cursor: 'pointer',
              }}
              initial={reduceMotion ? false : { scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.4 + i * 0.08, type: 'spring', stiffness: 400, damping: 22 }}
              aria-label={HOME.GO_SLIDE(i + 1)}
              onClick={() => setIndex(i)}
            />
          ))}
        </Box>
        {!reduceMotion && (
          <motion.div
            className="absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-0.5 text-white/45"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.5, ease: EASE_NAV }}
            aria-hidden
          >
            <motion.div
              animate={{ y: [0, 6, 0] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <ChevronDown className="h-6 w-6" />
            </motion.div>
          </motion.div>
        )}
      </MotionBox>

      <section className="bg-[var(--mui-palette-background-default)] py-16">
        <div className="container mx-auto max-w-6xl px-4">
          <motion.div
            className="text-center"
            initial="hidden"
            whileInView="visible"
            viewport={inView}
            variants={secDram}
          >
            <h2 className="font-display text-3xl font-bold text-base-content md:text-4xl">{HOME.FEATURES_TITLE}</h2>
            <p className="mx-auto mt-3 max-w-2xl text-base-content/80">{HOME.FEATURES_SUB}</p>
          </motion.div>
          <motion.div
            className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
            initial="hidden"
            whileInView="visible"
            viewport={inView}
            variants={sGrid}
          >
            {featureCopy.map((item, i) => {
              const Icon = featureIcons[i];
              return (
                <motion.div key={item.title} variants={sItem} className="h-full min-h-0 text-left">
                  <Paper
                    elevation={0}
                    className="h-full"
                    sx={{
                      p: 3,
                      height: '100%',
                      transition: 'box-shadow 0.2s ease, border-color 0.2s ease, transform 0.2s ease',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: (t) => t.shadows[3],
                        borderColor: 'primary.main',
                      },
                    }}
                  >
                    <Box
                      className="mb-4 inline-flex rounded-xl p-3"
                      sx={{ bgcolor: 'color-mix(in oklab, var(--mui-palette-primary-main) 12%, transparent)' }}
                    >
                      <Icon className="h-7 w-7" style={{ color: 'var(--mui-palette-primary-main)' }} aria-hidden />
                    </Box>
                    <Typography component="h3" className="font-display text-lg font-bold text-base-content">
                      {item.title}
                    </Typography>
                    <Typography component="p" className="mt-2 text-sm text-base-content/80">
                      {item.text}
                    </Typography>
                  </Paper>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      <section className="container mx-auto max-w-6xl px-4 py-16">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <motion.div
            className="relative aspect-[4/3] overflow-hidden rounded-2xl shadow-xl"
            initial="hidden"
            whileInView="visible"
            viewport={inView}
            variants={imgRe}
          >
            <Box component="img" src="/img/about.jpg" alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </motion.div>
          <motion.div
            className="min-w-0"
            initial="hidden"
            whileInView="visible"
            viewport={inView}
            variants={secDram}
          >
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">{HOME.ABOUT_SECTION_KICKER}</p>
            <h2 className="font-display mt-2 text-3xl font-bold text-base-content md:text-4xl">{HOME.ABOUT_SECTION_H2}</h2>
            <p className="mt-4 text-base-content/85">{HOME.ABOUT_SECTION_P}</p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {HOME.ABOUT_SECTION_BULLETS.map((line) => (
                <li key={line} className="flex gap-2 text-sm text-base-content/90">
                  <Check className="mt-0.5 h-5 w-5 shrink-0" style={{ color: 'var(--mui-palette-primary-main)' }} aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <Button component={Link} to="/about" variant="contained" color="primary" size="large" sx={{ mt: 4 }}>
              {HOME.LEARN_MORE}
            </Button>
          </motion.div>
        </div>
      </section>

      <section className="bg-[var(--mui-palette-background-default)] py-16">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="grid items-center gap-10 md:grid-cols-2">
            <motion.div
              className="order-2 min-w-0 md:order-1"
              initial="hidden"
              whileInView="visible"
              viewport={inView}
              variants={sec}
            >
              <h2 className="font-display text-3xl font-bold text-base-content md:text-4xl">{HOME.PROGRAMS_CTA_H2}</h2>
              <p className="mt-4 text-base-content/85">{HOME.PROGRAMS_CTA_SUB}</p>
              <Button component={Link} to="/signup" variant="contained" color="primary" size="large" sx={{ mt: 4 }}>
                {HOME.REGISTER_NOW}
              </Button>
            </motion.div>
            <motion.div
              className="relative order-1 aspect-[4/3] overflow-hidden rounded-2xl shadow-xl md:order-2"
              initial="hidden"
              whileInView="visible"
              viewport={inView}
              variants={imgRe}
            >
              <Box component="img" src="/img/ready.jpg" alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </motion.div>
          </div>
        </div>
      </section>

      <section className="container mx-auto max-w-6xl px-4 py-16">
        <motion.div
          className="text-center"
          initial="hidden"
          whileInView="visible"
          viewport={inView}
          variants={sGrid}
        >
          <motion.p
            className="text-sm font-semibold uppercase tracking-wide text-primary"
            variants={sItem}
          >
            {HOME.MAJORS_KICKER}
          </motion.p>
          <motion.h2
            className="font-display mt-2 text-3xl font-bold text-base-content md:text-4xl"
            variants={sItem}
          >
            {HOME.MAJORS_H2}
          </motion.h2>
        </motion.div>
        {catalogErr ? (
          <Alert severity="error" sx={{ mt: 4 }} role="alert">
            {catalogErr}
          </Alert>
        ) : null}
        <motion.div
          className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          initial="hidden"
          whileInView="visible"
          viewport={inView}
          variants={sGrid}
        >
          {categoriesPreview.map((cat) => (
            <motion.div key={cat.id} variants={sItem} className="min-h-0">
              <Card
                elevation={0}
                sx={{
                  height: '100%',
                  transition: 'box-shadow 0.2s ease, transform 0.2s ease, border-color 0.2s ease',
                  '&:hover': { boxShadow: (t) => t.shadows[3], transform: 'translateY(-2px)', borderColor: 'primary.main' },
                }}
              >
                <CardActionArea
                  component={Link}
                  to="/courses"
                  sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 2, p: 2, height: '100%' }}
                >
                  {cat.image_url ? (
                    <Box
                      component="img"
                      src={cat.image_url}
                      alt=""
                      sx={{ width: 52, height: 52, flexShrink: 0, borderRadius: 1.5, objectFit: 'contain' }}
                    />
                  ) : (
                    <Box
                      sx={{
                        width: 52,
                        height: 52,
                        flexShrink: 0,
                        borderRadius: 1.5,
                        bgcolor: 'action.hover',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        typography: 'caption',
                        fontWeight: 700,
                        color: 'text.secondary',
                      }}
                    >
                      {cat.name?.slice(0, 2)}
                    </Box>
                  )}
                  <Typography component="h3" className="font-display text-left text-base font-bold text-base-content">
                    {cat.name}
                  </Typography>
                </CardActionArea>
              </Card>
            </motion.div>
          ))}
        </motion.div>
        {!catalogErr && categoriesPreview.length === 0 ? (
          <p className="mt-8 text-center text-base-content/60">{COURSES_PAGE.EMPTY}</p>
        ) : null}
      </section>

      <section className="bg-[var(--mui-palette-background-default)] py-16">
        <div className="container mx-auto max-w-6xl px-4">
          <motion.div
            className="text-center"
            initial="hidden"
            whileInView="visible"
            viewport={inView}
            variants={sGrid}
          >
            <motion.p
              className="text-sm font-semibold uppercase tracking-wide text-primary"
              variants={sItem}
            >
              {HOME.FEATURED_PROGRAMS_KICKER}
            </motion.p>
            <motion.h2
              className="font-display mt-2 text-3xl font-bold text-base-content md:text-4xl"
              variants={sItem}
            >
              {HOME.FEATURED_PROGRAMS_H2}
            </motion.h2>
          </motion.div>
          <motion.div
            className="mt-10 grid gap-8 sm:grid-cols-2 xl:grid-cols-3"
            initial="hidden"
            whileInView="visible"
            viewport={inView}
            variants={sGrid}
          >
            {featuredCourses.map((course) => (
              <motion.div key={course.id} variants={sItem} className="min-h-0">
                <CourseCatalogCard course={course} />
              </motion.div>
            ))}
          </motion.div>
          {!catalogErr && featuredCourses.length === 0 ? (
            <p className="mt-8 text-center text-base-content/60">{COURSES_PAGE.EMPTY}</p>
          ) : null}
          <motion.div
            className="mt-10 text-center"
            initial="hidden"
            whileInView="visible"
            viewport={inView}
            variants={sec}
          >
            <Button component={Link} to="/courses" variant="contained" color="primary" size="large" sx={{ minWidth: 200 }}>
              {HOME.VIEW_ALL_COURSES}
            </Button>
          </motion.div>
        </div>
      </section>

      {teamPreview.length > 0 ? (
        <motion.section
          className="container mx-auto max-w-6xl px-4 py-16"
          initial="hidden"
          whileInView="visible"
          viewport={inView}
          variants={sec}
        >
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
        </motion.section>
      ) : null}

      <Box
        component="section"
        className="relative bg-cover bg-center py-16"
        sx={{ backgroundImage: "url('/img/banner-3.jpg')" }}
      >
        <Box className="absolute inset-0" sx={{ bgcolor: 'color-mix(in oklab, var(--color-base-content) 75%, transparent)' }} />
        <div className="container relative z-10 mx-auto max-w-6xl px-4">
          <div className="grid items-center gap-10 md:grid-cols-2">
            <motion.div
              className="relative aspect-[4/3] overflow-hidden rounded-2xl shadow-2xl"
              initial="hidden"
              whileInView="visible"
              viewport={inView}
              variants={imgRe}
            >
              <img src="/img/banner-2.png" alt="" className="h-full w-full object-cover" />
            </motion.div>
            <motion.div
              className="min-w-0"
              initial="hidden"
              whileInView="visible"
              viewport={inView}
              variants={sec}
            >
              <h2 className="font-display text-3xl font-bold text-primary md:text-4xl">{HOME.INSTRUCTOR_TITLE}</h2>
              <p className="mt-4 text-white/90">{HOME.INSTRUCTOR_TEXT}</p>
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
            </motion.div>
          </div>
        </div>
      </Box>

      <motion.section
        className="container mx-auto max-w-3xl px-4 py-16"
        initial="hidden"
        whileInView="visible"
        viewport={inView}
        variants={sec}
      >
        <h2 className="font-display text-center text-3xl font-bold text-base-content md:text-4xl">{HOME.FAQ_TITLE}</h2>
        <Box className="mt-8" sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {HOME.FAQ_ITEMS.map((item, i) => (
            <Accordion
              key={item.q}
              defaultExpanded={i === 0}
              disableGutters
              elevation={0}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: '10px !important',
                '&:before': { display: 'none' },
                overflow: 'hidden',
              }}
            >
              <AccordionSummary
                expandIcon={<ChevronDown className="h-5 w-5 text-base-content/60" aria-hidden />}
                aria-controls={`home-faq-${i}`}
                id={`home-faq-header-${i}`}
              >
                <Typography component="span" className="font-display font-semibold text-base-content">
                  {item.q}
                </Typography>
              </AccordionSummary>
              <AccordionDetails id={`home-faq-${i}`}>
                <Typography color="text.secondary">{item.a}</Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      </motion.section>
    </>
  );
}
