import { useEffect, useId, useRef } from 'react';
import type { HazardLayerProps, HazardLayerState } from '../types/public';
import { usePlateauContext } from '../hooks/usePlateauContext';

export function HazardLayer(props: HazardLayerProps): null {
  const id = useId();
  const ctx = usePlateauContext();
  const { type, visible = true, opacity = 0.6, colorRamp, missingColor, safeColor } = props;
  const registered = useRef(false);

  // Register once on mount, unregister on unmount. Visual priority follows
  // children mount order; subsequent prop changes update in place.
  useEffect(() => {
    const state: HazardLayerState = {
      id,
      type,
      visible,
      opacity,
      colorRamp,
      missingColor,
      safeColor,
    };
    const unregister = ctx.registerHazardLayer(state);
    registered.current = true;
    return () => {
      registered.current = false;
      unregister();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, id]);

  // Forward subsequent prop updates without re-inserting (which would change
  // visual stacking order under the plan's children-order rule).
  useEffect(() => {
    if (!registered.current) return;
    ctx.updateHazardLayer({
      id,
      type,
      visible,
      opacity,
      colorRamp,
      missingColor,
      safeColor,
    });
  }, [ctx, id, type, visible, opacity, colorRamp, missingColor, safeColor]);

  return null;
}
