import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { Analytics } from '@vercel/analytics/react';
import { Toaster } from 'sonner';
import { AuthProvider } from './context/AuthContext';
import { appTheme } from './theme';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RoleRoute } from './components/RoleRoute';
import { Home } from './pages/Home';
import { About } from './pages/About';
import { Courses } from './pages/Courses';
import { CourseDetail } from './pages/CourseDetail';
import { LectureDetail } from './pages/LectureDetail';
import { QuizDetail } from './pages/QuizDetail';
import { Contact } from './pages/Contact';
import { Team } from './pages/Team';
import { Testimonials } from './pages/Testimonials';
import { Instructor } from './pages/Instructor';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { DashboardRedirect } from './pages/DashboardRedirect';
import { DashboardStudent } from './pages/DashboardStudent';
import { DashboardAdmin } from './pages/DashboardAdmin';

export default function App() {
  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <Toaster position="top-center" theme="light" richColors closeButton />
      <Analytics />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="about" element={<About />} />
            <Route path="courses" element={<Courses />} />
            <Route path="courses/:slug/lecture/:lectureId" element={<LectureDetail />} />
            <Route path="courses/:slug/quiz/:quizId" element={<QuizDetail />} />
            <Route path="courses/:slug" element={<CourseDetail />} />
            <Route path="contact" element={<Contact />} />
            <Route path="team" element={<Team />} />
            <Route path="testimonials" element={<Testimonials />} />
            <Route path="instructor" element={<Instructor />} />
            <Route path="login" element={<Login />} />
            <Route path="signup" element={<Signup />} />
            <Route
              path="dashboard"
              element={
                <ProtectedRoute>
                  <DashboardRedirect />
                </ProtectedRoute>
              }
            />
            <Route
              path="dashboard/student"
              element={
                <RoleRoute roles={['student']}>
                  <DashboardStudent />
                </RoleRoute>
              }
            />
            <Route
              path="dashboard/admin"
              element={
                <RoleRoute roles={['admin']}>
                  <DashboardAdmin />
                </RoleRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
