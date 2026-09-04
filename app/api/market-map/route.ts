import { createClient } from "@/lib/supabase/server"
import { loadMarketMapExport } from "@/lib/market-map.server"
import { hasPermission } from "@/lib/permissions.server"

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "private, no-store" }

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json(
      { error: "Authentication required" },
      { status: 401, headers: NO_STORE }
    )
  }

  if (!(await hasPermission("market_signals", "view"))) {
    return Response.json(
      { error: "Not authorized" },
      { status: 403, headers: NO_STORE }
    )
  }

  try {
    const payload = await loadMarketMapExport()
    return Response.json(payload, { headers: NO_STORE })
  } catch (error) {
    console.error("Market map export failed", error)
    return Response.json(
      { error: "Market map export could not be loaded." },
      { status: 503, headers: NO_STORE }
    )
  }
}
