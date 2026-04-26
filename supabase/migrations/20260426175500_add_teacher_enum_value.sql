-- Must run alone and commit before any migration that references the new enum label
-- (Postgres 55P04: new enum values cannot be used in the same transaction as ADD VALUE).
ALTER TYPE public.user_role ADD VALUE 'teacher';
