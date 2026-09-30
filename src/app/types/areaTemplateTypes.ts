/** The shapes of an area of effect, as game systems describe them. */
export type TemplateShape = 'line' | 'cone' | 'cube' | 'sphere' | 'emanation';

/**
 * Which grid points a template's origin may sit on: any of a cell's centre,
 * corners and edge middles, or only its centre or only its corners. An emanation
 * uses the last two to line its footprint up with whole cells.
 */
export type TemplateOriginSnap = 'any' | 'cell-center' | 'intersection';

/**
 * Which grid cells a template highlights besides its exact outline:
 * `any` those it touches at all, `half` those at least half covered (the
 * Dungeon Master's Guide's grid variant), `center` those whose centre it covers.
 */
export type CellCoverage = 'off' | 'any' | 'half' | 'center';

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
  /** Direction in radians for a line or cone; the other shapes grow the same way on every side. */
  angle: number;
  /** Cells across the creature an emanation spreads from (1 for a medium creature, 2 for a large one). */
  footprint?: number;
  /** Which cells to highlight; unset highlights none. */
  coverage?: CellCoverage | undefined;
  /** Hex colour; unset uses the theme accent. */
  color?: string | undefined;
  /** Whether players see the template. */
  visibleToPlayers: boolean;
}

/** What a new template needs; the store adds its id. */
export type AreaTemplateInput = Omit<AreaTemplate, 'id'>;
