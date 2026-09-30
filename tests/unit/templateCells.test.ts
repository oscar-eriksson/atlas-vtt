import { describe, expect, it } from 'vitest';
import { coveredCells } from '../../src/app/templates/templateCells';
import type { AreaTemplate } from '../../src/app/types/areaTemplateTypes';

const grid = { type: 'square' as const, size: 70, offsetX: 0, offsetY: 0 };
const base: AreaTemplate = { id: 't', shape: 'cube', x: 0, y: 0, snap: 'any', size: 1, angle: 0, visibleToPlayers: true };
const corner = (cell: { x: number; y: number }[]): string => `${cell[0]!.x / 70},${cell[0]!.y / 70}`;
const cellsOf = (template: AreaTemplate, rule: 'any' | 'half' | 'center'): string[] => coveredCells(template, grid, rule).map(corner).sort();

describe('coveredCells on a square grid', () => {
  it('covers exactly the four cells of a two-cell cube on an intersection, by every rule', () => {
    const cube = { ...base, x: 70, y: 70, size: 2 };
    for (const rule of ['any', 'half', 'center'] as const) expect(cellsOf(cube, rule)).toEqual(['0,0', '0,1', '1,0', '1,1']);
  });

  it('counts a cell by how much of it is covered', () => {
    // A one-cell cube just off an intersection: each of the four cells around it is a little under or over a quarter covered.
    const cube = { ...base, x: 72, y: 72, size: 1 };
    expect(cellsOf(cube, 'any')).toEqual(['0,0', '0,1', '1,0', '1,1']);
    expect(cellsOf(cube, 'half')).toEqual([]);
    expect(cellsOf(cube, 'center')).toEqual(['1,1']);
  });

  it('counts a half-covered cell for the half rule, and not one covered less', () => {
    // A one-cell cube centred on an edge middle covers two cells by half each.
    const half = { ...base, x: 70, y: 35, size: 1 };
    expect(cellsOf(half, 'half')).toEqual(['0,0', '1,0']);
    // Shift it so each is 40% covered (28 of 70 px wide).
    const less = { ...base, x: 70 + 7, y: 35, size: 1 };
    expect(cellsOf(less, 'half')).toEqual(['1,0']);
    expect(cellsOf(less, 'any')).toEqual(['0,0', '1,0']);
  });

  it('does not count a cell the shape only touches along an edge', () => {
    const cube = { ...base, x: 35, y: 35, size: 1 };
    expect(cellsOf(cube, 'any')).toEqual(['0,0']);
  });

  it('highlights a sphere around a cell centre with the whole middle cell and the four beside it', () => {
    const sphere = { ...base, shape: 'sphere' as const, x: 35, y: 35, size: 1 };
    expect(cellsOf(sphere, 'center')).toContain('0,0');
    // Radius 70 reaches the middle of the neighbours' far edge, so the cells beside it are touched.
    expect(cellsOf(sphere, 'any')).toEqual(expect.arrayContaining(['-1,0', '1,0', '0,-1', '0,1']));
  });

  it('follows a cone', () => {
    // A 3-cell cone pointing right from an intersection.
    const cone = { ...base, shape: 'cone' as const, x: 0, y: 0, size: 3, angle: 0 };
    const cells = cellsOf(cone, 'half');
    expect(cells).toContain('2,-1');
    expect(cells).not.toContain('0,1');
    expect(cells.every(cell => Number(cell.split(',')[0]) >= 0)).toBe(true);
  });
});

describe('coveredCells on a hex grid', () => {
  const hexGrid = { type: 'hex-vertical' as const, size: 70, offsetX: 0, offsetY: 0 };

  it('covers the hex a sphere sits on, but not distant ones', () => {
    const sphere: AreaTemplate = { ...base, shape: 'sphere', x: 35, y: 40, size: 1 };
    const cells = coveredCells(sphere, hexGrid, 'any');
    const near = (x: number, y: number): boolean => cells.some(cell => {
      const cx = cell.reduce((s, p) => s + p.x, 0) / cell.length;
      const cy = cell.reduce((s, p) => s + p.y, 0) / cell.length;
      return Math.hypot(cx - x, cy - y) < 1;
    });
    expect(cells.length).toBeGreaterThanOrEqual(7);
    expect(cells.length).toBeLessThan(25);
    expect(coveredCells(sphere, hexGrid, 'center').length).toBeGreaterThanOrEqual(1);
    expect(near(9999, 9999)).toBe(false);
  });
});
