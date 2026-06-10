-- Clean scan views for the Fitness Court Engagement Map
-- Applied to Supabase project ypjatmjcehoamdbtyatj (NFC Design Studio) as migration
-- `engagement_map_clean_scan_views`.
--
-- Raw `scan_logs` is an append-only archive fed by the `receive-scan` edge function
-- (Uniqode webhook). Correctness lives here, at read time:
--   * Uniqode sends two events per physical scan (qr_code_view + qr_code.scanned);
--     only qr_code.scanned rows are counted, deduped by mappable_id.
--   * Legacy backfill rows (event_type IS NULL) are single-counted, no bot flag.
--   * Stored scan_date on live rows is UTC-based; dashboards bucket in account
--     timezone (America/Los_Angeles), so dates are recomputed from the event time.
--
-- Access: anon/authenticated have no grants on these views (the map's data goes
-- through the Vercel API with the service role). Views are security_invoker=false
-- (definer) on purpose: service_role reads them without needing scan_logs RLS policies.

create or replace view public.scan_events_clean as
with live as (
  select distinct on (raw_payload->'event_detail'->>'mappable_id')
    qr_id,
    (coalesce(
       to_timestamp((raw_payload->'event_detail'->>'time')::bigint / 1000.0),
       created_at
     ) at time zone 'America/Los_Angeles')::date as scan_date_la,
    coalesce((raw_payload->'event_detail'->>'isBotScan')::boolean, false) as is_bot,
    raw_payload->'event_detail'->>'mappable_id' as mappable_id
  from public.scan_logs
  where raw_payload->>'event_type' = 'qr_code.scanned'
  order by raw_payload->'event_detail'->>'mappable_id', id
),
legacy as (
  select
    qr_id,
    scan_date as scan_date_la,  -- backfill dates taken as-is (account-TZ export)
    false as is_bot,
    null::text as mappable_id
  from public.scan_logs
  where raw_payload->>'event_type' is null
)
select * from live
union all
select * from legacy;

create or replace view public.scan_daily as
select qr_id, scan_date_la, is_bot, count(*)::int as scans
from public.scan_events_clean
group by 1, 2, 3;

-- Per-code totals split by bot flag (migration: engagement_map_scan_totals_view)
create or replace view public.scan_totals as
select
  qr_id,
  coalesce(sum(scans) filter (where not is_bot), 0)::int as human_scans,
  coalesce(sum(scans) filter (where is_bot), 0)::int as bot_scans
from public.scan_daily
group by 1;

-- Lock down: API gateway (service role) only — never the browser.
revoke all on public.scan_events_clean from anon, authenticated;
revoke all on public.scan_daily from anon, authenticated;
revoke all on public.scan_totals from anon, authenticated;
grant select on public.scan_events_clean to service_role;
grant select on public.scan_daily to service_role;
grant select on public.scan_totals to service_role;
