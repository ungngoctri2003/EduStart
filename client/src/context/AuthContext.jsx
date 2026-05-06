import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { AuthContext } from './auth-context';

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const profileRequestId = useRef(0);
  /** Canonical user id for the active session — updated synchronously on auth/session changes */
  const sessionUserIdRef = useRef(null);

  const loadProfile = useCallback(async (userId) => {
    const reqId = ++profileRequestId.current;
    if (!userId) {
      setProfile(null);
      setProfileLoading(false);
      return null;
    }
    setProfileLoading(true);
    const PROFILE_MS = 15000;
    try {
      const row = supabase.from('profiles').select('id, full_name, role').eq('id', userId).single();
      const { data, error } = await Promise.race([
        row,
        new Promise((resolve) =>
          setTimeout(() => resolve({ data: null, error: { message: 'Profile load timeout' } }), PROFILE_MS),
        ),
      ]);
      const reqStale = profileRequestId.current !== reqId;
      const userStale = sessionUserIdRef.current !== userId;
      if (reqStale || userStale) {
        return error ? null : data;
      }
      if (error) {
        console.warn('Profile load:', error.message || error);
        setProfile(null);
        return null;
      }
      setProfile(data);
      return data;
    } finally {
      if (profileRequestId.current === reqId) {
        setProfileLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      const uid = s?.user?.id ?? null;
      sessionUserIdRef.current = uid;
      setSession(s);
      setLoading(false);

      queueMicrotask(() => {
        if (cancelled) return;
        if (uid) {
          void loadProfile(uid);
        } else {
          profileRequestId.current += 1;
          setProfile(null);
          setProfileLoading(false);
        }
      });
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const value = useMemo(
    () => ({
      session,
      profile,
      loading,
      profileLoading,
      user: session?.user ?? null,
      async signIn(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Apply session immediately so navigate() after login sees a session (onAuthStateChange can lag one tick).
        const nextSession = data.session ?? null;
        const nextUid = data.user?.id ?? null;
        setSession(nextSession);
        sessionUserIdRef.current = nextUid;
        const profileRow = await loadProfile(nextUid);
        return { data, profile: profileRow };
      },
      async signUp(email, password, fullName) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName || '' } },
        });
        if (error) throw error;
        let profileRow = null;
        if (data.session) {
          const nextUid = data.user?.id ?? null;
          setSession(data.session);
          sessionUserIdRef.current = nextUid;
          profileRow = await loadProfile(nextUid);
        }
        return { data, profile: profileRow };
      },
      async signOut() {
        profileRequestId.current += 1;
        sessionUserIdRef.current = null;
        await supabase.auth.signOut();
        setSession(null);
        setProfile(null);
        setProfileLoading(false);
      },
    }),
    [session, profile, loading, profileLoading, loadProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
