-- Run in Supabase SQL editor. This is the ONLY inbounds script — it builds the
-- whole schema in one go and is safe to re-run, whatever state the database is
-- in right now (nothing, a half-built version, or the finished one).
--
-- It DROPS and recreates the inbound tables, so any charges already entered are
-- lost. That is intended at this stage: the data so far is test data.
-- app_config and inbound_scenarios are left alone — they hold the inbound
-- calculator's saved defaults and scenarios.
--
-- Model: a charge splits into shipments. Part of an order travels by air and the
-- rest by train, so the mode, the freight cost and the arrival dates belong to a
-- shipment — not to the charge and not to the product.
--
-- Currency: suppliers invoice in USD. Amounts are entered in USD and converted
-- with the rate of the day that part was actually paid — production at ordering,
-- freight weeks later — so each carries its own rate. The converted EUR amount
-- is stored beside the USD one rather than derived on read, otherwise editing a
-- rate would retroactively change an old charge.

DROP TABLE IF EXISTS inbound_invoices       CASCADE;
DROP TABLE IF EXISTS inbound_shipment_items CASCADE;
DROP TABLE IF EXISTS inbound_shipments      CASCADE;
DROP TABLE IF EXISTS inbound_items          CASCADE;
DROP TABLE IF EXISTS inbounds               CASCADE;

-- ─── Partners ────────────────────────────────────────────────────────────────
-- Suppliers and forwarders. One company can be both — Quanzhou Pengxin Bags
-- manufactures and also ships — hence two flags rather than a single kind.

CREATE TABLE IF NOT EXISTS partners (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT    NOT NULL UNIQUE,
  is_supplier BOOLEAN NOT NULL DEFAULT FALSE,
  is_shipping BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Roles follow lib/costs-config.ts: the three below only manufacture.
INSERT INTO partners (name, is_supplier, is_shipping) VALUES
  ('Quanzhou Pengxin Bags', TRUE,  TRUE),
  ('Shenzhen Amanda',       FALSE, TRUE),
  ('Dongguan Webbing',      TRUE,  FALSE),
  ('Langhai Printing',      TRUE,  FALSE),
  ('Licheng Plastic',       TRUE,  FALSE)
ON CONFLICT (name) DO NOTHING;

-- ─── Charge ──────────────────────────────────────────────────────────────────

CREATE TABLE inbounds (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  charge     TEXT NOT NULL UNIQUE,
  order_date DATE NOT NULL,
  -- One rate for the whole production section: it is paid in one go at ordering.
  production_fx_usd_eur DECIMAL(12,6),
  production_fx_date    DATE,
  notes      TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS inbounds_order_date_idx ON inbounds (order_date DESC);

-- ─── Production positions ────────────────────────────────────────────────────
-- Costs are the TOTAL for the position (that is what an invoice states);
-- per-unit is derived as total / quantity.

CREATE TABLE inbound_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inbound_id          UUID NOT NULL REFERENCES inbounds(id) ON DELETE CASCADE,
  product_id          TEXT NOT NULL,          -- matches ids in lib/costs-config.ts
  quantity            INTEGER       NOT NULL DEFAULT 0,
  production_cost_usd DECIMAL(12,2) NOT NULL DEFAULT 0,   -- EXW, as invoiced
  production_cost_eur DECIMAL(12,2) NOT NULL DEFAULT 0,   -- usd × production rate
  supplier_id         UUID REFERENCES partners(id) ON DELETE SET NULL,
  position            INTEGER NOT NULL DEFAULT 0,
  UNIQUE (inbound_id, product_id)
);

CREATE INDEX IF NOT EXISTS inbound_items_inbound_idx ON inbound_items (inbound_id);

-- ─── Shipments ───────────────────────────────────────────────────────────────
-- Arrival dates live here because two shipments of the same charge land weeks
-- apart; the charge shows the span across them.

CREATE TABLE inbound_shipments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inbound_id          UUID NOT NULL REFERENCES inbounds(id) ON DELETE CASCADE,
  mode                TEXT NOT NULL,          -- 'air' | 'truck' | 'train' | 'sea'
  shipping_company_id UUID REFERENCES partners(id) ON DELETE SET NULL,
  cost_usd            DECIMAL(12,2) NOT NULL DEFAULT 0,
  cost_eur            DECIMAL(12,2) NOT NULL DEFAULT 0,   -- usd × this leg's rate
  fx_usd_eur          DECIMAL(12,6),
  fx_date             DATE,
  planned_arrival     DATE,
  actual_arrival      DATE,
  position            INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS inbound_shipments_inbound_idx ON inbound_shipments (inbound_id);

-- How much of each product travels on this shipment.
CREATE TABLE inbound_shipment_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES inbound_shipments(id) ON DELETE CASCADE,
  product_id  TEXT NOT NULL,
  quantity    INTEGER NOT NULL DEFAULT 0,
  UNIQUE (shipment_id, product_id)
);

CREATE INDEX IF NOT EXISTS inbound_shipment_items_shipment_idx
  ON inbound_shipment_items (shipment_id);

-- ─── Invoices ────────────────────────────────────────────────────────────────
-- shipment_id NULL means the invoice belongs to production; otherwise it belongs
-- to that shipment. Files live in the private storage bucket 'inbound-invoices',
-- which the app creates on the first upload.

CREATE TABLE inbound_invoices (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inbound_id   UUID NOT NULL REFERENCES inbounds(id) ON DELETE CASCADE,
  shipment_id  UUID REFERENCES inbound_shipments(id) ON DELETE CASCADE,
  path         TEXT NOT NULL,
  filename     TEXT NOT NULL,
  content_type TEXT,
  size_bytes   BIGINT,
  uploaded_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS inbound_invoices_inbound_idx ON inbound_invoices (inbound_id);

-- ─── Calculator storage (kept across re-runs) ────────────────────────────────

-- Key/value store for persisted app defaults; holds the inbound calculator
-- config under key 'inbound_calc'.
CREATE TABLE IF NOT EXISTS app_config (
  key        TEXT PRIMARY KEY,
  value      JSONB       NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Saved calculator scenarios. payload is the full calculator input state, kept
-- as JSONB because that shape is still moving.
CREATE TABLE IF NOT EXISTS inbound_scenarios (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT  NOT NULL,
  payload    JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS inbound_scenarios_created_idx ON inbound_scenarios (created_at DESC);

-- PostgREST caches which tables and foreign keys exist and does not always pick
-- up new ones on its own. Without this, the app can still fail with "Could not
-- find a relationship between 'inbounds' and 'inbound_shipments' in the schema
-- cache" even though the tables are now there.
NOTIFY pgrst, 'reload schema';
