import { useEffect, useRef, useState } from 'react';
import type { BuildingAttributes, BuildingFilter } from '../types/public';
import { usePlateauContext } from './usePlateauContext';
import { selectColorPlanVersion, selectVisibleTileUris } from '../store/selectors';

/**
 * Materializes attributes for every visible building. Recomputes only when
 * the visible tile set changes, the color plan version changes, or the
 * subscribed store version changes. Heavy filtering is left to the caller's
 * `filter.predicate`.
 *
 * For very large scenes prefer subscribing to `<store>` directly with a
 * narrower selector and materializing on-demand.
 */
export function useBuildings(filter?: BuildingFilter): BuildingAttributes[] {
  const { runtime, store } = usePlateauContext();
  const filterRef = useRef(filter);
  filterRef.current = filter;

  const [list, setList] = useState<BuildingAttributes[]>(() =>
    runtime.queryVisibleBuildings(filterRef.current),
  );

  useEffect(() => {
    let lastVisible = selectVisibleTileUris(store.getState());
    let lastVersion = selectColorPlanVersion(store.getState());
    const unsub = store.subscribe((s) => {
      const v = selectVisibleTileUris(s);
      const ver = selectColorPlanVersion(s);
      const sameLen = v.length === lastVisible.length;
      const same =
        sameLen && (v === lastVisible || v.every((u, i) => u === lastVisible[i]));
      if (!same || ver !== lastVersion) {
        lastVisible = v;
        lastVersion = ver;
        setList(runtime.queryVisibleBuildings(filterRef.current));
      }
    });
    return unsub;
  }, [runtime, store]);

  return list;
}
