import { describe, expect, it } from 'vitest';
import { clampPinTitleSize, MAX_PIN_TITLE, PIN_TITLE_SIZES, pinTitleOf } from '../../src/app/tools/pinTitle';

describe('pinTitleOf', () => {
  it('is the name of the note, without its folders or extension', () => {
    expect(pinTitleOf('10 - Kallor/Sword Coast/Neverwinter.md')).toBe('Neverwinter');
    expect(pinTitleOf('Conyberry.MD')).toBe('Conyberry');
  });

  it('keeps a dot inside the name and a note of another extension', () => {
    expect(pinTitleOf('Lore/Mr. Smith.md')).toBe('Mr. Smith');
    expect(pinTitleOf('Maps/overview.canvas')).toBe('overview.canvas');
  });

  it('is empty for a pin without a note', () => {
    expect(pinTitleOf('')).toBe('');
    expect(pinTitleOf(undefined)).toBe('');
  });

  it('ends a long name in an ellipsis within the limit', () => {
    const title = pinTitleOf(`${'a'.repeat(60)}.md`);
    expect(title.length).toBe(MAX_PIN_TITLE);
    expect(title.endsWith('…')).toBe(true);
  });
});

describe('clampPinTitleSize', () => {
  it('keeps a size within what titles can take, in tenths', () => {
    expect(clampPinTitleSize(0.1)).toBe(PIN_TITLE_SIZES.min);
    expect(clampPinTitleSize(9)).toBe(PIN_TITLE_SIZES.max);
    expect(clampPinTitleSize(1.34)).toBe(1.3);
  });

  it('is the normal size for anything that is no number', () => {
    for (const bad of ['big', NaN, Infinity, null, undefined]) expect(clampPinTitleSize(bad)).toBe(PIN_TITLE_SIZES.normal);
  });
});
