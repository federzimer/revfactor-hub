import { createHash } from "node:crypto"

export const MARKET_MAP_VERSION = 1 as const

const FORBIDDEN_KEY =
  /^(guest|client|owner|customer|address|street|airbnb|listing|email|phone|url|pms)/i

export type MarketMapPrecision = "exact" | "approximate"
export type MarketMapMarketStatus = "active" | "approved_draft"

export type MarketMapPointInput = {
  listingId: string
  city: string | null
  state: string | null
  country?: string | null
  latitude: number | string | null
  longitude: number | string | null
  locationPrecision?: string | null
  locationSource?: string | null
  locationObservedAt?: string | null
  marketName?: string | null
  marketStatus?: string | null
  localityName?: string | null
  localityStatus?: string | null
  membershipStatus?: string | null
  assignmentSource?: string | null
}

export type MarketMapPoint = {
  map_key: string
  city: string
  state: string
  country: string
  latitude: number
  longitude: number
  location_precision: MarketMapPrecision
  location_source: string | null
  location_observed_at: string | null
  market: { name: string; status: MarketMapMarketStatus } | null
  locality: { name: string; status: string } | null
  assignment_confidence: string
}

export type MarketMapResponse = {
  version: typeof MARKET_MAP_VERSION
  generated_at: string
  read_only: true
  points: MarketMapPoint[]
}

export type ListingMembership = {
  listingId: string
  membershipStatus: string | null
  relationshipType?: string | null
  assignmentSource?: string | null
  marketName?: string | null
  marketStatus?: string | null
  localityName?: string | null
  localityStatus?: string | null
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export function opaqueMapKey(listingId: string): string {
  return createHash("sha256")
    .update(`rfmap:${listingId}`)
    .digest("hex")
    .slice(0, 32)
}

export function parseCoordinate(
  value: unknown,
  kind: "lat" | "lon"
): number | null {
  const parsed = asNumber(value)
  if (parsed === null) return null
  if (kind === "lat" && (parsed < -90 || parsed > 90)) return null
  if (kind === "lon" && (parsed < -180 || parsed > 180)) return null
  return parsed
}

export function asMapPrecision(value: unknown): MarketMapPrecision {
  const raw = asString(value)?.toLowerCase() ?? ""
  if (raw === "exact" || raw === "coordinate_exact" || raw === "precise") {
    return "exact"
  }
  return "approximate"
}

export function asMapMarketStatus(
  value: unknown
): MarketMapMarketStatus | null {
  const raw = asString(value)?.toLowerCase()
  if (!raw) return null
  if (raw === "active") return "active"
  return "approved_draft"
}

export function assignmentConfidence(input: {
  membershipStatus?: string | null
  assignmentSource?: string | null
}): string {
  const status = asString(input.membershipStatus)?.toLowerCase()
  if (status === "approved") return "reviewed"
  if (status === "proposed") return "draft"
  const source = asString(input.assignmentSource)?.toLowerCase()
  if (source === "manual") return "reviewed"
  if (source) return source
  return "unknown"
}

export function pickMembership(
  rows: ListingMembership[]
): ListingMembership | null {
  if (rows.length === 0) return null
  const approved = rows.filter(
    (row) => row.membershipStatus?.toLowerCase() === "approved"
  )
  const proposed = rows.filter(
    (row) => row.membershipStatus?.toLowerCase() === "proposed"
  )
  const ranked = approved.length > 0 ? approved : proposed
  const primary = ranked.find(
    (row) => row.relationshipType?.toLowerCase() === "primary"
  )
  return primary ?? ranked[0] ?? null
}

function collectKeys(value: unknown, keys: string[]): void {
  if (!value || typeof value !== "object") return
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, keys)
    return
  }
  for (const [key, nested] of Object.entries(value)) {
    keys.push(key)
    collectKeys(nested, keys)
  }
}

export function forbiddenFieldNames(payload: unknown): string[] {
  const keys: string[] = []
  collectKeys(payload, keys)
  return keys.filter((key) => FORBIDDEN_KEY.test(key)).sort()
}

export function buildMarketMapPoint(
  input: MarketMapPointInput
): MarketMapPoint | null {
  const city = asString(input.city)
  const state = asString(input.state)?.toUpperCase() ?? null
  const latitude = parseCoordinate(input.latitude, "lat")
  const longitude = parseCoordinate(input.longitude, "lon")
  if (!city || !state || latitude === null || longitude === null) return null
  if (latitude === 0 && longitude === 0) return null

  const membershipStatus = asString(input.membershipStatus)
  const hasMarket =
    Boolean(asString(input.marketName)) && membershipStatus !== "excluded"
  const marketName = hasMarket ? asString(input.marketName) : null
  const localityName = hasMarket ? asString(input.localityName) : null

  return {
    map_key: opaqueMapKey(input.listingId),
    city,
    state,
    country: asString(input.country)?.toUpperCase() ?? "US",
    latitude,
    longitude,
    location_precision: asMapPrecision(input.locationPrecision),
    location_source: asString(input.locationSource),
    location_observed_at: asString(input.locationObservedAt),
    market: marketName
      ? {
          name: marketName,
          status: asMapMarketStatus(input.marketStatus) ?? "approved_draft",
        }
      : null,
    locality: localityName
      ? {
          name: localityName,
          status: asString(input.localityStatus) ?? "active",
        }
      : null,
    assignment_confidence: hasMarket
      ? assignmentConfidence({
          membershipStatus: input.membershipStatus,
          assignmentSource: input.assignmentSource,
        })
      : "unmapped",
  }
}

export function buildMarketMapResponse(
  points: MarketMapPoint[],
  generatedAt = new Date().toISOString()
): MarketMapResponse {
  const payload: MarketMapResponse = {
    version: MARKET_MAP_VERSION,
    generated_at: generatedAt,
    read_only: true,
    points,
  }
  const forbidden = forbiddenFieldNames(payload)
  if (forbidden.length > 0) {
    throw new Error(
      `Market map payload contained forbidden fields: ${forbidden.join(", ")}`
    )
  }
  return payload
}
