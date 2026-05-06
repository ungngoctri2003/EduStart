import { useEffect, useState } from 'react';
import { useAuth } from '../context/useAuth';
import { apiFetch } from '../lib/api';

/**
 * Catalog: course id / class id → payment_status for the current student.
 * Course map merges direct enrollments and class memberships on the same course_id (pending wins, then approved).
 * @returns {{ coursePaymentById: Map<string, string>, classPaymentById: Map<string, string>, classCertificateEligibleById: Map<string, boolean> }}
 */
export function useStudentCatalogAccess() {
  const { session, profile } = useAuth();
  const [coursePaymentById, setCoursePaymentById] = useState(() => new Map());
  const [classPaymentById, setClassPaymentById] = useState(() => new Map());
  const [classCertificateEligibleById, setClassCertificateEligibleById] = useState(() => new Map());

  useEffect(() => {
    if (!session?.access_token || profile?.role !== 'student') {
      queueMicrotask(() => {
        setCoursePaymentById(new Map());
        setClassPaymentById(new Map());
        setClassCertificateEligibleById(new Map());
      });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [enr, cls] = await Promise.all([
          apiFetch('/api/enrollments/me', {}, session.access_token),
          apiFetch('/api/class-learn/me', {}, session.access_token),
        ]);
        const byCourse = new Map();
        const add = (courseId, status) => {
          if (!courseId) return;
          const list = byCourse.get(courseId) || [];
          list.push(status ?? 'approved');
          byCourse.set(courseId, list);
        };
        for (const row of enr || []) {
          add(row.course_id || row.courses?.id, row.payment_status);
        }
        for (const row of cls || []) {
          add(row.class?.course?.id, row.payment_status);
        }
        const cMap = new Map();
        for (const [cid, arr] of byCourse) {
          if (arr.some((s) => s === 'pending')) cMap.set(cid, 'pending');
          else if (arr.some((s) => s === 'approved' || s == null)) cMap.set(cid, 'approved');
          else if (arr.some((s) => s === 'rejected')) cMap.set(cid, 'rejected');
          else cMap.set(cid, 'approved');
        }
        const kMap = new Map();
        const certMap = new Map();
        for (const row of cls || []) {
          const id = row.class?.id;
          if (!id) continue;
          kMap.set(id, row.payment_status ?? 'approved');
          certMap.set(id, Boolean(row.certificate_eligible));
        }
        if (!cancelled) {
          setCoursePaymentById(cMap);
          setClassPaymentById(kMap);
          setClassCertificateEligibleById(certMap);
        }
      } catch {
        if (!cancelled) {
          setCoursePaymentById(new Map());
          setClassPaymentById(new Map());
          setClassCertificateEligibleById(new Map());
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.access_token, profile?.role]);

  return { coursePaymentById, classPaymentById, classCertificateEligibleById };
}
