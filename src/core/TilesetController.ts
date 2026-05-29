import * as THREE from 'three';
import { TilesRenderer } from '3d-tiles-renderer';
import type { Tile } from '3d-tiles-renderer';
import { ReorientationPlugin } from '3d-tiles-renderer/plugins';
import type { FeatureIdAttribute, TileRuntimeHandle } from '../types/internal';
import { detectFeatureIdAttribute } from '../shader/featureId';
import { normalizeTileContentUri } from '../utils/uri';

type Listener = (handle: TileRuntimeHandle) => void;

export interface TilesetControllerOptions {
  tilesetUrl: string;
  reorient?: { recenter?: boolean; up?: '+y' | '+z' };
}

export interface TilesetController {
  group: THREE.Object3D;
  setCamera(camera: THREE.Camera): void;
  setResolutionFromRenderer(camera: THREE.Camera, renderer: THREE.WebGLRenderer): void;
  update(): void;
  onTileLoaded(fn: Listener): () => void;
  onTileUnloaded(fn: Listener): () => void;
  onTileVisibilityChanged(fn: (h: TileRuntimeHandle, visible: boolean) => void): () => void;
  getHandles(): IterableIterator<TileRuntimeHandle>;
  dispose(): void;
}

export async function createTilesetController(
  opts: TilesetControllerOptions,
): Promise<TilesetController> {
  const renderer = new TilesRenderer(opts.tilesetUrl);
  const reorient = opts.reorient ?? { recenter: true, up: '+y' };
  renderer.registerPlugin(
    new ReorientationPlugin({
      recenter: reorient.recenter ?? true,
      up: reorient.up ?? '+y',
    }),
  );

  const handles = new Map<string, TileRuntimeHandle>();
  const loaded = new Set<Listener>();
  const unloaded = new Set<Listener>();
  const visibility = new Set<(h: TileRuntimeHandle, v: boolean) => void>();

  function deriveUri(_scene: THREE.Object3D, tile: Tile | undefined): string | undefined {
    const raw = tile?.content?.uri;
    if (!raw) return undefined;
    return normalizeTileContentUri(raw, opts.tilesetUrl);
  }

  function attachHandle(scene: THREE.Object3D, tile: Tile | undefined): TileRuntimeHandle | undefined {
    const uri = deriveUri(scene, tile);
    if (!uri) return undefined;
    const meshes: TileRuntimeHandle['meshes'] = [];
    let firstFid: FeatureIdAttribute | undefined;
    scene.traverse((child) => {
      const m = child as THREE.Mesh;
      if (!(m as { isMesh?: boolean }).isMesh) return;
      const fid = m.geometry ? detectFeatureIdAttribute(m.geometry) : undefined;
      meshes.push({ mesh: m, featureIdAttribute: fid });
      if (!firstFid && fid) firstFid = fid;
    });
    const anyHasFid = meshes.some((m) => !!m.featureIdAttribute);
    const handle: TileRuntimeHandle = {
      tile_content_uri: uri,
      object: scene,
      featureIdAttribute: firstFid,
      meshes,
      state: anyHasFid ? 'featureIdDetected' : 'featureIdMissing',
    };
    handles.set(uri, handle);
    (scene.userData as Record<string, unknown>).plateauHandle = handle;
    return handle;
  }

  renderer.addEventListener('load-model', (e) => {
    const handle = attachHandle(e.scene, e.tile);
    if (!handle) return;
    for (const fn of loaded) fn(handle);
  });

  renderer.addEventListener('dispose-model', (e) => {
    const uri = deriveUri(e.scene, e.tile);
    if (!uri) return;
    const handle = handles.get(uri);
    if (!handle) return;
    handle.state = 'disposed';
    handles.delete(uri);
    for (const fn of unloaded) fn(handle);
  });

  renderer.addEventListener('tile-visibility-change', (e) => {
    const uri = deriveUri(e.scene as THREE.Object3D, e.tile);
    if (!uri) return;
    const handle = handles.get(uri);
    if (!handle) return;
    const visible = Boolean(e.visible);
    handle.state = visible ? 'visible' : 'hidden';
    for (const fn of visibility) fn(handle, visible);
  });

  return {
    group: renderer.group,
    setCamera: (c) => {
      renderer.setCamera(c);
    },
    setResolutionFromRenderer: (c, r) => {
      renderer.setResolutionFromRenderer(c, r);
    },
    update: () => renderer.update(),
    onTileLoaded(fn) {
      loaded.add(fn);
      return () => loaded.delete(fn);
    },
    onTileUnloaded(fn) {
      unloaded.add(fn);
      return () => unloaded.delete(fn);
    },
    onTileVisibilityChanged(fn) {
      visibility.add(fn);
      return () => visibility.delete(fn);
    },
    getHandles() {
      return handles.values();
    },
    dispose() {
      renderer.dispose();
      handles.clear();
      loaded.clear();
      unloaded.clear();
      visibility.clear();
    },
  };
}
