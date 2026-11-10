import { describe, expect, it } from 'vitest';
import { TIMER_RING, timerRingOffset } from '../../src/app/utils/timerWidget';

describe('timerRingOffset', () => {
  it('leaves the ring empty with all the time left and full once it has run out', () => {
    expect(timerRingOffset(300, 300)).toBeCloseTo(TIMER_RING.circumference);
    expect(timerRingOffset(0, 300)).toBe(0);
  });

  it('fills in proportion to the time that has run', () => {
    expect(timerRingOffset(150, 300)).toBeCloseTo(TIMER_RING.circumference / 2);
  });

  it('stays within the circle for a time outside the duration or no duration', () => {
    expect(timerRingOffset(900, 300)).toBeCloseTo(TIMER_RING.circumference);
    expect(timerRingOffset(-5, 300)).toBe(0);
    expect(timerRingOffset(10, 0)).toBe(0);
  });
});
