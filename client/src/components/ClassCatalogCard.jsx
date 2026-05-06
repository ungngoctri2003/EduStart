import { createElement } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, Calendar, ChevronRight, Clock, GraduationCap, Users } from 'lucide-react';
import { Box, Card, CardActionArea, CardContent, CardMedia, Chip, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { classCoverUrl } from '../lib/classCoverUrl';
import { CATALOG_BADGES, CLASSES_PAGE, COMMON } from '../strings/vi';
import { formatVndFromPriceCentsOrFree } from '../utils/money.js';

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('vi-VN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

function MetaRow({ icon, label, children }) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="flex-start" sx={{ minWidth: 0 }}>
      <Box
        aria-hidden
        sx={{
          mt: 0.125,
          display: 'flex',
          color: 'text.secondary',
          opacity: 0.85,
          flexShrink: 0,
        }}
      >
        {createElement(icon, { size: 17, strokeWidth: 2 })}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2, mb: 0.125 }}>
          {label}
        </Typography>
        <Typography variant="body2" color="text.primary" sx={{ fontWeight: 600, lineHeight: 1.35 }}>
          {children}
        </Typography>
      </Box>
    </Stack>
  );
}

/**
 * @param {{ klass: object & { course_slug?: string }, courseSlug?: string, paymentStatus?: string | null }} props
 */
export function ClassCatalogCard({ klass, courseSlug: courseSlugProp, paymentStatus = null }) {
  const theme = useTheme();
  const courseSlug = courseSlugProp ?? klass.course_slug;
  const teacher = klass.teacher_name;
  const n = klass.student_count;
  const showApproved = paymentStatus === 'approved';
  const showPending = paymentStatus === 'pending';
  const fee = formatVndFromPriceCentsOrFree(klass.price_cents, COMMON.FREE);
  const desc = (() => {
    if (!klass.description) return null;
    const t = String(klass.description).replace(/\s+/g, ' ').trim();
    if (!t) return null;
    return t.length > 120 ? `${t.slice(0, 120)}…` : t;
  })();

  return (
    <Card
      elevation={0}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        bgcolor: 'background.paper',
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: theme.palette.mode === 'dark' ? 'none' : `0 1px 3px ${alpha(theme.palette.common.black, 0.06)}`,
        transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: `0 16px 40px ${alpha(theme.palette.primary.main, 0.12)}`,
          borderColor: alpha(theme.palette.primary.main, 0.35),
        },
        '& .MuiCardActionArea-root:hover .class-card-media': {
          transform: 'scale(1.05)',
        },
      }}
    >
      <CardActionArea
        component={Link}
        to={
          courseSlug
            ? `/courses/${encodeURIComponent(courseSlug)}/classes/${encodeURIComponent(klass.slug)}`
            : '/courses'
        }
        aria-label={`${CLASSES_PAGE.VIEW_CLASS_ARIA}: ${klass.name}`}
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
            aspectRatio: '16 / 9',
            overflow: 'hidden',
            bgcolor: 'action.hover',
          }}
        >
          <CardMedia
            className="class-card-media"
            component="img"
            image={classCoverUrl(klass)}
            alt=""
            sx={{
              height: '100%',
              width: '100%',
              objectFit: 'cover',
              transition: 'transform 0.45s ease',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              background: (t) =>
                `linear-gradient(165deg, ${alpha(t.palette.common.black, 0.08)} 0%, transparent 42%, ${alpha(t.palette.common.black, t.palette.mode === 'dark' ? 0.62 : 0.52)} 100%)`,
              pointerEvents: 'none',
            }}
          />
          <Stack
            direction="row"
            spacing={1}
            sx={{ position: 'absolute', left: 12, top: 12, flexWrap: 'wrap', gap: 0.75 }}
            useFlexGap
          >
            <Chip
              label={CLASSES_PAGE.TITLE}
              size="small"
              sx={{
                bgcolor: alpha(theme.palette.background.paper, 0.94),
                color: 'primary.main',
                fontWeight: 800,
                fontSize: '0.6875rem',
                height: 26,
                border: '1px solid',
                borderColor: alpha(theme.palette.primary.main, 0.2),
              }}
            />
          </Stack>
          {showApproved ? (
            <Chip
              icon={<BadgeCheck size={14} aria-hidden />}
              label={CATALOG_BADGES.CLASS_JOINED}
              size="small"
              color="success"
              sx={{
                position: 'absolute',
                right: 12,
                top: 12,
                fontWeight: 800,
                fontSize: '0.6875rem',
                height: 28,
                boxShadow: `0 4px 14px ${alpha(theme.palette.common.black, 0.18)}`,
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
                fontSize: '0.6875rem',
                height: 28,
                boxShadow: `0 4px 14px ${alpha(theme.palette.common.black, 0.18)}`,
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
            gap: 0,
            p: 2.5,
            pt: 2,
            '&:last-child': { pb: 2.5 },
          }}
        >
          <Typography
            component="h3"
            className="font-display"
            sx={{
              fontWeight: 800,
              fontSize: '1.0625rem',
              lineHeight: 1.35,
              letterSpacing: '-0.02em',
              color: 'text.primary',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              minHeight: '2.86rem',
              mb: 1.5,
            }}
          >
            {klass.name}
          </Typography>

          <Stack
            direction="row"
            alignItems="baseline"
            justifyContent="space-between"
            flexWrap="wrap"
            useFlexGap
            spacing={1}
            sx={{ rowGap: 0.5, mb: 2 }}
          >
            <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {COMMON.FEE_LABEL}
            </Typography>
            <Typography variant="h6" component="span" color="primary" sx={{ fontWeight: 800, fontSize: '1.1rem', lineHeight: 1.2 }}>
              {fee}
            </Typography>
          </Stack>

          <Stack spacing={1.35} sx={{ mb: 0 }}>
            <MetaRow icon={Calendar} label={CLASSES_PAGE.META_STARTS}>
              {fmtDate(klass.starts_at)}
            </MetaRow>
            <MetaRow icon={GraduationCap} label={CLASSES_PAGE.META_TEACHER}>
              {teacher || '—'}
            </MetaRow>
            <MetaRow icon={Users} label={CLASSES_PAGE.META_STUDENTS}>
              {n != null && n > 0 ? `${n}` : '—'}
            </MetaRow>
          </Stack>

          {desc ? (
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.55, mt: 1.75, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {desc}
            </Typography>
          ) : null}

          <Box
            component="span"
            sx={{
              mt: 'auto',
              pt: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.5,
              py: 1.125,
              px: 1.5,
              borderRadius: 2,
              bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.12 : 0.08),
              color: 'primary.main',
              fontWeight: 800,
              fontSize: '0.8125rem',
            }}
          >
            {CLASSES_PAGE.OPEN_CLASS}
            <ChevronRight size={18} aria-hidden style={{ flexShrink: 0 }} />
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
