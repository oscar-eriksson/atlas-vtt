import type { QuarterTurn } from './imageJob';

/** The turns a map can be given as it is imported, clockwise. */
export const QUARTER_TURNS: readonly QuarterTurn[] = [0, 90, 180, 270];

/** The turn after `turn` when a map is turned a quarter further, back to none after three quarters. */
export function nextQuarterTurn(turn: QuarterTurn): QuarterTurn {
  return QUARTER_TURNS[(QUARTER_TURNS.indexOf(turn) + 1) % QUARTER_TURNS.length] ?? 0;
}

/** The turn written as a choice's value (`'90'`); anything else reads as no turn. */
export function parseQuarterTurn(value: string): QuarterTurn {
  return QUARTER_TURNS.find((turn) => String(turn) === value) ?? 0;
}
