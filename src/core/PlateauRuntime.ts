import * as THREE from 'three';
import type {
  Attribution,
  BuildingAttributes,
  BuildingFilter,
  BuildingKey,
  ColorPlan,
  FallbackPolicy,
  HazardLayerState,
  PlateauRuntimeApi,
  PlateauError,
} from '../types/public';
import { decideFallback, type FallbackMode } from '../fallback/FallbackController';
import type { TileRuntimeHandle, TileColorTexture } from '../types/internal';
import {
  createStyleTableCache,
  type StyleTableCache,
} from '../style/StyleTableCache';
import { buildTileColorTexture } from '../style/TileColorizer';
import { compileColorBy, type CompiledColorBy } from '../style/colorBy';
import { compileHazardLayer, type CompiledHazardLayer } from '../hazards/hazardColor';
import {
  applyShaderPatch,
  updateShaderUniforms,
  type ShaderExtension,
} from '../shader/ShaderInjector';
import {
  defaultResolver,
  loadArtifacts,
  type ArtifactResolver,
  type ResolvedSet,
} from './ManifestLoader';
import { createTilesetController, type TilesetController } from './TilesetController';
import { attributionsFromManifest } from './AttributionTracker';
import { joinUrl } from '../utils/uri';
import { disposeTexture } from '../utils/dispose';

export interface PlateauRuntimeOptions {
  city: string;
  baseUrl?: string;
  resolver?: ArtifactResolver;
  initialColorPlan: ColorPlan;
  initialHazardLayers?: HazardLayerState[];
  fallbackPolicy?: FallbackPolicy;
  shaderExtensions?: ShaderExtension[];
  /** Custom Arrow decoder (e.g. Worker-backed) for very large style tables. */
  styleDecoder?: (
    tile_content_uri: string,
    url: string,
    signal?: AbortSignal,
  ) => Promise<import('../style/StyleTable').StyleTable>;
  onError?: (err: PlateauError) => void;
  onFallbackChange?: (mode: FallbackMode) => void;
  /** Called when the visible-tile set changes (debounced one tick). */
  onVisibleTilesChange?: (uris: string[]) => void;
  /** Called when any tile finishes restyling — drives React hooks. */
  onColorPlanChange?: (version: number) => void;
}

let runtimeIdCounter = 0;

interface TileEntry {
  handle: TileRuntimeHandle;
  colorTexture?: TileColorTexture;
  styleVersion: number;
  /** Permanent failure (style 404 etc) — no further rebuilds attempted. */
  terminallyFailed?: boolean;
  /** True while a rebuildTile is in flight — prevents duplicate awaiters. */
  rebuildInFlight?: boolean;
  /** Counter for bounded auto-retry from rebuildTile's finally block. */
  autoRetryCount?: number;
}

const MAX_AUTO_RETRIES = 3;

export interface PlateauRuntime extends PlateauRuntimeApi {
  start(): Promise<void>;
  group: THREE.Object3D;
  artifacts: import('./ManifestLoader').ResolvedArtifacts;
  setCamera(c: THREE.Camera): void;
  setResolutionFromRenderer(c: THREE.Camera, r: THREE.WebGLRenderer): void;
  update(): void;
  isReady(): boolean;
  getFallbackMode(): FallbackMode;
  setFallbackPolicy(policy: FallbackPolicy): void;
  /**
   * Register footprint features for a synthetic `pmtiles://z/x/y` tile.
   * Called by `<FootprintLayer>` (or fallback) so query APIs see fallback
   * buildings without a 3D Tiles geometry. Pass `bbox` (world-space) so
   * `queryVisibleBuildings()` can frustum-cull.
   */
  registerFootprintTile(
    pmtilesTileUri: string,
    entries: BuildingAttributes[],
    bbox?: THREE.Box3,
  ): void;
  unregisterFootprintTile(pmtilesTileUri: string): void;
  /** Snapshot of the currently active hazard layers (used by fallback paths). */
  getHazardLayers(): HazardLayerState[];
  /** Snapshot of the active color plan (used by fallback paths). */
  getColorPlan(): ColorPlan;
}

export async function createPlateauRuntime(
  opts: PlateauRuntimeOptions,
): Promise<PlateauRuntime> {
  const resolver = opts.resolver ?? defaultResolver(opts.baseUrl);
  let resolved: ResolvedSet;
  try {
    resolved = await loadArtifacts(resolver, opts.city);
  } catch (cause) {
    const err: PlateauError = {
      code: 'manifest_not_found',
      message: `Failed to load manifest for "${opts.city}"`,
      cause,
    };
    opts.onError?.(err);
    throw err;
  }

  const { artifacts, tileIndex } = resolved;
  const attributions = attributionsFromManifest(artifacts.manifest);

  const styleCache: StyleTableCache = createStyleTableCache({
    resolveUrl: (tile_content_uri) => {
      const rel = tileIndex[tile_content_uri];
      if (rel) return joinUrl(artifacts.baseUrl, rel);
      // fall back: assume <styleDir>/<encoded>.arrow
      return `${artifacts.styleDir}/${encodeURIComponent(tile_content_uri)}.arrow`;
    },
    decoder: opts.styleDecoder,
  });

  // Decide whether to even attempt 3D Tiles. Skip when:
  //  - manifest explicitly says tiles_available=false
  //  - the user has forced footprint fallback
  //  - no tileset URL was resolved
  const tilesUnavailable =
    artifacts.manifest.artifacts?.tiles_available === false ||
    !artifacts.tilesetUrl;
  const skipTileset =
    tilesUnavailable || (opts.fallbackPolicy ?? 'auto') === 'force-footprint';

  let tileset: TilesetController | null = null;
  try {
    if (!skipTileset) {
      tileset = await createTilesetController({ tilesetUrl: artifacts.tilesetUrl });
    }
  } catch (cause) {
    // If pmtiles is available we degrade gracefully; otherwise rethrow.
    if (!artifacts.pmtilesUrl) {
      const err: PlateauError = {
        code: 'tileset_load_failed',
        message: `Failed to start tileset for "${opts.city}"`,
        cause,
      };
      opts.onError?.(err);
      throw err;
    }
    opts.onError?.({
      code: 'tileset_load_failed',
      message: `Tileset failed to load; falling back to PMTiles for "${opts.city}"`,
      cause,
    });
    tileset = null;
  }

  let plan = opts.initialColorPlan;
  let activeHazardLayers: HazardLayerState[] = opts.initialHazardLayers ?? [];
  let compiledColor: CompiledColorBy = compileColorBy(plan.colorBy, plan.missingColor);
  let compiledLayers: CompiledHazardLayer[] = activeHazardLayers
    .filter((l) => l.visible)
    .map(compileHazardLayer);

  const tiles = new Map<string, TileEntry>();
  const visibleUris = new Set<string>();
  let disposed = false;
  // Notification hooks for hooks/useBuildings — fired after rebuilds and
  // visibility changes so React components re-query.
  let planSignal = 0;
  function bumpColorPlanVersion() {
    if (disposed) return;
    planSignal += 1;
    opts.onColorPlanChange?.(planSignal);
  }
  interface FootprintTileEntry {
    entries: BuildingAttributes[];
    bbox?: THREE.Box3;
  }
  const footprintTiles = new Map<string, FootprintTileEntry>();
  let activeCamera: THREE.Camera | null = null;
  const tmpFrustum = new THREE.Frustum();
  const tmpMat = new THREE.Matrix4();
  let ready = false;

  let policy: FallbackPolicy = opts.fallbackPolicy ?? 'auto';
  let lastFallbackMode: FallbackMode | null = null;
  const runtimeId = ++runtimeIdCounter;
  const cacheKeySalt = `rt${runtimeId}`;
  const shaderExtensions = opts.shaderExtensions ?? [];

  function computeFallback(): FallbackMode {
    let hasFeatureIds = false;
    let has3dTiles = false;
    let tilesInspected = false;
    for (const entry of tiles.values()) {
      has3dTiles = true;
      tilesInspected = true;
      if (entry.handle.featureIdAttribute) {
        hasFeatureIds = true;
        break;
      }
    }
    const manifestTilesAvail = artifacts.manifest.artifacts?.tiles_available !== false;
    const manifestStyleAvail = artifacts.manifest.artifacts?.style_available !== false;
    if (!has3dTiles) has3dTiles = Boolean(artifacts.tilesetUrl) && manifestTilesAvail;
    const mode = decideFallback({
      policy,
      has3dTiles,
      hasFeatureIds,
      styleAvailable: Object.keys(tileIndex).length > 0 && manifestStyleAvail,
      pmtilesAvailable: Boolean(artifacts.pmtilesUrl),
      tilesInspected,
    });
    if (mode !== lastFallbackMode) {
      lastFallbackMode = mode;
      opts.onFallbackChange?.(mode);
    }
    return mode;
  }

  function tileAlive(entry: TileEntry, uri: string): boolean {
    if (disposed) return false;
    if (entry.handle.state === 'disposed') return false;
    if (tiles.get(uri) !== entry) return false;
    return true;
  }

  async function rebuildTile(entry: TileEntry): Promise<void> {
    const uri = entry.handle.tile_content_uri;
    // Use entry-local flags rather than handle.state — visibility events
    // overwrite state to 'visible'/'hidden' so it can't be used to gate
    // terminal failure or in-flight detection.
    if (entry.terminallyFailed) return;
    if (entry.rebuildInFlight) return;
    if (!entry.handle.featureIdAttribute) return;
    if (!tileAlive(entry, uri)) return;
    entry.rebuildInFlight = true;
    const planAtStart = plan;
    if (entry.handle.state !== 'visible' && entry.handle.state !== 'hidden') {
      entry.handle.state = 'styleRequested';
    }
    try {
      let table;
      try {
        table = await styleCache.get(uri);
      } catch (cause) {
        if (!tileAlive(entry, uri)) return;
        entry.terminallyFailed = true;
        if (entry.handle.state !== 'visible' && entry.handle.state !== 'hidden') {
          entry.handle.state = 'featureIdMissing';
        }
        opts.onError?.({
          code: 'style_load_failed',
          message: `Failed to load style for ${uri}`,
          cause,
        });
        computeFallback();
        return;
      }
      if (!tileAlive(entry, uri)) return;
      // Drop result if a newer color plan superseded ours while we awaited.
      if (entry.styleVersion >= planAtStart.version && entry.colorTexture) return;
      if (entry.handle.state !== 'visible' && entry.handle.state !== 'hidden') {
        entry.handle.state = 'styleLoaded';
      }
      if (entry.colorTexture) {
        disposeTexture(entry.colorTexture.texture);
        entry.colorTexture = undefined;
      }
      const colorTexture = buildTileColorTexture({
        table,
        colorBy: compiledColor,
        layers: compiledLayers,
      });
      if (!tileAlive(entry, uri)) {
        disposeTexture(colorTexture.texture);
        return;
      }
      entry.colorTexture = colorTexture;
      entry.styleVersion = plan.version;
      if (entry.handle.state !== 'visible' && entry.handle.state !== 'hidden') {
        entry.handle.state = 'colorTextureReady';
      }
      for (const meshEntry of entry.handle.meshes) {
        if (!meshEntry.featureIdAttribute) continue;
        applyShaderPatch(meshEntry.mesh, {
          featureIdAttribute: meshEntry.featureIdAttribute,
          colorTexture,
          opacity: plan.opacity,
          cacheKeySalt,
          extensions: shaderExtensions,
          onUnsupported: (material) => {
            opts.onError?.({
              code: 'unknown',
              message: `Material "${material.type}" is unsupported for plateau shader patch; tile ${uri} will not be styled.`,
            });
          },
        });
      }
      if (entry.handle.state !== 'visible' && entry.handle.state !== 'hidden') {
        entry.handle.state = 'shaderInjected';
      }
      bumpColorPlanVersion();
    } finally {
      entry.rebuildInFlight = false;
      // Bounded auto-retry: if this rebuild bailed (no colorTexture set)
      // while the tile is still alive, visible, and not terminally failed,
      // queue one more attempt. Without this, a rebuild that lost the
      // tileAlive race mid-flight would leave the tile unstyled until a
      // hide→visible toggle (which may never happen).
      if (
        !entry.colorTexture &&
        !entry.terminallyFailed &&
        tileAlive(entry, uri) &&
        visibleUris.has(uri) &&
        (entry.autoRetryCount ?? 0) < MAX_AUTO_RETRIES
      ) {
        entry.autoRetryCount = (entry.autoRetryCount ?? 0) + 1;
        // Defer one microtask so the recursive call doesn't deepen the stack
        // and any pending tile_alive flips have a chance to settle.
        queueMicrotask(() => {
          if (!tileAlive(entry, uri)) return;
          void rebuildTile(entry);
        });
      } else if (entry.colorTexture) {
        // Reset the counter on success so future renormalization (e.g.
        // colorBy change) starts with a fresh retry budget.
        entry.autoRetryCount = 0;
      }
    }
  }

  async function rebuildAll(): Promise<void> {
    compiledColor = compileColorBy(plan.colorBy, plan.missingColor);
    await Promise.all(Array.from(tiles.values()).map(rebuildTile));
  }

  // A neutral group when 3D Tiles is skipped — keeps `runtime.group` valid.
  const fallbackGroup = new THREE.Group();
  fallbackGroup.name = 'PlateauFallbackGroup';

  if (tileset) {
   tileset.onTileLoaded((handle) => {
    const entry: TileEntry = { handle, styleVersion: -1 };
    tiles.set(handle.tile_content_uri, entry);
    if (handle.state === 'featureIdMissing') {
      opts.onError?.({
        code: 'feature_id_missing',
        message: `Tile ${handle.tile_content_uri} has no feature id attribute; styling disabled for this tile.`,
      });
    }
    computeFallback();
    void rebuildTile(entry);
  });

  let visibleTickScheduled = false;
  function emitVisibleTiles() {
    if (visibleTickScheduled) return;
    visibleTickScheduled = true;
    queueMicrotask(() => {
      visibleTickScheduled = false;
      opts.onVisibleTilesChange?.(Array.from(visibleUris));
    });
  }

  tileset.onTileUnloaded((handle) => {
    const entry = tiles.get(handle.tile_content_uri);
    if (entry?.colorTexture) disposeTexture(entry.colorTexture.texture);
    tiles.delete(handle.tile_content_uri);
    if (visibleUris.delete(handle.tile_content_uri)) emitVisibleTiles();
    styleCache.release(handle.tile_content_uri);
  });

  tileset.onTileVisibilityChanged((handle, visible) => {
    const uri = handle.tile_content_uri;
    let changed = false;
    if (visible) {
      if (!visibleUris.has(uri)) {
        visibleUris.add(uri);
        styleCache.retain(uri);
        changed = true;
      }
      // Resilient retry: if the tile reached "visible" without being styled
      // (e.g. an earlier rebuildTile bailed because tileAlive went false
      // mid-flight while the camera was reframing), trigger a fresh rebuild.
      // Gates use entry-local flags so they survive visibility state writes.
      const entry = tiles.get(uri);
      if (
        entry &&
        entry.handle.featureIdAttribute &&
        !entry.colorTexture &&
        !entry.terminallyFailed &&
        !entry.rebuildInFlight
      ) {
        void rebuildTile(entry);
      }
    } else if (visibleUris.delete(uri)) {
      styleCache.release(uri);
      changed = true;
    }
    if (changed) emitVisibleTiles();
  });
  }  // end of "if (tileset)" block

  ready = true;

  return {
    group: tileset?.group ?? fallbackGroup,
    artifacts,
    setCamera: (c) => {
      activeCamera = c;
      tileset?.setCamera(c);
    },
    setResolutionFromRenderer: (c, r) => tileset?.setResolutionFromRenderer(c, r),
    update: () => tileset?.update(),
    isReady: () => ready,
    async start() {
      /* artifacts already loaded above */
    },
    getFallbackMode: () => computeFallback(),
    setFallbackPolicy(next) {
      policy = next;
      computeFallback();
    },
    setColorPlan(next) {
      plan = next;
      void rebuildAll();
      // Also update opacity on existing tiles immediately for snappy UX.
      for (const entry of tiles.values()) {
        if (!entry.colorTexture) continue;
        for (const meshEntry of entry.handle.meshes) {
          updateShaderUniforms(meshEntry.mesh, entry.colorTexture, plan.opacity);
        }
      }
    },
    setHazardLayers(layers) {
      activeHazardLayers = layers;
      compiledLayers = layers.filter((l) => l.visible).map(compileHazardLayer);
      void rebuildAll();
    },
    getHazardLayers: () => activeHazardLayers.slice(),
    getColorPlan: () => plan,
    getBuilding(key) {
      // Fallback path: synthetic pmtiles://z/x/y key
      if (key.tile_content_uri.startsWith('pmtiles://')) {
        const ft = footprintTiles.get(key.tile_content_uri);
        if (!ft) return undefined;
        const attrs = ft.entries[key.feature_id];
        if (!attrs) return undefined;
        return { ...attrs, _attribution: attributions };
      }
      const entry = tiles.get(key.tile_content_uri);
      if (!entry) return undefined;
      const table = styleCache.peek(key.tile_content_uri);
      if (!table) return undefined;
      const attrs = table.materialize(key.feature_id);
      attrs._attribution = attributions;
      return attrs;
    },
    queryVisibleBuildings(filter) {
      const out: BuildingAttributes[] = [];
      const limit = filter?.limit ?? Infinity;
      // Main path: 3D Tiles + arrow style. Iterate rows, not 0..featureCount —
      // feature_id may be sparse.
      for (const uri of visibleUris) {
        const table = styleCache.peek(uri);
        if (!table) continue;
        for (let row = 0; row < table.featureCount; row++) {
          const fid = table.featureIdAt(row);
          if (fid < 0) continue;
          const attrs = table.materialize(fid);
          attrs._attribution = attributions;
          if (filter?.predicate && !filter.predicate(attrs)) continue;
          out.push(attrs);
          if (out.length >= limit) return out;
        }
      }
      // Fallback path: PMTiles synthetic entries — frustum-cull when possible.
      let frustumReady = false;
      if (activeCamera) {
        const cam = activeCamera as THREE.PerspectiveCamera;
        cam.updateMatrixWorld();
        tmpMat.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
        tmpFrustum.setFromProjectionMatrix(tmpMat);
        frustumReady = true;
      }
      for (const ft of footprintTiles.values()) {
        if (frustumReady && ft.bbox && !tmpFrustum.intersectsBox(ft.bbox)) continue;
        for (const a of ft.entries) {
          const attrs = { ...a, _attribution: attributions };
          if (filter?.predicate && !filter.predicate(attrs)) continue;
          out.push(attrs);
          if (out.length >= limit) return out;
        }
      }
      return out;
    },
    registerFootprintTile(uri, entries, bbox) {
      footprintTiles.set(uri, { entries, bbox });
    },
    unregisterFootprintTile(uri) {
      footprintTiles.delete(uri);
    },
    getAttribution() {
      return attributions.slice();
    },
    dispose() {
      disposed = true;
      for (const entry of tiles.values()) {
        if (entry.colorTexture) disposeTexture(entry.colorTexture.texture);
      }
      tiles.clear();
      visibleUris.clear();
      tileset?.dispose();
      styleCache.dispose();
    },
  };
}
