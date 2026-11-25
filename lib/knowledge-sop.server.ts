// Server-only loaders for the agent-readable SOP export.
import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  normalizeSop,
  renderSopMarkdown,
  type KnowledgeSop,
  type SopExportArticle,
} from "@/lib/knowledge-sop"

// Explicit projection: the export never carries author ids, approval metadata
// or agent-index internals. The v1 API reads through the admin client, so this
// list is its security boundary (same model as app/api/v1/leads).
const ARTICLE_COLUMNS =
  "id, title, slug, status, updated_at, content_html, knowledge_categories(name), knowledge_sops(*), knowledge_article_versions(version)"

export type SopExport = {
  article: SopExportArticle
  sop: KnowledgeSop
  markdown: string
}

type Row = {
  id: string
  title: string
  slug: string
  status: string
  updated_at: string
  content_html: string | null
  knowledge_categories: { name: string } | { name: string }[] | null
  knowledge_sops: Record<string, unknown> | Record<string, unknown>[] | null
  knowledge_article_versions: { version: number }[] | null
}

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function toExport(row: Row): SopExport {
  const versions = row.knowledge_article_versions ?? []
  const article: SopExportArticle = {
    title: row.title,
    slug: row.slug,
    status: row.status,
    updated_at: row.updated_at,
    category_name: one(row.knowledge_categories)?.name ?? null,
    content_html: row.content_html ?? "",
    version: versions.length ? Math.max(...versions.map((v) => v.version)) : null,
  }
  const sop = normalizeSop(one(row.knowledge_sops), row.id)
  return { article, sop, markdown: renderSopMarkdown(article, sop) }
}

export async function loadSopBySlug(
  supabase: SupabaseClient,
  slug: string,
  opts: { publishedOnly: boolean }
): Promise<SopExport | null> {
  let query = supabase
    .from("knowledge_articles")
    .select(ARTICLE_COLUMNS)
    .eq("article_type", "sop")
    .eq("slug", slug)
  if (opts.publishedOnly) query = query.eq("status", "published")
  const { data } = await query.maybeSingle()
  return data ? toExport(data as unknown as Row) : null
}

export async function listPublishedSops(
  supabase: SupabaseClient
): Promise<SopExport[]> {
  const { data } = await supabase
    .from("knowledge_articles")
    .select(ARTICLE_COLUMNS)
    .eq("article_type", "sop")
    .eq("status", "published")
    .order("title")
  return ((data ?? []) as unknown as Row[]).map(toExport)
}
