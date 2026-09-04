# Market Map export

Read-only Hub feed used by the internal geography map to validate market
boundaries and listing assignments.

`GET /api/market-map` never writes to Supabase, PriceLabs, PMS, or OTA. It
does not activate markets, reassign listings, change pricing, enable event
ingestion, or run cron jobs.

## Auth

- Requires an authenticated Hub session.
- Returns **401** when there is no session.
- Returns **403** when the session lacks `market_signals:view`.
- After the permission check, listings are read through the admin client with
  an explicit column projection. That projection is the security boundary:
  guest data, client names, street addresses, Airbnb URLs, and Hub / PMS /
  Airbnb listing IDs are never selected.

## Response

```json
{
  "version": 1,
  "generated_at": "2026-09-04T00:00:00.000Z",
  "read_only": true,
  "points": [
    {
      "map_key": "opaque-key",
      "city": "Gatlinburg",
      "state": "TN",
      "country": "US",
      "latitude": 35.7143,
      "longitude": -83.5103,
      "location_precision": "exact",
      "location_source": "pricelabs",
      "location_observed_at": "2026-09-01T00:00:00.000Z",
      "market": { "name": "Smoky Mountains", "status": "active" },
      "locality": { "name": "Gatlinburg", "status": "active" },
      "assignment_confidence": "reviewed"
    }
  ]
}
```

- `map_key` is an opaque SHA-256 prefix of the Hub listing UUID. It is stable
  and is not a listing ID.
- Points without city, state, or coordinates are omitted.
- Listings without an approved or proposed market membership are unmapped
  (`market` is `null`, `assignment_confidence` is `unmapped`).
- Locality is included only when the optional foundation locality join is
  available. Missing locality tables do not fail the feed.

## Coordinates

Migration `092_listing_location_coordinates.sql` adds nullable
`location_lat` / `location_lon` / `location_precision` / `location_source` /
`location_observed_at` on `listings`.

The existing PriceLabs inventory sync (`lib/pricelabs-sync.ts`) copies
latitude and longitude from the PriceLabs listing read onto those columns
when both values are valid. It does **not** push prices, stay rules, or
calendar changes to PriceLabs.

Until the migration is applied and a sync has stored coordinates, this route
returns an empty `points` array so the map can keep using its geography atlas.

## Out of scope

- Event ingestion (`PREDICTHQ_INGESTION_ENABLED`, `CFBD_INGESTION_ENABLED`,
  `UNIVERSITY_PAGE_INGESTION_ENABLED`) stays unchanged and disabled-by-default.
- No PriceLabs / PMS / OTA writes.
- No market activation, listing reassignment, or membership edits.
- No new cron.
