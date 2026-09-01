-- Run in Supabase SQL editor
--
-- Suppliers invoice in USD, so amounts are entered in USD and converted with
-- the rate that applied when that part was actually paid. Production is paid at
-- ordering, freight weeks later, so each carries its own rate and rate date.
--
-- The converted EUR amount is stored alongside the USD one rather than derived
-- on read: otherwise editing a rate would retroactively change a two-year-old
-- charge, and the order statistics that will later build on these figures would
-- stop being reproducible.
--
-- Purely additive — no table is dropped and no row is lost. Rows created before
-- this migration keep their EUR figure and sit at 0 USD.

ALTER TABLE inbounds
  ADD COLUMN IF NOT EXISTS production_fx_usd_eur DECIMAL(12,6),
  ADD COLUMN IF NOT EXISTS production_fx_date    DATE;

ALTER TABLE inbound_items
  ADD COLUMN IF NOT EXISTS production_cost_usd DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE inbound_shipments
  ADD COLUMN IF NOT EXISTS cost_usd   DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fx_usd_eur DECIMAL(12,6),
  ADD COLUMN IF NOT EXISTS fx_date    DATE;

-- PostgREST caches which tables and foreign keys exist. Until it reloads, a
-- nested query fails with "Could not find a relationship between 'inbounds' and
-- 'inbound_shipments' in the schema cache" — which is what happens right now
-- after running inbounds_v2.sql. This clears it.
NOTIFY pgrst, 'reload schema';
