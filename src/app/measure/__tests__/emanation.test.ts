import { describe, expect, it } from 'vitest';
import { cellsByRule, flatCells } from '../../grid/gridDistance';
import type { MeasurementSettings } from '../../grid/measurementFormat';
import type { DiagonalRule } from '../../types/collectionSettingsTypes';
import { areaOnMap, type AreaMap } from '../areaOnMap';
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
