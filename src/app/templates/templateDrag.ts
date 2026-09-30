import type { GridGeometry } from '../grid/gridDistance';
import type { Point } from '../grid/hexGeometry';
import type { AreaTemplateInput, TemplateOriginSnap } from '../types/areaTemplateTypes';
import type { TemplateToolSettings } from '../tools/templateToolSettings';

/** A drag shorter than this many cells places nothing, so a plain click is not a template. */
const MIN_DRAG_CELLS = 0.25;

/**
 * The template a drag from `origin` to `pointer` makes: pointing at the pointer
 * and as long as the drag, in whole cells. An emanation's size is measured from
 * the edge of the creature's footprint, not from its centre. Returns nothing
 * for a drag too short to mean anything.
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
  const size = Math.max(1, Math.round(isEmanation ? cells - settings.footprint / 2 : cells));
  return {
    shape: settings.shape,
    x: origin.x,
    y: origin.y,
    snap,
    size,
    angle: Math.atan2(dy, dx),
    ...(settings.shape === 'line' && { width: settings.lineWidth }),
    ...(isEmanation && { footprint: settings.footprint }),
    ...(settings.color && { color: settings.color }),
    visibleToPlayers: settings.visibleToPlayers,
  };
}
