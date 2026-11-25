"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  SOP_AGENT_MODES,
  SOP_AGENT_MODE_LABELS,
  SOP_APPROVAL_CLASSES,
  SOP_APPROVAL_CLASS_LABELS,
  SOP_RUNS_ROLES,
  SOP_RUNS_ROLE_LABELS,
  formatDuration,
  listToLines,
  type KnowledgeSop,
  type SopFormValues,
} from "@/lib/knowledge-sop"

const NO_BACKUP = "__none__"

export function sopFormDefaults(sop: KnowledgeSop | null): SopFormValues {
  return {
    sop_code: sop?.sop_code ?? "",
    trigger_text: sop?.trigger_text ?? "",
    runs_role: sop?.runs_role ?? "am",
    backup_role: sop?.backup_role ?? "",
    owner_label: sop?.owner_label ?? "",
    approval_class: sop?.approval_class ?? "none",
    hub_record: sop?.hub_record ?? "",
    proof: sop?.proof ?? "",
    agent_mode: sop?.agent_mode ?? "human_only",
    inputs: listToLines(sop?.inputs ?? []),
    steps: listToLines(sop?.steps ?? []),
    guardrails: listToLines(sop?.guardrails ?? []),
    escalate_when: sop?.escalate_when ?? "",
    video_url: sop?.video_url ?? "",
    video_duration_sec: formatDuration(sop?.video_duration_sec ?? null),
  }
}

type Props = {
  values: SopFormValues
  onChange: (values: SopFormValues) => void
}

export function SopFields({ values, onChange }: Props) {
  function set<K extends keyof SopFormValues>(key: K, value: string) {
    onChange({ ...values, [key]: value })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>SOP card</CardTitle>
        <CardDescription>
          The same SOP serves people (video and checklist) and agents (trigger,
          inputs, steps, proof, guardrails). Write one step per line as
          “Actor: action -&gt; check”.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="sop-code">SOP code</FieldLabel>
              <Input
                id="sop-code"
                value={values.sop_code}
                onChange={(e) => set("sop_code", e.target.value)}
                placeholder="DP-02"
              />
            </Field>
            <Field>
              <FieldLabel>Runs it</FieldLabel>
              <Select
                value={values.runs_role}
                onValueChange={(v) => set("runs_role", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {SOP_RUNS_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {SOP_RUNS_ROLE_LABELS[role]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Backup</FieldLabel>
              <Select
                value={values.backup_role || NO_BACKUP}
                onValueChange={(v) => set("backup_role", v === NO_BACKUP ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={NO_BACKUP}>None</SelectItem>
                    {SOP_RUNS_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {SOP_RUNS_ROLE_LABELS[role]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="sop-trigger">Trigger</FieldLabel>
            <Input
              id="sop-trigger"
              value={values.trigger_text}
              onChange={(e) => set("trigger_text", e.target.value)}
              placeholder="A client asks for a price, floor, min stay, discount or markup change"
            />
            <FieldDescription>The event that starts this SOP.</FieldDescription>
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="sop-owner">Owner</FieldLabel>
              <Input
                id="sop-owner"
                value={values.owner_label}
                onChange={(e) => set("owner_label", e.target.value)}
                placeholder="Gaston"
              />
              <FieldDescription>Keeps it current.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel>Highest change class</FieldLabel>
              <Select
                value={values.approval_class}
                onValueChange={(v) => set("approval_class", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {SOP_APPROVAL_CLASSES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {SOP_APPROVAL_CLASS_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Agent use</FieldLabel>
              <Select
                value={values.agent_mode}
                onValueChange={(v) => set("agent_mode", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {SOP_AGENT_MODES.map((m) => (
                      <SelectItem key={m} value={m}>
                        {SOP_AGENT_MODE_LABELS[m]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="sop-hub-record">Hub record</FieldLabel>
              <Input
                id="sop-hub-record"
                value={values.hub_record}
                onChange={(e) => set("hub_record", e.target.value)}
                placeholder="Adjustment on the listing"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="sop-proof">Done when (proof)</FieldLabel>
              <Input
                id="sop-proof"
                value={values.proof}
                onChange={(e) => set("proof", e.target.value)}
                placeholder="Seen live in PriceLabs and on Airbnb, screenshot on the adjustment"
              />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="sop-inputs">Inputs (one per line)</FieldLabel>
            <Textarea
              id="sop-inputs"
              value={values.inputs}
              onChange={(e) => set("inputs", e.target.value)}
              rows={3}
              placeholder={"Client message in the client portal\nListing band (floor, ceiling)"}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="sop-steps">Steps (one per line)</FieldLabel>
            <Textarea
              id="sop-steps"
              value={values.steps}
              onChange={(e) => set("steps", e.target.value)}
              rows={8}
              className="font-mono text-xs"
              placeholder={"AM: Log the request as a Hub adjustment -> adjustment exists with the client's words\nPricing team: Apply the change in PriceLabs -> sync on"}
            />
            <FieldDescription>
              These become the checklist people tick and the numbered steps agents follow.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="sop-guardrails">
              Guardrails (one per line)
            </FieldLabel>
            <Textarea
              id="sop-guardrails"
              value={values.guardrails}
              onChange={(e) => set("guardrails", e.target.value)}
              rows={4}
              placeholder={"Never go below the owner minimum (payout after markups and discounts)"}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="sop-escalate">Escalate when</FieldLabel>
            <Textarea
              id="sop-escalate"
              value={values.escalate_when}
              onChange={(e) => set("escalate_when", e.target.value)}
              rows={2}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
            <Field>
              <FieldLabel htmlFor="sop-video">Video walkthrough link</FieldLabel>
              <Input
                id="sop-video"
                value={values.video_url}
                onChange={(e) => set("video_url", e.target.value)}
                placeholder="https://youtu.be/… (unlisted) or Loom"
              />
              <FieldDescription>
                YouTube, Loom, Vimeo or an MP4 link. Keep it under 5 minutes.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="sop-video-length">Length</FieldLabel>
              <Input
                id="sop-video-length"
                value={values.video_duration_sec}
                onChange={(e) => set("video_duration_sec", e.target.value)}
                placeholder="3:20"
              />
            </Field>
          </div>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
