// Regenerate the .arrow fixture file. Run once with:
//   node test/fixtures/mini-city/generate.mjs
import fs from 'node:fs';
import path from 'node:path';
import { tableFromArrays, tableToIPC } from 'apache-arrow';

const table = tableFromArrays({
  tile_feature_id: new Int32Array([0, 1]),
  year_built: new Float64Array([1985, 2005]),
  height: new Float64Array([12, 30]),
  river_flood_covered: [true, true],
  river_flood_depth_max: new Float64Array([0, 2.5]),
  landslide_covered: [false, false],
});

const bytes = tableToIPC(table, 'file');
const outDir = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(outDir, 'style', '0%2F0%2F0_bldg_Building.glb.arrow');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, bytes);
console.log('wrote', out, bytes.length, 'bytes');
