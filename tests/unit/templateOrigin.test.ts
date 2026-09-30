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

describe('footprintSnap', () => {
  it('centres odd footprints on a cell and even ones on a corner', () => {
    expect(footprintSnap(1)).toBe('cell-center');
    expect(footprintSnap(2)).toBe('intersection');
    expect(footprintSnap(3)).toBe('cell-center');
    expect(footprintSnap(4)).toBe('intersection');
  });
});
