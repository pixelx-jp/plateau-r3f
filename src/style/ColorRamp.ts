import * as THREE from 'three';
import type { ColorRamp, Rgba8 } from '../types/public';

export function parseColor(c: THREE.ColorRepresentation, alpha = 255): Rgba8 {
  const col = new THREE.Color(c as THREE.ColorRepresentation);
  return [
    Math.round(col.r * 255),
    Math.round(col.g * 255),
    Math.round(col.b * 255),
    alpha,
  ];
}

function mix(a: Rgba8, b: Rgba8, t: number): Rgba8 {
  const it = 1 - t;
  return [
    Math.round(a[0] * it + b[0] * t),
    Math.round(a[1] * it + b[1] * t),
    Math.round(a[2] * it + b[2] * t),
    Math.round(a[3] * it + b[3] * t),
  ];
}

export interface CompiledRamp {
  evaluate(value: number | string | null | undefined): Rgba8;
}

export function compileRamp(ramp: ColorRamp): CompiledRamp {
  const missing = parseColor(ramp.missing ?? '#cccccc', 0);
  if (ramp.type === 'linear') {
    const stops = (ramp.stops ?? []).slice().sort((a, b) => a.value - b.value);
    if (stops.length === 0) {
      return { evaluate: () => missing };
    }
    const colors = stops.map((s) => parseColor(s.color));
    return {
      evaluate(v) {
        if (typeof v !== 'number' || !Number.isFinite(v)) return missing;
        if (v <= stops[0].value) return colors[0];
        if (v >= stops[stops.length - 1].value) return colors[colors.length - 1];
        for (let i = 0; i < stops.length - 1; i++) {
          if (v >= stops[i].value && v <= stops[i + 1].value) {
            const span = stops[i + 1].value - stops[i].value;
            const t = span === 0 ? 0 : (v - stops[i].value) / span;
            return mix(colors[i], colors[i + 1], t);
          }
        }
        return missing;
      },
    };
  }
  // categorical
  const cats = ramp.categories ?? {};
  const compiled = new Map<string, Rgba8>();
  for (const [k, c] of Object.entries(cats)) compiled.set(k, parseColor(c));
  return {
    evaluate(v) {
      if (v == null) return missing;
      const key = String(v);
      return compiled.get(key) ?? missing;
    },
  };
}
