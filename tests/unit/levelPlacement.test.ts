import { describe, expect, it } from 'vitest';
import { centredOffset, levelWorldRect, movedOffset, placedAlignment } from '../../src/app/levels/levelPlacement';

const square = { size: 70, type: 'square' as const };

describe('moving a level\'s image', () => {
  it('moves it by whole cells, to the nearest', () => {
    expect(movedOffset({ x: 0, y: 0 }, { x: 100, y: 34 }, square)).toEqual({ x: 70, y: 0 });
    expect(movedOffset({ x: 140, y: 70 }, { x: 36, y: 106 }, square)).toEqual({ x: 210, y: 210 });
  });

  it('never moves it left of or above the origin', () => {
    expect(movedOffset({ x: 70, y: 0 }, { x: -500, y: -500 }, square)).toEqual({ x: 0, y: 0 });
    expect(movedOffset({ x: 100, y: 100 }, { x: -500, y: -500 }, square)).toEqual({ x: 30, y: 30 });
  });

  it('moves a pointy hex grid by a hex across and two rows down', () => {
    const hex = { size: 100, type: 'hex-vertical' as const };
    expect(movedOffset({ x: 0, y: 0 }, { x: 105, y: 180 }, hex)).toEqual({ x: 100, y: 173.2051 });
  });
});

describe('centring a level\'s image', () => {
  it('puts a smaller image in the middle of a larger one, to the cell', () => {
    const below = { x: 0, y: 0, width: 1400, height: 1000 };
    const small = { x: 0, y: 0, width: 700, height: 500 };
    // Centred would be (350, 250); the nearest whole cells are 350 and 280 or 350
    expect(centredOffset(small, below, square)).toEqual({ x: 350, y: 280 });
  });

  it('measures from where the image lies now', () => {
    const below = { x: 0, y: 0, width: 1400, height: 1000 };
    expect(centredOffset({ x: 70, y: 70, width: 700, height: 500 }, below, square)).toEqual({ x: 350, y: 280 });
  });
});

describe('the rect an image fills', () => {
  it('starts at its offset and grows with its stretch', () => {
    expect(levelWorldRect({ width: 1000, height: 500 }, { x: 1.1, y: 1, offset: { x: 70, y: 140 } })).toMatchObject({ x: 70, y: 140, width: 1100, height: 500 });
  });
});

describe('the alignment of a moved level', () => {
  it('keeps the scale and stretch of a level that has one', () => {
    const current = { offset: { x: 0, y: 0 }, scale: 1.5, stretch: { x: 1.1, y: 1 } };
    expect(placedAlignment({}, current, { x: 70, y: 70 })).toEqual({ offset: { x: 70, y: 70 }, scale: 1.5, stretch: { x: 1.1, y: 1 } });
  });

  it('takes the scene\'s stretch for a level drawn in its frame, at scale 1', () => {
    expect(placedAlignment({ mapStretch: { x: 1.2, y: 1 } }, undefined, { x: 70, y: 0 })).toEqual({ offset: { x: 70, y: 0 }, scale: 1, stretch: { x: 1.2, y: 1 } });
    expect(placedAlignment({}, undefined, { x: 0, y: 70 }).stretch).toEqual({ x: 1, y: 1 });
  });
});
