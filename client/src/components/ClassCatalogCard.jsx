import { Link } from 'react-router-dom';
import { Calendar, ChevronRight, GraduationCap, Users } from 'lucide-react';
import { Box, Card, CardActionArea, CardContent, CardMedia, Chip, Stack, Typography } from '@mui/material';
import { CLASSES_PAGE } from '../strings/vi';

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('vi-VN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

export function ClassCatalogCard({ klass }) {
  const teacher = klass.teacher_name;
  const n = klass.student_count;

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
        '& .MuiCardActionArea-root:hover .class-card-media': {
          transform: 'scale(1.04)',
        },
      }}
    >
      <CardActionArea
        component={Link}
        to={`/classes/${klass.slug}`}
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
            aspectRatio: '16 / 10',
            overflow: 'hidden',
            bgcolor: 'action.hover',
          }}
        >
          <CardMedia
            className="class-card-media"
            component="img"
            image="/img/banner-3.jpg"
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
              background: 'linear-gradient(180deg, transparent 40%, rgba(28,36,51,0.6) 100%)',
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
                bgcolor: 'rgba(255,255,255,0.92)',
                color: 'primary.main',
                fontWeight: 700,
                fontSize: '0.7rem',
                height: 26,
              }}
            />
          </Stack>
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
            {klass.name}
          </Typography>
          <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1} sx={{ rowGap: 1 }}>
            {teacher ? (
              <Chip
                icon={<GraduationCap size={14} aria-hidden />}
                label={teacher}
                size="small"
                variant="outlined"
                sx={{ borderColor: 'divider', maxWidth: '100%', '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }}
              />
            ) : null}
            <Chip
              icon={<Users size={14} aria-hidden />}
              label={n != null && n > 0 ? String(n) : '—'}
              size="small"
              variant="outlined"
              sx={{ borderColor: 'divider' }}
            />
            <Chip
              icon={<Calendar size={14} aria-hidden />}
              label={fmtDate(klass.starts_at)}
              size="small"
              variant="outlined"
              sx={{ borderColor: 'divider' }}
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
            <Typography variant="body2" color="text.secondary" sx={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {(() => {
                if (!klass.description) return '—';
                const t = String(klass.description).replace(/\s+/g, ' ').trim();
                return t.length > 72 ? `${t.slice(0, 72)}…` : t;
              })()}
            </Typography>
            <Typography
              variant="body2"
              color="primary"
              sx={{ display: 'flex', alignItems: 'center', gap: 0.25, fontWeight: 800, flexShrink: 0 }}
            >
              {CLASSES_PAGE.OPEN_CLASS}
              <ChevronRight size={18} aria-hidden />
            </Typography>
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
