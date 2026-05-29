import { useEffect, useState } from 'react';
import { usePlateauContext } from '../hooks/usePlateauContext';
import { FootprintLayer } from '../components/FootprintLayer';
import type { FallbackMode } from './FallbackController';

/**
 * Mounts when the runtime decides PMTiles fallback should be active.
 * Inside <Plateau>; renders nothing when 3D Tiles are styled normally.
 */
export function FallbackExtrusionLayer(): JSX.Element | null {
  const { runtime } = usePlateauContext();
  const [mode, setMode] = useState<FallbackMode>(() => runtime.getFallbackMode());

  useEffect(() => {
    let cancelled = false;
    // Cheap polling: fallback mode is a slowly-changing aggregate
    // (depends on what tiles have loaded). Poll twice a second.
    const id = setInterval(() => {
      if (cancelled) return;
      const next = runtime.getFallbackMode();
      setMode((prev) => (prev === next ? prev : next));
    }, 500);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [runtime]);

  if (mode !== 'level-2-pmtiles-extruded' && mode !== 'level-3-pmtiles-flat') {
    return null;
  }

  return <FootprintLayer flat={mode === 'level-3-pmtiles-flat'} />;
}
