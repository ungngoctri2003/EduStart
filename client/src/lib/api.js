/** Same-origin on Vercel: leave VITE_API_URL unset in production build. */
const base =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:4000' : '');

export async function apiFetch(path, options = {}, accessToken = null) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  const res = await fetch(`${base}${path}`, { ...options, headers });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const err = new Error(data?.error || res.statusText || 'Request failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

/** Download binary (e.g. PDF). Uses same base URL and auth as apiFetch. */
export async function apiFetchBinary(path, { accessToken, filename } = {}) {
  const base =
    import.meta.env.VITE_API_URL ||
    (import.meta.env.DEV ? 'http://localhost:4000' : '');
  const headers = {};
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  const res = await fetch(`${base}${path}`, { headers });
  if (!res.ok) {
    let message = res.statusText || 'Request failed';
    try {
      const text = await res.text();
      const j = text ? JSON.parse(text) : null;
      if (j?.error) message = j.error;
    } catch {
      /* ignore */
    }
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'download.pdf';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
