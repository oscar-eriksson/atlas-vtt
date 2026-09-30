import type { GridGeometry } from '../grid/gridDistance';
import {
  axialToPixel, createHexLayout, hexVertices, isHexGridType, nearestHexCenter, pixelToAxial,
  type AxialCoord, type HexLayout, type Point,
} from '../grid/hexGeometry';
import type { TemplateOriginSnap } from '../types/areaTemplateTypes';

const HEX_NEIGHBOURS: readonly AxialCoord[] = [
  { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 }, { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
];

/** The points `hexSnapPoints` lists for one hex: its centre, six corners and six edge middles. */
const HEX_SNAP_POINTS = 13;

/** A hex's centre, its six corners and the middle of its six edges. */
function hexSnapPoints(layout: HexLayout, hex: AxialCoord): Point[] {
  const center = axialToPixel(layout, hex);
  const corners = hexVertices(layout, center);
  const edgeMiddles = corners.map((corner, i) => {
    const next = corners[(i + 1) % corners.length]!;
    return { x: (corner.x + next.x) / 2, y: (corner.y + next.y) / 2 };
  });
  return [center, ...corners, ...edgeMiddles];
}

function nearestOf(candidates: readonly Point[], point: Point): Point {
  return candidates.reduce((nearest, candidate) =>
    Math.hypot(candidate.x - point.x, candidate.y - point.y) < Math.hypot(nearest.x - point.x, nearest.y - point.y) ? candidate : nearest);
}

function snapToHexGrid(layout: HexLayout, point: Point, snap: TemplateOriginSnap): Point {
  if (snap === 'cell-center') return nearestHexCenter(layout, point);
  const home = pixelToAxial(layout, point);
  if (snap === 'intersection') {
    // The nearest corner of the whole grid is always a corner of the hex holding the point.
    return nearestOf(hexVertices(layout, axialToPixel(layout, home)), point);
  }
  // Every snap point near the pointer belongs to the hex holding it or to one of its neighbours.
  const hexes = [home, ...HEX_NEIGHBOURS.map(step => ({ q: home.q + step.q, r: home.r + step.r }))];
  const points = hexes.flatMap(hex => hexSnapPoints(layout, hex));
  // A hex's own centre comes first in its list; leave it out when only edges and corners are wanted.
  return nearestOf(snap === 'edge-or-corner' ? points.filter((_, i) => i % HEX_SNAP_POINTS !== 0) : points, point);
}

/** The nearest half-cell point that is a corner or the middle of an edge: not a cell centre. */
function nearestEdgeOrCorner(grid: GridGeometry, point: Point): Point {
  const offsetX = grid.offsetX ?? 0;
  const offsetY = grid.offsetY ?? 0;
  const halfX = Math.floor(((point.x - offsetX) / grid.size) * 2);
  const halfY = Math.floor(((point.y - offsetY) / grid.size) * 2);
  const candidates: Point[] = [];
  for (let i = halfX - 1; i <= halfX + 2; i++) {
    for (let j = halfY - 1; j <= halfY + 2; j++) {
      // Both coordinates at an odd half is the middle of a cell.
      if (Math.abs(i) % 2 === 1 && Math.abs(j) % 2 === 1) continue;
      candidates.push({ x: offsetX + (i / 2) * grid.size, y: offsetY + (j / 2) * grid.size });
    }
  }
  return nearestOf(candidates, point);
}

/**
 * The point a template's origin lands on. `any` is the nearest of a cell's
 * centre, its corners and the middle of its edges, which on a square grid is
 * the nearest half cell in each direction. `edge-or-corner` leaves out the
 * centres; `cell-center` and `intersection` allow just that kind of point. On
 * hex grids a corner is a hex vertex.
 */
export function snapTemplateOrigin(grid: GridGeometry, point: Point, snap: TemplateOriginSnap): Point {
  const offsetX = grid.offsetX ?? 0;
  const offsetY = grid.offsetY ?? 0;

  if (isHexGridType(grid.type)) return snapToHexGrid(createHexLayout(grid.type, grid.size, offsetX, offsetY), point, snap);

  if (snap === 'edge-or-corner') return nearestEdgeOrCorner(grid, point);

  const kind: Exclude<TemplateOriginSnap, 'edge-or-corner'> = snap;
  const axis = (value: number, offset: number): number => {
    const cells = (value - offset) / grid.size;
    switch (kind) {
      case 'cell-center': return offset + (Math.floor(cells) + 0.5) * grid.size;
      case 'intersection': return offset + Math.round(cells) * grid.size;
      case 'any': return offset + (Math.round(cells * 2) / 2) * grid.size;
    }
  };
  return { x: axis(point.x, offsetX), y: axis(point.y, offsetY) };
}

/**
 * The snap an emanation needs so its footprint fills whole cells around the
 * origin: an odd number of cells is centred on a cell, an even number on a corner.
 */
export function footprintSnap(footprint: number): TemplateOriginSnap {
  return footprint % 2 === 0 ? 'intersection' : 'cell-center';
}
