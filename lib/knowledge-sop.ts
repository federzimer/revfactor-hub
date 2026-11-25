// SOP standard shared by the Knowledge UI and the agent API.
//
// One SOP serves two readers:
//   - people get the video walkthrough plus a checklist built from `steps`
//   - agents get the same SOP as Markdown with YAML front matter
//     (renderSopMarkdown), or as JSON from GET /api/v1/sops
//
// Client-safe module: no server imports. See docs/agent/sop-standard.md.

export const SOP_RUNS_ROLES = [
  "am",
  "pricing_team",
  "founders",
  "sales",
  "agent",
] as const
export type SopRunsRole = (typeof SOP_RUNS_ROLES)[number]

export const SOP_RUNS_ROLE_LABELS: Record<SopRunsRole, string> = {
  am: "Account manager",
  pricing_team: "Pricing team",
  founders: "Fede or Gaston",
  sales: "Sales",
  agent: "Agent",
}

export const SOP_APPROVAL_CLASSES = ["none", "A", "B", "C"] as const
export type SopApprovalClass = (typeof SOP_APPROVAL_CLASSES)[number]

export const SOP_APPROVAL_CLASS_LABELS: Record<SopApprovalClass, string> = {
  none: "No pricing change",
  A: "Class A: inside the band, AM approves",
  B: "Class B: band edge, weekly pricing review",
  C: "Class C: outside the band, Fede or Gaston",
}

export const SOP_AGENT_MODES = [
  "human_only",
  "agent_assist",
  "agent_runs",
] as const
export type SopAgentMode = (typeof SOP_AGENT_MODES)[number]

export const SOP_AGENT_MODE_LABELS: Record<SopAgentMode, string> = {
  human_only: "People only (agents read for context)",
  agent_assist: "Agent drafts, a person acts",
  agent_runs: "Agent runs the agent steps",
}

export type KnowledgeSop = {
  article_id: string
  sop_code: string | null
  trigger_text: string
  runs_role: SopRunsRole
  backup_role: SopRunsRole | null
  owner_label: string
  approval_class: SopApprovalClass
  hub_record: string
  proof: string
  agent_mode: SopAgentMode
  inputs: string[]
  steps: string[]
  guardrails: string[]
  escalate_when: string
  video_url: string | null
  video_duration_sec: number | null
  updated_at: string | null
}

export type SopStep = {
  n: number
  actor: string | null
  action: string
  check: string | null
}

const SOP_CODE_RE = /^[A-Z]{2,5}-[0-9]{2,3}$/

function pick<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T
): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
}

/** Split a textarea into one item per non-empty line, dropping list bullets. */
export function linesToList(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim())
    .filter(Boolean)
}

export function listToLines(items: string[]): string {
  return items.join("\n")
}

/** Normalise a DB row (or a missing one) into a KnowledgeSop. */
export function normalizeSop(
  row: Record<string, unknown> | null | undefined,
  articleId: string
): KnowledgeSop {
  const r = row ?? {}
  const duration = Number(r.video_duration_sec)
  return {
    article_id: articleId,
    sop_code: typeof r.sop_code === "string" && r.sop_code ? r.sop_code : null,
    trigger_text: String(r.trigger_text ?? ""),
    runs_role: pick(r.runs_role, SOP_RUNS_ROLES, "am"),
    backup_role:
      r.backup_role == null
        ? null
        : pick(r.backup_role, SOP_RUNS_ROLES, "am"),
    owner_label: String(r.owner_label ?? ""),
    approval_class: pick(r.approval_class, SOP_APPROVAL_CLASSES, "none"),
    hub_record: String(r.hub_record ?? ""),
    proof: String(r.proof ?? ""),
    agent_mode: pick(r.agent_mode, SOP_AGENT_MODES, "human_only"),
    inputs: toStringList(r.inputs),
    steps: toStringList(r.steps),
    guardrails: toStringList(r.guardrails),
    escalate_when: String(r.escalate_when ?? ""),
    video_url:
      typeof r.video_url === "string" && r.video_url ? r.video_url : null,
    video_duration_sec:
      Number.isFinite(duration) && duration > 0 ? duration : null,
    updated_at: typeof r.updated_at === "string" ? r.updated_at : null,
  }
}

export type SopFormValues = {
  sop_code: string
  trigger_text: string
  runs_role: string
  backup_role: string
  owner_label: string
  approval_class: string
  hub_record: string
  proof: string
  agent_mode: string
  inputs: string
  steps: string
  guardrails: string
  escalate_when: string
  video_url: string
  video_duration_sec: string
}

export type SopRowInput = Omit<KnowledgeSop, "article_id" | "updated_at">

/** Validate form input. Returns the DB row or a user-facing error. */
export function parseSopForm(
  values: SopFormValues
): { ok: true; row: SopRowInput } | { ok: false; error: string } {
  const code = values.sop_code.trim().toUpperCase()
  if (code && !SOP_CODE_RE.test(code)) {
    return {
      ok: false,
      error: "SOP code must look like RM-01 (2 to 5 letters, a dash, 2 or 3 digits).",
    }
  }
  const video = values.video_url.trim()
  if (video && !/^https:\/\//.test(video)) {
    return { ok: false, error: "Video link must start with https://" }
  }
  const durationText = values.video_duration_sec.trim()
  let duration: number | null = null
  if (durationText) {
    duration = parseDuration(durationText)
    if (duration == null) {
      return { ok: false, error: "Video length must be like 3:20 or 200 (seconds)." }
    }
  }
  return {
    ok: true,
    row: {
      sop_code: code || null,
      trigger_text: values.trigger_text.trim(),
      runs_role: pick(values.runs_role, SOP_RUNS_ROLES, "am"),
      backup_role: values.backup_role
        ? pick(values.backup_role, SOP_RUNS_ROLES, "am")
        : null,
      owner_label: values.owner_label.trim(),
      approval_class: pick(values.approval_class, SOP_APPROVAL_CLASSES, "none"),
      hub_record: values.hub_record.trim(),
      proof: values.proof.trim(),
      agent_mode: pick(values.agent_mode, SOP_AGENT_MODES, "human_only"),
      inputs: linesToList(values.inputs),
      steps: linesToList(values.steps),
      guardrails: linesToList(values.guardrails),
      escalate_when: values.escalate_when.trim(),
      video_url: video || null,
      video_duration_sec: duration,
    },
  }
}

/** "3:20" -> 200, "200" -> 200. Null when invalid or out of range. */
export function parseDuration(text: string): number | null {
  const t = text.trim()
  let seconds: number
  if (/^\d+$/.test(t)) seconds = Number(t)
  else {
    const m = /^(\d+):([0-5]\d)$/.exec(t)
    if (!m) return null
    seconds = Number(m[1]) * 60 + Number(m[2])
  }
  return seconds >= 1 && seconds <= 3600 ? seconds : null
}

export function formatDuration(seconds: number | null): string {
  if (!seconds) return ""
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

/**
 * Parse "Actor: action -> check" into parts. Actor and check are optional.
 * The actor must be short (up to 4 words) so a colon inside a sentence isn't
 * mistaken for one.
 */
export function parseStep(text: string, n: number): SopStep {
  let rest = text.trim()
  let actor: string | null = null
  const actorMatch = /^([A-Za-z][\w &/]{0,30}?):\s+(.+)$/.exec(rest)
  if (actorMatch && actorMatch[1].split(/\s+/).length <= 4) {
    actor = actorMatch[1].trim()
    rest = actorMatch[2]
  }
  let check: string | null = null
  const arrow = rest.search(/\s(?:->|→)\s/)
  if (arrow >= 0) {
    check = rest.slice(arrow).replace(/^\s(?:->|→)\s/, "").trim() || null
    rest = rest.slice(0, arrow).trim()
  }
  return { n, actor, action: rest, check }
}

export function parseSteps(steps: string[]): SopStep[] {
  return steps.map((s, i) => parseStep(s, i + 1))
}

/**
 * Turn a video link into an embeddable player. YouTube (watch, youtu.be,
 * shorts), Loom and Vimeo become iframes; .mp4/.webm play in <video>.
 */
export function videoEmbed(
  url: string | null
): { kind: "iframe" | "video"; src: string } | null {
  if (!url) return null
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  if (u.protocol !== "https:") return null
  const host = u.hostname.replace(/^www\./, "")
  if (host === "youtu.be") {
    const id = u.pathname.slice(1).split("/")[0]
    return id ? { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${id}` } : null
  }
  if (host === "youtube.com" || host === "m.youtube.com") {
    const id =
      u.searchParams.get("v") ??
      (/^\/(?:shorts|embed|live)\/([^/]+)/.exec(u.pathname)?.[1] ?? null)
    return id ? { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${id}` } : null
  }
  if (host === "loom.com") {
    const id = /^\/(?:share|embed)\/([a-zA-Z0-9]+)/.exec(u.pathname)?.[1]
    return id ? { kind: "iframe", src: `https://www.loom.com/embed/${id}` } : null
  }
  if (host === "vimeo.com") {
    const id = /^\/(\d+)/.exec(u.pathname)?.[1]
    return id ? { kind: "iframe", src: `https://player.vimeo.com/video/${id}` } : null
  }
  if (/\.(mp4|webm)$/i.test(u.pathname)) return { kind: "video", src: u.toString() }
  return null
}

/** Missing pieces that keep an SOP from being "ready" under the standard. */
export function sopReadinessGaps(sop: KnowledgeSop): string[] {
  const gaps: string[] = []
  if (!sop.sop_code) gaps.push("SOP code")
  if (!sop.trigger_text) gaps.push("trigger")
  if (!sop.owner_label) gaps.push("owner")
  if (!sop.hub_record) gaps.push("Hub record")
  if (!sop.proof) gaps.push("proof that closes it")
  if (sop.steps.length === 0) gaps.push("steps")
  if (sop.guardrails.length === 0) gaps.push("guardrails")
  if (!sop.video_url) gaps.push("video walkthrough")
  return gaps
}

function yamlString(value: string): string {
  return JSON.stringify(value)
}

function yamlList(key: string, items: string[]): string {
  if (items.length === 0) return `${key}: []`
  return `${key}:\n${items.map((i) => `  - ${yamlString(i)}`).join("\n")}`
}

/** Strip tags for the plain-text "Notes" section of the Markdown export. */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h[1-6]|li|div|tr)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export type SopExportArticle = {
  title: string
  slug: string
  status: string
  updated_at: string
  category_name: string | null
  content_html: string
  version: number | null
}

/**
 * Agent-readable SOP: YAML front matter (the contract) plus a Markdown body
 * (the same steps a person checks off). Stable field names; add, never rename.
 */
export function renderSopMarkdown(
  article: SopExportArticle,
  sop: KnowledgeSop
): string {
  const steps = parseSteps(sop.steps)
  const front = [
    "---",
    `sop_code: ${yamlString(sop.sop_code ?? "")}`,
    `title: ${yamlString(article.title)}`,
    `slug: ${yamlString(article.slug)}`,
    `group: ${yamlString(article.category_name ?? "")}`,
    `status: ${yamlString(article.status)}`,
    `version: ${article.version ?? 0}`,
    `updated_at: ${yamlString(article.updated_at)}`,
    `trigger: ${yamlString(sop.trigger_text)}`,
    `runs: ${yamlString(sop.runs_role)}`,
    `backup: ${yamlString(sop.backup_role ?? "")}`,
    `owner: ${yamlString(sop.owner_label)}`,
    `approval_class: ${yamlString(sop.approval_class)}`,
    `agent_mode: ${yamlString(sop.agent_mode)}`,
    `hub_record: ${yamlString(sop.hub_record)}`,
    `proof: ${yamlString(sop.proof)}`,
    yamlList("inputs", sop.inputs),
    yamlList("guardrails", sop.guardrails),
    `escalate_when: ${yamlString(sop.escalate_when)}`,
    `video_url: ${yamlString(sop.video_url ?? "")}`,
    "---",
  ].join("\n")

  const body: string[] = [
    `# ${sop.sop_code ? `${sop.sop_code} ` : ""}${article.title}`,
    "",
    `**Trigger:** ${sop.trigger_text || "(not set)"}`,
    `**Runs:** ${SOP_RUNS_ROLE_LABELS[sop.runs_role]}${sop.backup_role ? ` (backup: ${SOP_RUNS_ROLE_LABELS[sop.backup_role]})` : ""}`,
    `**Owner:** ${sop.owner_label || "(not set)"}`,
    `**Approval:** ${SOP_APPROVAL_CLASS_LABELS[sop.approval_class]}`,
    `**Hub record:** ${sop.hub_record || "(not set)"}`,
    `**Done when:** ${sop.proof || "(not set)"}`,
    "",
  ]
  if (sop.inputs.length) {
    body.push("## Inputs", "", ...sop.inputs.map((i) => `- ${i}`), "")
  }
  body.push("## Steps", "")
  if (steps.length === 0) body.push("(no steps yet)")
  for (const s of steps) {
    body.push(
      `${s.n}. ${s.actor ? `**${s.actor}:** ` : ""}${s.action}${s.check ? ` → check: ${s.check}` : ""}`
    )
  }
  body.push("")
  if (sop.guardrails.length) {
    body.push("## Guardrails", "", ...sop.guardrails.map((g) => `- ${g}`), "")
  }
  if (sop.escalate_when) {
    body.push("## Escalate when", "", sop.escalate_when, "")
  }
  const notes = htmlToPlainText(article.content_html)
  if (notes) body.push("## Notes", "", notes, "")

  return `${front}\n\n${body.join("\n").trimEnd()}\n`
}
