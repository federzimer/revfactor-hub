"use server"

import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/lib/supabase/admin"
import { hasPermission } from "@/lib/permissions.server"
import { getN8nConfig } from "@/lib/automations/n8n.server"
import { syncN8nAutomations } from "@/lib/automations/sync.server"

export async function syncAutomationsNow(): Promise<
  { ok: true; message: string } | { ok: false; error: string }
> {
  // Admin client + external API: RLS does not apply, so gate in code.
  if (!(await hasPermission("automations", "edit"))) {
    return { ok: false, error: "You don't have permission to sync automations." }
  }
  if (!getN8nConfig()) {
    return { ok: false, error: "n8n is not connected yet (N8N_BASE_URL / N8N_API_KEY missing)." }
  }
  try {
    const result = await syncN8nAutomations(createAdminClient())
    revalidatePath("/automations")
    return {
      ok: true,
      message: `Synced ${result.upserted} n8n workflows${result.deactivated ? `, ${result.deactivated} marked inactive` : ""}.`,
    }
  } catch (err) {
    console.error("Automations sync error:", err)
    return { ok: false, error: err instanceof Error ? err.message : "Sync failed." }
  }
}
