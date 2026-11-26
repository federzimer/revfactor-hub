import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getN8nConfig } from "@/lib/automations/n8n.server"
import { syncN8nAutomations } from "@/lib/automations/sync.server"

export const dynamic = "force-dynamic"
export const maxDuration = 60

// Not in vercel.json: the Hub's Vercel plan rejects extra high-frequency
// crons (see docs/agent/decisions.md). n8n calls this route on its own
// schedule with `Authorization: Bearer <CRON_SECRET>`; the Automations page
// also has a "Sync now" button.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!getN8nConfig()) {
    return NextResponse.json(
      { error: "N8N_BASE_URL / N8N_API_KEY not configured" },
      { status: 500 }
    )
  }
  try {
    const result = await syncN8nAutomations(createAdminClient())
    return NextResponse.json({
      message: `Synced ${result.upserted} n8n workflows (${result.deactivated} marked inactive)`,
      ...result,
    })
  } catch (err) {
    console.error("Automations sync error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    )
  }
}
