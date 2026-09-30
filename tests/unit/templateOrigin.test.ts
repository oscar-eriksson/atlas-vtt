import { describe, expect, it } from 'vitest';
import { createHexLayout, axialToPixel, hexVertices, pixelToAxial } from '../../src/app/grid/hexGeometry';
import { footprintSnap, snapTemplateOrigin } from '../../src/app/templates/templateOrigin';

const square = { type: 'square' as const, size: 70, offsetX: 10, offsetY: 20 };

describe('snapTemplateOrigin on a square grid', () => {
  it('snaps to the middle of the cell', () => {
    // Cell (1, 0) spans x 80..150, y 20..90 with this offset.
    expect(snapTemplateOrigin(square, { x: 85, y: 30 }, 'cell-center')).toEqual({ x: 115, y: 55 });
  });

  it('snaps to the nearest corner', () => {
    expect(snapTemplateOrigin(square, { x: 85, y: 30 }, 'intersection')).toEqual({ x: 80, y: 20 });
    expect(snapTemplateOrigin(square, { x: 140, y: 85 }, 'intersection')).toEqual({ x: 150, y: 90 });
  });

  it('snaps correctly left of and above the grid origin', () => {
    expect(snapTemplateOrigin(square, { x: -5, y: 0 }, 'cell-center')).toEqual({ x: -25, y: -15 });
    expect(snapTemplateOrigin(square, { x: -5, y: 0 }, 'intersection')).toEqual({ x: 10, y: 20 });
  });
});

describe('snapTemplateOrigin to an edge or a corner', () => {
  // Cell (1, 0) spans x 80..150, y 20..90 with this offset.
  it('snaps to an edge middle or a corner and never to a cell centre', () => {
    expect(snapTemplateOrigin(square, { x: 115, y: 55 }, 'edge-or-corner').x === 115 && snapTemplateOrigin(square, { x: 115, y: 55 }, 'edge-or-corner').y === 55).toBe(false);
    expect(snapTemplateOrigin(square, { x: 112, y: 28 }, 'edge-or-corner')).toEqual({ x: 115, y: 20 });
    expect(snapTemplateOrigin(square, { x: 85, y: 30 }, 'edge-or-corner')).toEqual({ x: 80, y: 20 });
  });

  it('picks the nearest edge when the pointer is near a cell centre', () => {
    expect(snapTemplateOrigin(square, { x: 130, y: 52 }, 'edge-or-corner')).toEqual({ x: 150, y: 55 });
    expect(snapTemplateOrigin(square, { x: 110, y: 40 }, 'edge-or-corner')).toEqual({ x: 115, y: 20 });
  });

  it('works left of and above the grid origin', () => {
    expect(snapTemplateOrigin(square, { x: -24, y: 4 }, 'edge-or-corner')).toEqual({ x: -25, y: 20 });
  });
});

describe('snapTemplateOrigin to an edge or a corner on a hex grid', () => {
  const grid = { type: 'hex-vertical' as const, size: 70, offsetX: 0, offsetY: 0 };
  const layout = createHexLayout('hex-vertical', 70, 0, 0);

  it('never returns the middle of a hex, even when the pointer is on it', () => {
    const centre = axialToPixel(layout, { q: 2, r: 1 });
    const snapped = snapTemplateOrigin(grid, centre, 'edge-or-corner');
    expect(Math.hypot(snapped.x - centre.x, snapped.y - centre.y)).toBeGreaterThan(20);
  });
});

describe('snapTemplateOrigin to any point', () => {
  // Cell (1, 0) spans x 80..150, y 20..90 with this offset.
  it('snaps to a corner, an edge middle or a cell centre, whichever is nearest', () => {
    expect(snapTemplateOrigin(square, { x: 85, y: 30 }, 'any')).toEqual({ x: 80, y: 20 });
    expect(snapTemplateOrigin(square, { x: 112, y: 28 }, 'any')).toEqual({ x: 115, y: 20 });
    expect(snapTemplateOrigin(square, { x: 82, y: 58 }, 'any')).toEqual({ x: 80, y: 55 });
    expect(snapTemplateOrigin(square, { x: 120, y: 50 }, 'any')).toEqual({ x: 115, y: 55 });
  });

  it('reaches every half cell left of and above the grid origin', () => {
    expect(snapTemplateOrigin(square, { x: -24, y: 4 }, 'any')).toEqual({ x: -25, y: 20 });
  });
});

describe('snapTemplateOrigin on a hex grid', () => {
  const grid = { type: 'hex-vertical' as const, size: 70, offsetX: 0, offsetY: 0 };
  const layout = createHexLayout('hex-vertical', 70, 0, 0);

  it('snaps to the centre of the hex holding the point', () => {
    const centre = axialToPixel(layout, { q: 2, r: 1 });
    expect(snapTemplateOrigin(grid, { x: centre.x + 6, y: centre.y - 4 }, 'cell-center')).toEqual(centre);
  });

  it('snaps to the nearest hex vertex, whichever hex holds the point', () => {
    for (const point of [{ x: 100, y: 130 }, { x: 33, y: 71 }, { x: 250, y: 12 }, { x: 180, y: 260 }]) {
      const snapped = snapTemplateOrigin(grid, point, 'intersection');
      // Brute force over the hex holding the point and all its neighbours.
      const home = pixelToAxial(layout, point);
      const candidates = [-1, 0, 1].flatMap(dq => [-1, 0, 1].flatMap(dr =>
        hexVertices(layout, axialToPixel(layout, { q: home.q + dq, r: home.r + dr }))));
      const best = Math.min(...candidates.map(v => Math.hypot(v.x - point.x, v.y - point.y)));
      expect(Math.hypot(snapped.x - point.x, snapped.y - point.y)).toBeCloseTo(best, 6);
    }
  });
});

describe('snapTemplateOrigin to any point on a hex grid', () => {
  const grid = { type: 'hex-vertical' as const, size: 70, offsetX: 0, offsetY: 0 };
  const layout = createHexLayout('hex-vertical', 70, 0, 0);

  it('snaps to the middle of a hex edge when that is nearest', () => {
    const centre = axialToPixel(layout, { q: 2, r: 1 });
    const [first, second] = hexVertices(layout, centre);
    const middle = { x: (first!.x + second!.x) / 2, y: (first!.y + second!.y) / 2 };
    const snapped = snapTemplateOrigin(grid, { x: middle.x + 2, y: middle.y - 1 }, 'any');
    expect(snapped.x).toBeCloseTo(middle.x, 6);
    expect(snapped.y).toBeCloseTo(middle.y, 6);
  });

  it('is never farther than any centre, corner or edge middle of the nearby hexes', () => {
    for (const point of [{ x: 100, y: 130 }, { x: 33, y: 71 }, { x: 250, y: 12 }, { x: 180, y: 260 }]) {
      const snapped = snapTemplateOrigin(grid, point, 'any');
      const home = pixelToAxial(layout, point);
      const all = [-1, 0, 1].flatMap(dq => [-1, 0, 1].flatMap(dr => {
        const centre = axialToPixel(layout, { q: home.q + dq, r: home.r + dr });
        const corners = hexVertices(layout, centre);
        return [centre, ...corners, ...corners.map((c, i) => ({ x: (c.x + corners[(i + 1) % 6]!.x) / 2, y: (c.y + corners[(i + 1) % 6]!.y) / 2 }))];
      }));
      const best = Math.min(...all.map(p => Math.hypot(p.x - point.x, p.y - point.y)));
      expect(Math.hypot(snapped.x - point.x, snapped.y - point.y)).toBeCloseTo(best, 6);
    }
  });
});

describe('footprintSnap', () => {
  it('centres odd footprints on a cell and even ones on a corner', () => {
    expect(footprintSnap(1)).toBe('cell-center');
    expect(footprintSnap(2)).toBe('intersection');
    expect(footprintSnap(3)).toBe('cell-center');
    expect(footprintSnap(4)).toBe('intersection');
  });
});
