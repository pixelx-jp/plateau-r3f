import type { HazardLayerProps } from '../types/public';
import { HazardLayer } from './HazardLayer';

/**
 * Convenience aliases for the 5 built-in hazard types. Each is exactly
 * equivalent to `<HazardLayer type="..." />`. Use whichever reads better.
 */

type Omitted = Omit<HazardLayerProps, 'type'>;

export function FloodLayer(props: Omitted): null {
  return HazardLayer({ ...props, type: 'river_flood' });
}

export function InlandFloodLayer(props: Omitted): null {
  return HazardLayer({ ...props, type: 'inland_flood' });
}

export function TsunamiLayer(props: Omitted): null {
  return HazardLayer({ ...props, type: 'tsunami' });
}

export function StormSurgeLayer(props: Omitted): null {
  return HazardLayer({ ...props, type: 'storm_surge' });
}

export function LandslideLayer(props: Omitted): null {
  return HazardLayer({ ...props, type: 'landslide' });
}
