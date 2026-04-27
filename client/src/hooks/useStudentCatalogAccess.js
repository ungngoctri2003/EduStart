import { useEffect, useState } from 'react';
import { useAuth } from '../context/useAuth';
import { apiFetch } from '../lib/api';

/**
 * For catalog pages: map course id / class id → payment_status for the current user (students only).
 * @returns {{ coursePaymentById: Map<string, string>, classPaymentById: Map<string, string> }}
 */
export function useStudentCatalogAccess() {
  const { session, profile } = useAuth();
  const [coursePaymentById, setCoursePaymentById] = useState(() => new Map());
  const [classPaymentById, setClassPaymentById] = useState(() => new Map());

  useEffect(() => {
    if (!session?.access_token || profile?.role !== 'student') {
      setCoursePaymentById(new Map());
      setClassPaymentById(new Map());
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [enr, cls] = await Promise.all([
          apiFetch('/api/enrollments/me', {}, session.access_token),
          apiFetch('/api/class-learn/me', {}, session.access_token),
        ]);
        const cMap = new Map();
        for (const row of enr || []) {
          const id = row.course_id || row.courses?.id;
          if (!id) continue;
          cMap.set(id, row.payment_status ?? 'approved');
        }
        const kMap = new Map();
        for (const row of cls || []) {
          const id = row.class?.id;
          if (!id) continue;
          kMap.set(id, row.payment_status ?? 'approved');
        }
        if (!cancelled) {
          setCoursePaymentById(cMap);
          setClassPaymentById(kMap);
        }
      } catch {
        if (!cancelled) {
          setCoursePaymentById(new Map());
          setClassPaymentById(new Map());
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.access_token, profile?.role]);

  return { coursePaymentById, classPaymentById };
}
