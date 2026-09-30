import type { Graphics } from 'pixi.js';
import type { TemplateOutline } from '../../templates/templateGeometry';

const FILL_ALPHA = 0.18;
const STROKE_WIDTH = 2;
const ORIGIN_MARKER_RADIUS = 4;

/**
 * Draws a template's outline, with a dot on its origin so a physical
 * miniature can be lined up with it. The outline is in the graphics' own
 * space; the origin is at (0, 0).
 */
export function drawTemplateOutline(graphics: Graphics, outline: TemplateOutline, color: number): void {
  switch (outline.kind) {
    case 'polygon':
      graphics.poly(outline.points.flatMap(point => [point.x, point.y]), true);
      break;
    case 'circle':
      graphics.circle(outline.center.x, outline.center.y, outline.radius);
      break;
    case 'roundedRect':
      graphics.roundRect(outline.x, outline.y, outline.width, outline.height, outline.radius);
      break;
  }
  graphics.fill({ color, alpha: FILL_ALPHA });
  graphics.stroke({ width: STROKE_WIDTH, color, alpha: 0.9 });
  graphics.circle(0, 0, ORIGIN_MARKER_RADIUS);
  graphics.fill({ color, alpha: 1 });
}
