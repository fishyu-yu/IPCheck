// Natural Earth 1:110m land, public domain. Run manually to refresh the bundled dots.
import { mkdir, writeFile } from 'node:fs/promises';
const source = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson';
const response = await fetch(source);
if (!response.ok) throw new Error(`Map download failed: ${response.status}`);
const data = await response.json();
const polygons = data.features.flatMap(({ geometry }) =>
  geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates,
);
function inRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x, y] = ring[i], [px, py] = ring[j];
    if ((y > lat) !== (py > lat) && lon < ((px - x) * (lat - y)) / (py - y) + x) inside = !inside;
  }
  return inside;
}
const dots = [];
for (let lat = -88; lat < 89; lat += 1.8) {
  const step = 1.8 / Math.cos((lat * Math.PI) / 180);
  for (let lon = -180 + step / 2; lon < 180; lon += step) {
    if (polygons.some(([outer, ...holes]) => inRing(lon, lat, outer) && !holes.some((hole) => inRing(lon, lat, hole))))
      dots.push([Number(lat.toFixed(2)), Number(lon.toFixed(2))]);
  }
}
await mkdir('src/data', { recursive: true });
await writeFile('src/data/globe-land.json', JSON.stringify(dots) + '\n');
console.log(`Bundled ${dots.length} land dots from Natural Earth.`);
