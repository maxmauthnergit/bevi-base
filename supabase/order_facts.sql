-- Run in Supabase SQL editor. Creates what is missing; running it twice is a no-op.
--
-- order_facts: a slim snapshot of every Shopify order, kept in sync
-- incrementally (only orders changed since the last sync are fetched). Marketing
-- 2.0 needs the whole history — FIFO COGS depends on every earlier sale, and a
-- "new customer" is only recognisable against their earlier orders — and this
-- spares fetching it from Shopify on every page view.
--
-- Facts only, no derived COGS: FIFO is recomputed in memory on each request, so
-- adding an inbound or changing an arrival date never leaves stale costs here.
--
-- Privacy: guest emails are stored only as a SHA-256 hash (enough to recognise a
-- returning customer). RLS is on with no policies, so only the service-role key
-- used by the API routes can read the table.

CREATE TABLE IF NOT EXISTS order_facts (
  id             BIGINT PRIMARY KEY,          -- Shopify order id
  name           TEXT        NOT NULL,        -- "#1234", matches the WeShip invoice
  created_at     TIMESTAMPTZ NOT NULL,
  updated_at     TIMESTAMPTZ NOT NULL,        -- Shopify updated_at at sync time
  day            DATE        NOT NULL,        -- order day in the shop timezone
  customer_key   TEXT,                        -- 'c:<customer id>' or 'e:<sha256(email)>'
  revenue_order  BOOLEAN     NOT NULL,        -- not cancelled, not voided
  units          JSONB       NOT NULL DEFAULT '[]',   -- [{productId, quantity}], net of restocked returns
  unmapped_units INT         NOT NULL DEFAULT 0,
  lines          JSONB       NOT NULL DEFAULT '[]',   -- [{title, quantity}] for WeShip basket matching
  country        TEXT,
  net_sales      NUMERIC(12,2) NOT NULL DEFAULT 0,    -- excl. VAT
  shipping       NUMERIC(12,2) NOT NULL DEFAULT 0,    -- excl. VAT
  amount_paid    NUMERIC(12,2) NOT NULL DEFAULT 0,    -- total_price − successful refunds
  synced_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS order_facts_created_at_idx ON order_facts (created_at);

ALTER TABLE order_facts ENABLE ROW LEVEL SECURITY;

-- The sync cursor lives in app_config (created by inbounds.sql) under the key
-- 'order_facts_sync'. Create the table here too in case that script never ran.
CREATE TABLE IF NOT EXISTS app_config (
  key        TEXT PRIMARY KEY,
  value      JSONB       NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
