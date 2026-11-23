/**
 * A cone aimed down from above the floor, as it lies on the floor. Its apex is `height` above the
 * point it starts from and its axis dips towards the floor, `down` being the sine of that dip (1
 * straight down). The floor cuts the cone in an oval (a circle where it points straight down), and
 * the cone's end cuts that oval off as it cuts the cone: a round end at the length from the apex
 * (an arc), a flat one across the axis at the length. `contains` asks the 3D cone itself.
 */

import type { Point } from '../types/visionTypes';
import type { ConeEnd } from './areaRules';
import { ringBounds, type ShapedArea } from './measureGeometry';

const TURN = 2 * Math.PI;
/** Directions the outline is sampled in. */
const DIRECTIONS = 120;
const SLACK = 1e-9;

/** The roots of `a r² + b r + d` that are above 0. */
function risingRoots(a: number, b: number, d: number): number[] {
  if (Math.abs(a) < 1e-12) return Math.abs(b) < 1e-12 ? [] : [-d / b].filter((r) => r > 0);
  const disc = b * b - 4 * a * d;
  if (disc < 0) return [];
  const root = Math.sqrt(disc);
  return [(-b - root) / (2 * a), (-b + root) / (2 * a)].filter((r) => r > 0);
}

/**
 * The part of the floor under a cone of `angle` degrees (under 180) and `length` pixels, `height`
 * pixels above `origin`, turned `towards` (one pixel long) and dipping by `down`. Null where it
 * reaches no floor: a round cone shorter than its height, or one aimed away from the floor.
 */
export function tiltedCone(origin: Point, towards: Point, length: number, height: number, down: number, angle: number, end: ConeEnd): ShapedArea | null {
  const round = end === 'round';
  if (!(angle > 0 && angle < 180) || !(height > 0) || !(length > 0) || (round && length < height)) return null;
  const cosHalf = Math.cos((angle * Math.PI) / 360);
  // `flat` of the axis runs along the floor and `down` of it towards it.
  const flat = Math.sqrt(Math.max(0, 1 - down * down));
  const heading = Math.atan2(towards.y, towards.x);
  const most = 10 * length;

  /** How far inside the cone's side the floor point `r` away along the way `k` (the axis' floor share) points lies. */
  const inside = (r: number, k: number): number => (r * k + height * down) / Math.hypot(r, height) - cosHalf;

  const outer: Point[] = [];
  const inner: Point[] = [];
  let around = true;
  for (let i = 0; i < DIRECTIONS; i++) {
    const turn = -Math.PI + (TURN * i) / DIRECTIONS;
    const k = Math.cos(turn) * flat;
    // A round end: no farther from the apex than the length. A flat one: the floor point's share along the axis may not pass it.
    const cap = round ? Math.sqrt(Math.max(0, length * length - height * height)) : k > 1e-12 ? Math.min(most, (length - height * down) / k) : most;
    const breaks = [0, ...risingRoots(k * k - cosHalf * cosHalf, 2 * k * height * down, height * height * (down * down - cosHalf * cosHalf)), ...(k < 0 ? [(-height * down) / k] : []), cap]
      .filter((r) => r <= cap).sort((x, y) => x - y);
    let lo = -1;
    let hi = -1;
    for (let j = 0; j + 1 < breaks.length; j++) {
      const from = breaks[j]!;
      const to = breaks[j + 1]!;
      if (to - from < SLACK || inside((from + to) / 2, k) < 0) continue;
      if (lo < 0) lo = from;
      hi = to;
    }
    if (lo < 0) { around = false; continue; }
    if (lo > 0) around = false;
    const at = heading + turn;
    const place = (r: number): Point => ({ x: origin.x + r * Math.cos(at), y: origin.y + r * Math.sin(at) });
    outer.push(place(hi));
    inner.push(place(lo));
  }
  if (outer.length < 3) return null;
  // Seen from below the origin lies in the cone's footprint or beside it: beside it the footprint is a band.
  const ring = around ? outer : [...outer, ...inner.reverse()];
  const contains = (point: Point): boolean => {
    const x = point.x - origin.x;
    const y = point.y - origin.y;
    const along = (x * towards.x + y * towards.y) * flat + height * down;
    if (round ? Math.hypot(x, y, height) > length + 1e-6 : along > length + 1e-6) return false;
    return along / Math.hypot(x, y, height) >= cosHalf - SLACK;
  };
  let far = 0;
  for (const corner of ring) far = Math.max(far, Math.hypot(corner.x - origin.x, corner.y - origin.y));
  return { origin, towards, reach: far, rings: [ring], bounds: ringBounds([ring]), contains };
}
