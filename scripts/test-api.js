// Smoke tests for the API gateway. Run against a deployed URL:
//   node scripts/test-api.js https://<preview-or-prod-host>
// Asserts response shapes, known reconciliation values, and that no secret
// leaks into client-delivered assets.

import { readFileSync } from 'node:fs';

const base = (process.argv[2] || process.env.BASE_URL || '').replace(/\/$/, '');
if (!base) {
  console.error('Usage: node scripts/test-api.js <base-url>');
  process.exit(1);
}

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

const courtsResp = await fetch(`${base}/api/courts`);
check('/api/courts returns 200', courtsResp.status === 200, `got ${courtsResp.status}`);
const courtsBody = await courtsResp.json();
const { courts = [], needsLocation = [], summary = {} } = courtsBody;

check('court list is substantial (>100 QR codes)', courts.length > 100, `got ${courts.length}`);
check('every court name starts with QR', courts.every((c) => c.name.startsWith('QR')));
check(
  'every court has officialScans + humanScans + botScans numbers',
  courts.every(
    (c) =>
      Number.isFinite(c.officialScans) &&
      Number.isFinite(c.humanScans) &&
      Number.isFinite(c.botScans)
  )
);
check(
  'no court is plotted without valid coordinates',
  courts.every((c) => !c.hasLocation || (Number.isFinite(c.lat) && Number.isFinite(c.lon)))
);
check(
  'needsLocation ids all map to hasLocation:false courts',
  needsLocation.every((id) => courts.find((c) => c.id === id && !c.hasLocation))
);

const marina = courts.find((c) => c.name === 'QR-SF-SanFranciscoCA-MarinaGreen');
check('Marina Green present', Boolean(marina));
if (marina) {
  const computed = marina.humanScans + marina.botScans;
  check(
    'Marina Green reconciles with Uniqode official total (±2)',
    Math.abs(marina.officialScans - computed) <= 2,
    `official ${marina.officialScans} vs computed ${computed}`
  );
}

check(
  'summary totals are consistent',
  summary.totalCourts === courts.length &&
    summary.plotted + summary.needsLocation === summary.totalCourts
);

const scansResp = await fetch(`${base}/api/scans?from=2026-06-01&to=2026-06-09`);
check('/api/scans returns 200', scansResp.status === 200, `got ${scansResp.status}`);
const scansBody = await scansResp.json();
check('scan days returned', Array.isArray(scansBody.days) && scansBody.days.length > 0);
check(
  'scan rows have date + human/bot numbers',
  (scansBody.days || []).every(
    (d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date) && Number.isFinite(d.human) && Number.isFinite(d.bot)
  )
);

const badResp = await fetch(`${base}/api/scans?from=junk`);
check('/api/scans rejects malformed dates with 400', badResp.status === 400, `got ${badResp.status}`);

// Secret hygiene: nothing sensitive in the client bundle.
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
for (const needle of ['UNIQODE', 'service_role', 'SUPABASE_SERVICE', 'supabase.co/rest']) {
  check(`index.html does not contain "${needle}"`, !html.includes(needle));
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
