# Components

## `<Plateau>`

```tsx
<Plateau
  city="chiyoda"
  baseUrl="https://cdn.example.com/plateau"
  colorBy="height"
  fallback="auto"
  opacity={1}
  missingColor="#bbbbbb"
  resolver={customResolver}
  shaderExtensions={[rimLight]}
  styleDecoder={workerDecoder}
  onReady={(rt) => console.log(rt.getAttribution())}
  onError={(e) => console.warn(e)}
>
  {/* HazardLayer / FootprintLayer / TileDebugLayer */}
</Plateau>
```

## `<HazardLayer>`

```tsx
<HazardLayer
  type="river_flood"
  visible
  opacity={0.6}
  colorRamp={{ type: 'linear', stops: [...] }}
  missingColor="#888888"
  safeColor="#9ad48a"
/>
```

## `<FloodLayer>` / `<InlandFloodLayer>` / `<TsunamiLayer>` / `<StormSurgeLayer>` / `<LandslideLayer>`

Thin aliases. `<FloodLayer opacity={0.6} />` ≡ `<HazardLayer type="river_flood" opacity={0.6} />`.

## `<FootprintLayer>`

PMTiles-driven extruded footprints. Auto-mounts from `<FallbackExtrusionLayer>` when needed.

```tsx
<FootprintLayer
  zoom={15}
  pmtilesUrl="https://cdn/.../buildings.pmtiles"
  flat={false}
  colorBy={(attrs) => attrs.height && attrs.height > 50 ? '#f0a' : '#5ab'}
/>
```

## `<FallbackExtrusionLayer>`

Mounts a `<FootprintLayer>` automatically when the runtime decides PMTiles fallback is needed.

```tsx
<Plateau city="..." fallback="auto">
  <FallbackExtrusionLayer />
</Plateau>
```

## `<TileDebugLayer>`

Wireframe boxes around each loaded tile, colored by lifecycle state. Use for debugging tile loading and `feature_id` detection.

```tsx
<TileDebugLayer states={['featureIdMissing']} opacity={0.5} />
```
