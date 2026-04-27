import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Alert, Box, Card, CardContent, Typography } from '@mui/material';
import { PageHeader } from '../components/PageHeader';
import { CourseCatalogCard } from '../components/CourseCatalogCard';
import { StaggerContainer, StaggerItem } from '../motion/ScrollBlock';
import { apiFetch } from '../lib/api';
import { useStudentCatalogAccess } from '../hooks/useStudentCatalogAccess';
import { COURSES_PAGE, ERR } from '../strings/vi';

export function Courses() {
  const reduce = useReducedMotion() ?? false;
  const { coursePaymentById } = useStudentCatalogAccess();
  const [courses, setCourses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [c, cat] = await Promise.all([apiFetch('/api/courses'), apiFetch('/api/categories')]);
        if (!cancelled) {
          setCourses(c || []);
          setCategories(cat || []);
        }
      } catch (e) {
        if (!cancelled) setErr(e.message || ERR.LOAD);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <PageHeader title={COURSES_PAGE.TITLE} crumbs={[{ label: COURSES_PAGE.CRUMB, active: true }]} />
      <div className="container mx-auto max-w-6xl px-4 py-16">
        <StaggerContainer reduced={reduce} className="text-center">
          <StaggerItem reduced={reduce}>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">{COURSES_PAGE.CATEGORIES}</p>
            <h2 className="font-display mt-2 text-3xl font-bold md:text-4xl">{COURSES_PAGE.TOPICS}</h2>
          </StaggerItem>
        </StaggerContainer>
        <StaggerContainer reduced={reduce} className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((cat) => (
            <StaggerItem reduced={reduce} key={cat.id}>
              <Card
                elevation={0}
                sx={{
                  height: '100%',
                  transition: 'box-shadow 0.2s ease, transform 0.2s ease, border-color 0.2s ease',
                  '&:hover': { boxShadow: (t) => t.shadows[4], transform: 'translateY(-2px)', borderColor: 'primary.main' },
                }}
              >
                <Box sx={{ px: 2, pt: 2 }}>
                  {cat.image_url ? (
                    <Box
                      component="img"
                      src={cat.image_url}
                      alt=""
                      sx={{ height: 112, width: '100%', borderRadius: 2, objectFit: 'contain' }}
                    />
                  ) : (
                    <Box
                      sx={{
                        display: 'flex',
                        height: 112,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 2,
                        bgcolor: 'action.hover',
                        color: 'text.secondary',
                      }}
                    >
                      {cat.name}
                    </Box>
                  )}
                </Box>
                <CardContent sx={{ py: 2, textAlign: 'center' }}>
                  <Typography component="h3" className="font-display" sx={{ fontWeight: 700, fontSize: '1rem' }}>
                    {cat.name}
                  </Typography>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>

      <div className="container mx-auto max-w-6xl px-4 pb-24 pt-4">
        <StaggerContainer reduced={reduce} className="text-center">
          <StaggerItem reduced={reduce}>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">{COURSES_PAGE.TITLE}</p>
            <h2 className="font-display mt-2 text-3xl font-bold md:text-4xl">{COURSES_PAGE.ALL_COURSES}</h2>
          </StaggerItem>
        </StaggerContainer>
        {err ? (
          <Alert severity="error" sx={{ mt: 4 }}>
            {err}
          </Alert>
        ) : null}
        <StaggerContainer reduced={reduce} className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => (
            <StaggerItem reduced={reduce} key={course.id}>
              <CourseCatalogCard course={course} paymentStatus={coursePaymentById.get(course.id) ?? null} />
            </StaggerItem>
          ))}
        </StaggerContainer>
        {!err && courses.length === 0 ? (
          <p className="mt-8 text-center text-base-content/60">{COURSES_PAGE.EMPTY}</p>
        ) : null}
      </div>
    </>
  );
}
