import { describe, expect, it } from 'vitest';
import { parseSceneFile } from '../../src/app/services/MapPersistence';

const forkScene = (version: number): string => JSON.stringify({
  state: {
    schema: 'atlas-vtt', version, mapPath: 'a.atlasmap', background: 'map.jpg',
    objects: { tokens: {}, pins: { p: { id: 'p', x: 1, y: 2 } }, templates: {} },
    viewports: { v: { id: 'v' } }, followViewport: true,
    floors: [{ id: 'floor-1', name: 'Floor 1' }], activeFloorId: 'floor-1', floorData: {},
  },
  version,
});

describe('scenes saved by this fork before it took upstream\'s levels', () => {
  it.each([6, 7, 8])('open as plain scenes from file version %i, with the fork\'s keys gone', (version) => {
    const { state, version: top } = parseSceneFile(forkScene(version));
    expect(state.version).toBe(4);
    expect(top).toBe(4);
    for (const key of ['viewports', 'followViewport', 'floors', 'activeFloorId', 'floorData']) expect(state).not.toHaveProperty(key);
    expect(state.objects?.pins).toEqual({ p: { id: 'p', x: 1, y: 2 } });
    expect(state.background).toBe('map.jpg');
  });

  it('are still refused when a newer Atlas saved them', () => {
    expect(() => parseSceneFile(JSON.stringify({ state: { schema: 'atlas-vtt', version: 9, objects: {} }, version: 9 }))).toThrow(/newer/);
  });
});
