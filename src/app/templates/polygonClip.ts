import type { Point } from '../grid/hexGeometry';

/** Twice the signed area: positive when the points run counter-clockwise on a y-up plane. */
function signedArea2(points: readonly Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return sum;
}

/** The area of a simple polygon. */
export function polygonArea(points: readonly Point[]): number {
  return Math.abs(signedArea2(points)) / 2;
}

/**
 * The part of `subject` inside the convex polygon `clip` (Sutherland–Hodgman),
 * whichever way either polygon is wound. Empty when they do not overlap.
 */
export function clipToConvex(subject: readonly Point[], clip: readonly Point[]): Point[] {
  const side = signedArea2(clip) >= 0 ? 1 : -1;
  let output = [...subject];
  for (let i = 0; i < clip.length && output.length > 0; i++) {
    const a = clip[i]!;
    const b = clip[(i + 1) % clip.length]!;
    const inside = (p: Point): number => side * ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x));
    const input = output;
    output = [];
    for (let j = 0; j < input.length; j++) {
      const current = input[j]!;
      const previous = input[(j + input.length - 1) % input.length]!;
      const currentSide = inside(current);
      const previousSide = inside(previous);
      if (currentSide >= 0) {
        if (previousSide < 0) output.push(crossing(previous, current, previousSide, currentSide));
        output.push(current);
      } else if (previousSide >= 0) {
        output.push(crossing(previous, current, previousSide, currentSide));
      }
    }
  }
  return output;
}

/** Where the segment from `a` to `b` meets the clip edge, given each end's signed distance to it. */
function crossing(a: Point, b: Point, sideA: number, sideB: number): Point {
  const t = sideA / (sideA - sideB);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
