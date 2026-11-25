import { NextRequest, NextResponse } from "next/server"
import { verifyApiKey } from "@/lib/api-auth.server"
import { listPublishedSops, loadSopBySlug } from "@/lib/knowledge-sop.server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

// Agent read API for published SOPs (scope `sops:read`).
//
//   GET /api/v1/sops                 -> JSON list of every published SOP
//   GET /api/v1/sops?slug=<slug>     -> one SOP as Markdown with YAML front matter
//
// Reads through the admin client after the key is verified; the projection in
// lib/knowledge-sop.server.ts is the security boundary. Drafts never leave here.
export async function GET(request: NextRequest) {
  const auth = await verifyApiKey(request, "sops:read")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const supabase = createAdminClient()
  const slug = request.nextUrl.searchParams.get("slug")

  if (slug) {
    const sop = await loadSopBySlug(supabase, slug, { publishedOnly: true })
    if (!sop) return NextResponse.json({ error: "SOP not found" }, { status: 404 })
    return new NextResponse(sop.markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "no-store",
      },
    })
  }

  const sops = await listPublishedSops(supabase)
  return NextResponse.json(
    {
      data: sops.map(({ article, sop }) => ({
        sop_code: sop.sop_code,
        title: article.title,
        slug: article.slug,
        group: article.category_name,
        version: article.version,
        updated_at: article.updated_at,
        trigger: sop.trigger_text,
        runs: sop.runs_role,
        backup: sop.backup_role,
        owner: sop.owner_label,
        approval_class: sop.approval_class,
        agent_mode: sop.agent_mode,
        hub_record: sop.hub_record,
        proof: sop.proof,
        inputs: sop.inputs,
        steps: sop.steps,
        guardrails: sop.guardrails,
        escalate_when: sop.escalate_when,
        video_url: sop.video_url,
      })),
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}
