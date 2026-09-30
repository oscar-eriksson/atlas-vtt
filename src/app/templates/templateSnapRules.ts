import type { TemplateOriginSnap, TemplateShape } from '../types/areaTemplateTypes';
import { footprintSnap } from './templateOrigin';

/**
 * Where a template of one shape may start: any `TemplateOriginSnap`, or one
 * that follows a size so the shape lines up with whole cells: `footprint`
 * centres it on the creature it spreads from, `size` on its own side length
 * (a cell centre for an odd number of cells across, a corner for an even number).
 */
export type TemplateSnapRule = TemplateOriginSnap | 'footprint' | 'size';

/** The snap rule of every shape; a game system may give its own. */
export type TemplateSnapRules = Record<TemplateShape, TemplateSnapRule>;

/** The rules as Dungeon & Dragons 5th edition places areas on a grid. */
export const DEFAULT_TEMPLATE_SNAP_RULES: Readonly<TemplateSnapRules> = {
  line: 'edge-or-corner',
  cone: 'edge-or-corner',
  cube: 'size',
  sphere: 'intersection',
  emanation: 'footprint',
};

/**
 * Where a template of `shape` being placed may start under `rules`. A shape
 * whose start follows its own size has none until it is dragged out, so it may
 * start anywhere a cell centre, corner or edge middle is until then.
 */
export function resolveOriginSnap(
  shape: TemplateShape,
  footprint: number,
  rules: Readonly<TemplateSnapRules> = DEFAULT_TEMPLATE_SNAP_RULES,
): TemplateOriginSnap {
  const rule = rules[shape];
  if (rule === 'footprint') return footprintSnap(footprint);
  return rule === 'size' ? 'any' : rule;
}
