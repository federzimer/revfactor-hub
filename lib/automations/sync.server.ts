import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  describeTriggers,
  getLatestN8nExecution,
  getN8nConfig,
  listN8nWorkflows,
  mapN8nStatus,
} from "./n8n.server"

export type AutomationSyncResult = {
  workflows: number
  upserted: number
  deactivated: number
}

/**
 * Pull every n8n workflow and its latest execution into public.automations.
 * Only n8n-owned columns are written, so owner/output/notes/changes_data/
 * logs_to_hub entered in the Hub are preserved. Workflows that no longer
 * exist in n8n are marked inactive, never deleted.
 * Must be called with the admin client; callers check permission first.
 */
export async function syncN8nAutomations(
  supabase: SupabaseClient
): Promise<AutomationSyncResult> {
  const cfg = getN8nConfig()
  if (!cfg) throw new Error("N8N_BASE_URL / N8N_API_KEY not configured")

  const workflows = await listN8nWorkflows(cfg)
  const now = new Date().toISOString()

  const rows = []
  for (const wf of workflows) {
    const latest = await getLatestN8nExecution(cfg, wf.id)
    rows.push({
      runner: "n8n" as const,
      external_id: wf.id,
      name: wf.name,
      url: `${cfg.baseUrl}/workflow/${wf.id}`,
      schedule: describeTriggers(wf),
      active: wf.active,
      last_run_at: latest?.startedAt ?? null,
      last_result: mapN8nStatus(latest),
      last_error: mapN8nStatus(latest) === "error" ? `Execution ${latest?.id} failed` : null,
      last_synced_at: now,
    })
  }

  if (rows.length) {
    const { error } = await supabase
      .from("automations")
      .upsert(rows, { onConflict: "runner,external_id" })
    if (error) throw new Error(`automations upsert failed: ${error.message}`)
  }

  const seen = workflows.map((w) => w.id)
  let deactivated = 0
  {
    let query = supabase
      .from("automations")
      .update({ active: false, last_synced_at: now })
      .eq("runner", "n8n")
      .eq("active", true)
    if (seen.length) query = query.not("external_id", "in", `(${seen.map((id) => `"${id}"`).join(",")})`)
    const { data, error } = await query.select("id")
    if (error) throw new Error(`automations deactivate failed: ${error.message}`)
    deactivated = data?.length ?? 0
  }

  return { workflows: workflows.length, upserted: rows.length, deactivated }
}
