import type { GridGeometry } from '../grid/gridDistance';
import { createHexLayout, hexVertices, isHexGridType, nearestHexCenter, pixelToAxial, axialToPixel, type Point } from '../grid/hexGeometry';
import type { TemplateOriginSnap, TemplateShape } from '../types/areaTemplateTypes';

/**
 * The point a template's origin lands on: the middle of the cell under
 * `point`, or the nearest corner where cells meet. On hex grids a corner is a
 * hex vertex.
 */
export function snapTemplateOrigin(grid: GridGeometry, point: Point, snap: TemplateOriginSnap): Point {
  const offsetX = grid.offsetX ?? 0;
  const offsetY = grid.offsetY ?? 0;

  if (isHexGridType(grid.type)) {
    const layout = createHexLayout(grid.type, grid.size, offsetX, offsetY);
    if (snap === 'cell-center') return nearestHexCenter(layout, point);
    // The nearest vertex of the whole grid is always a vertex of the hex holding the point.
    const center = axialToPixel(layout, pixelToAxial(layout, point));
    return hexVertices(layout, center).reduce((nearest, vertex) =>
      Math.hypot(vertex.x - point.x, vertex.y - point.y) < Math.hypot(nearest.x - point.x, nearest.y - point.y) ? vertex : nearest);
  }

  const cell = (value: number, offset: number): number => (snap === 'cell-center'
    ? offset + (Math.floor((value - offset) / grid.size) + 0.5) * grid.size
    : offset + Math.round((value - offset) / grid.size) * grid.size);
  return { x: cell(point.x, offsetX), y: cell(point.y, offsetY) };
}

/**
 * The snap an emanation needs so its footprint fills whole cells around the
 * origin: an odd number of cells is centred on a cell, an even number on a corner.
 */
export function footprintSnap(footprint: number): TemplateOriginSnap {
  return footprint % 2 === 0 ? 'intersection' : 'cell-center';
}

/**
 * Where a template being placed starts: an emanation is centred on its
 * footprint; every other shape starts where the GM chose, a corner where cells
 * meet or a cell centre. `flip` (Shift held) picks the other of the two.
 */
export function resolveOriginSnap(
  shape: TemplateShape,
  footprint: number,
  choice: TemplateOriginSnap,
  flip: boolean,
): TemplateOriginSnap {
  if (shape === 'emanation') return footprintSnap(footprint);
  if (!flip) return choice;
  return choice === 'intersection' ? 'cell-center' : 'intersection';
}
