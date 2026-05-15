import type { Database } from "@/db";
import { getLibsqlClient } from "@/db";

let ensured = false;

export async function ensureBizgoTablesAtRuntime(_db: Database) {
  if (ensured) return;
  const client = getLibsqlClient();
  await client.executeMultiple(`
CREATE TABLE IF NOT EXISTS bizgo_expense_lines (
  id text PRIMARY KEY NOT NULL,
  import_batch_id text NOT NULL,
  settlement_month text NOT NULL,
  subject text,
  detail_date text,
  category_label text NOT NULL,
  account_id text,
  amount_incl_tax_minor integer DEFAULT 0 NOT NULL,
  tax_category text,
  amount_excl_tax_minor integer DEFAULT 0 NOT NULL,
  tax_amount_minor integer DEFAULT 0 NOT NULL,
  summary text,
  has_receipt text,
  invoice_flag text,
  registration_number text,
  created_at integer NOT NULL
);
CREATE INDEX IF NOT EXISTS bizgo_expense_month_idx ON bizgo_expense_lines (settlement_month);
CREATE INDEX IF NOT EXISTS bizgo_expense_batch_idx ON bizgo_expense_lines (import_batch_id);

CREATE TABLE IF NOT EXISTS bizgo_trip_expense_lines (
  id text PRIMARY KEY NOT NULL,
  import_batch_id text NOT NULL,
  target_month text NOT NULL,
  subject text,
  trip_start_date text,
  trip_end_date text,
  trip_days text,
  one_way_distance_km text,
  lodging text,
  daily_allowance_total_minor integer DEFAULT 0 NOT NULL,
  detail_date text,
  category_label text NOT NULL,
  account_id text,
  amount_incl_tax_minor integer DEFAULT 0 NOT NULL,
  tax_category text,
  amount_excl_tax_minor integer DEFAULT 0 NOT NULL,
  tax_amount_minor integer DEFAULT 0 NOT NULL,
  summary text,
  has_receipt text,
  invoice_flag text,
  registration_number text,
  created_at integer NOT NULL
);
CREATE INDEX IF NOT EXISTS bizgo_trip_month_idx ON bizgo_trip_expense_lines (target_month);
CREATE INDEX IF NOT EXISTS bizgo_trip_batch_idx ON bizgo_trip_expense_lines (import_batch_id);
`);
  ensured = true;
}
