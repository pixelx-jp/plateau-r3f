# Custom hazard layer

`registerHazardLayer` declares a new hazard type and its field bindings:

```ts
import { registerHazardLayer, HazardLayer } from '@yodolabs/plateau-r3f';

registerHazardLayer({
  type: 'heat_island',
  valueField: 'heat_island_index',
  coveredField: 'heat_island_covered',
  defaultRamp: {
    type: 'linear',
    stops: [
      { value: 0, color: '#fff7bc' },
      { value: 1, color: '#fec44f' },
      { value: 2, color: '#d95f0e' },
    ],
  },
});

// then anywhere inside <Plateau>:
<HazardLayer type="heat_island" opacity={0.6} />
```

For zone-style hazards (boolean per building), set `inZoneField` instead of `valueField`:

```ts
registerHazardLayer({
  type: 'evac_zone_a',
  inZoneField: 'evac_zone_a_in',
  coveredField: 'evac_zone_a_covered',
});
```

Built-in types cannot be overridden — `registerHazardLayer({ type: 'river_flood', ... })` throws.

The unregister function returned by `registerHazardLayer` removes the registration. Call it on unmount if you registered conditionally.
