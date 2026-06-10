---
title: "feat: Rebuild Engagement Map on exact Uniqode data"
type: feat
status: active
date: 2026-06-10
---

# feat: Rebuild Engagement Map on exact Uniqode data

## Summary

Rebuild the map's entire data layer so every number is exact and traceable to Uniqode: a small Vercel backend syncs the QR code list (names starting with `QR`) and per-code locations from the Uniqode API, reads scan history from the existing Uniqode-webhook→Supabase archive with correct deduplication and bot filtering (bots excluded by default, toggle to include), and the frontend renders only that — no baked-in snapshot, no Google Sheet, no guessed coordinates. New QR codes created in Uniqode appear automatically.

---

## Problem Frame

The live map (fitness-court-engagement-map.vercel.app) shows wrong numbers, missing codes, broken time filters, and a non-working heatmap. Investigation on 2026-06-10 found the root causes with hard evidence:

1. **Stale baked-in snapshot** (April 7, 2026) renders on every page load before live data arrives, and is the permanent source of the court list — codes created after April 7 can never appear (Supabase shows 121 codes with scan data; the map knows ~44; Uniqode now has 118 `QR`-prefixed codes).
2. **Double counting**: Uniqode's webhook sends two events per scan (`qr_code_view` + `qr_code.scanned`); the `scan_logs` table holds a perfect 1:1 duplication (17,712 + 17,712 rows) and the frontend counts every row.
3. **Bot scans counted as engagement**: 3,044 of 17,712 live-webhook scans (17%) carry Uniqode's own `isBotScan: true` flag.
4. **Guessed coordinates**: courts marked `Geocoded ⚠️ verify` are plotted at approximations. Uniqode itself holds no per-code locations today (all 190 codes: `place_data` empty or "Default Place", `metadata` empty).
5. **Three unreconciled sources** (snapshot, Google Sheet via Apps Script, raw Supabase rows) with different freshness; all-time totals and range counts come from different sources and cannot agree. Date math uses UTC, shifting "today/yesterday" ranges.

Verified reconciliation: Marina Green (`8664801`) — Uniqode dashboard official total **648**; webhook archive deduped including bots **647** (546 legacy backfill rows + 101 live `qr_code.scanned`). The dashboard therefore includes bot scans; deduped+bots is the dashboard-match formula.

---

## Requirements

- R1. Every active Uniqode QR code whose name starts with `QR` appears on the map, sourced from the Uniqode API (`GET /api/2.0/qrcodes/`, paginated; 118 codes today, 115 active). Non-matching codes (QR Walls, tests, retired, NFC site links) are excluded.
- R2. New codes created in Uniqode appear automatically on the next data sync with no code change. A code without a verified location still appears — in the "Needs location verification" panel, never plotted at a guessed position.
- R3. Scan counts are exact: one counted scan per physical scan. Dedup rule: count `qr_code.scanned` events plus legacy backfill rows (`event_type IS NULL`); ignore `qr_code_view` duplicates.
- R4. Bot filtering: scans with `event_detail.isBotScan = true` are **excluded by default**. A visible toggle ("Include bot scans") switches to bots-included mode, which matches the Uniqode dashboard totals exactly. Both modes must be labeled so the viewer knows which one they're seeing. Legacy backfill rows carry no bot flag and are always counted (consistent with dashboard totals).
- R5. Locations are exact only: read from each code's Uniqode `metadata` keys `lat`, `lon`, `address`. Valid numeric `lat` + `lon` are required for plotting; `address` is optional display-only text. Codes missing or with malformed `lat`/`lon` go to the needs-verification panel. No geocoding, no approximation, ever.
- R6. One-time location seeding: write verified coordinates (the 30 Salesforce-verified entries in the current map — all 30 have valid lat/lon; 8 lack an address, which is fine per R5) into Uniqode metadata via the API. Previously-geocoded coordinates (16 codes) are NOT seeded as truth — they appear in the verification panel as suggestions for the team to confirm.
- R7. Time-range filters (today, yesterday, 7/30 days, year, custom) compute correctly in the account timezone (America/Los_Angeles, matching the Uniqode dashboard), with results consistent with the dashboard's date bucketing.
- R8. The heatmap, bubble map, sidebar stats, and Analytics view all render from the same single clean dataset, and agree with each other for any given filter state.
- R9. No stale data ever renders: remove the baked-in `COURTS` snapshot, the Google Sheet/Apps Script path, and the frontend's direct Supabase reads. Page shows a loading state until real data arrives, and a clear error state if it can't.
- R10. Secrets (Uniqode API key, Supabase service key) live only in Vercel environment variables — never in the repo. The deployed frontend talks only to same-origin `/api/*` endpoints.
- R11. Reconciliation: a per-code comparison of our computed all-time total (bots-included mode) against Uniqode's official `scans` field, surfaced in the UI as a data-trust indicator. **Tolerance: delta ≤ 2 counts as "✓ matches Uniqode"; delta > 2 shows "⚠ drift" with the delta.** (Marina Green already carries a permanent delta of 1 from a missed webhook event — small deltas are expected.) This makes silent drift impossible going forward.
- R12. Workflow: all changes land via branch → PR with a detailed report (what changed, behavior changes, what was tested, risks) → Jessica's approval → merge to main → Vercel auto-deploy. GitHub branch protection on `main` requiring PR review.
- R13. UI redesign (user-approved mockup, 2026-06-10): all pages restyled to match `docs/plans/assets/2026-06-10-ui-mockup.png` — branded header (NFC logo, "Fitness Court Tracking", Map/Analytics tabs, date-range picker, Refresh Scans, settings), four KPI cards (Fitness Courts installed / With Scans + % active / Total Scans / Visible on map), filter bar (Search City, Visualization, Basemap, Date Range, Filters), left Rankings panel (Top 3 courts + all courts by city with scan counts), card-style map legend, branded "Track. Engage. Grow." callout, and "Data refreshed" footer with live-status dot. Applies to the Map view and Analytics view consistently.

---

## Scope Boundaries

- Per-day history **before June 4, 2025** is out of scope for time-series charts (the webhook archive starts then). All-time totals are still exact from each code's Uniqode `scans` field. The account's Uniqode plan tier (and therefore its analytics-API retention window: 30 days → lifetime by tier) is verified during U2; if it allows older per-day pulls, that's a bonus — not a commitment.
- Non-`QR`-prefixed codes (QR Walls, campaign codes, tests) stay off the map entirely. No secondary view for them in this plan.
- No custom bot detection beyond Uniqode's own `isBotScan` flag (no trust-score thresholds, no IP analysis).
- Scanner-GPS heatmaps (where scanners physically were) are out of scope — the map plots scans at the court's exact location, per the product's purpose.
- Moving `scan_logs` out of the "NFC Design Studio" Supabase project into a dedicated project — works fine where it is.

### Deferred to Follow-Up Work

- Editing/confirming locations directly from the map UI (write-back to Uniqode): future iteration; this plan's team workflow is the Uniqode dashboard Metadata panel.
- Optional alerting (email/Slack) when reconciliation drift is detected or when new codes lack locations.

---

## Context & Research

### Relevant Code and Patterns

- `index.html` — the entire current app (single file, ~1,090 lines): Leaflet map, `COURTS` baked snapshot, `loadFromSheet()` (Apps Script), `loadDailyFromSupabase()` (paginated PostgREST reads), `getScanCount()` range math (UTC bug), `renderMarkers()`/`heatParams()` heatmap, `renderAnalytics()` charts.
- Supabase project **NFC Design Studio** (`ypjatmjcehoamdbtyatj`): table `public.scan_logs` (37,343 rows, 2025-06-04 → today; columns `qr_id`, `scan_date`, `created_at`, `raw_payload` jsonb), fed by edge function `receive-scan` (live Uniqode webhook receiver, v1, no dedup/filtering — interpretation must happen at read time).
- Webhook payload shape (verified from live rows): `object` = full QR code object (id, name, url, `scans` official total, place, tags); `event_type` = `qr_code.scanned` | `qr_code_view` | NULL (legacy backfill); `event_detail` = `isBotScan`, `mappable_id` (unique scan id), `time` (epoch ms), `scanLocation` (scanner GPS), city/region/country, trust/vpn/threat scores.

### Verified Live Facts (2026-06-10)

- Uniqode account: 190 codes, 118 named `QR*` (115 active, 7,922 official scans total). API auth works: `Authorization: Token <key>`, base `https://api.uniqode.com/api/2.0/`, paginated (`count`/`next`).
- No code has a real `place_data` or any `metadata` — locations must be seeded (R6).
- Marina Green reconciliation: official 648 vs deduped-with-bots 647 → dashboard includes bots; dedup rule confirmed.
- Webhook double-send confirmed globally: identical 17,712-row counts per event type; `mappable_id` provides per-scan identity (17,692 unique — a handful of legitimate same-id retries exist, use `mappable_id` dedup where present).

### External References

- Uniqode docs: API intro & auth (docs.uniqode.com/en/articles/6725065), QR API getting started (6064771), analytics retention by plan (9305836), JSON metadata feature (12867267).
- Plan-tier constraints: API access requires Pro/Core+; analytics retention 30d→lifetime by tier; rate limits 10 req/s / 250k/mo at Pro tier. The exact analytics endpoint schema is not publicly documented (JS-rendered Swagger at apidocs.uniqode.com) — verified empirically during implementation with the live key.

---

## Key Technical Decisions

- **Keep webhook→Supabase as the scan-event store; fix interpretation at read time**: it is the only source of per-scan, per-day history (Uniqode API retention is plan-gated). The `receive-scan` edge function keeps writing raw events untouched (raw archive = audit trail); correctness lives in SQL views.
- **Vercel serverless functions as the only data gateway**: the static page is open to the world, so the Uniqode key cannot ship to the browser. Frontend calls `/api/courts` and `/api/scans`; functions hold secrets, talk to Uniqode + Supabase, and cache responses (~5 min) to respect rate limits.
- **Uniqode metadata is the location source of truth** (user-confirmed): keys `lat`, `lon`, `address` on each QR code, editable by the team in the Uniqode dashboard's Metadata panel where they already create codes. New sites keep arriving in Uniqode; keeping location there means one system, one workflow, no second list to maintain.
- **Bots-excluded is the default count; bots-included is the dashboard-match mode** (user-confirmed): the toggle makes the difference explicit instead of hiding it.
- **Dashboard-consistent counting**: dedup to `qr_code.scanned` + legacy rows; count in America/Los_Angeles dates; all-time = official Uniqode `scans` field in bots-included mode, computed sum in default mode, reconciled per R11.
- **Same repo, same Vercel project**: restructure `fitness-court-map` (Vercel auto-detects `api/` functions next to static files). The live URL doesn't change.

---

## Open Questions

### Resolved During Planning

- Does the dashboard count bots? — Yes (Marina Green 648 vs 647 reconciliation). Default excludes them per user; toggle reproduces dashboard.
- Which codes belong on the map? — `name.startsWith("QR")`, user-confirmed; verified to cleanly split court codes from walls/tests.
- Where do locations live? — Uniqode metadata (user-confirmed; dashboard Metadata panel exists for team editing).
- New codes auto-appear? — Yes by construction: `/api/courts` lists from the Uniqode API on each sync.

### Deferred to Implementation

- Exact Uniqode endpoint for writing metadata (likely `PATCH /api/2.0/qrcodes/{id}/`): verify with the live key during U3; fallback is manual entry of ~25 seeds via the dashboard panel (small, bounded).
- Whether the analytics API exposes per-day series beyond the webhook archive window: probe during U2; nice-to-have only.
- How `scan_date` was computed by `receive-scan` for legacy vs live rows (UTC vs local): derive the TZ-correct date from `event_detail.time` / `created_at` in the views and verify daily buckets against the dashboard for 2–3 codes.
- The handful of `mappable_id` duplicate rows (17,712 vs 17,692): inspect during U1; prefer `DISTINCT ON (mappable_id)` where the id exists.

---

## Output Structure

    fitness-court-map/
    ├── index.html              # rewritten data layer, same look & feel
    ├── api/
    │   ├── courts.js           # QR list + locations + counts (Uniqode + Supabase)
    │   └── scans.js            # daily time series for ranges/analytics
    ├── scripts/
    │   └── seed-locations.js   # one-time: write lat/lon/address metadata to Uniqode
    ├── sql/
    │   └── views.sql           # scan_events_clean + daily rollup views (applied via Supabase migration)
    ├── docs/plans/             # this plan
    ├── .github/
    │   └── pull_request_template.md
    ├── package.json            # minimal; Vercel functions runtime
    └── vercel.json             # static + functions config (if needed)

---

## Implementation Units

### U1. Clean scan views in Supabase

**Goal:** One authoritative, deduplicated, bot-flagged, timezone-correct representation of every scan, as SQL views over the raw `scan_logs` archive (raw rows never modified).

**Requirements:** R3, R4, R7

**Dependencies:** None

**Files:**
- Create: `sql/views.sql` (applied as a Supabase migration to project `ypjatmjcehoamdbtyatj`)

**Approach:**
- `scan_events_clean`: one row per physical scan — `qr_code.scanned` events deduped by `mappable_id`, plus legacy `event_type IS NULL` rows; columns: `qr_id`, `scan_date_la` (America/Los_Angeles), `is_bot` (false for legacy), `mappable_id`.
- `scan_daily`: per `qr_id` × `scan_date_la` × `is_bot` counts — the single feed for all range math.
- **Access control:** create the views in a non-PostgREST-exposed schema (or `security_invoker` with grants to the service role only) so they are NOT anonymously readable — `public` schema views would bypass RLS and undercut R10. Anon SELECT on `scan_logs` itself is revoked in U4 (sequencing: only after the new frontend no longer reads Supabase directly, or the live map breaks).
- Investigate the 20 `mappable_id` collisions and the legacy rows' date semantics before finalizing.

**Test scenarios:**
- Happy path: Marina Green (`8664801`) all-time from `scan_events_clean` (bots included) = 647 ±1 vs Uniqode official 648.
- Happy path: total clean rows ≈ 17,692 live + 1,921 legacy; zero `qr_code_view` rows counted.
- Edge case: a scan at 11 PM Pacific lands on the Pacific date, not the UTC (next) date.
- Edge case: legacy rows (no `event_detail`) appear with `is_bot = false`, not dropped.
- Integration: for 2–3 codes, daily buckets for a recent week match the Uniqode dashboard day-by-day.

**Verification:** Reconciliation query across all `QR*` codes shows computed (bots-included) totals within expected tolerance of official `scans`; documented result pasted into the PR report.

---

### U2. Vercel backend: `/api/courts` and `/api/scans`

**Goal:** A thin serverless gateway that is the frontend's only data source — Uniqode key and Supabase access live here, never in the browser.

**Requirements:** R1, R2, R5, R10, R11

**Dependencies:** U1

**Files:**
- Create: `api/courts.js`, `api/scans.js`, `package.json`, `vercel.json` (if needed)
- Test: `scripts/test-api.js` (node script asserting response shapes and known values against the deployed/local endpoints)

**Approach:**
- `/api/courts`: pages through Uniqode `GET /qrcodes/`, filters `name.startsWith("QR")` and active state, parses `metadata.lat/lon/address` (validating numeric ranges), joins per-code counts from `scan_daily`, returns courts + `needsLocation` list + official `scans` + computed totals + `lastSynced`.
- `/api/scans`: returns per-day series (split by bot/human) for the requested codes/range from `scan_daily`.
- Caching via Vercel's CDN: `Cache-Control: s-maxage=300, stale-while-revalidate=600` (in-memory caches don't survive serverless instance recycling). The frontend "Refresh" button busts cache with a query param (new CDN cache key). Even uncached, ~3 paginated Uniqode calls per load stays far under the 250k/mo Pro-tier limit. Supabase access via service-role key server-side.
- Env vars: `UNIQODE_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` — set in Vercel project settings; `.env.local` gitignored.

**Test scenarios:**
- Happy path: `/api/courts` returns 115±, includes `QR-MI-WayneCounty-VenoyDorsey` (created 2026-06-10) in `needsLocation`.
- Happy path: each court carries both `officialScans` and computed bot-split totals.
- Error path: Uniqode 401/5xx → 502 with a clear error body, no stale-pretending-fresh response.
- Error path: malformed metadata (`lat: "TBD"`) → code routed to `needsLocation`, not plotted.
- Integration: a code created in Uniqode mid-session appears in the next uncached `/api/courts` response with no deploy.

**Verification:** `scripts/test-api.js` passes against a preview deploy; no secret appears in any client-delivered asset (grep the built output).

---

### U3. One-time location seeding into Uniqode

**Goal:** Every code with already-verified coordinates gets exact `lat`/`lon`/`address` metadata in Uniqode; everything else is explicitly flagged for the team — never guessed.

**Requirements:** R5, R6

**Dependencies:** U2 (env/key plumbing). Can run in parallel with U4–U6 once U2 completes.

**Files:**
- Create: `scripts/seed-locations.js`

**Approach:**
- Source of truth for seeds: the current map's `Salesforce ✓` entries (address + coords). `Geocoded ⚠️` entries are NOT written to Uniqode; they're emitted into the needs-verification output as suggestions.
- Verify the metadata write endpoint empirically (`PATCH /qrcodes/{id}/`); dry-run mode prints intended writes before executing; output a summary table (seeded / skipped / needs-verification).
- Fallback if API write is blocked: generate the same table for manual entry via the dashboard Metadata panel (~25 rows, bounded).

**Test scenarios:**
- Happy path: dry run lists ~25 seeds with valid coordinate ranges; live run then shows those codes with populated metadata on re-fetch.
- Edge case: a code already carrying metadata is skipped (never overwritten) unless `--force`.
- Error path: write failure on one code doesn't abort the batch; failures land in the summary.

**Verification:** `/api/courts` after seeding plots the seeded codes at exact coordinates and lists the remainder in `needsLocation`; counts of seeded + needs-verification = 118.

---

### U4. Frontend data layer replacement

**Goal:** `index.html` renders exclusively from `/api/*` — delete the baked snapshot, Apps Script path, and direct Supabase reads.

**Requirements:** R2, R7, R9

**Dependencies:** U2

**Files:**
- Modify: `index.html` (remove `COURTS`, `APPS_SCRIPT_URL`, `SUPABASE_*` constants, `loadFromSheet`, `loadDailyFromSupabase`; add `/api` loader with loading + error states)

**Approach:**
- Single load path: fetch `/api/courts` + `/api/scans`, hold one in-memory dataset, re-render everything from it. "Refresh" button busts the cache. Range math moves off UTC `toISOString()` onto the LA-date strings the API provides.
- **Totals policy:** sidebar/Analytics headline totals cover ALL `QR*` codes — plotted AND needs-location — so account-wide numbers can reconcile with Uniqode. The needs-location contribution is labeled (e.g., "includes N scans from M codes awaiting location"). A "plotted only" sub-total equals the sum of visible markers.
- After deploy is verified: revoke anon SELECT on `scan_logs` in Supabase (closes the old public-read path; the anon key is in git history forever).

**Test scenarios:**
- Happy path: cold load shows a loading state, then real data; view-source contains zero hardcoded scan numbers.
- Error path: API down → visible error banner with retry, not a silently empty/stale map.
- Edge case: "today" right after midnight Pacific shows the new Pacific day.
- Integration: plotted-only sub-total = sum of visible markers for every range; headline total = plotted + needs-location contributions; switching ranges never resurrects deleted-source data.
- Integration: after anon revoke, the deployed map still works fully (it never touches Supabase directly) and a direct PostgREST request with the old anon key is rejected.

**Verification:** Network tab shows only same-origin `/api/*` data calls; the words "Salesforce" and the Apps Script URL no longer exist in the repo.

---

### U5. UI: bot toggle, filters, heatmap, needs-location panel, freshness

**Goal:** The visible controls users touch every day work correctly on the clean dataset and make data provenance explicit.

**Requirements:** R4, R7, R8, R2

**Dependencies:** U4

**Files:**
- Modify: `index.html`

**Approach:**
- Bot toggle: default **off** (humans only), labeled e.g. "Include bot scans (matches Uniqode dashboard)"; state shown in the header so screenshots are self-explanatory; affects map, sidebar, analytics, heatmap together.
- Rebuild time-range filtering and heatmap on `scan_daily`-derived data; heatmap intensity from the active range's counts with sensible scaling re-tuned on real (smaller) numbers.
- Needs-location panel: lists codes awaiting verification (with suggested old geocoded coords where they exist) and shows the metadata how-to (`lat` / `lon` / `address`).
- Freshness line: "Data synced from Uniqode HH:MM" + reconciliation status from R11.

**Test scenarios:**
- Happy path: toggling bots visibly changes counts; bots-included all-time for Marina Green = dashboard 648 ±1.
- Happy path: heatmap renders for every range including ones where max count is small (no invisible layer, no divide-by-zero).
- Edge case: custom range spanning the legacy/live boundary (e.g., 2025-05 → 2025-07) returns sensible combined counts.
- Edge case: a court with zero scans in range stays visible as a zero marker (not dropped from the map).
- Integration: bubble map, heatmap, sidebar, and Analytics view all report identical totals for the same filter state.

**Verification:** Side-by-side check against the Uniqode dashboard for 3 codes × 2 ranges in bots-included mode — numbers match; screenshots in the PR report.

---

### U6. Reconciliation + drift indicator

**Goal:** Continuous proof of correctness: the map checks itself against Uniqode's official totals so drift can never again go unnoticed.

**Requirements:** R11

**Dependencies:** U2, U5

**Files:**
- Modify: `api/courts.js` (include per-code `officialScans` vs computed delta), `index.html` (indicator UI)

**Approach:**
- Each sync compares computed bots-included all-time vs official `scans` per code; aggregate status surfaces in the freshness line; per-code status in popups (✓ / ⚠ with the delta). Tolerance per R11: delta ≤ 2 = ✓.
- Drift remediation path: when a code exceeds tolerance, the U2 analytics-API probe doubles as a backfill source if the plan tier allows; otherwise document the delta as acknowledged (a small known-drift allowance per code) so a ⚠ can be cleared once explained rather than staying on forever.

**Test scenarios:**
- Happy path: matching code shows ✓; artificially perturbed computed count shows ⚠ with the delta.
- Edge case: a brand-new code (0 scans both sides) shows ✓, not a false warning.
- Error path: Uniqode unreachable during a sync → indicator says "reconciliation unavailable", not a fake ✓.

**Verification:** Deployed map shows aggregate reconciliation status; deliberately mismatched test data produces a visible warning.

---

### U8. UI redesign to the approved mockup

**Goal:** Restyle the whole app — Map and Analytics views — to match the approved dashboard mockup while keeping every data behavior from U4–U6 intact.

**Requirements:** R13, R4 (toggle placement), R2 (needs-location panel placement), R11 (freshness footer)

**Dependencies:** U4, U5

**Files:**
- Modify: `index.html`
- Reference: `docs/plans/assets/2026-06-10-ui-mockup.png` (authoritative design)

**Approach:**
- Light dashboard aesthetic per mockup: white cards on a soft gray canvas, rounded corners, subtle borders/shadows, Inter-style typography, blue/green accent palette matching the legend buckets.
- Header: NFC logo + "NATIONAL FITNESS CAMPAIGN / Fitness Court Tracking", Map | Analytics tabs, date display, "Refresh Scans" button, settings gear (home for the bot-scans toggle and basemap options if the filter bar gets tight).
- KPI cards: Total Installed, With Scans (+% active), Total Scans (all time / current range), Visible Courts — all computed from the same clean dataset (R8: cards, rankings, map always agree).
- Rankings panel: Top 3 courts by scans in the active range + "all courts by city" list with counts and mini progress bars; "View All Rankings" expands. This replaces the old sidebar; the needs-location panel lives here as a labeled section or badge-count tab.
- Map area: zoom + locate controls, card-style "QR SCANS" legend matching the mockup buckets (0, 1–4, 5–19, 20–49, 50–99, 100–299, 300+), branded callout card, "Data refreshed: <timestamp>" footer with status dot (doubles as the R11 reconciliation indicator).
- Bot toggle remains visible/labeled (header or filter bar) — mockup doesn't show it, but R4 says the active mode must be explicit; settings gear is an acceptable home with the active mode echoed in the footer line.
- Analytics view restyled with the same card system, header, and palette.

**Test scenarios:**
- Happy path: Map view visually matches the mockup's layout regions (header, 4 KPI cards, filter bar, rankings panel, map+legend, footer) at desktop width.
- Happy path: KPI cards, rankings, and map markers report identical numbers for any filter state (carries R8 across the redesign).
- Edge case: narrow/laptop width — cards wrap without overlapping the map; panel collapses gracefully.
- Edge case: bot-toggle state is discoverable and labeled in the new layout; changing it updates KPI cards, rankings, and map together.
- Integration: every U5 behavior (ranges, heatmap, needs-location, freshness) still works after restyle — no regression in data wiring.

**Verification:** Side-by-side screenshot of deployed Map view vs `docs/plans/assets/2026-06-10-ui-mockup.png` included in the PR report; all U5 verification checks re-run green after the restyle.

---

### U7. PR workflow + branch protection

**Goal:** Every change to this repo arrives as a reviewed PR with a detailed report; direct pushes to `main` are impossible.

**Requirements:** R12

**Dependencies:** None (do first or in parallel)

**Files:**
- Create: `.github/pull_request_template.md` (sections: What changed / Why / Behavior changes / How it was tested / Risks / Screenshots)

**Approach:**
- Enable GitHub branch protection on `main` via `gh api` on `NFC-FC/Fitness-Court-Engagement-Map`: require a PR for all merges. **Required-approval count depends on who reviews:** GitHub blocks self-approval, so if Jessica's account authors the PRs and no teammate reviews on GitHub, a required-approval rule would deadlock merges. Default: require PR without required approvals (Jessica reviews the detailed PR report, then merges); flip on "require 1 approval" if a second team account will review.
- Every PR in this plan ships with the detailed report format Jessica specified (memory: applies to all repos).

**Test scenarios:**
- Test expectation: none — process/config only. Verified by attempting a direct push to `main` (must be rejected) and opening one PR with the template auto-populated.

**Verification:** Direct push to `main` rejected; first feature PR shows the template sections filled in.

---

## System-Wide Impact

- **Interaction graph:** `receive-scan` edge function and the raw `scan_logs` table are untouched (append-only archive). The "NFC Design Studio" app shares the Supabase project but no tables with this work; new views are additive.
- **Error propagation:** Frontend ←(`/api` JSON errors with status)← functions ←(Uniqode/Supabase failures)←. Every failure is visible (banner / indicator), never silently absorbed into stale data — that silence is what caused this rebuild.
- **State lifecycle risks:** Function cache (~5 min) can serve slightly stale counts; freshness timestamp makes that visible. Seeding script is idempotent and never overwrites existing metadata without `--force`.
- **API surface parity:** None — no other consumer of these endpoints today. The Apps Script/Sheet pipeline is decommissioned (document in the PR so the team can retire the Sheet).
- **Unchanged invariants:** Live URL, repo, Vercel project, Supabase project, and the webhook ingestion path all stay as-is.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Uniqode metadata write endpoint shape unverified | Verify empirically in U3 dry-run; bounded manual fallback (~25 entries via dashboard panel) |
| Legacy backfill rows' date semantics unknown (TZ) | U1 explicitly validates daily buckets against the dashboard before anything renders |
| Team forgets to add metadata to new codes | Codes still appear (needs-location panel), so nothing is invisible; panel shows the how-to |
| Uniqode rate limits (10 req/s, 250k/mo at Pro tier) | Server-side caching; full code-list sync is ~3 paginated calls per 5 min worst case |
| API key was shared in chat | Key lives only in Vercel env vars; recommend rotation in the Uniqode dashboard after setup |
| Smaller default numbers surprise stakeholders | Toggle labeling + header state make the mode explicit; dashboard-match mode is one click |

---

## Documentation / Operational Notes

- PR reports double as the change log Jessica reviews before each merge (R12).
- Team-facing how-to (lives in the needs-location panel and the README): *In Uniqode → code → Metadata: add `lat` (e.g. `37.80614`), `lon` (e.g. `-122.43512`), `address` (full street address). Get coordinates by right-clicking the exact spot in Google Maps → first menu item copies them.*
- After launch, retire the Google Sheet + Apps Script deployment to avoid a zombie data path.

---

## Sources & References

- Related code: `index.html` (current app), Supabase `ypjatmjcehoamdbtyatj.scan_logs` + `receive-scan` edge function
- Live verification (2026-06-10): Uniqode API probes (190 codes, 118 `QR*`), Marina Green 648-vs-647 reconciliation, event-type duplication counts
- External docs: docs.uniqode.com articles 6725065 (API/auth), 6064771 (QR API), 9305836 (analytics retention), 12867267 (JSON metadata)
