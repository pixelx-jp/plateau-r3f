# Hooks

All hooks must be used inside `<Plateau>`.

## `useBuilding(key?)`

```ts
const attrs = useBuilding({
  tile_content_uri: '15/29102/4943_bldg_Building.glb',
  feature_id: 380,
});
```

Returns the materialized `BuildingAttributes` (with `_attribution`) or `undefined` if the tile isn't loaded yet.

For PMTiles fallback buildings, use the synthetic key:

```ts
useBuilding({ tile_content_uri: 'pmtiles://15/29103/12873', feature_id: 0 });
```

## `useBuildings(filter?)`

Returns all currently-visible buildings.

```ts
const tall = useBuildings({
  predicate: (a) => (a.height ?? 0) > 80,
  limit: 100,
});
```

Recomputes only when the visible tile set changes or the color plan version changes — keeps `filter` in a ref so changing the predicate doesn't trigger a full re-subscription.

## `usePlateauContext()` / `usePlateauContextOptional()`

```ts
const { runtime, store, artifacts, registerHazardLayer } = usePlateauContext();
```

The strict variant throws outside `<Plateau>`; the optional variant returns `null`. Use the optional one in components that may render standalone (e.g. shared `<FootprintLayer>`).
