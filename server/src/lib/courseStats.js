import { supabaseAdmin } from '../supabase.js';

/**
 * @param {string[]} courseIds
 * @returns {Promise<Map<string, { review_avg: number | null, review_count: number, enrollment_count: number }>>}
 */
export async function fetchCourseStatsMap(courseIds) {
  const ids = [...new Set(courseIds.filter(Boolean))];
  if (ids.length === 0) return new Map();
  const { data, error } = await supabaseAdmin
    .from('course_public_stats')
    .select('course_id, review_avg, review_count, enrollment_count')
    .in('course_id', ids);
  if (error) throw new Error(error.message);
  return new Map(
    (data || []).map((r) => [
      r.course_id,
      {
        review_avg: r.review_avg != null ? Number(r.review_avg) : null,
        review_count: r.review_count ?? 0,
        enrollment_count: r.enrollment_count ?? 0,
      },
    ]),
  );
}

/**
 * @param {object} course
 * @param {Map<string, object>} statsMap
 * @returns {object}
 */
export function mergeCourseStats(course, statsMap) {
  if (!course?.id) return course;
  const s = statsMap.get(course.id);
  if (!s) {
    return {
      ...course,
      review_avg: null,
      review_count: 0,
      enrollment_count: 0,
    };
  }
  return {
    ...course,
    review_avg: s.review_avg,
    review_count: s.review_count,
    enrollment_count: s.enrollment_count,
  };
}
