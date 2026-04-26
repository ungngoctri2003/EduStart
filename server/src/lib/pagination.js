/**
 * @param {import('express').Request} req
 * @param {{ defaultPageSize?: number, maxPageSize?: number }} [opts]
 * @returns {{ page: number, pageSize: number, from: number, to: number }}
 */
export function parsePaginationQuery(req, { defaultPageSize = 10, maxPageSize = 100 } = {}) {
  const page = Math.max(1, parseInt(String(req.query?.page ?? '1'), 10) || 1);
  const raw = parseInt(String(req.query?.pageSize ?? String(defaultPageSize)), 10);
  const pageSize = Math.min(
    maxPageSize,
    Math.max(1, Number.isFinite(raw) && raw > 0 ? raw : defaultPageSize),
  );
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  return { page, pageSize, from, to };
}
