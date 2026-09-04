-- Migration 092: persist listing map coordinates from PriceLabs reads.
--
-- Additive location columns for the read-only market-map export. This does
-- not write to PriceLabs, PMS, or OTA, does not enable event ingestion, and
-- does not change listing-market memberships or pricing.

-- ==========================================================
-- 1. Listing coordinate columns
-- ==========================================================

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS location_lat NUMERIC(9, 6),
  ADD COLUMN IF NOT EXISTS location_lon NUMERIC(9, 6),
  ADD COLUMN IF NOT EXISTS location_precision TEXT,
  ADD COLUMN IF NOT EXISTS location_source TEXT,
  ADD COLUMN IF NOT EXISTS location_observed_at TIMESTAMPTZ;

ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_location_lat_check,
  DROP CONSTRAINT IF EXISTS listings_location_lon_check,
  DROP CONSTRAINT IF EXISTS listings_location_precision_check,
  DROP CONSTRAINT IF EXISTS listings_location_source_check,
  DROP CONSTRAINT IF EXISTS listings_location_pair_check;

ALTER TABLE public.listings
  ADD CONSTRAINT listings_location_lat_check
    CHECK (location_lat IS NULL OR location_lat BETWEEN -90 AND 90),
  ADD CONSTRAINT listings_location_lon_check
    CHECK (location_lon IS NULL OR location_lon BETWEEN -180 AND 180),
  ADD CONSTRAINT listings_location_precision_check
    CHECK (
      location_precision IS NULL
      OR location_precision IN ('exact', 'approximate')
    ),
  ADD CONSTRAINT listings_location_source_check
    CHECK (
      location_source IS NULL
      OR location_source IN ('pricelabs', 'manual', 'geocoded')
    ),
  ADD CONSTRAINT listings_location_pair_check
    CHECK (
      (location_lat IS NULL AND location_lon IS NULL)
      OR (location_lat IS NOT NULL AND location_lon IS NOT NULL)
    );

CREATE INDEX IF NOT EXISTS idx_listings_location
  ON public.listings (location_lat, location_lon)
  WHERE location_lat IS NOT NULL AND location_lon IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_listings_location_source
  ON public.listings (location_source, location_observed_at)
  WHERE location_lat IS NOT NULL;
