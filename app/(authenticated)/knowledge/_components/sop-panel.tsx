"use client"

import { useState } from "react"
import { AlertTriangle, FileCode2, ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  SOP_AGENT_MODE_LABELS,
  SOP_APPROVAL_CLASS_LABELS,
  SOP_RUNS_ROLE_LABELS,
  formatDuration,
  parseSteps,
  sopReadinessGaps,
  videoEmbed,
  type KnowledgeSop,
} from "@/lib/knowledge-sop"
import type { KnowledgeArticleVersion } from "../_lib/types"

type Props = {
  slug: string
  sop: KnowledgeSop | null
  versions: KnowledgeArticleVersion[]
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={value ? "" : "text-muted-foreground italic"}>
        {value || "Not set"}
      </dd>
    </div>
  )
}

export function SopPanel({ slug, sop, versions }: Props) {
  // Ticks are local to this visit: the checklist is a reading aid, the Hub
  // record named on the SOP is where completion is logged.
  const [done, setDone] = useState<Set<number>>(new Set())

  if (!sop) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>SOP card missing</CardTitle>
          <CardDescription>
            This article is typed as an SOP but has no trigger, steps or proof
            yet. Edit it to fill in the SOP card.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const steps = parseSteps(sop.steps)
  const gaps = sopReadinessGaps(sop)
  const embed = videoEmbed(sop.video_url)
  const latest = versions[0]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            {sop.sop_code && (
              <Badge variant="outline" className="font-mono">
                {sop.sop_code}
              </Badge>
            )}
            <Badge variant="secondary">
              {SOP_APPROVAL_CLASS_LABELS[sop.approval_class]}
            </Badge>
            <Badge variant="outline">
              {SOP_AGENT_MODE_LABELS[sop.agent_mode]}
            </Badge>
            {latest && (
              <Badge variant="outline">Version {latest.version}</Badge>
            )}
          </div>
          <CardTitle className="pt-2">At a glance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="space-y-2">
            <Row label="Trigger" value={sop.trigger_text} />
            <Row
              label="Runs it"
              value={`${SOP_RUNS_ROLE_LABELS[sop.runs_role]}${
                sop.backup_role
                  ? ` (backup: ${SOP_RUNS_ROLE_LABELS[sop.backup_role]})`
                  : ""
              }`}
            />
            <Row label="Owner" value={sop.owner_label} />
            <Row label="Hub record" value={sop.hub_record} />
            <Row label="Done when" value={sop.proof} />
          </dl>
          {gaps.length > 0 && (
            <p className="flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              Not ready under the SOP standard. Missing: {gaps.join(", ")}.
            </p>
          )}
          <a
            href={`/api/knowledge/sops/${slug}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            <FileCode2 className="size-4" />
            Agent format (Markdown)
          </a>
        </CardContent>
      </Card>

      {embed && (
        <Card>
          <CardHeader>
            <CardTitle>Walkthrough</CardTitle>
            {sop.video_duration_sec && (
              <CardDescription>
                {formatDuration(sop.video_duration_sec)} video
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <div className="aspect-video overflow-hidden rounded-lg border bg-muted">
              {embed.kind === "iframe" ? (
                <iframe
                  src={embed.src}
                  title="SOP walkthrough"
                  className="size-full"
                  allow="encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              ) : (
                <video src={embed.src} controls preload="metadata" className="size-full" />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {sop.inputs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Before you start</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {sop.inputs.map((input) => (
                <li key={input}>{input}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Checklist</CardTitle>
          <CardDescription>
            {done.size} of {steps.length} done. Log completion on the Hub record,
            not here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {steps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No steps yet.</p>
          ) : (
            <ol className="space-y-3">
              {steps.map((step) => {
                const checked = done.has(step.n)
                return (
                  <li key={step.n} className="flex items-start gap-3">
                    <Checkbox
                      id={`sop-step-${step.n}`}
                      checked={checked}
                      onCheckedChange={(value) =>
                        setDone((prev) => {
                          const next = new Set(prev)
                          if (value) next.add(step.n)
                          else next.delete(step.n)
                          return next
                        })
                      }
                      className="mt-0.5"
                    />
                    <label
                      htmlFor={`sop-step-${step.n}`}
                      className={`text-sm leading-6 ${checked ? "text-muted-foreground line-through" : ""}`}
                    >
                      <span className="font-mono text-xs text-muted-foreground">
                        {step.n}.
                      </span>{" "}
                      {step.actor && (
                        <span className="font-medium">{step.actor}: </span>
                      )}
                      {step.action}
                      {step.check && (
                        <span className="block text-muted-foreground">
                          Check: {step.check}
                        </span>
                      )}
                    </label>
                  </li>
                )
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      {(sop.guardrails.length > 0 || sop.escalate_when) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-4" />
              Guardrails
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sop.guardrails.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {sop.guardrails.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            )}
            {sop.escalate_when && (
              <div className="text-sm">
                <p className="font-medium">Escalate when</p>
                <p className="whitespace-pre-wrap text-muted-foreground">
                  {sop.escalate_when}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {versions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Version history</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 text-sm">
              {versions.map((v) => (
                <li key={v.id} className="grid grid-cols-[48px_1fr] gap-2">
                  <span className="font-mono text-muted-foreground">v{v.version}</span>
                  <span>
                    {new Date(v.published_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                    {v.published_by_name ? ` · ${v.published_by_name}` : ""}
                    {v.change_note ? (
                      <span className="block text-muted-foreground">{v.change_note}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
