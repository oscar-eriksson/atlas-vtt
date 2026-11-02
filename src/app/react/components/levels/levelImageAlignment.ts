import { movedWithMap, sameStretch, type ImageSize, type MapStretch } from '../../../grid/mapStretch';
import { fittedLevelAlignment, placementShift, type FoundGrid } from '../../../levels/levelAlignmentFit';
import { DECISIVE_SUPPORT } from '../../../pixi/spectralEngine/detectGrid';
import type { AlignmentResult } from '../../../pixi/gridAlignmentMath';
import type { LevelAlignment } from '../../../types/sceneLevelTypes';
import type { GridState } from '../../../types/gridTypes';
import { alignmentPlacement, alignsSceneGrid, levelImagePlacement } from '../../../levels/levelAlignment';
import { viewedLevelId } from '../../../levels/sceneLevels';
import type { ViewAtlasStore } from '../../../storeFactory';
import { showNotice } from '../../../ui/notice';
import type { App } from 'obsidian';
import { levelBackground } from '../../../levels/levelEdits';
import { levelsToKeep, placedAlignment } from '../../../levels/levelPlacement';
import { mosaicCanvasSize } from '../../../pixi/mosaicCanvas/mosaicCanvasSize';
import { t } from '../../../i18n';

/** The level whose image the alignment panel fits to the grid as it is; null where it aligns the scene's grid (the first level, as before levels). */
export function levelBeingFitted(store: ViewAtlasStore): string | null {
  const state = store.getState();
  const levelId = viewedLevelId(state);
  return alignsSceneGrid(state, levelId) ? null : levelId;
}

/** Level `levelId`'s alignment once fitted by `found` on the scene's `grid`, and how its image is drawn before and after. */
function levelFit(store: ViewAtlasStore, grid: GridState, levelId: string, found: FoundGrid): { alignment: LevelAlignment; from: MapStretch; to: MapStretch } {
  const state = store.getState();
  const alignment = fittedLevelAlignment(grid, found, state.levelAlignments?.[levelId]);
  const from = levelImagePlacement(state, levelId);
  const to = levelImagePlacement({ ...state, levelAlignments: { ...state.levelAlignments, [levelId]: alignment } }, levelId);
  return { alignment, from, to };
}

/** Less than this many world pixels at the image's farthest corner, a fit leaves a level where it lies. */
const UNMOVED_PX = 1;

/**
 * Whether auto-detect's grid `found` may fit level `levelId`'s image (of `imageSize`). A floor often
 * lines up already (the floors of one export), and the art of a map without a grid, its walls and
 * furniture, gives a weak fit of the right cells at the wrong place: so a detection moves a level only
 * where the map's lines settle the grid (`DECISIVE_SUPPORT`). A weaker one is no grid found, unless it
 * leaves the level where it lies.
 */
export function acceptsLevelDetection(store: ViewAtlasStore, levelId: string, found: AlignmentResult, imageSize: ImageSize | null | undefined): boolean {
  const { grid } = store.getState();
  if (!grid || !imageSize) return false;
  if ((found.confidence ?? 0) >= DECISIVE_SUPPORT) return true;
  if (found.gridType && found.gridType !== (grid.type ?? 'square')) return false;
  const { from, to } = levelFit(store, grid, levelId, found);
  return placementShift(imageSize, from, to) < UNMOVED_PX;
}

/**
 * Fits level `levelId`'s image to the scene's grid by the grid `found` on it (measured or detected
 * on the image drawn on its own): the grid stays, the level's alignment changes, and what stands on
 * that level alone follows its image, in one undo step. False, with a word to the GM, where the image
 * shows another kind of grid than the scene's.
 */
export function applyLevelAlignment(store: ViewAtlasStore, levelId: string, found: FoundGrid & { gridType?: string | undefined }, imageSize: ImageSize | null | undefined): boolean {
  const state = store.getState();
  const { grid } = state;
  if (!grid) return false;
  if (found.gridType && found.gridType !== (grid.type ?? 'square')) {
    showNotice(t('levels.alignOtherGrid'));
    return false;
  }
  const { alignment, from, to } = levelFit(store, grid, levelId, found);
  const move = imageSize && !sameStretch(from, to) ? movedWithMap(imageSize, from, to) : undefined;
  state.alignLevel(levelId, alignment, move);
  return true;
}

/**
 * Moves level `levelId`'s image to where `alignment` draws it, in one undo step: what stands on that
 * level alone follows its image, so a wall stays on the wall it was drawn along.
 */
export function applyLevelPlacement(store: ViewAtlasStore, levelId: string, alignment: LevelAlignment, imageSize: ImageSize | null | undefined): void {
  const state = store.getState();
  const from = levelImagePlacement(state, levelId);
  const to = alignmentPlacement(alignment);
  const move = imageSize && !sameStretch(from, to) ? movedWithMap(imageSize, from, to) : undefined;
  state.alignLevel(levelId, alignment, move);
}

/**
 * The size of the map image of every level of the scene that has one, by level id; null for one that
 * cannot be read. A level without an image has no entry.
 */
export async function readLevelImageSizes(app: App, store: ViewAtlasStore): Promise<Record<string, ImageSize | null>> {
  const state = store.getState();
  const sizes: Record<string, ImageSize | null> = {};
  for (const level of state.levels ?? []) {
    const path = levelBackground(state, level.id);
    if (path) sizes[level.id] = await mosaicCanvasSize(app, path).catch(() => null);
  }
  return sizes;
}

/**
 * Keeps the levels that `levelsToKeep` names as they are drawn now, before the scene's grid is aligned:
 * each gets an alignment of its own at scale 1 with the frame's stretch as it stands, which the grid's
 * change then carries, so the level's image is neither stretched nor moved by it. Returns how many.
 */
export function keepLevelsAsDrawn(store: ViewAtlasStore, sizes: Record<string, ImageSize | null>, aligned: ImageSize | null | undefined): number {
  const state = store.getState();
  if (!state.grid || !aligned) return 0;
  const kept = levelsToKeep(state, viewedLevelId(state), sizes, aligned);
  for (const id of kept) state.alignLevel(id, placedAlignment(state.grid, undefined, { x: 0, y: 0 }));
  return kept.length;
}
