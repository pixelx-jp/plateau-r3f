# Attribution

Underlying PLATEAU data is **© Project PLATEAU / MLIT** under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). You **must** surface the credit if you ship something built on this library.

`<Plateau>` reads the manifest's `sources` block and exposes them via:

```ts
runtime.getAttribution(): Attribution[]
```

Every `BuildingAttributes` returned by `useBuilding` / `useBuildings` / `runtime.getBuilding` / `runtime.queryVisibleBuildings` also carries an `_attribution: Attribution[]` field.

Minimum compliant footer:

```text
© Project PLATEAU / MLIT — CC BY 4.0
```

Programmatic version:

```tsx
function Footer() {
  const { runtime } = usePlateauContext();
  const credits = runtime.getAttribution();
  return (
    <div>
      Data from{' '}
      {credits.map((c, i) => (
        <span key={i}>
          <a href={c.source_url}>{c.dataset_id}</a>
          {i < credits.length - 1 ? ', ' : ''}
        </span>
      ))}
      {' — '}
      <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>
    </div>
  );
}
```
