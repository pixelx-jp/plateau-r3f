/**
 * Per-tile state machine. The runtime drives transitions; the controller and
 * the orchestrator only emit/observe states — they don't gate logic on
 * unrelated states.
 *
 * Valid transitions (forward-only):
 *
 *   discovered
 *     -> geometryLoaded
 *       -> featureIdDetected
 *           -> styleRequested
 *             -> styleLoaded
 *               -> colorTextureReady
 *                 -> shaderInjected
 *                   -> visible <-> hidden
 *                     -> disposed
 *       -> featureIdMissing
 *           -> visible <-> hidden
 *             -> disposed
 *
 * `featureIdMissing` is terminal for the styling path; the runtime emits an
 * error and the tile renders with its original 3D Tiles material (Level 1).
 */

export type TileLifecycleState =
  | 'discovered'
  | 'geometryLoaded'
  | 'featureIdDetected'
  | 'featureIdMissing'
  | 'styleRequested'
  | 'styleLoaded'
  | 'colorTextureReady'
  | 'shaderInjected'
  | 'visible'
  | 'hidden'
  | 'disposed';

const ORDER: Record<TileLifecycleState, number> = {
  discovered: 0,
  geometryLoaded: 1,
  featureIdDetected: 2,
  featureIdMissing: 2,
  styleRequested: 3,
  styleLoaded: 4,
  colorTextureReady: 5,
  shaderInjected: 6,
  visible: 7,
  hidden: 7,
  disposed: 8,
};

/**
 * Returns true if `next` is a legal transition from `current`.
 * - visible <-> hidden is allowed (toggling).
 * - Anything can go to `disposed`.
 * - Otherwise lifecycle is monotonic on ORDER.
 */
export function canTransition(current: TileLifecycleState, next: TileLifecycleState): boolean {
  if (next === 'disposed') return current !== 'disposed';
  if (current === 'disposed') return false;
  if (current === 'visible' && next === 'hidden') return true;
  if (current === 'hidden' && next === 'visible') return true;
  if (current === 'featureIdMissing') {
    return next === 'visible' || next === 'hidden';
  }
  return ORDER[next] > ORDER[current];
}
