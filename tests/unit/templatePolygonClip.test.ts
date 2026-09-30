import { describe, expect, it } from 'vitest';
import { clipToConvex, polygonArea } from '../../src/app/templates/polygonClip';

const square = (x: number, y: number, size: number) => [{ x, y }, { x: x + size, y }, { x: x + size, y: y + size }, { x, y: y + size }];

describe('polygonArea', () => {
  it('measures a square and a triangle, whichever way they are wound', () => {
    expect(polygonArea(square(0, 0, 10))).toBe(100);
    expect(polygonArea([...square(0, 0, 10)].reverse())).toBe(100);
    expect(polygonArea([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }])).toBe(50);
  });
});

describe('clipToConvex', () => {
  it('keeps the overlap of two squares', () => {
    expect(polygonArea(clipToConvex(square(0, 0, 10), square(5, 5, 10)))).toBe(25);
  });

  it('keeps a shape that lies wholly inside, and drops one that lies wholly outside', () => {
    expect(polygonArea(clipToConvex(square(2, 2, 4), square(0, 0, 10)))).toBe(16);
    expect(clipToConvex(square(20, 20, 4), square(0, 0, 10))).toEqual([]);
  });

  it('cuts a triangle by a square', () => {
    // Right triangle with legs 20 and 20 from the origin; the square takes its 10 by 10 corner, less the far corner cut off.
    const triangle = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 0, y: 20 }];
    expect(polygonArea(clipToConvex(triangle, square(0, 0, 10)))).toBe(100);
    expect(polygonArea(clipToConvex(triangle, square(10, 10, 10)))).toBe(0);
    expect(polygonArea(clipToConvex(triangle, square(5, 5, 10)))).toBeCloseTo(50);
  });

  it('does not care which way the clip polygon is wound', () => {
    const clip = [...square(5, 5, 10)].reverse();
    expect(polygonArea(clipToConvex(square(0, 0, 10), clip))).toBe(25);
  });
});
