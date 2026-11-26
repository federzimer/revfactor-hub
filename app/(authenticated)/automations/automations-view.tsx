"use client"

import { useMemo, useState, useTransition } from "react"
import { AlertTriangle, ExternalLink, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AUTOMATION_RUNNERS,
  breaksLogRule,
  runnerLabel,
  type Automation,
} from "@/lib/automations/types"
import { syncAutomationsNow } from "./actions"

function formatWhen(iso: string | null): string {
  if (!iso) return "Never"
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function ResultBadge({ automation }: { automation: Automation }) {
  if (!automation.active) return <Badge variant="outline">Off</Badge>
  switch (automation.last_result) {
    case "success":
      return <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">OK</Badge>
    case "error":
      return <Badge variant="destructive">Failed</Badge>
    case "running":
    case "waiting":
      return <Badge variant="secondary">Running</Badge>
    case "canceled":
      return <Badge variant="outline">Canceled</Badge>
    default:
      return <Badge variant="outline">No runs yet</Badge>
  }
}

export function AutomationsView({
  automations,
  canSync,
  n8nConnected,
}: {
  automations: Automation[]
  canSync: boolean
  n8nConnected: boolean
}) {
  const [runner, setRunner] = useState<string>("all")
  const [status, setStatus] = useState<string>("all")
  const [pending, startTransition] = useTransition()

  const counts = useMemo(
    () => ({
      active: automations.filter((a) => a.active).length,
      failed: automations.filter((a) => a.active && a.last_result === "error").length,
      noLog: automations.filter(breaksLogRule).length,
      noOwner: automations.filter((a) => a.active && !a.owner).length,
    }),
    [automations]
  )

  const rows = useMemo(
    () =>
      automations.filter((a) => {
        if (runner !== "all" && a.runner !== runner) return false
        if (status === "failed") return a.active && a.last_result === "error"
        if (status === "no_log") return breaksLogRule(a)
        if (status === "active") return a.active
        return true
      }),
    [automations, runner, status]
  )

  function onSync() {
    startTransition(async () => {
      const result = await syncAutomationsNow()
      if (result.ok) toast.success(result.message)
      else toast.error(result.error)
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Automations</h1>
          <p className="text-sm text-muted-foreground">
            Every scheduled job and workflow, who owns it, what it changes and how its last run went.
          </p>
        </div>
        {canSync && (
          <Button onClick={onSync} disabled={pending || !n8nConnected}>
            <RefreshCw className={pending ? "mr-2 size-4 animate-spin" : "mr-2 size-4"} />
            Sync n8n now
          </Button>
        )}
      </div>

      {!n8nConnected && (
        <Card>
          <CardContent className="py-4 text-sm text-muted-foreground">
            n8n is not connected yet. Add <code>N8N_BASE_URL</code> and <code>N8N_API_KEY</code> to the
            Hub&apos;s environment to list n8n workflows here.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Active", value: counts.active },
          { label: "Last run failed", value: counts.failed, warn: counts.failed > 0 },
          { label: "Change data, no Hub log", value: counts.noLog, warn: counts.noLog > 0 },
          { label: "No owner", value: counts.noOwner, warn: counts.noOwner > 0 },
        ].map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={c.warn ? "text-2xl font-semibold text-destructive" : "text-2xl font-semibold"}>
                {c.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={runner} onValueChange={setRunner}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Runner" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All runners</SelectItem>
            {AUTOMATION_RUNNERS.map((r) => (
              <SelectItem key={r.key} value={r.key}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="failed">Last run failed</SelectItem>
            <SelectItem value="no_log">Changes data, no Hub log</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Runner</TableHead>
                  <TableHead>Schedule / trigger</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Output</TableHead>
                  <TableHead>Last run</TableHead>
                  <TableHead>Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                      No automations match these filters.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((a) => (
                  <TableRow key={a.id} className={a.active ? undefined : "opacity-60"}>
                    <TableCell className="whitespace-normal font-medium">
                      <div className="flex items-center gap-1.5">
                        {a.url ? (
                          <a
                            href={a.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 hover:underline"
                          >
                            {a.name}
                            <ExternalLink className="size-3" />
                          </a>
                        ) : (
                          a.name
                        )}
                        {breaksLogRule(a) && (
                          <span title="Changes data or sends messages but writes no Hub record">
                            <AlertTriangle className="size-4 text-amber-600" />
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{runnerLabel(a.runner)}</TableCell>
                    <TableCell className="whitespace-normal">{a.schedule ?? "—"}</TableCell>
                    <TableCell>{a.owner ?? <span className="text-destructive">Unassigned</span>}</TableCell>
                    <TableCell className="whitespace-normal text-sm text-muted-foreground">
                      {a.output ?? "—"}
                    </TableCell>
                    <TableCell>{formatWhen(a.last_run_at)}</TableCell>
                    <TableCell title={a.last_error ?? undefined}>
                      <ResultBadge automation={a} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
