# SOP standard (Knowledge → SOP)

One SOP serves two readers. People watch a short video and tick a checklist.
Agents read the same SOP as structured fields. Both come from one record, so
they can't drift apart.

## Where it lives

- An SOP is a `knowledge_articles` row with `article_type = 'sop'`, in the
  category for its group (Onboarding, Channel Management, Revenue Management /
  Pricing Strategy, Daily Performance & Adjustments, Client Reporting & Calls,
  Inbox & Communication, Hosting & Software Help, Account Management, Billing &
  Admin, Team & Quality).
- The structured card is `knowledge_sops` (1:1, migration 092). The article body
  holds the why, examples and edge cases.
- Every publish appends an immutable row to `knowledge_article_versions`.
- wikifactor, Drive and Notion link to the Hub SOP; they don't keep copies.

## Fields

| Field | Rule |
|---|---|
| `sop_code` | `GROUP-NN`, e.g. `DP-02`. Stable; never reused. |
| `trigger_text` | The event that starts it, one sentence. |
| `runs_role` / `backup_role` | `am`, `pricing_team`, `founders`, `sales`, `agent`. |
| `owner_label` | Who keeps it current and approves edits. |
| `approval_class` | Highest pricing change it can produce: `none`, `A` (inside the band, AM), `B` (band edge, weekly pricing review), `C` (outside the band, Fede or Gaston). |
| `hub_record` | The Hub record it creates or updates. No record, not done. |
| `proof` | What is seen live (PriceLabs, Airbnb, PMS, client portal) to close it. |
| `inputs` | What you need before step 1. One per line. |
| `steps` | One per line: `Actor: action -> check`. 5–12 steps. Becomes the checklist and the agent's numbered steps. |
| `guardrails` | Hard "never" and "always" lines. Copy the project rules that apply. |
| `escalate_when` | When to stop and pull in Fede or Gaston. |
| `agent_mode` | `human_only` (agents read for context), `agent_assist` (agent drafts, a person acts), `agent_runs` (agent runs the steps whose actor is `Agent`). |
| `video_url` | Unlisted YouTube, Loom, Vimeo or MP4. Under 5 minutes. |

An SOP is "ready" when every field above has a value (`sopReadinessGaps`).

## Writing rules

- Client-facing wording: "client portal", never Assembly, Hub, India team or
  Grokbot.
- Numbers are the owner's take-home. Owner minimum = payout after markups and
  discounts.
- Any price, floor, min stay, discount or markup change carries its class, and
  class C always needs Fede or Gaston.
- Video follows the flight-deck `video-creation` skill: script is the one
  approval gate, redact before capture, unlisted upload only after Fede's OK.

## Agent access

- Signed in: `GET /api/knowledge/sops/<slug>` → Markdown with YAML front matter
  (drafts included, for checking before publish).
- API key with scope `sops:read`: `GET /api/v1/sops` (JSON list of published
  SOPs) and `GET /api/v1/sops?slug=<slug>` (Markdown). Drafts never leave.
- Front-matter field names are a contract: add fields, never rename them.

## Roles

- `account_manager` (migration 092): Knowledge view/create/edit. Can draft and
  edit drafts; a published article can only be changed by someone with
  `knowledge:publish`, so every live change gets a version.
- Pricing team (`contractor` role): grant `knowledge:view` in Settings → Roles
  when Fede approves. No code change needed.
