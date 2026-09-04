import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import {
  assignmentConfidence,
  buildMarketMapPoint,
  buildMarketMapResponse,
  forbiddenFieldNames,
  opaqueMapKey,
  pickMembership,
} from "@/lib/market-map"
import { locationFieldsFromPriceLabs } from "@/lib/pricelabs-sync"
import type { PriceLabsListing } from "@/lib/pricelabs"

const LISTING_ID = "2f1c0b6e-4a9d-4c1f-9b77-0a1d2c3b4e5f"

function listing(overrides: Partial<PriceLabsListing> = {}): PriceLabsListing {
  return {
    id: "pl-1",
    pms: "airbnb",
    name: "Hidden Cabin",
    latitude: 35.7143,
    longitude: -83.5103,
    country: "United States",
    city_name: "Gatlinburg",
    state: "TN",
    no_of_bedrooms: 3,
    cleaning_fees: 150,
    channel_listing_details: [],
    min: 120,
    base: 180,
    max: 400,
    group: "Smokies",
    subgroup: "",
    tags: "",
    notes: null,
    isHidden: false,
    push_enabled: true,
    occupancy_next_7: "40 %",
    market_occupancy_next_7: "55 %",
    adjusted_occupancy_next_30: "60 %",
    market_adjusted_occupancy_next_30: "62 %",
    adjusted_occupancy_next_90: "50 %",
    market_adjusted_occupancy_next_90: "51 %",
    recommended_base_price: 190,
    last_date_pushed: null,
    last_refreshed_at: "2026-09-01T00:00:00.000Z",
    mpi_next_30: 1.1,
    mpi_next_60: 1.0,
    last_booked_date: "2026-08-20",
    weekend_adjusted_occupancy_next_30: "70 %",
    market_weekend_adjusted_occupancy_next_30: "68 %",
    ...overrides,
  }
}

describe("opaque map keys", () => {
  it("is stable, hex, and not the listing UUID", () => {
    const key = opaqueMapKey(LISTING_ID)
    expect(key).toBe(opaqueMapKey(LISTING_ID))
    expect(key).toMatch(/^[a-f0-9]{32}$/)
    expect(key).not.toContain(LISTING_ID)
    expect(key).not.toBe(LISTING_ID.replaceAll("-", ""))
  })
})

describe("market map points", () => {
  it("redacts listing identity and emits the contract shape", () => {
    const point = buildMarketMapPoint({
      listingId: LISTING_ID,
      city: "Gatlinburg",
      state: "tn",
      latitude: "35.7143",
      longitude: -83.5103,
      locationPrecision: "exact",
      locationSource: "pricelabs",
      locationObservedAt: "2026-09-01T00:00:00.000Z",
      marketName: "Smoky Mountains",
      marketStatus: "active",
      localityName: "Gatlinburg",
      localityStatus: "active",
      membershipStatus: "approved",
      assignmentSource: "manual",
    })

    expect(point).toMatchObject({
      map_key: opaqueMapKey(LISTING_ID),
      city: "Gatlinburg",
      state: "TN",
      country: "US",
      latitude: 35.7143,
      longitude: -83.5103,
      location_precision: "exact",
      location_source: "pricelabs",
      market: { name: "Smoky Mountains", status: "active" },
      locality: { name: "Gatlinburg", status: "active" },
      assignment_confidence: "reviewed",
    })
    expect(JSON.stringify(point)).not.toContain(LISTING_ID)
    expect(forbiddenFieldNames(point)).toEqual([])
  })

  it("omits points without city, state, or coordinates", () => {
    expect(
      buildMarketMapPoint({
        listingId: LISTING_ID,
        city: null,
        state: "TN",
        latitude: 35.7,
        longitude: -83.5,
      })
    ).toBeNull()
    expect(
      buildMarketMapPoint({
        listingId: LISTING_ID,
        city: "Gatlinburg",
        state: "TN",
        latitude: null,
        longitude: -83.5,
      })
    ).toBeNull()
  })

  it("treats listings without membership as unmapped", () => {
    const point = buildMarketMapPoint({
      listingId: LISTING_ID,
      city: "Knoxville",
      state: "TN",
      latitude: 35.96,
      longitude: -83.92,
    })
    expect(point?.market).toBeNull()
    expect(point?.assignment_confidence).toBe("unmapped")
  })

  it("prefers an approved primary membership", () => {
    const picked = pickMembership([
      {
        listingId: LISTING_ID,
        membershipStatus: "proposed",
        marketName: "Draft Market",
      },
      {
        listingId: LISTING_ID,
        membershipStatus: "approved",
        relationshipType: "secondary",
        marketName: "Secondary",
      },
      {
        listingId: LISTING_ID,
        membershipStatus: "approved",
        relationshipType: "primary",
        marketName: "Smoky Mountains",
        assignmentSource: "manual",
      },
    ])
    expect(picked?.marketName).toBe("Smoky Mountains")
    expect(assignmentConfidence(picked ?? {})).toBe("reviewed")
  })
})

describe("PriceLabs location copy", () => {
  it("copies valid coordinates without touching PriceLabs write fields", () => {
    const fields = locationFieldsFromPriceLabs(
      listing(),
      "2026-09-04T00:00:00.000Z"
    )
    expect(fields).toEqual({
      location_lat: 35.7143,
      location_lon: -83.5103,
      location_precision: "exact",
      location_source: "pricelabs",
      location_observed_at: "2026-09-04T00:00:00.000Z",
    })
    expect(fields).not.toHaveProperty("pl_base_price")
  })

  it("skips invalid or zeroed coordinates so existing Hub values remain", () => {
    expect(
      locationFieldsFromPriceLabs(listing({ latitude: 0, longitude: 0 }), "now")
    ).toEqual({})
    expect(
      locationFieldsFromPriceLabs(
        listing({ latitude: 999, longitude: -83 }),
        "now"
      )
    ).toEqual({})
  })
})

describe("market map payload contract", () => {
  it("is versioned, read-only, and free of forbidden keys", () => {
    const point = buildMarketMapPoint({
      listingId: LISTING_ID,
      city: "Park City",
      state: "UT",
      latitude: 40.6461,
      longitude: -111.498,
      locationPrecision: "exact",
      locationSource: "pricelabs",
    })
    const payload = buildMarketMapResponse(
      point ? [point] : [],
      "2026-09-04T00:00:00.000Z"
    )
    expect(payload).toMatchObject({
      version: 1,
      generated_at: "2026-09-04T00:00:00.000Z",
      read_only: true,
    })
    expect(forbiddenFieldNames(payload)).toEqual([])
  })
})

describe("market map route stays a read-only export", () => {
  const files = [
    "app/api/market-map/route.ts",
    "lib/market-map.ts",
    "lib/market-map.server.ts",
  ].map((file) => ({
    file,
    content: readFileSync(path.join(process.cwd(), file), "utf8"),
  }))

  it("does not write Supabase or enable ingestion / pricing providers", () => {
    const forbidden = [
      ".insert(",
      ".upsert(",
      ".delete(",
      "PREDICTHQ_INGESTION_ENABLED",
      "CFBD_INGESTION_ENABLED",
      "UNIVERSITY_PAGE_INGESTION_ENABLED",
      "PRICELABS_API_KEY",
      "fetchPriceLabsListings",
    ]
    for (const { file, content } of files) {
      for (const token of forbidden) {
        expect(content, `${file} must not contain ${token}`).not.toContain(
          token
        )
      }
      expect(content, `${file} must not write listings`).not.toMatch(
        /from\(["']listings["']\)[\s\S]{0,200}\.update\(/
      )
    }
  })

  it("gates the route on a session and market_signals:view", () => {
    const route = files.find((item) => item.file.endsWith("route.ts"))!.content
    expect(route).toContain('hasPermission("market_signals", "view")')
    expect(route).toContain("status: 401")
    expect(route).toContain("status: 403")
    expect(route).toContain("export async function GET")
    expect(route).not.toContain("export async function POST")
  })
})
