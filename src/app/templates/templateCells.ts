import type { GridGeometry } from '../grid/gridDistance';
import { axialToPixel, createHexLayout, hexVertices, isHexGridType, pixelToAxial, type Point } from '../grid/hexGeometry';
import type { AreaTemplate, CellCoverage } from '../types/areaTemplateTypes';
import { clipToConvex, polygonArea } from './polygonClip';
import { templateContainsPoint, templateOutline, type TemplateOutline } from './templateGeometry';

/** Sides of the polygon that stands in for a circle, and segments of each rounded corner. */
const CIRCLE_SIDES = 64;
const CORNER_SEGMENTS = 16;
/** A cell counts as touched only when the overlap is more than a sliver of rounding error. */
const MIN_OVERLAP = 1e-6;

/** The outline as one polygon: curves become many short straight sides. */
function outlinePolygon(outline: TemplateOutline): Point[] {
  switch (outline.kind) {
    case 'polygon':
      return outline.points;
    case 'circle':
      return Array.from({ length: CIRCLE_SIDES }, (_, i) => {
        const angle = (2 * Math.PI * i) / CIRCLE_SIDES;
        return { x: outline.center.x + outline.radius * Math.cos(angle), y: outline.center.y + outline.radius * Math.sin(angle) };
      });
    case 'roundedRect': {
      const { x, y, width, height, radius } = outline;
      // Corners in clockwise order on screen, each the quarter turn that starts at `from`.
      const corners = [
        { cx: x + width - radius, cy: y + radius, from: -Math.PI / 2 },
        { cx: x + width - radius, cy: y + height - radius, from: 0 },
        { cx: x + radius, cy: y + height - radius, from: Math.PI / 2 },
        { cx: x + radius, cy: y + radius, from: Math.PI },
      ];
      return corners.flatMap(({ cx, cy, from }) => Array.from({ length: CORNER_SEGMENTS + 1 }, (_, i) => {
        const angle = from + ((Math.PI / 2) * i) / CORNER_SEGMENTS;
        return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
      }));
    }
  }
}

function bounds(points: readonly Point[]): { minX: number; minY: number; maxX: number; maxY: number } {
  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

/** The outlines of the grid cells that overlap the box, as polygons in map coordinates. */
function cellsInBox(grid: GridGeometry, box: ReturnType<typeof bounds>): Point[][] {
  const offsetX = grid.offsetX ?? 0;
  const offsetY = grid.offsetY ?? 0;
  const size = grid.size;

  if (!isHexGridType(grid.type)) {
    const cells: Point[][] = [];
    for (let column = Math.floor((box.minX - offsetX) / size); column <= Math.floor((box.maxX - offsetX) / size); column++) {
      for (let row = Math.floor((box.minY - offsetY) / size); row <= Math.floor((box.maxY - offsetY) / size); row++) {
        const x = offsetX + column * size;
        const y = offsetY + row * size;
        cells.push([{ x, y }, { x: x + size, y }, { x: x + size, y: y + size }, { x, y: y + size }]);
      }
    }
    return cells;
  }

  // Walk the box in half-cell steps, a margin wider than the box, and keep each hex once.
  const layout = createHexLayout(grid.type, size, offsetX, offsetY);
  const seen = new Map<string, Point[]>();
  for (let x = box.minX - size; x <= box.maxX + size; x += size / 2) {
    for (let y = box.minY - size; y <= box.maxY + size; y += size / 2) {
      const hex = pixelToAxial(layout, { x, y });
      const key = `${hex.q},${hex.r}`;
      if (!seen.has(key)) seen.set(key, hexVertices(layout, axialToPixel(layout, hex)));
    }
  }
  return [...seen.values()];
}

const centreOf = (cell: readonly Point[]): Point => ({
  x: cell.reduce((sum, point) => sum + point.x, 0) / cell.length,
  y: cell.reduce((sum, point) => sum + point.y, 0) / cell.length,
});

/**
 * The grid cells the template covers under `rule`, as polygons in map
 * coordinates: those it touches (`any`), those it covers at least half of
 * (`half`), or those whose centre it covers (`center`). Square and hex cells
 * alike; the overlap is measured on the exact shape, curves approximated by
 * short straight sides.
 */
export function coveredCells(template: AreaTemplate, grid: GridGeometry, rule: Exclude<CellCoverage, 'off'>): Point[][] {
  const outline = templateOutline(template, grid.size);
  const shape = outlinePolygon(outline);
  return cellsInBox(grid, bounds(shape)).filter((cell) => {
    if (rule === 'center') return templateContainsPoint(template, grid.size, centreOf(cell));
    const overlap = polygonArea(clipToConvex(shape, cell));
    return rule === 'any' ? overlap > MIN_OVERLAP * polygonArea(cell) : overlap >= polygonArea(cell) / 2 - MIN_OVERLAP * polygonArea(cell);
  });
}
