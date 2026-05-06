import { Link } from 'react-router-dom';
import { BadgeCheck, Clock, Star, Users, Gauge, ChevronRight } from 'lucide-react';
import { Box, Card, CardActionArea, CardContent, CardMedia, Chip, Stack, Typography } from '@mui/material';
import { CATALOG_BADGES, COURSES_PAGE, COMMON } from '../strings/vi';
import { formatVndFromPriceCentsOrFree } from '../utils/money.js';

/**
 * @param {{ course: object, paymentStatus?: string | null }} props
 * `paymentStatus`: merged from course enrollments and class memberships (`approved` | `pending` | `rejected`).
 */
export function CourseCatalogCard({ course, paymentStatus = null }) {
  const categoryName = course.categories?.name;
  const showApproved = paymentStatus === 'approved';
  const showPending = paymentStatus === 'pending';
  const activeClassCount = Number(course.active_classes_count) || 0;
  const priceChipLabel =
    activeClassCount > 0
      ? COURSES_PAGE.CATALOG_PRICE_VIA_CLASS
      : formatVndFromPriceCentsOrFree(course.price_cents, COMMON.FREE);

  return (
    <Card
      elevation={0}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        bgcolor: 'background.paper',
        transition: 'transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease',
        '&:hover': {
          transform: 'translateY(-6px)',
          boxShadow: (t) => t.shadows[5],
          borderColor: 'primary.main',
        },
        '& .MuiCardActionArea-root:hover .courses-card-media': {
          transform: 'scale(1.06)',
        },
      }}
    >
      <CardActionArea
        component={Link}
        to={`/courses/${course.slug}`}
        aria-label={`${COURSES_PAGE.VIEW_COURSE_ARIA}: ${course.title}`}
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          textAlign: 'left',
          borderRadius: 0,
        }}
      >
        <Box
          sx={{
            position: 'relative',
            aspectRatio: '16 / 10',
            overflow: 'hidden',
            bgcolor: 'action.hover',
          }}
        >
          <CardMedia
            className="courses-card-media"
            component="img"
            image={course.thumbnail_url || '/img/course-1.png'}
            alt=""
            sx={{
              height: '100%',
              width: '100%',
              objectFit: 'cover',
              transition: 'transform 0.4s ease',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(180deg, transparent 45%, rgba(28,36,51,0.55) 100%)',
              pointerEvents: 'none',
            }}
          />
          <Stack
            direction="row"
            spacing={1}
            sx={{ position: 'absolute', left: 12, top: 12, flexWrap: 'wrap', gap: 0.75 }}
            useFlexGap
          >
            {categoryName ? (
              <Chip
                label={categoryName}
                size="small"
                sx={{
                  bgcolor: 'rgba(255,255,255,0.92)',
                  color: 'secondary.main',
                  fontWeight: 700,
                  fontSize: '0.7rem',
                  height: 26,
                }}
              />
            ) : null}
          </Stack>
          {showApproved ? (
            <Chip
              icon={<BadgeCheck size={14} aria-hidden />}
              label={CATALOG_BADGES.COURSE_ENROLLED}
              size="small"
              color="success"
              sx={{
                position: 'absolute',
                right: 12,
                top: 12,
                fontWeight: 800,
                fontSize: '0.7rem',
                height: 28,
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                '& .MuiChip-icon': { color: 'inherit' },
              }}
            />
          ) : null}
          {showPending ? (
            <Chip
              icon={<Clock size={14} aria-hidden />}
              label={CATALOG_BADGES.PENDING}
              size="small"
              color="warning"
              sx={{
                position: 'absolute',
                right: 12,
                top: 12,
                fontWeight: 800,
                fontSize: '0.7rem',
                height: 28,
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                '& .MuiChip-icon': { color: 'inherit' },
              }}
            />
          ) : null}
        </Box>
        <CardContent
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            p: 2.5,
            pt: 2.25,
          }}
        >
          <Typography
            component="h3"
            className="font-display"
            sx={{
              fontWeight: 800,
              fontSize: '1.125rem',
              lineHeight: 1.35,
              letterSpacing: '-0.02em',
              color: 'text.primary',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              minHeight: '2.7rem',
            }}
          >
            {course.title}
          </Typography>
          <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1} sx={{ rowGap: 1 }}>
            <Chip
              icon={<Star size={14} style={{ color: 'inherit' }} aria-hidden />}
              label={
                course.review_avg != null
                  ? String(course.review_avg)
                  : course.rating != null
                    ? String(course.rating)
                    : '—'
              }
              size="small"
              variant="outlined"
              sx={{ borderColor: 'divider', '& .MuiChip-icon': { color: 'warning.main' } }}
            />
            <Chip
              icon={<Users size={14} aria-hidden />}
              label={
                course.enrollment_count != null && course.enrollment_count > 0
                  ? String(course.enrollment_count)
                  : course.learners_count || '—'
              }
              size="small"
              variant="outlined"
              sx={{ borderColor: 'divider' }}
            />
            <Chip
              icon={<Gauge size={14} aria-hidden />}
              label={course.level || COMMON.ALL_LEVELS}
              size="small"
              variant="outlined"
              sx={{ borderColor: 'divider' }}
            />
            <Chip
              size="small"
              variant="outlined"
              label={priceChipLabel}
              sx={{ borderColor: 'divider', fontWeight: 700 }}
            />
          </Stack>
          <Box
            sx={{
              mt: 'auto',
              pt: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              borderTop: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Clock size={16} aria-hidden />
              {course.duration_hours != null ? `${course.duration_hours} ${COMMON.HOURS}` : '—'}
            </Typography>
            <Typography variant="body2" color="primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.25, fontWeight: 800 }}>
              {COURSES_PAGE.OPEN_COURSE}
              <ChevronRight size={18} aria-hidden />
            </Typography>
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
