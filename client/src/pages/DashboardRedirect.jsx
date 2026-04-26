import { Navigate } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, Stack } from '@mui/material';
import { useAuth } from '../context/useAuth';
import { NAV } from '../strings/vi';
import { ROLE } from '../strings/vi';

export function DashboardRedirect() {
  const { profile, loading, profileLoading, signOut } = useAuth();
  if (loading || profileLoading) {
    return (
      <Box className="flex min-h-[40vh] items-center justify-center">
        <CircularProgress color="primary" />
      </Box>
    );
  }
  if (!profile) {
    return (
      <Box className="container mx-auto max-w-2xl px-4 py-10">
        <Stack spacing={2}>
          <Alert severity="warning">{ROLE.NO_PROFILE}</Alert>
          <Button variant="outlined" color="primary" onClick={() => void signOut()}>
            {NAV.SIGN_OUT}
          </Button>
        </Stack>
      </Box>
    );
  }
  if (profile.role === 'admin') return <Navigate to="/dashboard/admin" replace />;
  if (profile.role === 'teacher') return <Navigate to="/dashboard/teacher" replace />;
  return <Navigate to="/dashboard/student" replace />;
}
