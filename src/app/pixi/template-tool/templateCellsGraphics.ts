import type { Graphics } from 'pixi.js';
import type { GridGeometry } from '../../grid/gridDistance';
import { coveredCells } from '../../templates/templateCells';
import type { AreaTemplate } from '../../types/areaTemplateTypes';
import { cssColorToHexNumber, getObsidianAccentColor } from '../utils/colorUtils';

/** Strong enough to read over a busy map, light enough to see the map through. */
const CELL_FILL_ALPHA = 0.4;
const CELL_STROKE_WIDTH = 2;
const CELL_STROKE_ALPHA = 0.9;

/** Everything the covered cells depend on, including where the template sits: cells follow it around the grid. */
function cellsKey(template: AreaTemplate, grid: GridGeometry): string {
  return [
    template.shape, template.x, template.y, template.angle, template.size, template.width, template.footprint,
    template.coverage, template.color, grid.type, grid.size, grid.offsetX, grid.offsetY,
  ].join('|');
}

/**
 * Highlights the grid cells `template` covers under its coverage rule, each with
 * a border. They are drawn in map coordinates, so the cells do not turn with the
 * template. Redrawn only when `previousKey` no
 * longer matches. Returns the key to pass in next time.
 */
export function showCoveredCells(graphics: Graphics, template: AreaTemplate, grid: GridGeometry, previousKey?: string): string {
  const key = cellsKey(template, grid);
  if (key === previousKey) return key;
  graphics.clear();
  const rule = template.coverage;
  if (!rule || rule === 'off') return key;

  const color = cssColorToHexNumber(template.color ?? getObsidianAccentColor());
  for (const cell of coveredCells(template, grid, rule)) graphics.poly(cell.flatMap(point => [point.x, point.y]), true);
  graphics.fill({ color, alpha: CELL_FILL_ALPHA });
  graphics.stroke({ width: CELL_STROKE_WIDTH, color, alpha: CELL_STROKE_ALPHA });
  return key;
}
