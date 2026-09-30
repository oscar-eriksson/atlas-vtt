import type { Graphics } from 'pixi.js';
import type { AreaTemplate } from '../../types/areaTemplateTypes';
import { isDirectionalShape, localTemplateOutline } from '../../templates/templateGeometry';
import { cssColorToHexNumber, getObsidianAccentColor } from '../utils/colorUtils';
import { drawTemplateOutline } from './templateDrawing';

/** Everything that changes the drawn outline. Position and direction are set on the graphics instead, so moving never redraws. */
function outlineKey(template: AreaTemplate, cellSize: number): string {
  return [template.shape, template.size, template.width, template.footprint, template.color, cellSize].join('|');
}

/**
 * Shows `template` on `graphics`: drawn once around its own origin, then placed
 * and turned. It is drawn again only when `previousKey` no longer matches the
 * template's shape, size or colour. Returns the key to pass in next time.
 */
export function showTemplate(graphics: Graphics, template: AreaTemplate, cellSize: number, previousKey?: string): string {
  const key = outlineKey(template, cellSize);
  if (key !== previousKey) {
    graphics.clear();
    const color = cssColorToHexNumber(template.color ?? getObsidianAccentColor());
    drawTemplateOutline(graphics, localTemplateOutline(template, cellSize), color);
  }
  graphics.position.set(template.x, template.y);
  graphics.rotation = isDirectionalShape(template.shape) ? template.angle : 0;
  return key;
}
