import { describe, expect, it } from 'vitest';
import { newSceneMapData } from '../../src/app/services/sceneCreation';
import type { CollectionSettings } from '../../src/app/types/collectionSettingsTypes';

const settings = (gridDefaults?: Partial<NonNullable<CollectionSettings['gridDefaults']>>): CollectionSettings =>
  ({ gridDefaults, defaultWidgets: {} } as unknown as CollectionSettings);

type MapData = { state: { background: string | null; grid: Record<string, unknown>; objects: Record<string, unknown> } };

describe('newSceneMapData', () => {
  it('starts an empty scene with a grid that detects itself', () => {
    const { state } = newSceneMapData(settings(), null) as MapData;
    expect(state.background).toBeNull();
    expect(state.grid).toMatchObject({ enabled: true, type: 'square', size: 70, autoDetect: true });
    expect(state.objects).toEqual({ tokens: {}, fog: {}, pins: {}, texts: {}, drawings: {} });
  });

  it('starts on the map image when it is given', () => {
    const { state } = newSceneMapData(settings(), 'atlas-vtt/assets/axeholm.webp') as MapData;
    expect(state.background).toBe('atlas-vtt/assets/axeholm.webp');
  });

  it('takes the collection\'s units', () => {
    const { state } = newSceneMapData(settings({ unitType: 'meters', unitDistance: 1.5, measurementMode: 'metric' }), null) as MapData;
    expect(state.grid).toMatchObject({ unitType: 'meters', unitDistance: 1.5, measurementType: 'units' });
  });

  it('measures in range bands when the collection does', () => {
    const { state } = newSceneMapData(settings({ measurementMode: 'abstract' }), null) as MapData;
    expect(state.grid).toMatchObject({ measurementType: 'abstract' });
  });
});
