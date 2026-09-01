-- Run in Supabase SQL editor

-- One row per goods purchase ("Charge") ordered in China.
CREATE TABLE IF NOT EXISTS inbounds (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_no                TEXT NOT NULL UNIQUE,
  order_date               DATE NOT NULL,
  shipping_mode            TEXT,              -- 'air' | 'truck' | 'train' | 'sea' | NULL
  weship_arrival_date      DATE,              -- actual arrival at the WeShip warehouse
  planned_weship_date_min  DATE,              -- planned band, carried over from the calculator
  planned_weship_date_max  DATE,
  production_invoice_path  TEXT,              -- object path in storage bucket 'inbound-invoices'
  shipping_invoice_path    TEXT,
  notes                    TEXT NOT NULL DEFAULT '',
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS inbounds_order_date_idx ON inbounds (order_date DESC);

-- Per-product positions of an inbound. Costs are the TOTAL for the position
-- (that is what an invoice states); per-unit is derived as total / quantity.
CREATE TABLE IF NOT EXISTS inbound_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inbound_id          UUID NOT NULL REFERENCES inbounds(id) ON DELETE CASCADE,
  product_id          TEXT NOT NULL,          -- matches ids in lib/costs-config.ts
  quantity            INTEGER       NOT NULL DEFAULT 0,
  production_cost_eur DECIMAL(12,2) NOT NULL DEFAULT 0,
  shipping_cost_eur   DECIMAL(12,2) NOT NULL DEFAULT 0,
  UNIQUE (inbound_id, product_id)
);

CREATE INDEX IF NOT EXISTS inbound_items_inbound_idx ON inbound_items (inbound_id);

-- Small key/value store for persisted app defaults. Currently holds the
-- inbound calculator config under key 'inbound_calc'. Can later also absorb
-- config/production-costs.json, which today lives in a storage bucket.
CREATE TABLE IF NOT EXISTS app_config (
  key        TEXT PRIMARY KEY,
  value      JSONB       NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Saved calculator scenarios. payload is the full calculator input state; kept
-- as JSONB because that shape is still moving.
CREATE TABLE IF NOT EXISTS inbound_scenarios (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT  NOT NULL,
  payload    JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS inbound_scenarios_created_idx ON inbound_scenarios (created_at DESC);
