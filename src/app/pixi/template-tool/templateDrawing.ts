import type { Graphics } from 'pixi.js';
import type { TemplateOutline } from '../../templates/templateGeometry';

const FILL_ALPHA = 0.18;
const SELECTED_FILL_ALPHA = 0.3;
const STROKE_WIDTH = 2;
const SELECTED_STROKE_WIDTH = 4;
const ORIGIN_MARKER_RADIUS = 4;
const CREATURE_FILL_ALPHA = 0.3;
const CREATURE_STROKE_WIDTH = 3;

/**
 * Draws a template's outline, heavier while it is selected, with a dot on its origin so a physical
 * miniature can be lined up with it. An emanation also shows the square of the
 * creature it spreads from, `creatureSide` pixels across and centred on the origin. The outline is in the graphics' own
 * space; the origin is at (0, 0).
 */
export function drawTemplateOutline(graphics: Graphics, outline: TemplateOutline, color: number, selected = false, creatureSide?: number): void {
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
  graphics.fill({ color, alpha: selected ? SELECTED_FILL_ALPHA : FILL_ALPHA });
  graphics.stroke({ width: selected ? SELECTED_STROKE_WIDTH : STROKE_WIDTH, color, alpha: selected ? 1 : 0.9 });
  if (creatureSide !== undefined) drawCreatureOutline(graphics, creatureSide, color);
  graphics.circle(0, 0, ORIGIN_MARKER_RADIUS);
  graphics.fill({ color, alpha: 1 });
}

/** The space of the creature an emanation spreads from: a square around the origin, stronger than the area so a miniature's base lines up with it. */
export function drawCreatureOutline(graphics: Graphics, side: number, color: number): void {
  graphics.rect(-side / 2, -side / 2, side, side);
  graphics.fill({ color, alpha: CREATURE_FILL_ALPHA });
  graphics.stroke({ width: CREATURE_STROKE_WIDTH, color, alpha: 1 });
}
