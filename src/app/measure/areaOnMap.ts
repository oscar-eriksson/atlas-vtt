/**
 * A measured area as it lies on a map: its shape, what the map's walls leave of it, and the cells it
 * covers by the map's rule. One place works it out for whatever draws the area, counts the tokens
 * in it or selects them, so they agree.
 */

import type { GridGeometry } from '../grid/gridDistance';
import { areaRulesOf, type MeasurementSettings } from '../grid/measurementFormat';
import type { DiagonalRule } from '../types/collectionSettingsTypes';
import type { Point } from '../types/visionTypes';
import type { WallSegment } from '../types/wallTypes';
import type { AreaCellRule, ConeEnd } from './areaRules';
import { cellsInArea, type AreaCell } from './measureCells';
import { EDGE_TOLERANCE, shapedArea, type MeasureArea, type ShapedArea } from './measureGeometry';
import { tiltedCone } from './tiltedCone';
import { emanationShape } from './outlineShape';
import type { Measurement } from './measureTypes';
import { areaWithinWalls, shapesWithinWalls, wallSweepPoint } from './measureWalls';

/** What of a map shapes the areas measured on it. */
export interface AreaMap {
  /** The grid areas are measured on: a line that names no width is one of its cells wide. */
  readonly grid: GridGeometry;
  /** Whether the grid's cells are counted: its Snap is on. */
  readonly cells: boolean;
  /** The full opening of a cone, degrees. */
  readonly coneAngle: number;
  readonly coneEnd: ConeEnd;
  readonly cellRule: AreaCellRule;
  /** How the map counts a diagonal step: an aura reaches as far from its token as distances are counted. */
  readonly diagonalRule: DiagonalRule;
  /** The walls areas stop at, as light is traced through them (`sealedWalls`); none on a map without walls. */
  readonly walls: readonly WallSegment[];
}

/**
 * A map as areas read it: `grid` with the rules `settings` name, whether its cells are counted
 * (`cells`), and the walls areas stop at.
 */
export function areaMapOf(grid: GridGeometry, settings: MeasurementSettings, cells: boolean, walls: readonly WallSegment[]): AreaMap {
  const { cellRule, coneEnd } = areaRulesOf(settings);
  return { grid, cells, coneAngle: settings.coneAngle, coneEnd, cellRule, diagonalRule: settings.diagonalRule, walls };
}

export interface AreaOnMap {
  /** The area as its measurement shapes it. */
  readonly shaped: ShapedArea;
  /** What the walls leave of it: `shaped` itself where none stops it. */
  readonly area: MeasureArea;
  /** The cells it covers; null where cells are not counted. */
  readonly cells: readonly AreaCell[] | null;
  /**
   * What the walls it stops at leave of shapes drawn with it that lie no farther than `beyond` past
   * its reach (`shapesWithinWalls`): a covered cell's tint reaches past its outline, and must not
   * reach past a wall. Null where it stops at no wall, and nothing is left out.
   */
  readonly withinWalls: ((shapes: readonly (readonly Point[])[], beyond: number) => readonly (readonly Point[])[]) | null;
}

/** The least an origin may lie from a wall and still count as on it, world pixels: a wall drawn by hand is that far off the line it follows. */
const LEAST_WALL_SLACK = 4;
/** The same as a share of a cell, where origins snap to the grid: a wall this near a grid line is drawn along it. */
const WALL_SLACK_OF_CELL = 1 / 12;

/**
 * How near a wall the origin of an area made on `map` lies and counts as on it (`wallSweepPoint`).
 * Origins snap to the grid's lines and walls never do, so a wall drawn along a line passes a few
 * pixels beside the origins on it: a twelfth of a cell and four pixels at least where cells are
 * counted, four pixels where an origin lies anywhere.
 */
export function wallSlack({ grid, cells }: Pick<AreaMap, 'grid' | 'cells'>): number {
  return cells && grid.size > 0 ? Math.max(LEAST_WALL_SLACK, grid.size * WALL_SLACK_OF_CELL) : LEAST_WALL_SLACK;
}

/**
 * The area of `measurement` on `map`: cut by the map's walls unless it does not stop at them
 * (`stopsAtWalls`). Null for a ruler and for an area without a size. A map without walls costs no
 * sweep and no cut.
 */
export function areaOnMap(dragged: Measurement, map: AreaMap, stopsAtWalls = true): AreaOnMap | null {
  const tilted = tiltedConeOn(dragged, map);
  if (tilted !== undefined) return tilted && shapeOnMap(tilted, map, stopsAtWalls, wallSlack(map));
  const measurement = groundedMeasure(dragged, map.grid.size);
  if (!measurement) return null;
  const shaped = measurement.space ? emanationOn(measurement, measurement.space, map) : shapedArea(measurement, { coneAngle: map.coneAngle, coneEnd: map.coneEnd, lineWidth: map.grid.size });
  return shaped && shapeOnMap(shaped, map, stopsAtWalls, wallSlack(map));
}

/** Whether height changes a measurement: it starts at the one who makes it (a ruler, a cone, a line, an emanation round a creature). A circle or square is put on a point of the floor, so it ignores height. */
export function seesHeight({ shape, space }: Pick<Measurement, 'shape' | 'space'>): boolean {
  return shape === 'ruler' || shape === 'cone' || shape === 'line' || (shape === 'circle' && space !== undefined);
}

/**
 * `measurement` as it lies on the floor: an area dragged to its true distance across a height
 * difference reaches only `√(distance² − height²)` along the ground. Null where the height is the
 * whole of the distance or more, so nothing of it reaches the floor.
 */
export function groundedMeasure(measurement: Measurement, cellSize: number): Measurement | null {
  const { rise, points } = measurement;
  const [origin, end] = points;
  if (!rise || rise <= 0 || !origin || !end || !seesHeight(measurement) || measurement.shape === 'ruler') return measurement;
  const length = Math.hypot(end.x - origin.x, end.y - origin.y);
  const height = rise * cellSize;
  if (length <= height) return null;
  const along = Math.sqrt(length * length - height * height) / length;
  return { ...measurement, points: [origin, { x: origin.x + (end.x - origin.x) * along, y: origin.y + (end.y - origin.y) * along }] };
}

/**
 * A cone with a height: the part of the floor under it; null where it reaches none, undefined
 * where this is no such cone. With a `length` of its own its drag only aims it (straight down
 * within half a cell of its start); without one its drag is its true length and its axis ends on
 * the floor there.
 */
function tiltedConeOn({ shape, points, rise, length: own }: Measurement, map: AreaMap): ShapedArea | null | undefined {
  const [origin, end] = points;
  if (shape !== 'cone' || !rise || rise <= 0 || !origin || !end || !(map.coneAngle > 0 && map.coneAngle < 180)) return undefined;
  const size = map.grid.size;
  const height = rise * size;
  const drag = Math.hypot(end.x - origin.x, end.y - origin.y);
  const towards = drag > 0 ? { x: (end.x - origin.x) / drag, y: (end.y - origin.y) / drag } : { x: 0, y: -1 };
  if (own) {
    const aim = drag < size / 2 ? 0 : drag;
    return tiltedCone(origin, towards, own * size, height, height / Math.hypot(aim, height), map.coneAngle, map.coneEnd);
  }
  if (!(drag >= height)) return null;
  return tiltedCone(origin, towards, drag, height, height / drag, map.coneAngle, map.coneEnd);
}

/** A circle that is an emanation: the cells within its reach of a creature's space, as an aura's are. */
function emanationOn({ points }: Measurement, space: number, map: AreaMap): ShapedArea | null {
  const [origin, end] = points;
  if (!origin || !end) return null;
  const radius = Math.hypot(end.x - origin.x, end.y - origin.y);
  const towards = radius > 0 ? { x: (end.x - origin.x) / radius, y: (end.y - origin.y) / radius } : { x: 1, y: 0 };
  return emanationShape(origin, towards, space, radius, { ...map.grid, snapToGrid: map.cells }, map.diagonalRule);
}

/**
 * `shaped` as it lies on `map`: cut by the map's walls unless it does not stop at them, with the
 * cells it covers. `slack` is how near a wall its origin counts as on it: an area the GM places
 * says `wallSlack`; one that lies where its token stands (an aura) has none.
 */
export function shapeOnMap(shaped: ShapedArea, map: AreaMap, stopsAtWalls = true, slack = 0): AreaOnMap {
  const { walls } = map;
  const stops = stopsAtWalls && walls.length > 0;
  const area = stops ? areaWithinWalls(shaped, walls, slack) : shaped;
  return {
    shaped,
    area,
    cells: map.cells ? cellsInArea(map.grid, area, map.cellRule) : null,
    withinWalls: stops ? (shapes, beyond) => shapesWithinWalls(shaped, walls, shapes, beyond, slack) : null,
  };
}

/** Whether two maps shape every area alike. */
export function sameAreaMap(a: AreaMap, b: AreaMap): boolean {
  return a.walls === b.walls && a.cells === b.cells && a.coneAngle === b.coneAngle && a.coneEnd === b.coneEnd && a.cellRule === b.cellRule && a.diagonalRule === b.diagonalRule
    && a.grid.type === b.grid.type && a.grid.size === b.grid.size && (a.grid.offsetX ?? 0) === (b.grid.offsetX ?? 0) && (a.grid.offsetY ?? 0) === (b.grid.offsetY ?? 0);
}

const samePoint = (a: Point, b: Point): boolean => a.x === b.x && a.y === b.y;

/** What was asked for last, and what came of it. */
interface Asked {
  readonly measurement: Measurement;
  readonly map: AreaMap;
  readonly stops: boolean;
  /** Where a circle's walls are swept from; null where walls do not cut it. */
  readonly sweptFrom: Point | null;
  readonly value: AreaOnMap | null;
}

/**
 * The area of one measurement, worked out again only when it is another area. A circle is the same
 * whichever way its end lies from its centre, so one dragged around at one size (a snapped size
 * changes only every cell) is worked out once: unless its centre lies on a wall or just beside
 * one, where the side it is dragged to decides (`wallSweepPoint`).
 */
export class AreaOnMapMemo {
  private last: Asked | null = null;

  get(measurement: Measurement, map: AreaMap, stopsAtWalls = true): AreaOnMap | null {
    const cut = stopsAtWalls && map.walls.length > 0;
    const sweptFrom = cut ? circleSweptFrom(measurement, map.walls, wallSlack(map)) : null;
    const last = this.last;
    if (last && last.stops === stopsAtWalls && sameAreaMap(last.map, map) && sameArea(last, measurement, sweptFrom)) return last.value;
    const value = areaOnMap(measurement, map, stopsAtWalls);
    this.last = { measurement, map, stops: stopsAtWalls, sweptFrom, value };
    return value;
  }

  forget(): void {
    this.last = null;
  }
}

/** Where the walls of a circle are swept from; null for any other shape, and for a circle without a size. */
function circleSweptFrom({ shape, points }: Measurement, walls: readonly WallSegment[], slack: number): Point | null {
  const [origin, end] = points;
  if (shape !== 'circle' || !origin || !end) return null;
  const x = end.x - origin.x;
  const y = end.y - origin.y;
  const length = Math.hypot(x, y);
  return length > 0 ? wallSweepPoint({ origin, towards: { x: x / length, y: y / length } }, walls, slack) : null;
}

function sameArea(last: Asked, measurement: Measurement, sweptFrom: Point | null): boolean {
  const before = last.measurement;
  if (before === measurement) return true;
  const [origin, end] = measurement.points;
  const [originBefore, endBefore] = before.points;
  if (before.shape !== measurement.shape || before.width !== measurement.width || before.space !== measurement.space || before.rise !== measurement.rise || before.length !== measurement.length || !origin || !end || !originBefore || !endBefore || !samePoint(origin, originBefore)) return false;
  if (samePoint(end, endBefore)) return true;
  if (measurement.shape !== 'circle') return false;
  const radius = Math.hypot(end.x - origin.x, end.y - origin.y);
  const radiusBefore = Math.hypot(endBefore.x - origin.x, endBefore.y - origin.y);
  if (Math.abs(radius - radiusBefore) > EDGE_TOLERANCE) return false;
  return sweptFrom === null || last.sweptFrom === null ? sweptFrom === last.sweptFrom : samePoint(sweptFrom, last.sweptFrom);
}
