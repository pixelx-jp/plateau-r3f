import { bench, describe } from 'vitest';
import { tableFromArrays, tableFromIPC, tableToIPC } from 'apache-arrow';
import { createStyleTable } from '../../src/style/StyleTable';
import { compileColorBy } from '../../src/style/colorBy';
import { compileHazardLayer } from '../../src/hazards/hazardColor';
import { buildTileColorTexture } from '../../src/style/TileColorizer';

const N_SMALL = 300;
const N_LARGE = 3000;

function makeTable(n: number) {
  return tableFromArrays({
    tile_feature_id: Int32Array.from({ length: n }, (_, i) => i),
    year_built: Float64Array.from({ length: n }, (_, i) => 1900 + (i % 120)),
    height: Float64Array.from({ length: n }, (_, i) => 5 + (i % 100)),
    structure: Array.from({ length: n }, (_, i) => ['RC', 'S', 'W'][i % 3]),
    river_flood_covered: Array.from({ length: n }, (_, i) => i % 3 !== 0),
    river_flood_depth_max: Float64Array.from({ length: n }, (_, i) => (i % 7) * 0.5),
  });
}

const tableSmall = makeTable(N_SMALL);
const ipcSmall = tableToIPC(tableSmall, 'file').buffer as ArrayBuffer;
const tableLarge = makeTable(N_LARGE);
const ipcLarge = tableToIPC(tableLarge, 'file').buffer as ArrayBuffer;

const styleSmall = createStyleTable(tableSmall, 'small');
const styleLarge = createStyleTable(tableLarge, 'large');
const colorBy = compileColorBy('height', '#888888');
const hazardLayer = compileHazardLayer({
  id: 'l1',
  type: 'river_flood',
  visible: true,
  opacity: 0.6,
});

describe(`Arrow IPC decode`, () => {
  bench(`small (${N_SMALL} rows)`, () => {
    tableFromIPC(new Uint8Array(ipcSmall));
  });
  bench(`large (${N_LARGE} rows)`, () => {
    tableFromIPC(new Uint8Array(ipcLarge));
  });
});

describe('buildTileColorTexture', () => {
  bench(`small (${N_SMALL} rows, colorBy only)`, () => {
    const tex = buildTileColorTexture({ table: styleSmall, colorBy, layers: [] });
    tex.texture.dispose();
  });
  bench(`small (${N_SMALL} rows, +river_flood)`, () => {
    const tex = buildTileColorTexture({
      table: styleSmall,
      colorBy,
      layers: [hazardLayer],
    });
    tex.texture.dispose();
  });
  bench(`large (${N_LARGE} rows, +river_flood)`, () => {
    const tex = buildTileColorTexture({
      table: styleLarge,
      colorBy,
      layers: [hazardLayer],
    });
    tex.texture.dispose();
  });
});

describe('queryVisibleBuildings (materialize)', () => {
  bench(`materialize ${N_SMALL} features`, () => {
    for (let fid = 0; fid < N_SMALL; fid++) styleSmall.materialize(fid);
  });
  bench(`materialize ${N_LARGE} features`, () => {
    for (let fid = 0; fid < N_LARGE; fid++) styleLarge.materialize(fid);
  });
});
