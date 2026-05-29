# Shader extensions

Mount extra GLSL into the patched per-tile material via `shaderExtensions`. Each extension declares an `id` (joined into `customProgramCacheKey` so different extensions produce different cached programs) and an `apply(shader)` hook.

```ts
import * as THREE from 'three';
import { Plateau, type ShaderExtension } from '@plateau/r3f';

const rimLight: ShaderExtension = {
  id: 'rim-light',
  uniforms: { uRimColor: { value: new THREE.Color('#88ccff') } },
  apply(shader) {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <output_fragment>',
      `
        float rim = pow(1.0 - dot(normalize(vNormal), vec3(0.0, 0.0, 1.0)), 2.0);
        gl_FragColor.rgb += uRimColor * rim * 0.4;
        #include <output_fragment>
      `,
    );
  },
};

<Plateau city="chiyoda" colorBy="height" shaderExtensions={[rimLight]} />
```

Rules:

- **Don't** put dynamic state (camera, time, etc.) into the cache key — keep it in uniforms.
- Extensions may modify `vertexShader` too; their `apply` is called inside the same `onBeforeCompile` after plateau's own injection.
- If the material isn't a recognized lit material (e.g. `ShaderMaterial`), the extension is skipped and `onError` is called with `unknown`.
