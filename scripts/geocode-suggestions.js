// Geocode APPROXIMATE locations for QR codes that lack verified metadata,
// using the QR-{ST}-{City}-{Location} naming convention + OSM Nominatim.
//
//   UNIQODE_API_KEY=<key> node scripts/geocode-suggestions.js --out /tmp/suggestions_out.json
//
// Results are SUGGESTIONS ONLY (source: geocoded-name) — stored in the
// qr_location_suggestions table, never written to Uniqode metadata. The map
// plots them as visually-distinct "approximate" markers until someone
// confirms the exact location (which writes Uniqode metadata and wins).
//
// With SUPABASE_URL + SUPABASE_SERVICE_KEY set, upserts directly; otherwise
// writes the JSON file for manual loading. Re-runnable: skips codes that
// already have a suggestion or verified location.

import { writeFileSync, readFileSync } from 'node:fs';

const API = 'https://api.uniqode.com/api/2.0';
const KEY = process.env.UNIQODE_API_KEY;
if (!KEY) { console.error('Set UNIQODE_API_KEY'); process.exit(1); }
const outIdx = process.argv.indexOf('--out');
const outFile = outIdx > -1 ? process.argv[outIdx + 1] : null;

const spaced = (s) => s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_#]/g, ' ').replace(/\s+/g, ' ').trim();

function parseParts(name) {
  const p = name.split('-');
  if (p[0] !== 'QR' || p.length < 3) return null;
  if (p[2] === 'DFW' && p.length >= 5) {
    return { state: p[1], city: spaced(p[3]), location: spaced(p.slice(4).join(' ')) };
  }
  if (p.length === 3) return { state: p[1], city: '', location: spaced(p[2]) };
  return { state: p[1], city: spaced(p[2]), location: spaced(p.slice(3).join(' ')) };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function nominatim(q) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(q)}`;
  const resp = await fetch(url, { headers: { 'User-Agent': 'NFC-FitnessCourtMap/1.0 (jessica@nfchq.com)' } });
  if (!resp.ok) return null;
  const hits = await resp.json();
  return hits[0] ? { lat: +hits[0].lat, lon: +hits[0].lon, label: hits[0].display_name } : null;
}

// Existing suggestions (to skip) — from file when offline, via Supabase when keys present
let existing = new Set();
const supa = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY;
async function supaFetch(path, opts = {}) {
  const k = process.env.SUPABASE_SERVICE_KEY;
  return fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: k, Authorization: `Bearer ${k}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates', ...(opts.headers || {}) },
  });
}
if (supa) {
  const rows = await (await supaFetch('qr_location_suggestions?select=qr_id')).json();
  existing = new Set(rows.map((r) => r.qr_id));
}

// All active QR codes without verified metadata location
const codes = [];
let path = '/qrcodes/?limit=100';
while (path) {
  const page = await (await fetch(`${API}${path}`, { headers: { Authorization: `Token ${KEY}` } })).json();
  codes.push(...page.results);
  path = page.next ? page.next.replace(API, '') : null;
}
const targets = codes.filter((c) => {
  if (!c.name.startsWith('QR') || c.state !== 'A') return false;
  const m = c.metadata || {};
  if (Number.isFinite(Number(m.lat)) && Number.isFinite(Number(m.lon)) && Number(m.lat) !== 0) return false;
  return !existing.has(String(c.id));
});
console.log(`geocoding ${targets.length} codes…`);

const out = [], misses = [];
for (const c of targets) {
  const parts = parseParts(c.name);
  if (!parts) { misses.push(c.name + ' (unparseable)'); continue; }
  const queries = [];
  if (parts.location && parts.city) queries.push(`${parts.location}, ${parts.city}, ${parts.state}`);
  if (parts.city) queries.push(`${parts.city}, ${parts.state}`);
  if (parts.location && !parts.city) queries.push(`${parts.location}, ${parts.state}`);
  let hit = null, used = null;
  for (const q of queries) {
    await sleep(1200);
    hit = await nominatim(q);
    if (hit) { used = q; break; }
  }
  if (hit) {
    out.push({ qr_id: String(c.id), lat: hit.lat, lon: hit.lon, label: used, source: 'geocoded-name' });
    console.log(`  + ${c.name} → ${hit.lat.toFixed(4)}, ${hit.lon.toFixed(4)} (${used})`);
  } else {
    misses.push(c.name);
    console.log(`  ! ${c.name} → no geocode hit`);
  }
}

if (supa && out.length) {
  const resp = await supaFetch('qr_location_suggestions', { method: 'POST', body: JSON.stringify(out) });
  console.log('supabase upsert:', resp.status);
}
if (outFile) writeFileSync(outFile, JSON.stringify(out, null, 1));
console.log(`\ndone: ${out.length} suggestions, ${misses.length} misses`);
if (misses.length) console.log('misses:', misses.join('; '));
