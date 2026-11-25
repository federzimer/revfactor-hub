-- ============================================================
-- 092: SOP section in the Knowledge base
--
-- One SOP standard for people (video + checklist) and agents (trigger, inputs,
-- steps, proof, guardrails). An SOP is still a knowledge_articles row with
-- article_type = 'sop'; this migration adds:
--   1. knowledge_sops            — the structured SOP card (1:1 with the article)
--   2. knowledge_article_versions — an immutable snapshot each time an article
--                                   is published, so "which version did the AM
--                                   follow on Tuesday" has an answer
--   3. account_manager role       — reads and drafts Knowledge, cannot publish
--   4. the SOP groups as categories (inventory of 25 Nov 2026)
--
-- RLS follows migration 038: permission-based, never USING (true).
-- ============================================================

-- ------------------------------------------------------------
-- 1. knowledge_sops
-- ------------------------------------------------------------
CREATE TABLE public.knowledge_sops (
  article_id UUID PRIMARY KEY
    REFERENCES public.knowledge_articles(id) ON DELETE CASCADE,
  -- Short stable id agents and people cite, e.g. "RM-01", "INB-02".
  sop_code TEXT UNIQUE
    CHECK (sop_code IS NULL OR sop_code ~ '^[A-Z]{2,5}-[0-9]{2,3}$'),
  -- When this SOP starts. One sentence, event-shaped.
  trigger_text TEXT,
  -- Who does the work, and who covers when they are out.
  runs_role TEXT NOT NULL DEFAULT 'am'
    CHECK (runs_role IN ('am', 'pricing_team', 'founders', 'sales', 'agent')),
  backup_role TEXT
    CHECK (backup_role IS NULL OR backup_role IN ('am', 'pricing_team', 'founders', 'sales', 'agent')),
  -- Who keeps the SOP current (approves edits). Free text: "Fede", "Fede, Gaston".
  owner_label TEXT,
  -- Highest change class the SOP can produce (pricing playbook classes).
  --   none = no price/floor/min-stay/discount/markup change
  --   A    = inside the listing's band; AM approves (after day 90)
  --   B    = at the band edge or strategic; weekly pricing review
  --   C    = outside the band; Fede or Gaston approves
  approval_class TEXT NOT NULL DEFAULT 'none'
    CHECK (approval_class IN ('none', 'A', 'B', 'C')),
  -- The Hub record the SOP creates or updates (adjustment, commitment, ticket…).
  hub_record TEXT,
  -- What has to be seen live to call it done (PriceLabs, Airbnb, PMS, portal).
  proof TEXT,
  -- What the agent may do with this SOP.
  --   human_only   = agents may read it for context only
  --   agent_assist = agents may draft and prepare; a person acts
  --   agent_runs   = agents may run the steps marked agent inside the guardrails
  agent_mode TEXT NOT NULL DEFAULT 'human_only'
    CHECK (agent_mode IN ('human_only', 'agent_assist', 'agent_runs')),
  -- Ordered lists, one string per item. Steps use "Actor: action -> check".
  inputs JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(inputs) = 'array'),
  steps JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(steps) = 'array'),
  guardrails JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(guardrails) = 'array'),
  escalate_when TEXT,
  -- The human walkthrough (YouTube unlisted, Loom, Vimeo or an MP4 URL).
  video_url TEXT
    CHECK (video_url IS NULL OR video_url ~ '^https://'),
  video_duration_sec INTEGER
    CHECK (video_duration_sec IS NULL OR video_duration_sec BETWEEN 1 AND 3600),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.knowledge_sops IS
  'Structured SOP card for knowledge_articles with article_type = sop. See docs/agent/sop-standard.md.';

CREATE INDEX idx_knowledge_sops_runs_role ON public.knowledge_sops(runs_role);

ALTER TABLE public.knowledge_sops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authorized users can view knowledge_sops"
  ON public.knowledge_sops FOR SELECT TO authenticated
  USING (public.has_permission('knowledge', 'view'));
CREATE POLICY "Authorized users can insert knowledge_sops"
  ON public.knowledge_sops FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('knowledge', 'create'));
CREATE POLICY "Authorized users can update knowledge_sops"
  ON public.knowledge_sops FOR UPDATE TO authenticated
  USING (public.has_permission('knowledge', 'edit'))
  WITH CHECK (public.has_permission('knowledge', 'edit'));
CREATE POLICY "Authorized users can delete knowledge_sops"
  ON public.knowledge_sops FOR DELETE TO authenticated
  USING (public.has_permission('knowledge', 'delete'));

-- ------------------------------------------------------------
-- 2. knowledge_article_versions (append-only)
-- ------------------------------------------------------------
CREATE TABLE public.knowledge_article_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL
    REFERENCES public.knowledge_articles(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version > 0),
  title TEXT NOT NULL,
  content_html TEXT,
  -- Snapshot of the knowledge_sops row at publish time (NULL for non-SOPs).
  sop JSONB,
  change_note TEXT CHECK (change_note IS NULL OR CHAR_LENGTH(change_note) <= 500),
  published_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (article_id, version)
);

CREATE INDEX idx_knowledge_article_versions_article
  ON public.knowledge_article_versions(article_id, version DESC);

ALTER TABLE public.knowledge_article_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authorized users can view knowledge_article_versions"
  ON public.knowledge_article_versions FOR SELECT TO authenticated
  USING (public.has_permission('knowledge', 'view'));
-- Only publishers write versions; there is no UPDATE or DELETE policy, so a
-- published version can't be rewritten (it goes only with its article).
CREATE POLICY "Publishers can insert knowledge_article_versions"
  ON public.knowledge_article_versions FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('knowledge', 'publish'));

-- ------------------------------------------------------------
-- 3. account_manager role
-- ------------------------------------------------------------
-- Reads every Knowledge article and drafts SOP edits; Fede or Gaston publish.
-- Only Knowledge is seeded here. Client, listing and adjustment access for AMs
-- is set in Settings -> Roles once the AM scope is final.
INSERT INTO public.roles (name, description, is_system) VALUES
  ('account_manager', 'Account manager for one client book; reads and drafts Knowledge, cannot publish', FALSE)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.role_permissions (role_name, resource, action, allowed) VALUES
  ('account_manager', 'knowledge', 'view', TRUE),
  ('account_manager', 'knowledge', 'create', TRUE),
  ('account_manager', 'knowledge', 'edit', TRUE),
  ('account_manager', 'knowledge', 'delete', FALSE),
  ('account_manager', 'knowledge', 'publish', FALSE),
  ('account_manager', 'knowledge', 'control', FALSE)
ON CONFLICT (role_name, resource, action) DO UPDATE SET allowed = EXCLUDED.allowed;

-- ------------------------------------------------------------
-- 4. SOP groups as categories
-- ------------------------------------------------------------
-- Existing: client-onboarding (Onboarding), pricing-strategy (Revenue
-- management), operations. Adds the other groups from the SOP inventory.
INSERT INTO public.knowledge_categories (name, slug, icon, description, color, dark_color, accent_color) VALUES
  -- Icons and colours come from ICON_MAP and CATEGORY_COLOR_PRESETS in the app.
  ('Channel Management', 'channel-management', 'Globe', 'Airbnb, Vrbo, Booking.com and direct: settings, markups, policies, sync', 'bg-teal-50', 'dark:bg-teal-950/30', 'text-teal-600 dark:text-teal-400'),
  ('Daily Performance & Adjustments', 'daily-performance', 'Zap', 'Morning check, change request to proof, outcome checks, incidents', 'bg-emerald-50', 'dark:bg-emerald-950/30', 'text-emerald-600 dark:text-emerald-400'),
  ('Client Reporting & Calls', 'client-reporting', 'FileText', 'Weekly and monthly reports, pacing reports, quarterly calls, wins', 'bg-sky-50', 'dark:bg-sky-950/30', 'text-sky-600 dark:text-sky-400'),
  ('Inbox & Communication', 'inbox-communication', 'MessageSquare', 'Client portal inbox, reply playbook, promises, escalations', 'bg-violet-50', 'dark:bg-violet-950/30', 'text-violet-600 dark:text-violet-400'),
  ('Hosting & Software Help', 'hosting-software-help', 'Wrench', 'Locks, reviews, guest incidents, PMS, direct sites: help outside pricing', 'bg-amber-50', 'dark:bg-amber-950/30', 'text-amber-600 dark:text-amber-400'),
  ('Account Management', 'account-management', 'Users', 'Book ownership, coverage, renewals, churn risk, offboarding', 'bg-pink-50', 'dark:bg-pink-950/30', 'text-pink-600 dark:text-pink-400'),
  ('Billing & Admin', 'billing-admin', 'Briefcase', 'Billing, failed payments, contract terms, Hub records', 'bg-rose-50', 'dark:bg-rose-950/30', 'text-rose-600 dark:text-rose-400'),
  ('Team & Quality', 'team-quality', 'ShieldCheck', 'AM training, quality checks, bots, tool access, SOP upkeep', 'bg-orange-50', 'dark:bg-orange-950/30', 'text-orange-600 dark:text-orange-400')
ON CONFLICT (slug) DO NOTHING;

-- ------------------------------------------------------------
-- 5. API scope for agents
-- ------------------------------------------------------------
-- GET /api/v1/sops uses an api_keys row with scope 'sops:read'. No key is
-- created here; a super_admin issues one in Settings when Fede approves it.
