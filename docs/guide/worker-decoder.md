# Worker-backed Arrow decoder

Most cities decode in <100 µs per tile, so the default main-thread decoder is fine. For very large tiles (>10k rows) or scenes that exhaust your main-thread budget, plug a Worker-backed decoder:

```ts
import { Plateau, createWorkerStyleDecoder } from '@plateau/r3f';

// Vite: ?worker import. Other bundlers — see their docs.
import StyleWorker from '@plateau/r3f/dist/styleWorker?worker';

const worker = new StyleWorker();
const decoder = createWorkerStyleDecoder(worker);

<Plateau city="chiyoda" colorBy="height" styleDecoder={decoder} />
```

The included `styleWorker.ts` only does the `fetch` in the worker and posts back the bytes (zero-copy transfer). Arrow parsing still happens on the main thread to keep the worker bundle small.

For maximum offload, write your own worker that does both fetch + Arrow IPC parsing + returns a serialized columnar shape; then construct a custom object satisfying the `StyleTable` interface on the main thread.
