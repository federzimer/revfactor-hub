import { createAdminClient } from "@/lib/supabase/admin"
import {
  buildMarketMapPoint,
  buildMarketMapResponse,
  pickMembership,
  type ListingMembership,
  type MarketMapPoint,
  type MarketMapResponse,
} from "@/lib/market-map"

const LISTING_COLUMNS = [
  "id",
  "city",
  "state",
  "location_lat",
  "location_lon",
  "location_precision",
  "location_source",
  "location_observed_at",
].join(", ")

const MEMBERSHIP_COLUMNS_FULL =
  "listing_id, membership_status, assignment_source, relationship_type, locality_id, revenue_markets(name, status), revenue_market_localities(name, status)"

const MEMBERSHIP_COLUMNS_BASE =
  "listing_id, membership_status, assignment_source, revenue_markets(name, status)"

const UNAVAILABLE_CODES = new Set(["42P01", "42703", "PGRST204", "PGRST205"])

type ListingRow = {
  id: string
  city: string | null
  state: string | null
  location_lat: number | string | null
  location_lon: number | string | null
  location_precision: string | null
  location_source: string | null
  location_observed_at: string | null
}

type NamedStatus = { name?: string | null; status?: string | null } | null

type MembershipRow = {
  listing_id: string
  membership_status: string | null
  assignment_source?: string | null
  relationship_type?: string | null
  locality_id?: string | null
  revenue_markets?: NamedStatus | NamedStatus[]
  revenue_market_localities?: NamedStatus | NamedStatus[]
}

function isUnavailable(error: { code?: string; message: string } | null) {
  if (!error) return false
  return (
    UNAVAILABLE_CODES.has(error.code ?? "") ||
    /does not exist|schema cache|could not find/i.test(error.message)
  )
}

function namedStatus(value: NamedStatus | NamedStatus[] | undefined): {
  name: string | null
  status: string | null
} {
  const row = Array.isArray(value) ? value[0] : value
  if (!row || typeof row !== "object") {
    return { name: null, status: null }
  }
  return {
    name: typeof row.name === "string" ? row.name : null,
    status: typeof row.status === "string" ? row.status : null,
  }
}

function asMembership(row: MembershipRow): ListingMembership {
  const market = namedStatus(row.revenue_markets)
  const locality = namedStatus(row.revenue_market_localities)
  return {
    listingId: row.listing_id,
    membershipStatus: row.membership_status,
    relationshipType: row.relationship_type ?? null,
    assignmentSource: row.assignment_source ?? null,
    marketName: market.name,
    marketStatus: market.status,
    localityName: locality.name,
    localityStatus: locality.status,
  }
}

async function loadMemberships(
  listingIds: string[]
): Promise<Map<string, ListingMembership[]>> {
  const grouped = new Map<string, ListingMembership[]>()
  if (listingIds.length === 0) return grouped

  const supabase = createAdminClient()
  const full = await supabase
    .from("revenue_market_listings")
    .select(MEMBERSHIP_COLUMNS_FULL)
    .in("listing_id", listingIds)

  const base = isUnavailable(full.error)
    ? await supabase
        .from("revenue_market_listings")
        .select(MEMBERSHIP_COLUMNS_BASE)
        .in("listing_id", listingIds)
    : full

  if (base.error) {
    if (isUnavailable(base.error)) return grouped
    throw new Error(
      `Market map memberships could not be read: ${base.error.message}`
    )
  }

  for (const row of (base.data ?? []) as unknown as MembershipRow[]) {
    const membership = asMembership(row)
    const current = grouped.get(membership.listingId) ?? []
    current.push(membership)
    grouped.set(membership.listingId, current)
  }
  return grouped
}

export async function loadMarketMapExport(
  generatedAt = new Date().toISOString()
): Promise<MarketMapResponse> {
  const supabase = createAdminClient()
  const listingsResult = await supabase
    .from("listings")
    .select(LISTING_COLUMNS)
    .eq("status", "active")

  if (listingsResult.error) {
    if (isUnavailable(listingsResult.error)) {
      return buildMarketMapResponse([], generatedAt)
    }
    throw new Error(
      `Market map listings could not be read: ${listingsResult.error.message}`
    )
  }

  const listings = (listingsResult.data ?? []) as unknown as ListingRow[]
  const memberships = await loadMemberships(listings.map((row) => row.id))
  const points: MarketMapPoint[] = []

  for (const listing of listings) {
    const membership = pickMembership(memberships.get(listing.id) ?? [])
    const point = buildMarketMapPoint({
      listingId: listing.id,
      city: listing.city,
      state: listing.state,
      latitude: listing.location_lat,
      longitude: listing.location_lon,
      locationPrecision: listing.location_precision,
      locationSource: listing.location_source,
      locationObservedAt: listing.location_observed_at,
      marketName: membership?.marketName,
      marketStatus: membership?.marketStatus,
      localityName: membership?.localityName,
      localityStatus: membership?.localityStatus,
      membershipStatus: membership?.membershipStatus,
      assignmentSource: membership?.assignmentSource,
    })
    if (point) points.push(point)
  }

  points.sort((left, right) => left.map_key.localeCompare(right.map_key))
  return buildMarketMapResponse(points, generatedAt)
}
