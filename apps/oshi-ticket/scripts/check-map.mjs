import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Module, { createRequire } from 'node:module';
import ts from 'typescript';
const nativeRequire = createRequire(import.meta.url);
const loaded = new Map();
function loadSource(filename) {
  if (loaded.has(filename)) return loaded.get(filename).exports;
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } });
  const mod = new Module(filename); mod.filename = filename; loaded.set(filename, mod);
  mod.require = (name) => {
    if (!name.startsWith('.')) return nativeRequire(name);
    const base = path.resolve(path.dirname(filename), name);
    if (name.endsWith('.json')) return nativeRequire(base);
    const source = ['.ts', '.tsx'].map(ext => base + ext).find(file => fs.existsSync(file));
    return source ? loadSource(source) : nativeRequire(base);
  };
  mod._compile(compiled.outputText, filename);
  return mod.exports;
}
const mod = { exports: loadSource(path.resolve('src/app/map-utils.ts')) };
const { toWorldPixel, fromWorldPixel, distanceMeters, prefectureAt, nearbySpots } = mod.exports;
for (const point of [{ latitude: 0, longitude: 0 }, { latitude: 34.66206, longitude: 135.434855 }, { latitude: -33.8, longitude: -179.9 }]) {
  for (const zoom of [0, 11, 17]) {
    const pixel = toWorldPixel(point, zoom); const actual = fromWorldPixel(pixel.x, pixel.y, zoom);
    assert.ok(Math.abs(actual.latitude - point.latitude) < 1e-8); assert.ok(Math.abs(actual.longitude - point.longitude) < 1e-8);
  }
}
assert.equal(distanceMeters({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0 }), 0);
assert.ok(Math.abs(distanceMeters({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 }) - 111195) < 1);
const features = JSON.parse(fs.readFileSync('public/data/prefectures.geojson', 'utf8')).features;
const center = { latitude: 34.66206, longitude: 135.434855 };
assert.equal(prefectureAt(center, features), '大阪府');
assert.equal(prefectureAt({ latitude: 35.7056, longitude: 139.7519 }, features), '東京都');
assert.equal(prefectureAt({ latitude: 0, longitude: 0 }, features), null);
const shape = [{ properties: { N03_001: 'test' }, geometry: { type: 'Polygon', coordinates: [[[0,0],[10,0],[10,10],[0,10],[0,0]], [[4,4],[6,4],[6,6],[4,6],[4,4]]] } }];
assert.equal(prefectureAt({latitude:2,longitude:2},shape),'test');
assert.equal(prefectureAt({latitude:5,longitude:5},shape),null);
const node = (id, name, lat, lon) => ({type:'node', id, lat, lon, tags:{name,tourism:'museum'}});
const spots = nearbySpots([
  node(1,'近く',34.663,135.435), node(1,'近く',34.663,135.435),
  {type:'way',id:2,center:{lat:34.664,lon:135.435},tags:{name:'遠め',tourism:'attraction'}},
  node(3,'範囲外',35,135), node(4,'近く',34.66301,135.43501),node(5,'',34.663,135.435),
  node(6,'不正',NaN,135),node(7,'不正緯度',394.663,135.435),
],center);
assert.deepEqual(spots.map(s=>s.name),['近く','遠め']);
assert.ok(spots[0].distance < spots[1].distance); assert.deepEqual(nearbySpots([],center),[]);
console.log('PASS: projection round trips, distance, prefecture boundaries/holes, POI radius/centers/deduplication/validation');

const { dateMonth, stayFacts } = loadSource(path.resolve('src/app/stay-insights.tsx'));
assert.equal(dateMonth('2026-11-07'), 11);
assert.equal(dateMonth(''), null);
assert.equal(dateMonth('2026-13-07'), null);
const january = stayFacts('大阪府', 2024, 1);
assert.equal(january.months.length, 12);
assert.equal(january.selected.occupancy, 65);
assert.equal(january.rank, 12);
const annualData = JSON.parse(fs.readFileSync('src/data/links-tourism.json', 'utf8'));
const current = annualData.guestCounts.find(r => r.prefectureCode === 27 && r.year === 2024).total;
const previous = annualData.guestCounts.find(r => r.prefectureCode === 27 && r.year === 2023).total;
assert.ok(Math.abs(january.change - (current / previous - 1) * 100) < 1e-9);
assert.equal(stayFacts('大阪府',2021,1).change,null);
const monthlyData = JSON.parse(fs.readFileSync('src/data/stay-seasonality.json','utf8'));
assert.equal(monthlyData.records.length,47);
for (const row of monthlyData.records) {
 assert.equal(row.months.length,12);
 assert.deepEqual(row.months.map(m => m.month), Array.from({length:12}, (_,i) => i+1));
 assert.ok(row.months.every(m => m.occupancy === null || (m.occupancy >= 0 && m.occupancy <= 100)));
}
const venues = JSON.parse(fs.readFileSync('src/data/venues.json','utf8'));
assert.ok(venues.some(v => v.name === '日本武道館' && v.prefecture === '東京都'));
assert.ok(venues.some(v => v.name === 'さいたまスーパーアリーナ' && v.prefecture === '埼玉県'));
assert.ok(!venues.some(v => v.name === '函館アリーナ前'));
console.log('PASS: calendar month/ranking, Project LINKS year-over-year change, 47 x 12 observations, venue import filtering');

const { GET: nearbyGet } = loadSource(path.resolve('src/app/api/nearby/route.ts'));
const { GET: venueGet } = loadSource(path.resolve('src/app/api/venues/route.ts'));
assert.equal((await nearbyGet(new Request('http://localhost/api/nearby?lat=&lon=139'))).status,400);
assert.equal((await nearbyGet(new Request('http://localhost/api/nearby?lat=NaN&lon=139'))).status,400);
assert.equal((await venueGet(new Request('http://localhost/api/venues?q='))).status,400);
const venueResponse = await venueGet(new Request('http://localhost/api/venues?q=' + encodeURIComponent('日本武道館')));
assert.equal(venueResponse.status,200);
assert.equal((await venueResponse.json()).venues[0].prefecture,'東京都');
const originalFetch = globalThis.fetch;
try {
 globalThis.fetch = async () => Response.json({elements:[node(12,'テスト博物館',35.694,139.75)]});
 const response = await nearbyGet(new Request('http://localhost/api/nearby?lat=35.6933578&lon=139.7498715'));
 const result = await response.json(); assert.equal(result.spots[0].name,'テスト博物館'); assert.equal(result.kind,undefined);
 globalThis.fetch = async () => { throw new Error('simulated outage'); };
 const fallback = await (await nearbyGet(new Request('http://localhost/api/nearby?lat=35.6933578&lon=139.7498715'))).json();
 assert.equal(fallback.kind,'cultural'); assert.ok(fallback.notice); assert.ok(fallback.spots.length > 0);
 assert.ok(fallback.spots.every(s => s.distance <= 2000 && s.category === '劇場・文化施設'));
} finally { globalThis.fetch = originalFetch; }
console.log('PASS: API validation, local venue lookup, nearby response transformation, clearly labeled cultural fallback');

const { ferryFacts, ferryRegion, railways } = loadSource(path.resolve('src/app/travel-data.ts'));
assert.equal(ferryRegion('北海道'),'北海道');
assert.equal(ferryRegion('大阪府'),'近畿');
assert.equal(ferryRegion('不明'),null);
assert.equal(ferryFacts('広島県').samples,14);
assert.equal(ferryFacts('大阪府').samples,7);
assert.ok(railways.length > 300);
assert.ok(railways.every(r => r.year === 2022 && Number.isFinite(r.kilometers) && r.kilometers > 0));
assert.equal(new Set(railways.map(r=>r.id)).size,railways.length);
const ferryData = JSON.parse(fs.readFileSync('src/data/ferry.json','utf8'));
assert.equal(ferryData.totalSamples,106);
assert.equal(ferryData.connections.reduce((total,row)=>total+row.samples,0),97);
const { GET: lodgingsGet } = loadSource(path.resolve('src/app/api/lodgings/route.ts'));
assert.equal((await lodgingsGet(new Request('http://localhost/api/lodgings?lat=0&lon=0'))).status,400);
try {
 globalThis.fetch = async () => Response.json({elements:[{type:'node',id:12,lat:35.694,lon:139.75,tags:{name:'Test Hotel',tourism:'hotel'}}]});
 const response = await lodgingsGet(new Request('http://localhost/api/lodgings?lat=35.6933578&lon=139.7498715'));
 const result = await response.json(); assert.equal(result.lodgings[0].category,'ホテル'); assert.ok(result.lodgings[0].distance < 3000);
 globalThis.fetch = async () => { throw new Error('simulated outage'); };
 assert.equal((await lodgingsGet(new Request('http://localhost/api/lodgings?lat=35.6933578&lon=139.7498715'))).status,502);
} finally { globalThis.fetch = originalFetch; }
console.log('PASS: railway units/identifiers, anonymized ferry aggregation, lodging validation/success/outage');
