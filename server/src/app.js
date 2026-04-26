import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import publicRoutes from './routes/public.js';
import contactRoutes from './routes/contact.js';
import enrollRoutes from './routes/enrollments.js';
import learnRoutes from './routes/learn.js';
import adminRoutes from './routes/admin.js';
import teacherRoutes from './routes/teacher.js';
import classLearnRoutes from './routes/classLearn.js';
import classEnrollmentsRoutes from './routes/classEnrollments.js';
import meRoutes from './routes/me.js';

function resolveClientOrigin() {
  if (process.env.CLIENT_ORIGIN) return process.env.CLIENT_ORIGIN;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:5173';
}

const app = express();
const clientOrigin = resolveClientOrigin();

app.use(cors({ origin: clientOrigin, credentials: true }));
app.use(express.json());

app.use((req, res, next) => {
  const started = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - started;
    console.log(`[api] ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
  });
  next();
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api', publicRoutes);
app.use('/api/me', meRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/enrollments', enrollRoutes);
app.use('/api/learn', learnRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/class-learn', classLearnRoutes);
app.use('/api/class-enrollments', classEnrollmentsRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
