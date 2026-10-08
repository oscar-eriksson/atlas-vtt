import { describe, expect, it } from 'vitest';
import type { QuarterTurn } from '../../src/app/imageProcessing/imageJob';
import { nextQuarterTurn, parseQuarterTurn, QUARTER_TURNS } from '../../src/app/imageProcessing/quarterTurns';

describe('parseQuarterTurn', () => {
  it('reads every offered turn back from its value', () => {
    for (const turn of QUARTER_TURNS) expect(parseQuarterTurn(String(turn))).toBe(turn);
  });

  it('reads anything else as no turn', () => {
    expect(parseQuarterTurn('45')).toBe(0);
    expect(parseQuarterTurn('')).toBe(0);
  });
});

describe('nextQuarterTurn', () => {
  it('goes a quarter further each time and back to none after three quarters', () => {
    expect([0, 90, 180, 270].map((turn) => nextQuarterTurn(turn as QuarterTurn))).toEqual([90, 180, 270, 0]);
  });
});
