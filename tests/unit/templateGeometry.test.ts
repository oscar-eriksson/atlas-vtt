import { describe, expect, it } from 'vitest';
import { creatureSide, templateContainsPoint, templateOutline } from '../../src/app/templates/templateGeometry';
import type { AreaTemplate } from '../../src/app/types/areaTemplateTypes';

const base: AreaTemplate = { id: 't', shape: 'line', x: 100, y: 100, snap: 'intersection', size: 3, angle: 0, visibleToPlayers: true };
const CELL = 70;

const polygon = (template: AreaTemplate): { x: number; y: number }[] => {
  const outline = templateOutline(template, CELL);
  if (outline.kind !== 'polygon') throw new Error(`expected a polygon, got ${outline.kind}`);
  return outline.points;
};

describe('templateOutline', () => {
  it('draws a line as a one-cell-wide rectangle along the angle', () => {
    expect(polygon(base)).toEqual([
      { x: 100, y: 65 }, { x: 310, y: 65 }, { x: 310, y: 135 }, { x: 100, y: 135 },
    ]);
  });

  it('honours a line width and turns with the angle', () => {
    const points = polygon({ ...base, width: 2, angle: Math.PI / 2 });
    expect(points[0]!.x).toBeCloseTo(170); expect(points[0]!.y).toBeCloseTo(100);
    expect(points[2]!.x).toBeCloseTo(30); expect(points[2]!.y).toBeCloseTo(310);
  });

  it('draws a cone as wide as it is long: its far edge equals its length', () => {
    const [tip, left, right] = polygon({ ...base, shape: 'cone', size: 3 });
    expect(tip).toEqual({ x: 100, y: 100 });
    expect(Math.hypot(right!.x - left!.x, right!.y - left!.y)).toBeCloseTo(3 * CELL);
    // Width at any distance along the cone equals that distance.
    expect(left!.x).toBeCloseTo(310);
    expect(Math.abs(left!.y - 100)).toBeCloseTo(3 * CELL / 2);
  });

  it('draws a cube as a square centred on the origin, whatever the angle', () => {
    const square = [{ x: 30, y: 30 }, { x: 170, y: 30 }, { x: 170, y: 170 }, { x: 30, y: 170 }];
    expect(polygon({ ...base, shape: 'cube', size: 2 })).toEqual(square);
    expect(polygon({ ...base, shape: 'cube', size: 2, angle: 1 })).toEqual(square);
  });

  it('draws a sphere as a circle around the origin', () => {
    expect(templateOutline({ ...base, shape: 'sphere', size: 4 }, CELL)).toEqual({ kind: 'circle', center: { x: 100, y: 100 }, radius: 280 });
  });

  it('grows an emanation from the creature footprint by the radius, with rounded corners', () => {
    const medium = templateOutline({ ...base, shape: 'emanation', size: 3, footprint: 1 }, CELL);
    expect(medium).toEqual({ kind: 'roundedRect', x: 100 - 245, y: 100 - 245, width: 490, height: 490, radius: 210 });
    const large = templateOutline({ ...base, shape: 'emanation', size: 3, footprint: 2 }, CELL);
    expect(large).toMatchObject({ width: 560, height: 560 });
  });

  it('treats an emanation without a footprint as a one-cell creature', () => {
    expect(templateOutline({ ...base, shape: 'emanation', size: 1 }, CELL)).toMatchObject({ width: 210, height: 210, radius: 70 });
  });
});

describe('templateContainsPoint', () => {
  const at = (template: AreaTemplate, x: number, y: number): boolean => templateContainsPoint(template, CELL, { x, y });

  it('finds points inside a cone and rejects those behind its tip or beyond its edge', () => {
    const cone: AreaTemplate = { ...base, shape: 'cone', size: 3 };
    expect(at(cone, 200, 100)).toBe(true);
    expect(at(cone, 300, 100 + 100)).toBe(true);
    expect(at(cone, 80, 100)).toBe(false);
    expect(at(cone, 150, 100 + 120)).toBe(false);
  });

  it('finds points in a cube on every side of its origin', () => {
    const cube: AreaTemplate = { ...base, shape: 'cube', size: 2, angle: 1 };
    for (const [x, y] of [[100 - 60, 100], [100 + 60, 100], [100, 100 - 60], [100, 100 + 60]]) expect(at(cube, x!, y!)).toBe(true);
    expect(at(cube, 100 + 80, 100)).toBe(false);
  });

  it('follows the direction of a line', () => {
    const down: AreaTemplate = { ...base, shape: 'line', size: 3, angle: Math.PI / 2 };
    expect(at(down, 100, 250)).toBe(true);
    expect(at(down, 250, 100)).toBe(false);
  });

  it('finds points in a sphere but not outside its radius', () => {
    const sphere: AreaTemplate = { ...base, shape: 'sphere', size: 2 };
    expect(at(sphere, 100 + 130, 100)).toBe(true);
    expect(at(sphere, 100 + 150, 100)).toBe(false);
  });

  it('leaves the rounded corners of an emanation out', () => {
    const emanation: AreaTemplate = { ...base, shape: 'emanation', size: 2, footprint: 1 };
    // Half a cell of creature plus two cells out is 175 px; the corner is beyond the rounded arc.
    expect(at(emanation, 100 + 170, 100)).toBe(true);
    expect(at(emanation, 100 + 170, 100 + 170)).toBe(false);
  });
});

describe('creatureSide', () => {
  it('is the footprint in pixels for an emanation, one cell when none is given', () => {
    expect(creatureSide('emanation', 2, CELL)).toBe(140);
    expect(creatureSide('emanation', undefined, CELL)).toBe(70);
  });

  it('is nothing for a shape that spreads from no creature', () => {
    for (const shape of ['line', 'cone', 'cube', 'sphere'] as const) expect(creatureSide(shape, 2, CELL)).toBeUndefined();
  });
});
