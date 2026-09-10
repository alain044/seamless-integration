-- The hourly integrity sweep was scheduled in 20260606213011 with the project's
-- publishable (anon) key inlined in the job definition. That value is not a
-- secret — it is the same key the client bundle ships to every browser — but
-- writing it into a migration froze it into schema history, so it can no longer
-- be rotated without another migration. This supersedes the job to read the
-- credential from Vault instead.
--
-- Provision the secret once, out of band (Cloud → Project Settings → Vault, or
-- in the SQL editor):
--
--   SELECT vault.create_secret('<SERVICE_ROLE_KEY>', 'integrity_cron_key',
--     'Sent by the hourly integrity-check cron sweep');
--
-- Use the service_role key, not the publishable key: the publishable key is
-- public, so it would not stop an unauthenticated caller from invoking the
-- endpoint. If you also flip integrity-check-cron to verify_jwt = true in
-- supabase/config.toml, this is the key that satisfies it.
--
-- Applied as a new migration rather than by editing 20260606213011: that one has
-- already run against the project, so changing the file would leave the
-- repository disagreeing with what the database actually executed.
--
-- Note this cannot break the job as currently configured: integrity-check-cron
-- is declared verify_jwt = false, so it does not check the key at all today. If
-- the secret is absent the header is simply null and the sweep still runs.

-- Rescheduling is idempotent: cron.unschedule(name) raises when the job is
-- absent, so look the id up first. Safe to re-run.
DO $$
DECLARE
  job_id bigint;
BEGIN
  SELECT jobid INTO job_id FROM cron.job WHERE jobname = 'integrity-check-hourly';
  IF job_id IS NOT NULL THEN
    PERFORM cron.unschedule(job_id);
  END IF;
END
$$;

SELECT cron.schedule(
  'integrity-check-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://svixhxkbroelwmpxynjy.supabase.co/functions/v1/integrity-check-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'integrity_cron_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
