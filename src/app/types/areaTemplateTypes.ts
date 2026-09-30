/** The shapes of an area of effect, as game systems describe them. */
export type TemplateShape = 'line' | 'cone' | 'cube' | 'sphere' | 'emanation';

/** Where on the grid a template's origin sits: the middle of a cell, or a corner where cells meet. */
export type TemplateOriginSnap = 'cell-center' | 'intersection';

/**
 * A persistent area of effect on the map. Sizes are in grid cells, as
 * distances are everywhere else, so they follow the grid and not the unit.
 */
export interface AreaTemplate {
  id: string;
  shape: TemplateShape;
  /** Origin in map coordinates. */
  x: number;
  y: number;
  /** How the origin was placed; dragging keeps it. */
  snap: TemplateOriginSnap;
  /** Length of a line, cone or cube side; radius of a sphere or emanation. */
  size: number;
  /** Width of a line. */
  width?: number;
  /** Direction in radians for a line, cone or cube. */
  angle: number;
  /** Cells across the creature an emanation spreads from (1 for a medium creature, 2 for a large one). */
  footprint?: number;
  /** Hex colour; unset uses the theme accent. */
  color?: string;
  /** Whether players see the template. */
  visibleToPlayers: boolean;
}

/** What a new template needs; the store adds its id. */
export type AreaTemplateInput = Omit<AreaTemplate, 'id'>;
