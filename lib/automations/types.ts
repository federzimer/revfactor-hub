// Shared automation registry types — safe for client & server components.

export const AUTOMATION_RUNNERS = [
  { key: "n8n", label: "n8n" },
  { key: "vercel_cron", label: "Vercel cron" },
  { key: "hub_webhook", label: "Hub webhook" },
  { key: "ghl", label: "GHL workflow" },
  { key: "grokbot", label: "Grokbot" },
  { key: "claude_task", label: "Claude task" },
  { key: "railway", label: "Railway" },
  { key: "other", label: "Other" },
] as const

export type AutomationRunner = (typeof AUTOMATION_RUNNERS)[number]["key"]

export type AutomationResult =
  | "success"
  | "error"
  | "running"
  | "waiting"
  | "canceled"
  | "unknown"

export type Automation = {
  id: string
  name: string
  runner: AutomationRunner
  external_id: string | null
  url: string | null
  schedule: string | null
  owner: string | null
  output: string | null
  changes_data: boolean
  logs_to_hub: boolean
  active: boolean
  last_run_at: string | null
  last_result: AutomationResult | null
  last_error: string | null
  last_synced_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export function runnerLabel(runner: string): string {
  return AUTOMATION_RUNNERS.find((r) => r.key === runner)?.label ?? runner
}

/** Changes client data or sends something, but writes no Hub record. */
export function breaksLogRule(a: Pick<Automation, "changes_data" | "logs_to_hub" | "active">): boolean {
  return a.active && a.changes_data && !a.logs_to_hub
}

/** Sort: failed first, then rule breakers, then active, then by name. */
export function sortAutomations(rows: Automation[]): Automation[] {
  const rank = (a: Automation) =>
    a.active && a.last_result === "error" ? 0 : breaksLogRule(a) ? 1 : a.active ? 2 : 3
  return [...rows].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
}
