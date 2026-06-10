// One-time seeding of verified court locations into Uniqode QR code metadata.
//
//   UNIQODE_API_KEY=<key> node scripts/seed-locations.js            # dry run
//   UNIQODE_API_KEY=<key> node scripts/seed-locations.js --live     # write
//   UNIQODE_API_KEY=<key> node scripts/seed-locations.js --live --force  # overwrite existing
//
// Seeds below are the 30 Salesforce-verified entries from the pre-rebuild map
// (frozen here for auditability). Previously-geocoded coordinates are NOT
// written — they are unverified suggestions, kept in docs/location-suggestions.json
// for the team to confirm via the Uniqode dashboard Metadata panel.
//
// Empirically verified (2026-06-10): PATCH /api/2.0/qrcodes/{id}/ accepts
// {"metadata": {...}}; lat/lon must be JSON numbers; string values reject
// special characters beyond hyphen/underscore/space (addresses pre-sanitized).

const SEEDS = [
  {
    "id": 9813864,
    "name": "QR-CA-DublinUSD-YorkAlternativeLearningCenter",
    "lat": 37.71069,
    "lon": -121.91906,
    "address": ""
  },
  {
    "id": 11102180,
    "name": "QR-NV-LasVegas-PoliceMemorialPark",
    "lat": 36.22001,
    "lon": -115.3107,
    "address": "3250 Metro Academy Way Las Vegas NV 89129"
  },
  {
    "id": 11102176,
    "name": "QR-NV-Henderson-CornerstonePark",
    "lat": 36.03805,
    "lon": -115.05437,
    "address": ""
  },
  {
    "id": 11101162,
    "name": "QR-NV-LasVegas-BillBriarePark",
    "lat": 36.17884,
    "lon": -115.24994,
    "address": ""
  },
  {
    "id": 11102199,
    "name": "QR-NV-LasVegas-WoofterFamilyPark",
    "lat": 36.18943,
    "lon": -115.24784,
    "address": ""
  },
  {
    "id": 11102213,
    "name": "QR-NV-LasVegas-VonTobelCommunityCenter",
    "lat": 36.2039,
    "lon": -115.09544,
    "address": ""
  },
  {
    "id": 11101128,
    "name": "QR-NV-LasVegas-GarehimeHeightsPark",
    "lat": 36.23141,
    "lon": -115.29375,
    "address": ""
  },
  {
    "id": 10837654,
    "name": "QR-WA-Yelm-YelmCityPark",
    "lat": 46.93978,
    "lon": -122.60793,
    "address": "115 SE Mosman Avenue Yelm WA 98597"
  },
  {
    "id": 10554578,
    "name": "QR-TX-FarmersBranch-FarmersBranchPoliceDepartment",
    "lat": 32.92523,
    "lon": -96.85528,
    "address": "3723 Valley View Ln Farmers Branch TX 75244"
  },
  {
    "id": 10449439,
    "name": "QR-FL-SantaRosaCounty-OptimistPark",
    "lat": 30.38582,
    "lon": -87.05687,
    "address": "1370 Tiger Park Ln Gulf Breeze FL 32563"
  },
  {
    "id": 10371042,
    "name": "QR-TX-WylieISD-WylieHighSchool",
    "lat": 32.37485,
    "lon": -99.78425,
    "address": "4502 Antilley Rd Abilene TX 79606"
  },
  {
    "id": 10344997,
    "name": "QR-OK-Moore-FairmoorePark",
    "lat": 35.34192,
    "lon": -97.49626,
    "address": "630 NW 5th St Moore OK 73160"
  },
  {
    "id": 9850296,
    "name": "QR-TX-Brownsville-MonteBellaPark",
    "lat": 25.95576,
    "lon": -97.54114,
    "address": "2485 W Alton Gloor Boulevard Brownsville TX 78520"
  },
  {
    "id": 9808422,
    "name": "QR-GA-HenryCounty-VillageUnitedPark",
    "lat": 33.53784,
    "lon": -84.16332,
    "address": "1041 Millers Mill Rd Stockbridge GA 30281"
  },
  {
    "id": 9785517,
    "name": "QR-NC-JonesCounty-JonesSeniorHighSchool",
    "lat": 35.03518,
    "lon": -77.33203,
    "address": "1378 NC-58 Trenton NC 28585"
  },
  {
    "id": 9164185,
    "name": "QR-NY-SUNYSchenectady-MohawkHudson",
    "lat": 42.81683,
    "lon": -73.95549,
    "address": "Schenectady NY 12302"
  },
  {
    "id": 9164189,
    "name": "QR-NY-Troy-1-Knickerbacker",
    "lat": 42.75951,
    "lon": -73.67474,
    "address": "103rd St 8th Ave Troy NY 12182"
  },
  {
    "id": 9139786,
    "name": "QR-NY-AlbanyCounty-BerneTownPark",
    "lat": 42.62572,
    "lon": -74.15577,
    "address": "1883 Helderberg Trail Berne NY 12023"
  },
  {
    "id": 9164193,
    "name": "QR-NY-Troy-2-Prospect",
    "lat": 42.72333,
    "lon": -73.68392,
    "address": "Prospect Park Rd Troy NY 12180"
  },
  {
    "id": 9164184,
    "name": "QR-NY-AlbanyCollege-UnionDr",
    "lat": 42.65021,
    "lon": -73.78,
    "address": "106 New Scotland Avenue Albany NY 12208"
  },
  {
    "id": 8664804,
    "name": "QR-SF-SanFranciscoCA-LakeMerced",
    "lat": 37.71236,
    "lon": -122.48907,
    "address": "558 John Muir Drive San Francisco CA 94132"
  },
  {
    "id": 9164188,
    "name": "QR-NY-CityofSchenectady-Orchard",
    "lat": 42.80119,
    "lon": -73.94982,
    "address": "737 Orchard Street Schenectady NY 12303"
  },
  {
    "id": 9701730,
    "name": "QR-NY-Rochester-GeneseeValleyPark",
    "lat": 43.14096,
    "lon": -77.57507,
    "address": "80 Culver Road Rochester NY 14610"
  },
  {
    "id": 9164182,
    "name": "QR-NY-AlbanyCounty-Tawasentha",
    "lat": 42.70169,
    "lon": -73.93464,
    "address": "188 NY-146 Altamont NY 12009"
  },
  {
    "id": 9164196,
    "name": "QR-NY-Troy-4-Beman",
    "lat": 42.73292,
    "lon": -73.67428,
    "address": ""
  },
  {
    "id": 9164194,
    "name": "QR-NY-Troy-3-112thSt",
    "lat": 42.77054,
    "lon": -73.6761,
    "address": ""
  },
  {
    "id": 8664801,
    "name": "QR-SF-SanFranciscoCA-MarinaGreen",
    "lat": 37.80614,
    "lon": -122.43512,
    "address": "180 Marina Blvd San Francisco CA 94123"
  },
  {
    "id": 8702075,
    "name": "QR-CA-StanfordUniversity-ArguelloField",
    "lat": 37.42383,
    "lon": -122.16484,
    "address": "498 Arguello Way Stanford CA 94305"
  },
  {
    "id": 9484548,
    "name": "QR-FL-HernandoCounty-VeteransMemorialPark",
    "lat": 28.46199,
    "lon": -82.52101,
    "address": "12254 Spring Hill Dr Spring Hill FL 34609"
  },
  {
    "id": 10915200,
    "name": "QR-GA-StoneMountain-McCurdyPark",
    "lat": 33.80699,
    "lon": -84.17716,
    "address": "5190 W Mountain St Stone Mountain GA 30083"
  }
];

const API = 'https://api.uniqode.com/api/2.0';
const KEY = process.env.UNIQODE_API_KEY;
if (!KEY) {
  console.error('Set UNIQODE_API_KEY');
  process.exit(1);
}
const LIVE = process.argv.includes('--live');
const FORCE = process.argv.includes('--force');
const headers = { Authorization: `Token ${KEY}`, 'Content-Type': 'application/json' };

const results = { seeded: [], skipped: [], failed: [] };

for (const seed of SEEDS) {
  try {
    const current = await fetch(`${API}/qrcodes/${seed.id}/`, { headers }).then((r) => {
      if (!r.ok) throw new Error(`GET ${r.status}`);
      return r.json();
    });
    const existing = current.metadata || {};
    if (existing.lat != null && !FORCE) {
      results.skipped.push(`${seed.name} (already has lat=${existing.lat})`);
      continue;
    }
    const metadata = { ...existing, lat: seed.lat, lon: seed.lon };
    if (seed.address) metadata.address = seed.address;

    if (!LIVE) {
      results.seeded.push(`${seed.name} -> lat=${seed.lat} lon=${seed.lon} [DRY RUN]`);
      continue;
    }
    const resp = await fetch(`${API}/qrcodes/${seed.id}/`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ metadata }),
    });
    if (!resp.ok) throw new Error(`PATCH ${resp.status}: ${(await resp.text()).slice(0, 120)}`);
    results.seeded.push(`${seed.name} -> lat=${seed.lat} lon=${seed.lon}`);
  } catch (err) {
    results.failed.push(`${seed.name}: ${err.message}`);
  }
}

console.log(`\n${LIVE ? 'SEEDED' : 'WOULD SEED (dry run)'}: ${results.seeded.length}`);
results.seeded.forEach((s) => console.log('  +', s));
console.log(`\nSKIPPED (already set): ${results.skipped.length}`);
results.skipped.forEach((s) => console.log('  =', s));
console.log(`\nFAILED: ${results.failed.length}`);
results.failed.forEach((s) => console.log('  !', s));
process.exit(results.failed.length ? 1 : 0);
