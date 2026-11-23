import { describe, expect, it } from 'vitest';
import { cellsByRule, flatCells } from '../../grid/gridDistance';
import type { MeasurementSettings } from '../../grid/measurementFormat';
import type { DiagonalRule } from '../../types/collectionSettingsTypes';
import { areaOnMap, groundedMeasure, type AreaMap } from '../areaOnMap';
import { readMeasure } from '../keptMeasures';
import { measureLabelText } from '../measureLabelText';
import { snapEmanationEnd, snapEmanationOrigin } from '../measureSnap';
import { cellsStoodOn, placementGridOf } from '../measureTokens';
import type { Measurement } from '../measureTypes';
import { tokenSizeOfCells, type TokenGrid } from '../tokenDistance';

const SIZE = 70;
const GRID: TokenGrid = { type: 'square', size: SIZE, offsetX: 0, offsetY: 0 };
const RULES: readonly DiagonalRule[] = ['equidistant', 'alternating', 'manhattan', 'euclidean'];
const mapOf = (diagonalRule: DiagonalRule): AreaMap => ({ grid: GRID, cells: true, coneAngle: 90, coneEnd: 'round', cellRule: 'half', diagonalRule, walls: [] });
const SETTINGS: MeasurementSettings = { mode: 'metric', unitType: 'feet', unitDistance: 5, ruleDistance: 5, diagonalRule: 'equidistant', rangeBands: [], coneAngle: 90 };

/** A creature `space` cells across standing with its middle at `at`, and an emanation of `reach` cells dragged to its right. */
function emanation(at: { x: number; y: number }, space: number, reach: number): Measurement {
  return { shape: 'circle', space, points: [at, { x: at.x + (space * SIZE) / 2 + reach * SIZE, y: at.y }] };
}

/** The cells within `reach` of the creature's own, counted cell by cell as an aura counts them. */
function cellsByHand(at: { x: number; y: number }, space: number, reach: number, rule: DiagonalRule): string[] {
  const stood = cellsStoodOn(at, tokenSizeOfCells(space), placementGridOf(GRID));
  const within: string[] = [];
  for (let row = -4; row <= 14; row++) {
    for (let column = -4; column <= 14; column++) {
      const centre = { x: column * SIZE + SIZE / 2, y: row * SIZE + SIZE / 2 };
      if (stood.some((from) => cellsByRule(flatCells(GRID, [from, centre]), rule) <= reach)) within.push(`${column},${row}`);
    }
  }
  return within.sort();
}

function cellsOf(measurement: Measurement, rule: DiagonalRule): string[] {
  const shaped = areaOnMap(measurement, mapOf(rule))!.shaped;
  const covered: string[] = [];
  for (let row = -4; row <= 14; row++) {
    for (let column = -4; column <= 14; column++) {
      if (shaped.contains({ x: column * SIZE + SIZE / 2, y: row * SIZE + SIZE / 2 })) covered.push(`${column},${row}`);
    }
  }
  return covered.sort();
}

describe('an emanation', () => {
  const places = [
    { space: 1, at: { x: 5 * SIZE + SIZE / 2, y: 5 * SIZE + SIZE / 2 } },
    { space: 2, at: { x: 5 * SIZE, y: 5 * SIZE } },
    { space: 3, at: { x: 5 * SIZE + SIZE / 2, y: 5 * SIZE + SIZE / 2 } },
  ];

  for (const rule of RULES) {
    for (const { space, at } of places) {
      for (const reach of [1, 2, 3]) {
        it(`covers what an aura of ${reach} cells covers around a creature ${space} across (${rule})`, () => {
          expect(cellsOf(emanation(at, space, reach), rule)).toEqual(cellsByHand(at, space, reach, rule));
        });
      }
    }
  }

  it('is a plain circle without the creature\'s size', () => {
    const plain: Measurement = { shape: 'circle', points: [{ x: 385, y: 385 }, { x: 385 + 3 * SIZE, y: 385 }] };
    expect(cellsOf(plain, 'equidistant')).not.toEqual(cellsOf({ ...plain, space: 1 }, 'equidistant'));
  });

  it('reads its distance from the edge of the creature\'s space', () => {
    const grid = { type: 'square', size: SIZE } as const;
    expect(measureLabelText(emanation({ x: 385, y: 385 }, 1, 2), grid, SETTINGS)).toBe('10ft');
    expect(measureLabelText(emanation({ x: 350, y: 350 }, 2, 3), grid, SETTINGS)).toBe('15ft');
  });
});

describe('where an emanation snaps', () => {
  it('starts in the middle of a cell for a creature an odd number across, and where cells meet for an even one', () => {
    expect(snapEmanationOrigin(GRID, { x: 190, y: 120 }, 1)).toEqual({ x: 175, y: 105 });
    expect(snapEmanationOrigin(GRID, { x: 190, y: 120 }, 3)).toEqual({ x: 175, y: 105 });
    expect(snapEmanationOrigin(GRID, { x: 190, y: 120 }, 2)).toEqual({ x: 210, y: 140 });
  });

  it('is placed freely where the grid does not snap', () => {
    expect(snapEmanationOrigin(null, { x: 190, y: 120 }, 2)).toEqual({ x: 190, y: 120 });
    expect(snapEmanationOrigin(GRID, { x: 190, y: 120 }, 2, true)).toEqual({ x: 190, y: 120 });
  });

  it('ends a whole number of cells past the edge of the creature\'s space, one at least', () => {
    const origin = { x: 175, y: 105 };
    expect(snapEmanationEnd(GRID, origin, { x: 175 + 100, y: 105 }, 1)).toEqual({ x: 175 + 35 + 70, y: 105 });
    expect(snapEmanationEnd(GRID, origin, { x: 175 + 36, y: 105 }, 1)).toEqual({ x: 175 + 35 + 70, y: 105 });
    expect(snapEmanationEnd(GRID, origin, { x: 175, y: 105 + 200 }, 2).y).toBeCloseTo(105 + 70 + 2 * 70);
  });
});

describe('a kept emanation', () => {
  const kept = { id: 'e', kind: 'measure', shape: 'circle', points: [{ x: 0, y: 0 }, { x: 105, y: 0 }] };

  it('keeps the creature\'s size when it is a whole number within the limit', () => {
    expect(readMeasure('e', { ...kept, space: 2 })?.space).toBe(2);
  });

  it('reads a size that is none, or on another shape, as a plain measurement', () => {
    for (const space of [0, 1.5, 99, '2', null]) expect(readMeasure('e', { ...kept, space })?.space).toBeUndefined();
    expect(readMeasure('e', { ...kept, shape: 'cone', space: 2 })?.space).toBeUndefined();
  });
});

describe('an area across a height', () => {
  const cone = (rise?: number): Measurement => ({ shape: 'line', points: [{ x: 0, y: 0 }, { x: 5 * SIZE, y: 0 }], ...(rise && { rise }) });

  it('reaches only along the floor what its true distance leaves after the height', () => {
    // 5 cells true distance, 3 cells up: 4 cells along the floor.
    expect(groundedMeasure(cone(3), SIZE)?.points[1]?.x).toBeCloseTo(4 * SIZE);
    expect(groundedMeasure(cone(), SIZE)).toEqual(cone());
  });

  it('has no footprint where the height is the whole distance', () => {
    expect(groundedMeasure(cone(5), SIZE)).toBeNull();
    expect(areaOnMap(cone(6), mapOf('equidistant'))).toBeNull();
  });

  it('puts a cone aimed straight down as a circle under it, as wide as its angle makes it', () => {
    const down: Measurement = { shape: 'cone', rise: 4, points: [{ x: 0, y: 0 }, { x: 4 * SIZE, y: 0 }] };
    const { shaped } = areaOnMap(down, { ...mapOf('equidistant'), coneEnd: 'flat' })!;
    // 90 degrees from 4 cells up: a circle of 4 cells around the point under its tip.
    expect(shaped.contains({ x: 3.9 * SIZE, y: 0 })).toBe(true);
    expect(shaped.contains({ x: 0, y: 3.9 * SIZE })).toBe(true);
    expect(shaped.contains({ x: -3.9 * SIZE, y: 0 })).toBe(true);
    expect(shaped.contains({ x: 4.5 * SIZE, y: 0 })).toBe(false);
  });

  it('ends a round cone with a height in an arc round the point under its tip, as far as its length reaches', () => {
    const tilted: Measurement = { shape: 'cone', rise: 3, points: [{ x: 0, y: 0 }, { x: 5 * SIZE, y: 0 }] };
    const { shaped } = areaOnMap(tilted, mapOf('equidistant'))!;
    // 5 cells long from 3 up: no farther than 4 cells along the floor, in a curve and not a line.
    expect(shaped.contains({ x: 3.9 * SIZE, y: 0 })).toBe(true);
    expect(shaped.contains({ x: 3.5 * SIZE, y: 2.2 * SIZE })).toBe(false);
    expect(shaped.contains({ x: 4.2 * SIZE, y: 0 })).toBe(false);
  });

  it('keeps a cone of its own length and lets its drag aim it: a 60-foot breath from 30 feet up, straight down, is a circle the floor cuts', () => {
    const breath = (aim: number): Measurement => ({ shape: 'cone', rise: 6, length: 12, points: [{ x: 0, y: 0 }, { x: aim * SIZE, y: 0 }] });
    for (const coneEnd of ['round', 'flat'] as const) {
      const { shaped } = areaOnMap(breath(0.3), { ...mapOf('equidistant'), coneEnd })!;
      // 90 degrees from 6 cells up, straight down: 6 cells all around the point under it.
      for (const [x, y] of [[5.9, 0], [-5.9, 0], [0, 5.9], [0, -5.9]] as const) expect(shaped.contains({ x: x * SIZE, y: y * SIZE })).toBe(true);
      expect(shaped.contains({ x: 6.3 * SIZE, y: 0 })).toBe(false);
    }
    // Aimed 6 cells away it reaches farther that way, and still no farther than its length.
    const { shaped } = areaOnMap(breath(6), mapOf('equidistant'))!;
    expect(shaped.contains({ x: 9 * SIZE, y: 0 })).toBe(true);
    expect(shaped.contains({ x: 10.5 * SIZE, y: 0 })).toBe(false);
    expect(measureLabelText(breath(6), { type: 'square', size: SIZE }, SETTINGS)).toBe('60ft ↑30ft');
  });

  it('puts a tilted cone as an oval that reaches the floor beyond where it starts', () => {
    const tilted: Measurement = { shape: 'cone', rise: 3, points: [{ x: 0, y: 0 }, { x: 5 * SIZE, y: 0 }] };
    const { shaped } = areaOnMap(tilted, mapOf('equidistant'))!;
    expect(shaped.contains({ x: 4 * SIZE, y: 0 })).toBe(true);
    expect(shaped.contains({ x: -2 * SIZE, y: 0 })).toBe(false);
    expect(areaOnMap({ ...tilted, rise: 6 }, mapOf('equidistant'))).toBeNull();
  });

  it('is no matter to a circle or square put on a point of the floor', () => {
    for (const shape of ['circle', 'square'] as const) {
      const placed: Measurement = { shape, rise: 3, points: [{ x: 0, y: 0 }, { x: 5 * SIZE, y: 0 }] };
      expect(groundedMeasure(placed, SIZE)).toBe(placed);
    }
  });

  it('reads its true distance and its height in the label', () => {
    const grid = { type: 'square', size: SIZE } as const;
    expect(measureLabelText(cone(4), grid, SETTINGS)).toBe('25 × 5ft ↑20ft');
  });

  it('is read from a file only as a height more than none', () => {
    const kept = { id: 'e', kind: 'measure', shape: 'cone', points: [{ x: 0, y: 0 }, { x: 105, y: 0 }] };
    expect(readMeasure('e', { ...kept, rise: 3 })?.rise).toBe(3);
    for (const rise of [0, -1, '3', null, 1e9]) expect(readMeasure('e', { ...kept, rise })?.rise).toBeUndefined();
  });
});
