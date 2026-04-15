import { Link } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  ArrowRight,
  Award,
  Eye,
  Globe2,
  GraduationCap,
  Lightbulb,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { ABOUT } from '../strings/vi';
import { NAV } from '../strings/vi';

const pillarItems = [
  { title: ABOUT.VISION, body: ABOUT.P_VISION, Icon: Eye },
  { title: ABOUT.EXCELLENCE, body: ABOUT.P_EXCELLENCE, Icon: Award },
  { title: ABOUT.EMPOWER, body: ABOUT.P_EMPOWER, Icon: GraduationCap },
  { title: ABOUT.INNOVATION, body: ABOUT.P_INNOVATION, Icon: Lightbulb },
  { title: ABOUT.COMMUNITY, body: ABOUT.P_COMMUNITY, Icon: Users },
  { title: ABOUT.DIVERSE, body: ABOUT.P_DIVERSE, Icon: Globe2 },
  { title: ABOUT.IMPROVE, body: ABOUT.P_IMPROVE, Icon: TrendingUp },
];

export function About() {
  return (
    <>
      <PageHeader title={ABOUT.TITLE} crumbs={[{ label: ABOUT.CRUMB, active: true }]} />

      <Box component="section" sx={{ bgcolor: 'background.default', py: { xs: 4, md: 6 } }}>
        <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 } }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={{ xs: 4, md: 6 }}
            alignItems="center"
          >
            <Box
              sx={{
                position: 'relative',
                width: 1,
                maxWidth: { md: '52%' },
                borderRadius: 3,
                overflow: 'hidden',
                aspectRatio: '4 / 3',
                boxShadow: (t) => t.shadows[4],
                border: 1,
                borderColor: 'divider',
              }}
            >
              <Box
                component="img"
                src="/img/about.jpg"
                alt=""
                sx={{ width: 1, height: 1, objectFit: 'cover', display: 'block' }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  background: (t) =>
                    `linear-gradient(180deg, transparent 55%, ${alpha(t.palette.secondary.main, 0.45)} 100%)`,
                  pointerEvents: 'none',
                }}
              />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <Sparkles size={18} strokeWidth={2} aria-hidden style={{ color: 'var(--mui-palette-primary-main)' }} />
                <Typography
                  variant="overline"
                  sx={{ fontWeight: 800, letterSpacing: '0.14em', color: 'primary.main', lineHeight: 1.5 }}
                >
                  {ABOUT.KICKER}
                </Typography>
              </Stack>
              <Typography
                component="h2"
                className="font-display"
                sx={{
                  fontWeight: 800,
                  letterSpacing: '-0.03em',
                  lineHeight: 1.15,
                  fontSize: { xs: '1.75rem', sm: '2.125rem', md: '2.375rem' },
                  color: 'text.primary',
                }}
              >
                {ABOUT.H2}
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mt: 2.5, lineHeight: 1.75, fontSize: '1.02rem' }}>
                {ABOUT.P1}
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mt: 2, lineHeight: 1.75 }}>
                {ABOUT.P2}
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 3 }}>
                <Button component={Link} to="/courses" variant="contained" color="primary" size="large" endIcon={<ArrowRight size={18} />}>
                  {NAV.COURSES}
                </Button>
                <Button component={Link} to="/contact" variant="outlined" color="primary" size="large">
                  {NAV.CONTACT}
                </Button>
              </Stack>
            </Box>
          </Stack>
        </Container>
      </Box>

      <Box component="section" sx={{ py: { xs: 5, md: 7 }, bgcolor: 'background.paper' }}>
        <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 } }}>
          <Typography
            component="h2"
            variant="h5"
            className="font-display"
            sx={{ fontWeight: 800, textAlign: 'center', letterSpacing: '-0.02em', mb: 1 }}
          >
            {ABOUT.VALUES_TITLE}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', maxWidth: 560, mx: 'auto', mb: 4 }}>
            {ABOUT.VALUES_LEAD}
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
              gap: 2.5,
            }}
          >
            {pillarItems.map((row) => {
              const PillarIcon = row.Icon;
              return (
                <Card
                  key={row.title}
                  elevation={0}
                  sx={{
                    height: '100%',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: (t) => t.shadows[3],
                      borderColor: 'primary.main',
                    },
                  }}
                >
                  <CardContent sx={{ p: 2.75 }}>
                    <Box
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 48,
                        height: 48,
                        borderRadius: 2,
                        mb: 2,
                        bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
                        color: 'primary.main',
                      }}
                    >
                      <PillarIcon size={22} strokeWidth={2} aria-hidden />
                    </Box>
                    <Typography component="h3" className="font-display" variant="subtitle1" sx={{ fontWeight: 800, mb: 1, lineHeight: 1.35 }}>
                      {row.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65 }}>
                      {row.body}
                    </Typography>
                  </CardContent>
                </Card>
              );
            })}
          </Box>
        </Container>
      </Box>

      <Box component="section" sx={{ py: { xs: 5, md: 6 }, bgcolor: 'background.default' }}>
        <Container maxWidth="md" sx={{ px: { xs: 2, sm: 3 } }}>
          <Card
            elevation={0}
            sx={{
              overflow: 'hidden',
              borderRadius: 3,
              background: (t) =>
                `linear-gradient(135deg, ${alpha(t.palette.primary.main, 0.12)} 0%, ${alpha(t.palette.secondary.main, 0.08)} 45%, ${t.palette.background.paper} 100%)`,
              border: 1,
              borderColor: 'divider',
            }}
          >
            <CardContent sx={{ p: { xs: 3, sm: 4, md: 5 }, textAlign: 'center' }}>
              <Typography variant="h6" className="font-display" sx={{ fontWeight: 800, letterSpacing: '-0.02em', mb: 2 }}>
                {ABOUT.CLOSING}
              </Typography>
              <Button component={Link} to="/signup" variant="contained" color="primary" size="large" sx={{ mt: 1 }}>
                {ABOUT.CTA_JOIN}
              </Button>
            </CardContent>
          </Card>
        </Container>
      </Box>
    </>
  );
}
