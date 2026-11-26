import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { hasPermission } from "@/lib/permissions.server"
import { getN8nConfig } from "@/lib/automations/n8n.server"
import { sortAutomations, type Automation } from "@/lib/automations/types"
import { AutomationsView } from "./automations-view"

export default async function AutomationsPage() {
  const canView = await hasPermission("automations", "view")
  if (!canView) redirect("/")

  const [canSync, supabase] = await Promise.all([
    hasPermission("automations", "edit"),
    createClient(),
  ])

  const { data, error } = await supabase
    .from("automations")
    .select(
      "id, name, runner, external_id, url, schedule, owner, output, changes_data, logs_to_hub, active, last_run_at, last_result, last_error, last_synced_at, notes, created_at, updated_at"
    )
    .order("name")

  if (error) throw new Error(`Failed to load automations: ${error.message}`)

  return (
    <AutomationsView
      automations={sortAutomations((data ?? []) as Automation[])}
      canSync={canSync}
      n8nConnected={getN8nConfig() !== null}
    />
  )
}
