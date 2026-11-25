import { describe, expect, it } from "vitest"
import {
  linesToList,
  normalizeSop,
  parseDuration,
  parseSopForm,
  parseStep,
  renderSopMarkdown,
  sopReadinessGaps,
  videoEmbed,
  type SopFormValues,
} from "@/lib/knowledge-sop"

const blankForm: SopFormValues = {
  sop_code: "",
  trigger_text: "",
  runs_role: "am",
  backup_role: "",
  owner_label: "",
  approval_class: "none",
  hub_record: "",
  proof: "",
  agent_mode: "human_only",
  inputs: "",
  steps: "",
  guardrails: "",
  escalate_when: "",
  video_url: "",
  video_duration_sec: "",
}

describe("parseStep", () => {
  it("splits actor, action and check", () => {
    expect(parseStep("AM: Open the Hub adjustment -> status is resolved", 1)).toEqual({
      n: 1,
      actor: "AM",
      action: "Open the Hub adjustment",
      check: "status is resolved",
    })
  })

  it("keeps a sentence with a late colon as the action", () => {
    const s = parseStep("Check the three numbers that matter most today: pace, pickup and ADR", 2)
    expect(s.actor).toBeNull()
    expect(s.action).toContain("today: pace")
  })

  it("accepts the unicode arrow", () => {
    expect(parseStep("Pricing team: Apply the change → live in PriceLabs", 3).check).toBe(
      "live in PriceLabs"
    )
  })
})

describe("linesToList", () => {
  it("drops blanks and bullets", () => {
    expect(linesToList("- one\n\n2. two\n* three\n")).toEqual(["one", "two", "three"])
  })
})

describe("parseDuration", () => {
  it("reads m:ss and seconds", () => {
    expect(parseDuration("3:20")).toBe(200)
    expect(parseDuration("45")).toBe(45)
    expect(parseDuration("3:75")).toBeNull()
    expect(parseDuration("0")).toBeNull()
  })
})

describe("parseSopForm", () => {
  it("rejects a bad code and a non-https video", () => {
    expect(parseSopForm({ ...blankForm, sop_code: "rm1" }).ok).toBe(false)
    expect(parseSopForm({ ...blankForm, video_url: "http://youtu.be/x" }).ok).toBe(false)
  })

  it("normalises input", () => {
    const r = parseSopForm({
      ...blankForm,
      sop_code: "dp-02",
      runs_role: "nope",
      approval_class: "B",
      steps: "AM: one\nAM: two",
      video_duration_sec: "2:05",
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row.sop_code).toBe("DP-02")
    expect(r.row.runs_role).toBe("am")
    expect(r.row.approval_class).toBe("B")
    expect(r.row.steps).toEqual(["AM: one", "AM: two"])
    expect(r.row.video_duration_sec).toBe(125)
  })
})

describe("videoEmbed", () => {
  it("handles YouTube, Loom, Vimeo and MP4", () => {
    expect(videoEmbed("https://youtu.be/IIquZ6M7SLk")?.src).toBe(
      "https://www.youtube-nocookie.com/embed/IIquZ6M7SLk"
    )
    expect(videoEmbed("https://www.youtube.com/watch?v=abc123&t=4")?.src).toBe(
      "https://www.youtube-nocookie.com/embed/abc123"
    )
    expect(videoEmbed("https://www.loom.com/share/0f1e2d3c")?.src).toBe(
      "https://www.loom.com/embed/0f1e2d3c"
    )
    expect(videoEmbed("https://vimeo.com/12345")?.src).toBe(
      "https://player.vimeo.com/video/12345"
    )
    expect(videoEmbed("https://x.supabase.co/storage/v1/object/public/a/b.mp4")?.kind).toBe(
      "video"
    )
    expect(videoEmbed("https://example.com/page")).toBeNull()
    expect(videoEmbed("javascript:alert(1)")).toBeNull()
  })
})

describe("renderSopMarkdown", () => {
  it("writes front matter and numbered steps", () => {
    const sop = normalizeSop(
      {
        sop_code: "DP-02",
        trigger_text: "A client asks for a pricing change",
        runs_role: "am",
        backup_role: "am",
        owner_label: "Gaston",
        approval_class: "C",
        hub_record: "Adjustment",
        proof: "Live in PriceLabs",
        agent_mode: "agent_assist",
        inputs: ["Client message"],
        steps: ["AM: Log the adjustment -> row exists", "Pricing team: Apply"],
        guardrails: ['Never promise a "booking"'],
        escalate_when: "Owner disputes",
        video_url: "https://youtu.be/x",
      },
      "a1"
    )
    const md = renderSopMarkdown(
      {
        title: "Change, request to proof",
        slug: "change-request-to-proof",
        status: "published",
        updated_at: "2026-11-25T00:00:00Z",
        category_name: "Daily Performance & Adjustments",
        content_html: "<p>Why this exists.</p>",
        version: 3,
      },
      sop
    )
    expect(md.startsWith("---\nsop_code: \"DP-02\"")).toBe(true)
    expect(md).toContain("version: 3")
    expect(md).toContain('  - "Never promise a \\"booking\\""')
    expect(md).toContain("1. **AM:** Log the adjustment → check: row exists")
    expect(md).toContain("2. **Pricing team:** Apply")
    expect(md).toContain("## Notes\n\nWhy this exists.")
  })
})

describe("sopReadinessGaps", () => {
  it("lists what is missing", () => {
    const gaps = sopReadinessGaps(normalizeSop(null, "a1"))
    expect(gaps).toContain("trigger")
    expect(gaps).toContain("proof that closes it")
    expect(gaps).toContain("video walkthrough")
  })
})
