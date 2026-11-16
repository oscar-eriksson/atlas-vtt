/**
 * The shape of a reach around a space on the grid: an aura's, which lies around its token, and an
 * emanation's, which lies around a creature's space that no token stands on (a miniature at the
 * table). One place makes it from a `rangeOutline`, so the two cannot disagree.
 */

import { axialKey } from '../grid/hexLattice';
import type { DiagonalRule } from '../types/collectionSettingsTypes';
import type { Point } from '../types/visionTypes';
import { ringBounds, shapedArea, type ShapedArea } from './measureGeometry';
import { cellKeyAt, hexLayoutOf } from './measureGrid';
import { outlinePointAt, rangeOutline, type RangeOutline } from './rangeOutline';
import { countsCells, tokenSizeOfCells, type TokenGrid } from './tokenDistance';

/** The least a reach is where it is sized freely, in cells; on cells it reaches one at least. */
const LEAST_FREE_REACH = 0.5;
const UP = -Math.PI / 2;
/** A circle has no cone and no width. */
const NO_RULES = { coneAngle: 360, coneEnd: 'round', lineWidth: 0 } as const;
/** The outline of a reach that is none: no shape comes of it. */
export const NO_OUTLINE: RangeOutline = { kind: 'circle', centre: { x: 0, y: 0 }, radius: 0 };

/** A reach as an aura or emanation takes it: whole cells and one at least where the map counts cells, and to the tenth of a cell where it does not or `free` says so. */
export function fitted(cells: number, grid: TokenGrid, free: boolean): number {
  if (free || !countsCells(grid)) return Math.max(LEAST_FREE_REACH, Math.round(cells * 10) / 10);
  return Math.max(1, Math.round(cells));
}

/** The shape of the cells within reach: a point is in it when its cell is. */
function cellsShape(outline: RangeOutline & { kind: 'cells' }, grid: TokenGrid, towards: Point): ShapedArea {
  const hex = hexLayoutOf(grid) !== null;
  const keys = new Set(outline.cells.map(([a, b]) => (hex ? axialKey({ q: a, r: b }) : `${a},${b}`)));
  const bounds = ringBounds(outline.loops);
  const origin = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
  let reach = 0;
  for (const loop of outline.loops) {
    for (const corner of loop) reach = Math.max(reach, Math.hypot(corner.x - origin.x, corner.y - origin.y));
  }
  return { origin, towards, reach, rings: outline.loops, bounds, contains: (point) => keys.has(cellKeyAt(grid, point)) };
}

/** A reach's shape, with the points of its outline that its far handle and its label stand at. */
export function shapeOf(outline: RangeOutline, grid: TokenGrid, towards: Point): { shaped: ShapedArea; end: Point; top: Point } | null {
  const { centre } = outline;
  const shaped = outline.kind === 'cells'
    ? cellsShape(outline, grid, towards)
    : shapedArea({ shape: 'circle', points: [centre, { x: centre.x + towards.x * outline.radius, y: centre.y + towards.y * outline.radius }] }, NO_RULES);
  if (!shaped) return null;
  // Asked from the shape's own middle: a token placed freely stands off the middle of its cells.
  const around: RangeOutline = { ...outline, centre: shaped.origin };
  return { shaped, end: outlinePointAt(around, Math.atan2(towards.y, towards.x)), top: outlinePointAt(around, UP) };
}

/** How far an emanation reaches past the edge of the space of a creature `space` cells across, in cells, when its far end was dragged `radius` world pixels from the space's middle. */
export function emanationCells(radius: number, space: number, grid: TokenGrid): number {
  return fitted(radius / grid.size - space / 2, grid, false);
}

/**
 * The emanation of a creature of `space` cells across, standing at `origin`: what lies within
 * `radius` pixels of the space's middle, less the space itself, as the map counts reach. Null where
 * it has no shape.
 */
export function emanationShape(origin: Point, towards: Point, space: number, radius: number, grid: TokenGrid, diagonalRule: DiagonalRule): ShapedArea | null {
  const outline = rangeOutline({ x: origin.x, y: origin.y, size: tokenSizeOfCells(space) }, emanationCells(radius, space, grid), grid, diagonalRule);
  return outline ? shapeOf(outline, grid, towards)?.shaped ?? null : null;
}
