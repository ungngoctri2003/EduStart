import { useEffect, useState } from 'react';
import { Alert, Box } from '@mui/material';
import { PageHeader } from '../components/PageHeader';
import { TeamMemberGrid } from '../components/TeamMemberGrid';
import { apiFetch } from '../lib/api';
import { TEAM_PAGE } from '../strings/vi';
import { ERR } from '../strings/vi';

export function Team() {
  const [members, setMembers] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch('/api/team');
        if (!cancelled) setMembers(data || []);
      } catch (e) {
        if (!cancelled) setErr(e.message || ERR.LOAD_TEAM);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <PageHeader title={TEAM_PAGE.TITLE} crumbs={[{ label: TEAM_PAGE.CRUMB, active: true }]} />
      <div className="container mx-auto max-w-6xl px-4 py-12">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">{TEAM_PAGE.KICKER}</p>
          <h2 className="font-display mt-2 text-3xl font-bold md:text-4xl">{TEAM_PAGE.H2}</h2>
        </div>
        {err ? (
          <Alert severity="error" sx={{ mt: 4 }}>
            {err}
          </Alert>
        ) : null}
        <TeamMemberGrid members={members} />
        {!err && members.length === 0 ? (
          <p className="mt-8 text-center text-base-content/60">{TEAM_PAGE.EMPTY}</p>
        ) : null}
      </div>
    </>
  );
}
