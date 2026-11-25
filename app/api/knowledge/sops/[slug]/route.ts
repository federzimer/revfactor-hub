import { NextResponse } from "next/server"
import { hasPermission } from "@/lib/permissions.server"
import { loadSopBySlug } from "@/lib/knowledge-sop.server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

// Signed-in view of one SOP in the agent format (Markdown + YAML front matter).
// Reads with the user's session, so RLS and knowledge:view apply; drafts are
// visible here so an editor can check the export before publishing.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (!(await hasPermission("knowledge", "view"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { slug } = await params
  const sop = await loadSopBySlug(supabase, slug, { publishedOnly: false })
  if (!sop) return NextResponse.json({ error: "SOP not found" }, { status: 404 })

  return new NextResponse(sop.markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  })
}
