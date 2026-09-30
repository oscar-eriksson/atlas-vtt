import type { GridGeometry } from '../grid/gridDistance';
import type { Point } from '../grid/hexGeometry';
import type { AreaTemplateInput, TemplateOriginSnap } from '../types/areaTemplateTypes';
import type { TemplateToolSettings } from '../tools/templateToolSettings';
import { snapTemplateOrigin } from './templateOrigin';
import { resolveOriginSnap, type TemplateSnapRules } from './templateSnapRules';

/** A drag shorter than this many cells places nothing, so a plain click is not a template. */
const MIN_DRAG_CELLS = 0.25;

/**
 * The template a drag from `origin` to `pointer` makes: pointing at the pointer
 * and as long as the drag, in whole cells. A cube grows from its centre, so its
 * side is twice the larger of the horizontal and vertical drag; an emanation's
 * size is measured from the edge of the creature's footprint, not from its
 * centre. Returns nothing for a drag too short to mean anything.
 */
export function templateFromDrag(
  settings: TemplateToolSettings,
  grid: GridGeometry,
  origin: Point,
  snap: TemplateOriginSnap,
  pointer: Point,
): AreaTemplateInput | null {
  const dx = pointer.x - origin.x;
  const dy = pointer.y - origin.y;
  const cells = Math.hypot(dx, dy) / grid.size;
  if (cells < MIN_DRAG_CELLS) return null;

  const isEmanation = settings.shape === 'emanation';
  const cubeSide = (2 * Math.max(Math.abs(dx), Math.abs(dy))) / grid.size;
  const extent = settings.shape === 'cube' ? cubeSide : isEmanation ? cells - settings.footprint / 2 : cells;
  const size = Math.max(1, Math.round(extent));
  return {
    shape: settings.shape,
    x: origin.x,
    y: origin.y,
    snap,
    size,
    angle: Math.atan2(dy, dx),
    ...(settings.shape === 'line' && { width: settings.lineWidth }),
    ...(isEmanation && { footprint: settings.footprint }),
    coverage: settings.coverage,
    ...(settings.color && { color: settings.color }),
    visibleToPlayers: settings.visibleToPlayers,
  };
}

/**
 * The cube that best fits a drag from `press` to `pointer` when it must line up
 * with whole cells: an odd side is centred on a cell and an even side on a
 * corner. Each of the two starts gives the nearest side of its parity; the one
 * closest to the pointer wins, and on a tie the one closest to the press.
 */
function alignedCube(settings: TemplateToolSettings, grid: GridGeometry, press: Point, pointer: Point): AreaTemplateInput | null {
  const fits = (['cell-center', 'intersection'] as const).map((snap) => {
    const origin = snapTemplateOrigin(grid, press, snap);
    const reach = (2 * Math.max(Math.abs(pointer.x - origin.x), Math.abs(pointer.y - origin.y))) / grid.size;
    // Odd sides for a cell centre (1, 3, 5...), even ones for a corner (2, 4, 6...).
    const nearest = snap === 'cell-center' ? 2 * Math.round((reach - 1) / 2) + 1 : 2 * Math.round(reach / 2);
    const side = Math.max(snap === 'cell-center' ? 1 : 2, nearest);
    return { snap, origin, side, gap: Math.abs(reach - side), pressGap: Math.hypot(origin.x - press.x, origin.y - press.y) };
  });
  const best = fits.reduce((a, b) => (b.gap < a.gap - 1e-9 || (Math.abs(b.gap - a.gap) <= 1e-9 && b.pressGap < a.pressGap) ? b : a));
  const drag = templateFromDrag(settings, grid, best.origin, best.snap, pointer);
  return drag && { ...drag, size: best.side };
}

/**
 * The template a drag from `press` to `pointer` places under the snap `rules`:
 * the origin snaps as its shape's rule says, and a cube's origin and side are
 * chosen together so its edges fall on grid lines.
 */
export function placeTemplate(
  settings: TemplateToolSettings,
  grid: GridGeometry,
  rules: Readonly<TemplateSnapRules>,
  press: Point,
  pointer: Point,
): AreaTemplateInput | null {
  if (rules[settings.shape] === 'size') return alignedCube(settings, grid, press, pointer);
  const snap = resolveOriginSnap(settings.shape, settings.footprint, rules);
  return templateFromDrag(settings, grid, snapTemplateOrigin(grid, press, snap), snap, pointer);
}
