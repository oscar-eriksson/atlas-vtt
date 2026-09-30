import type { Point } from '../grid/hexGeometry';
import type { AreaTemplate, TemplateShape } from '../types/areaTemplateTypes';

/** A template's exact outline in map coordinates, ready to draw. */
export type TemplateOutline =
  | { kind: 'polygon'; points: Point[] }
  | { kind: 'circle'; center: Point; radius: number }
  | { kind: 'roundedRect'; x: number; y: number; width: number; height: number; radius: number };

/** Shapes that point somewhere; a sphere and an emanation look the same from every side. */
export function isDirectionalShape(shape: TemplateShape): boolean {
  return shape === 'line' || shape === 'cone' || shape === 'cube';
}

/** The template's outline around its own origin, pointing along +x: what to draw once and then move by position and rotation. */
export function localTemplateOutline(template: AreaTemplate, cellSize: number): TemplateOutline {
  return templateOutline({ ...template, x: 0, y: 0, angle: 0 }, cellSize);
}

/** Whether `point` lies inside the polygon, by counting how many edges a ray from it crosses. */
function insidePolygon(point: Point, polygon: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    if (a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Whether a map point lies inside the template, for picking one with a click. */
export function templateContainsPoint(template: AreaTemplate, cellSize: number, point: Point): boolean {
  const outline = localTemplateOutline(template, cellSize);
  // Turn the point into the template's own space, where it points along +x from the origin.
  const angle = isDirectionalShape(template.shape) ? -template.angle : 0;
  const dx = point.x - template.x;
  const dy = point.y - template.y;
  const local = { x: dx * Math.cos(angle) - dy * Math.sin(angle), y: dx * Math.sin(angle) + dy * Math.cos(angle) };

  switch (outline.kind) {
    case 'polygon':
      return insidePolygon(local, outline.points);
    case 'circle':
      return Math.hypot(local.x - outline.center.x, local.y - outline.center.y) <= outline.radius;
    case 'roundedRect': {
      const halfWidth = outline.width / 2;
      const halfHeight = outline.height / 2;
      const beyondX = Math.max(Math.abs(local.x - (outline.x + halfWidth)) - (halfWidth - outline.radius), 0);
      const beyondY = Math.max(Math.abs(local.y - (outline.y + halfHeight)) - (halfHeight - outline.radius), 0);
      return Math.hypot(beyondX, beyondY) <= outline.radius;
    }
  }
}

/** How wide a line of effect is when the template does not say: one cell. */
export const DEFAULT_LINE_WIDTH_CELLS = 1;

/** Corners of a rectangle of `length` along `angle` from `origin`, `width` across, centred on that axis. */
function rectangleAlong(origin: Point, angle: number, length: number, width: number): Point[] {
  const along = { x: Math.cos(angle), y: Math.sin(angle) };
  const across = { x: -along.y, y: along.x };
  const half = width / 2;
  const at = (distance: number, side: number): Point => ({
    x: origin.x + along.x * distance + across.x * side,
    y: origin.y + along.y * distance + across.y * side,
  });
  return [at(0, -half), at(length, -half), at(length, half), at(0, half)];
}

/**
 * The outline of a template on a grid of `cellSize` pixels, drawn as the game
 * rules describe the shape and not snapped to cells:
 * - line: a rectangle from the origin.
 * - cone: as wide as it is long at every point, so its far edge is as wide as its length.
 * - cube: a square whose near face is centred on the origin.
 * - sphere: a circle around the origin.
 * - emanation: the creature's footprint grown by the radius in every direction,
 *   with rounded corners.
 */
export function templateOutline(template: AreaTemplate, cellSize: number): TemplateOutline {
  const origin = { x: template.x, y: template.y };
  const length = template.size * cellSize;

  switch (template.shape) {
    case 'line':
      return { kind: 'polygon', points: rectangleAlong(origin, template.angle, length, (template.width ?? DEFAULT_LINE_WIDTH_CELLS) * cellSize) };
    case 'cube':
      return { kind: 'polygon', points: rectangleAlong(origin, template.angle, length, length) };
    case 'cone': {
      const [, farLeft, farRight] = rectangleAlong(origin, template.angle, length, length);
      return { kind: 'polygon', points: [origin, farLeft!, farRight!] };
    }
    case 'sphere':
      return { kind: 'circle', center: origin, radius: length };
    case 'emanation': {
      const half = ((template.footprint ?? 1) / 2) * cellSize + length;
      return { kind: 'roundedRect', x: origin.x - half, y: origin.y - half, width: half * 2, height: half * 2, radius: length };
    }
  }
}
