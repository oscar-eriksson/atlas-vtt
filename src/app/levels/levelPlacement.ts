import { readMapStretch, turnedBox, type ImageSize, type MapStretch } from '../grid/mapStretch';
import type { Point } from '../grid/hexGeometry';
import type { GridState } from '../types/gridTypes';
import type { LevelAlignment } from '../types/sceneLevelTypes';
import { gridPeriod } from './levelAlignmentFit';

/** A box in the world. */
export interface WorldRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The part of the world an image of `size` fills when it is drawn with `stretch`, from where its offset places it. */
export function levelWorldRect(size: ImageSize, stretch: MapStretch): WorldRect {
  const { box } = turnedBox(size.width, size.height, stretch);
  return { x: stretch.offset?.x ?? 0, y: stretch.offset?.y ?? 0, width: box.width * stretch.x, height: box.height * stretch.y };
}

const round = (value: number): number => Math.round(value * 1e4) / 1e4;

/** `value` moved by `by`, in whole `step`s, and never below 0: the offset of a level's image is never left of or above the world's origin. */
function movedAlong(value: number, by: number, step: number): number {
  return round(value + Math.max(Math.round(by / step), Math.ceil(-value / step)) * step);
}

/**
 * Where a level's image begins once it is moved by `delta`: by whole periods of the grid
 * (`gridPeriod`), so the grid printed on the image keeps lying on the scene's.
 */
export function movedOffset(current: Point, delta: Point, grid: Pick<GridState, 'size' | 'type'>): Point {
  const period = gridPeriod(grid);
  return { x: movedAlong(current.x, delta.x, period.x), y: movedAlong(current.y, delta.y, period.y) };
}

/** Where a level's image begins once its middle lies as near as the grid allows to the middle of `target`. */
export function centredOffset(current: WorldRect, target: WorldRect, grid: Pick<GridState, 'size' | 'type'>): Point {
  const delta = { x: target.x + target.width / 2 - (current.x + current.width / 2), y: target.y + target.height / 2 - (current.y + current.height / 2) };
  return movedOffset({ x: current.x, y: current.y }, delta, grid);
}

/**
 * The alignment of a level whose image begins at `offset`: the level's own scale and stretch where
 * it has an alignment, else its image as the scene's grid draws it, which is what moves.
 */
export function placedAlignment(grid: Pick<GridState, 'mapStretch'>, current: LevelAlignment | undefined, offset: Point): LevelAlignment {
  const { offset: _unplaced, ...stretch } = current?.stretch ?? readMapStretch(grid.mapStretch);
  return { offset, scale: current?.scale ?? 1, stretch };
}

/**
 * The levels to keep as they are when the grid is aligned on the level that defines it: those drawn
 * in the frame (no alignment of its own) whose image is not the size of the aligned one's, so they
 * are not floors exported on one canvas, which follow the frame's stretch, but maps of their own that
 * it would distort. A level whose image is not known is kept too.
 */
export function levelsToKeep(
  scene: { levels?: readonly { id: string }[] | undefined; levelAlignments?: Record<string, unknown> | undefined },
  aligning: string | null,
  sizes: Readonly<Record<string, ImageSize | null>>,
  aligned: ImageSize,
): string[] {
  return (scene.levels ?? [])
    .filter((level) => level.id !== aligning && !scene.levelAlignments?.[level.id] && level.id in sizes)
    .filter((level) => {
      const size = sizes[level.id];
      return !size || size.width !== aligned.width || size.height !== aligned.height;
    })
    .map((level) => level.id);
}
