import { useEffect, useState } from 'react';
import type { BuildingAttributes, BuildingKey } from '../types/public';
import { usePlateauContext } from './usePlateauContext';

export function useBuilding(key?: BuildingKey): BuildingAttributes | undefined {
  const { runtime, store } = usePlateauContext();
  const [attrs, setAttrs] = useState<BuildingAttributes | undefined>(() =>
    key ? runtime.getBuilding(key) : undefined,
  );

  useEffect(() => {
    if (!key) {
      setAttrs(undefined);
      return;
    }
    setAttrs(runtime.getBuilding(key));
    return store.subscribe(() => {
      setAttrs(runtime.getBuilding(key));
    });
  }, [key?.tile_content_uri, key?.feature_id, runtime, store]);

  return attrs;
}
