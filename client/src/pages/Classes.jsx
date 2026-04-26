import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Alert } from '@mui/material';
import { ClassCatalogCard } from '../components/ClassCatalogCard';
import { PageHeader } from '../components/PageHeader';
import { StaggerContainer, StaggerItem } from '../motion/ScrollBlock';
import { apiFetch } from '../lib/api';
import { CLASSES_PAGE, ERR } from '../strings/vi';

export function Classes() {
  const reduce = useReducedMotion() ?? false;
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch('/api/classes');
        if (!cancelled) setRows(data || []);
      } catch (e) {
        if (!cancelled) setErr(e.message || ERR.LOAD);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <PageHeader title={CLASSES_PAGE.TITLE} crumbs={[{ label: CLASSES_PAGE.CRUMB, active: true }]} />
      <div className="container mx-auto max-w-6xl px-4 py-12">
        <StaggerContainer reduced={reduce} className="text-center">
          <StaggerItem reduced={reduce}>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">{CLASSES_PAGE.TITLE}</p>
            <h2 className="font-display mt-2 text-3xl font-bold md:text-4xl">{CLASSES_PAGE.ALL}</h2>
            <p className="mx-auto mt-3 max-w-2xl text-base-content/80">{CLASSES_PAGE.SUB}</p>
          </StaggerItem>
        </StaggerContainer>
        {err ? (
          <Alert severity="error" sx={{ mt: 4 }}>
            {err}
          </Alert>
        ) : null}
        <StaggerContainer reduced={reduce} className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((k) => (
            <StaggerItem reduced={reduce} key={k.id}>
              <ClassCatalogCard klass={k} />
            </StaggerItem>
          ))}
        </StaggerContainer>
        {!err && rows.length === 0 ? (
          <p className="mt-8 text-center text-base-content/60">{CLASSES_PAGE.EMPTY}</p>
        ) : null}
      </div>
    </>
  );
}
