import { describe, expect, it } from 'vitest';
import { hoistLegacyViewports } from '../../src/app/stores/legacyViewports';

const rect = { id: 'v', kind: 'viewport', x: 1, y: 2, width: 3, height: 4, locked: true, active: true };

describe('hoistLegacyViewports', () => {
  it('moves the viewports of an older map out of its objects and up to the scene', () => {
    const saved = hoistLegacyViewports({ objects: { tokens: {}, viewports: { v: rect } } });
    expect(saved.viewports).toEqual({ v: rect });
    expect(saved.objects).toEqual({ tokens: {} });
  });

  it('keeps the scene\'s own viewports when a map has both', () => {
    const newer = { ...rect, x: 99 };
    const saved = hoistLegacyViewports({ viewports: { v: newer }, objects: { viewports: { v: rect } } });
    expect(saved.viewports).toEqual({ v: newer });
    expect(saved.objects).toEqual({});
  });

  it('takes them out of every floor that still holds them', () => {
    const saved = hoistLegacyViewports({ floorData: { upstairs: { background: null, objects: { tokens: {}, viewports: { v: rect } } } } });
    expect(saved.floorData).toEqual({ upstairs: { background: null, objects: { tokens: {} } } });
  });

  it('leaves a map without any alone, and gives it none', () => {
    const saved = hoistLegacyViewports({ objects: { tokens: { a: 1 } } });
    expect(saved).toEqual({ objects: { tokens: { a: 1 } }, viewports: {} });
  });

  it('does not invent objects for a file that has none', () => {
    expect(hoistLegacyViewports({})).toEqual({ viewports: {} });
  });
});
