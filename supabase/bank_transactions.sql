-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS bank_transactions (
  id            TEXT PRIMARY KEY,
  date          DATE          NOT NULL,
  counterparty  TEXT          NOT NULL DEFAULT '',
  reference     TEXT          NOT NULL DEFAULT '',
  amount_eur    DECIMAL(12,2) NOT NULL,
  raw           TEXT,
  created_at    TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS bank_transactions_date_idx ON bank_transactions (date DESC);

-- One closing-balance snapshot per uploaded statement month
CREATE TABLE IF NOT EXISTS bank_balance_snapshots (
  statement_month     TEXT PRIMARY KEY,          -- e.g. "2026-03"
  closing_balance_eur DECIMAL(12,2) NOT NULL,
  uploaded_at         TIMESTAMPTZ   DEFAULT NOW()
);
