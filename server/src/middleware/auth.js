import { createJwtValidationClient, supabaseAdmin } from '../supabase.js';

/**
 * Validates the access token against Supabase Auth (GET /auth/v1/user).
 * Prefer this over local jwt.verify + SUPABASE_JWT_SECRET so it stays correct when
 * the project uses asymmetric JWT signing keys or the JWT secret was mis-copied.
 */
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = header.slice(7);
  const jwtClient = createJwtValidationClient();
  const { data: authData, error: authError } = await jwtClient.auth.getUser(token);
  if (authError || !authData?.user?.id) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  const userId = authData.user.id;
  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', userId)
    .single();

  if (error || !profile) {
    return res.status(403).json({ error: 'Profile not found' });
  }
  req.user = { id: userId, email: authData.user.email ?? null, ...profile };
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

/** Optional: attach user if Bearer present, else continue */
export async function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next();
  }
  const token = header.slice(7);
  try {
    const jwtClient = createJwtValidationClient();
    const { data: authData } = await jwtClient.auth.getUser(token);
    const userId = authData?.user?.id;
    if (!userId) return next();
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', userId)
      .single();
    if (profile) {
      req.user = { id: userId, email: authData.user.email ?? null, ...profile };
    }
  } catch {
    /* ignore */
  }
  next();
}
