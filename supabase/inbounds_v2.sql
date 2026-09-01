-- Run in Supabase SQL editor
--
-- Replaces the first inbounds schema (supabase/inbounds.sql). A charge is now
-- split into shipments: part of an order travels by air, the rest by train, so
-- the shipping mode and the freight cost belong to a shipment, not to the
-- charge or the product.
--
-- Only test data existed, so the old tables are dropped rather than migrated.
-- app_config and inbound_scenarios from the first script stay as they are.

DROP TABLE IF EXISTS inbound_items CASCADE;
DROP TABLE IF EXISTS inbounds      CASCADE;

-- Suppliers and forwarders. One company can be both — Quanzhou Pengxin Bags
-- manufactures and also ships — hence two flags rather than a single kind.
CREATE TABLE IF NOT EXISTS partners (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT    NOT NULL UNIQUE,
  is_supplier BOOLEAN NOT NULL DEFAULT FALSE,
  is_shipping BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO partners (name, is_supplier, is_shipping) VALUES
  ('Quanzhou Pengxin Bags', TRUE,  TRUE),
  ('Shenzhen Amanda',       FALSE, TRUE)
ON CONFLICT (name) DO NOTHING;

-- One row per goods purchase ("Charge").
CREATE TABLE IF NOT EXISTS inbounds (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  charge     TEXT NOT NULL UNIQUE,
  order_date DATE NOT NULL,
  notes      TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS inbounds_order_date_idx ON inbounds (order_date DESC);

-- Production positions. The cost is the TOTAL for the position (EXW), which is
-- what the invoice states; per-unit is derived as total / quantity.
CREATE TABLE IF NOT EXISTS inbound_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inbound_id          UUID NOT NULL REFERENCES inbounds(id) ON DELETE CASCADE,
  product_id          TEXT NOT NULL,          -- matches ids in lib/costs-config.ts
  quantity            INTEGER       NOT NULL DEFAULT 0,
  production_cost_eur DECIMAL(12,2) NOT NULL DEFAULT 0,
  supplier_id         UUID REFERENCES partners(id) ON DELETE SET NULL,
  position            INTEGER NOT NULL DEFAULT 0,
  UNIQUE (inbound_id, product_id)
);

CREATE INDEX IF NOT EXISTS inbound_items_inbound_idx ON inbound_items (inbound_id);

-- One leg of a charge. Arrival dates live here because two shipments of the
-- same charge land weeks apart; the charge shows the span across them.
CREATE TABLE IF NOT EXISTS inbound_shipments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inbound_id          UUID NOT NULL REFERENCES inbounds(id) ON DELETE CASCADE,
  mode                TEXT NOT NULL,          -- 'air' | 'truck' | 'train' | 'sea'
  shipping_company_id UUID REFERENCES partners(id) ON DELETE SET NULL,
  cost_eur            DECIMAL(12,2) NOT NULL DEFAULT 0,
  planned_arrival     DATE,
  actual_arrival      DATE,
  position            INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS inbound_shipments_inbound_idx ON inbound_shipments (inbound_id);

-- How much of each product travels on this shipment.
CREATE TABLE IF NOT EXISTS inbound_shipment_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES inbound_shipments(id) ON DELETE CASCADE,
  product_id  TEXT NOT NULL,
  quantity    INTEGER NOT NULL DEFAULT 0,
  UNIQUE (shipment_id, product_id)
);

CREATE INDEX IF NOT EXISTS inbound_shipment_items_shipment_idx
  ON inbound_shipment_items (shipment_id);

-- Uploaded invoices. shipment_id NULL means the invoice belongs to production;
-- otherwise it belongs to that shipment. Files live in the private storage
-- bucket 'inbound-invoices'.
CREATE TABLE IF NOT EXISTS inbound_invoices (
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
