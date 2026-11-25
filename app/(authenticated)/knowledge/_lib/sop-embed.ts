import { normalizeSop, type KnowledgeSop } from "@/lib/knowledge-sop"

/**
 * `knowledge_sops(*)` embedded on an article. PostgREST returns an object for
 * this one-to-one (PK = FK), but older clients typed it as an array; accept both.
 */
export function sopFromEmbed(embed: unknown, articleId: string): KnowledgeSop | null {
  const row = Array.isArray(embed) ? embed[0] : embed
  if (!row || typeof row !== "object") return null
  return normalizeSop(row as Record<string, unknown>, articleId)
}
