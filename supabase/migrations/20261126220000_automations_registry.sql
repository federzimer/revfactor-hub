-- Automation registry (ontology object 9): one row per scheduled or
-- event-driven job on any runner, so the team can see in one place what runs,
-- who owns it, what it changes and whether its last run worked.
--
-- n8n rows are kept current by lib/automations/sync.server.ts (n8n public API),
-- called from /api/cron/sync-automations and the "Sync now" button. Rows for
-- other runners (Vercel crons, GHL workflows, Grokbot routines, Claude tasks,
-- Railway jobs) are entered by hand until those runners report in.
--
-- Rule ("no log, no send"): an automation that sends a message or changes
-- client data must write a Hub record of what it did. `logs_to_hub` tracks
-- whether it does; the page flags rows that change data without logging.

CREATE TABLE public.automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  runner text NOT NULL CHECK (runner IN (
    'n8n', 'vercel_cron', 'hub_webhook', 'ghl', 'grokbot', 'claude_task', 'railway', 'other'
  )),
  external_id text,
  url text,
  schedule text,
  owner text,
  output text,
  changes_data boolean NOT NULL DEFAULT false,
  logs_to_hub boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  last_result text CHECK (last_result IN (
    'success', 'error', 'running', 'waiting', 'canceled', 'unknown'
  )),
  last_error text,
  last_synced_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT automations_runner_external_id_key UNIQUE (runner, external_id)
);

COMMENT ON TABLE public.automations IS
  'Automation registry: every job on every runner with owner, output and last run result.';

CREATE TRIGGER automations_set_updated_at
  BEFORE UPDATE ON public.automations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY automations_select ON public.automations
  FOR SELECT TO authenticated
  USING (public.has_permission('automations', 'view'));

CREATE POLICY automations_insert ON public.automations
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('automations', 'create'));

CREATE POLICY automations_update ON public.automations
  FOR UPDATE TO authenticated
  USING (public.has_permission('automations', 'edit'))
  WITH CHECK (public.has_permission('automations', 'edit'));

CREATE POLICY automations_delete ON public.automations
  FOR DELETE TO authenticated
  USING (public.has_permission('automations', 'delete'));

-- Permissions: super_admin passes has_permission() already. admin can view,
-- create and edit (delete stays off, tunable in Settings -> Roles). External
-- roles get an explicit deny so the grid is deterministic.
INSERT INTO role_permissions (role_name, resource, action, allowed)
SELECT r.name, 'automations', a.action,
  CASE
    WHEN r.name = 'super_admin' THEN TRUE
    WHEN r.name = 'admin' AND a.action IN ('view', 'create', 'edit') THEN TRUE
    ELSE FALSE
  END
FROM roles r
CROSS JOIN (VALUES ('view'), ('create'), ('edit'), ('delete'), ('publish'), ('control')) AS a(action)
ON CONFLICT (role_name, resource, action) DO UPDATE SET allowed = EXCLUDED.allowed;

-- Seed the Hub's own scheduled jobs (vercel.json).
INSERT INTO public.automations
  (name, runner, external_id, schedule, owner, output, changes_data, logs_to_hub, notes)
VALUES
  ('PriceLabs sync', 'vercel_cron', '/api/cron/sync-pricelabs', 'Daily 08:00 UTC', 'Gaston',
   'Refreshes listing data from PriceLabs into the Hub', false, false,
   'Reads only; writes Hub cache tables.'),
  ('Stripe sync + Market Signals drain', 'vercel_cron', '/api/cron/sync-stripe', 'Daily 08:30 UTC', 'Gaston',
   'Refreshes subscriptions, invoices and payouts; drains up to 5 Market Signals jobs', false, false,
   'Reads only; writes Hub cache tables.')
ON CONFLICT (runner, external_id) DO NOTHING;
