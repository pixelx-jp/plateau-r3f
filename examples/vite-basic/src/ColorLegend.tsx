import type { BuiltinColorBy, HazardType } from '@yodolabs/plateau-r3f';

interface Stop {
  color: string;
  label: string;
}

// Mirror of the ramps inside @yodolabs/plateau-r3f. Keep these in sync with
// src/style/colorBy.ts and src/hazards/hazardColor.ts when updating.
const COLOR_BY_RAMPS: Record<BuiltinColorBy, { title: string; stops: Stop[]; kind: 'linear' | 'categorical' }> = {
  year_built: {
    title: 'Year built',
    kind: 'linear',
    stops: [
      { color: '#5e3c99', label: '1900' },
      { color: '#b2abd2', label: '1950' },
      { color: '#f6e8c3', label: '1981' },
      { color: '#fdb863', label: '2000' },
      { color: '#e66101', label: '2020' },
    ],
  },
  height: {
    title: 'Height (m)',
    kind: 'linear',
    stops: [
      { color: '#edf8fb', label: '0' },
      { color: '#b3cde3', label: '10' },
      { color: '#8c96c6', label: '30' },
      { color: '#8856a7', label: '60' },
      { color: '#810f7c', label: '120+' },
    ],
  },
  structure: {
    title: 'Structure',
    kind: 'categorical',
    stops: [
      { color: '#3182bd', label: 'RC' },
      { color: '#6baed6', label: 'SRC' },
      { color: '#9ecae1', label: 'S' },
      { color: '#fd8d3c', label: 'W' },
      { color: '#e6550d', label: 'CB' },
      { color: '#bbbbbb', label: 'Other' },
    ],
  },
  // Hazard types as colorBy use depth ramps internally; show inundation depth.
  river_flood: {
    title: 'River flood depth',
    kind: 'linear',
    stops: [
      { color: '#ffffcc', label: '0' },
      { color: '#a1dab4', label: '1m' },
      { color: '#41b6c4', label: '3m' },
      { color: '#2c7fb8', label: '5m' },
      { color: '#253494', label: '10m+' },
    ],
  },
  inland_flood: { title: 'Inland flood', kind: 'linear', stops: [] },
  tsunami: { title: 'Tsunami', kind: 'linear', stops: [] },
  storm_surge: { title: 'Storm surge', kind: 'linear', stops: [] },
  landslide: {
    title: 'Landslide zone',
    kind: 'categorical',
    stops: [
      { color: '#d73027', label: 'In zone' },
      { color: '#9ad48a', label: 'Safe' },
    ],
  },
};

const HAZARD_RAMPS: Record<HazardType, Stop[]> = {
  river_flood: COLOR_BY_RAMPS.river_flood.stops,
  inland_flood: COLOR_BY_RAMPS.river_flood.stops,
  tsunami: COLOR_BY_RAMPS.river_flood.stops,
  storm_surge: COLOR_BY_RAMPS.river_flood.stops,
  landslide: COLOR_BY_RAMPS.landslide.stops,
};

const HAZARD_TITLES: Record<HazardType, string> = {
  river_flood: 'River flood',
  inland_flood: 'Inland flood',
  tsunami: 'Tsunami',
  storm_surge: 'Storm surge',
  landslide: 'Landslide',
};

function LinearRamp({ stops }: { stops: Stop[] }) {
  const gradient = `linear-gradient(to right, ${stops.map((s) => s.color).join(', ')})`;
  return (
    <div>
      <div
        style={{
          height: 10,
          borderRadius: 4,
          background: gradient,
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 4,
          fontSize: 10,
          color: 'var(--muted)',
        }}
      >
        {stops.map((s, i) => (
          <span key={i}>{s.label}</span>
        ))}
      </div>
    </div>
  );
}

function CategoricalRamp({ stops }: { stops: Stop[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', marginTop: 4 }}>
      {stops.map((s, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              background: s.color,
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          />
          <span style={{ color: 'var(--muted)' }}>{s.label}</span>
        </span>
      ))}
    </div>
  );
}

export function ColorLegend({
  colorBy,
  hazard,
}: {
  colorBy: BuiltinColorBy;
  hazard: HazardType | 'none';
}) {
  const ramp = COLOR_BY_RAMPS[colorBy];
  return (
    <div className="legend">
      <div className="legend-section">
        <div className="legend-title">{ramp.title}</div>
        {ramp.kind === 'linear' ? (
          <LinearRamp stops={ramp.stops} />
        ) : (
          <CategoricalRamp stops={ramp.stops} />
        )}
      </div>
      {hazard !== 'none' && (
        <div className="legend-section">
          <div className="legend-title">
            {HAZARD_TITLES[hazard]}{' '}
            <span style={{ color: 'var(--muted)', fontWeight: 400 }}>· overlay</span>
          </div>
          {hazard === 'landslide' ? (
            <CategoricalRamp stops={HAZARD_RAMPS[hazard]} />
          ) : (
            <LinearRamp stops={HAZARD_RAMPS[hazard]} />
          )}
        </div>
      )}
    </div>
  );
}
