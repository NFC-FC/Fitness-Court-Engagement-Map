// GET /api/courts — the map's single source for the QR code list.
//
// Lists every active Uniqode QR code whose name starts with "QR", joins exact
// per-code scan totals from the cleaned webhook archive (scan_totals view),
// reads locations ONLY from Uniqode metadata (lat/lon/address keys), and
// reconciles computed totals against Uniqode's official `scans` field.
// Codes without valid coordinates are returned in the same list with
// hasLocation:false — visible, never plotted at a guess.

import {
  fetchAllQRCodes,
  supabaseSelect,
  parseLocation,
  parseName,
  sendError,
  setCache,
} from './_lib.js';

const RECONCILE_TOLERANCE = 2; // R11: delta ≤ 2 = matches Uniqode
// Per-day webhook archive begins here. Codes created before this date have
// official totals that legitimately include scans we have no event rows for —
// that surplus is expected history, not drift.
const ARCHIVE_START = '2025-06-04';

export default async function handler(req, res) {
  try {
    const [codes, totals] = await Promise.all([
      fetchAllQRCodes(),
      supabaseSelect('scan_totals?select=qr_id,human_scans,bot_scans'),
    ]);

    const totalsById = new Map(totals.map((t) => [String(t.qr_id), t]));

    const courts = codes
      .filter((c) => c.name.startsWith('QR') && c.state === 'A')
      .map((c) => {
        const loc = parseLocation(c.metadata);
        const named = parseName(c.name);
        const t = totalsById.get(String(c.id)) || { human_scans: 0, bot_scans: 0 };
        const computedAll = t.human_scans + t.bot_scans;
        const official = c.scans ?? 0;
        const delta = official - computedAll;
        const preArchive = (c.created || '').slice(0, 10) < ARCHIVE_START;
        return {
          id: c.id,
          name: c.name,
          state: named.state,
          city: named.city,
          location: named.location,
          url: c.url,
          created: c.created,
          lat: loc.lat,
          lon: loc.lon,
          address: loc.address,
          hasLocation: loc.hasLocation,
          officialScans: official,
          humanScans: t.human_scans,
          botScans: t.bot_scans,
          reconciled: Math.abs(delta) <= RECONCILE_TOLERANCE || (preArchive && delta > 0),
          preArchive,
          delta,
        };
      })
      .sort((a, b) => b.humanScans - a.humanScans);

    const needsLocation = courts.filter((c) => !c.hasLocation).map((c) => c.id);
    const reconciledCount = courts.filter((c) => c.reconciled).length;

    setCache(res);
    res.status(200).json({
      courts,
      needsLocation,
      summary: {
        totalCourts: courts.length,
        plotted: courts.length - needsLocation.length,
        needsLocation: needsLocation.length,
        humanScans: courts.reduce((s, c) => s + c.humanScans, 0),
        botScans: courts.reduce((s, c) => s + c.botScans, 0),
        officialScans: courts.reduce((s, c) => s + c.officialScans, 0),
        reconciled: reconciledCount,
        reconciliationOk: reconciledCount === courts.length,
      },
      lastSynced: new Date().toISOString(),
    });
  } catch (err) {
    sendError(res, err);
  }
}
