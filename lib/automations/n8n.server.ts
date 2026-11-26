import "server-only"
import type { AutomationResult } from "./types"

// Minimal client for the n8n public REST API (v1).
// Env: N8N_BASE_URL (e.g. https://n8n-production-xxxx.up.railway.app) and
// N8N_API_KEY (created in n8n under Settings -> n8n API). Server-only.

export type N8nWorkflow = {
  id: string
  name: string
  active: boolean
  updatedAt?: string
  nodes?: { type: string; parameters?: Record<string, unknown> }[]
}

export type N8nExecution = {
  id: string
  workflowId: string
  status?: string
  finished?: boolean
  startedAt?: string | null
  stoppedAt?: string | null
}

export function getN8nConfig(): { baseUrl: string; apiKey: string } | null {
  const baseUrl = process.env.N8N_BASE_URL?.replace(/\/+$/, "")
  const apiKey = process.env.N8N_API_KEY
  if (!baseUrl || !apiKey) return null
  return { baseUrl, apiKey }
}

async function n8nGet<T>(
  cfg: { baseUrl: string; apiKey: string },
  path: string,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`${cfg.baseUrl}/api/v1${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url, {
    headers: { "X-N8N-API-KEY": cfg.apiKey, accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    throw new Error(`n8n API ${path} returned ${res.status}`)
  }
  return (await res.json()) as T
}

export async function listN8nWorkflows(cfg: {
  baseUrl: string
  apiKey: string
}): Promise<N8nWorkflow[]> {
  const out: N8nWorkflow[] = []
  let cursor: string | undefined
  for (let page = 0; page < 20; page++) {
    const params: Record<string, string> = { limit: "100" }
    if (cursor) params.cursor = cursor
    const body = await n8nGet<{ data: N8nWorkflow[]; nextCursor?: string | null }>(
      cfg,
      "/workflows",
      params
    )
    out.push(...body.data)
    if (!body.nextCursor) break
    cursor = body.nextCursor
  }
  return out
}

export async function getLatestN8nExecution(
  cfg: { baseUrl: string; apiKey: string },
  workflowId: string
): Promise<N8nExecution | null> {
  const body = await n8nGet<{ data: N8nExecution[] }>(cfg, "/executions", {
    workflowId,
    limit: "1",
  })
  return body.data[0] ?? null
}

export function mapN8nStatus(execution: N8nExecution | null): AutomationResult | null {
  if (!execution) return null
  switch (execution.status) {
    case "success":
      return "success"
    case "error":
    case "crashed":
      return "error"
    case "running":
    case "new":
      return "running"
    case "waiting":
      return "waiting"
    case "canceled":
      return "canceled"
    default:
      return execution.finished ? "success" : "unknown"
  }
}

/** Human summary of a workflow's triggers, e.g. "Schedule, Webhook". */
export function describeTriggers(workflow: N8nWorkflow): string | null {
  const triggers = (workflow.nodes ?? [])
    .map((n) => n.type)
    .filter((t) => /trigger$/i.test(t) || /webhook$/i.test(t))
    .map((t) =>
      t
        .replace(/^.*\./, "")
        .replace(/Trigger$/i, "")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .trim()
    )
    .filter(Boolean)
  const unique = Array.from(new Set(triggers.map((t) => t[0].toUpperCase() + t.slice(1))))
  return unique.length ? unique.join(", ") : null
}
