import { describe, expect, it } from 'vitest';
import { createViewAtlasStore } from '../../src/app/storeFactory';
import { getHistoryStore } from '../../src/app/stores/history';
import { ATLAS_VERSION, migrateMapFile } from '../../src/app/services/MapPersistence';
import type { AreaTemplateInput } from '../../src/app/types/areaTemplateTypes';
import { createInMemoryApp } from '../mocks/inMemoryVault';

const cone: AreaTemplateInput = { shape: 'cone', x: 100, y: 100, snap: 'intersection', size: 3, angle: 0, visibleToPlayers: true };

let storeCount = 0;
function setupStore(): ReturnType<typeof createViewAtlasStore> {
  const { app } = createInMemoryApp({ files: {} });
  const store = createViewAtlasStore(app, `templates-test-${storeCount++}`);
  store.getState().setPersistenceEnabled(false);
  store.getState().setMapPath('maps/town.atlasmap');
  return store;
}

const undoSteps = (store: ReturnType<typeof setupStore>): number => getHistoryStore(store)!.getState().pastStates.length;

describe('area template store actions', () => {
  it('adds a template under a new id', () => {
    const store = setupStore();
    const id = store.getState().addTemplate(cone);
    expect(store.getState().objects.templates[id]).toEqual({ ...cone, id });
  });

  it('updates only the fields it is given', () => {
    const store = setupStore();
    const id = store.getState().addTemplate(cone);
    store.getState().updateTemplate(id, { angle: 1.5, size: 6 });
    expect(store.getState().objects.templates[id]).toMatchObject({ shape: 'cone', x: 100, angle: 1.5, size: 6 });
  });

  it('ignores an update for a template that is gone', () => {
    const store = setupStore();
    store.getState().updateTemplate('missing', { size: 2 });
    expect(store.getState().objects.templates).toEqual({});
  });

  it('deletes a template and drops it from the selection', () => {
    const store = setupStore();
    const id = store.getState().addTemplate(cone);
    store.getState().setSelection([id]);
    store.getState().deleteTemplate(id);
    expect(store.getState().objects.templates[id]).toBeUndefined();
    expect(store.getState().selectedIds).toEqual([]);
  });

  it('is removed by the normal delete of the selection, in one undo step', () => {
    const store = setupStore();
    const id = store.getState().addTemplate(cone);
    store.getState().setSelection([id]);
    const before = undoSteps(store);
    store.getState().deleteSelected();
    expect(store.getState().objects.templates[id]).toBeUndefined();
    expect(store.getState().selectedIds).toEqual([]);
    expect(undoSteps(store)).toBe(before + 1);
    getHistoryStore(store)!.getState().undo();
    expect(store.getState().objects.templates[id]).toBeDefined();
  });

  it('can be recoloured and set back to the theme colour', () => {
    const store = setupStore();
    const id = store.getState().addTemplate(cone);
    store.getState().updateTemplate(id, { color: '#e5484d' });
    expect(store.getState().objects.templates[id]?.color).toBe('#e5484d');
    store.getState().updateTemplate(id, { color: undefined });
    expect(store.getState().objects.templates[id]?.color).toBeUndefined();
  });

  it('is one undo step to add and to undo it', () => {
    const store = setupStore();
    const before = undoSteps(store);
    const id = store.getState().addTemplate(cone);
    expect(undoSteps(store)).toBe(before + 1);
    getHistoryStore(store)!.getState().undo();
    expect(store.getState().objects.templates[id]).toBeUndefined();
  });

  it('starts empty when the map changes', () => {
    const store = setupStore();
    store.getState().addTemplate(cone);
    store.getState().clearMapState();
    expect(store.getState().objects.templates).toEqual({});
  });
});

describe('map files and area templates', () => {
  it('starts a new map file with no templates', () => {
    const file = migrateMapFile(undefined);
    expect(file.version).toBe(ATLAS_VERSION);
    expect(file.objects.templates).toEqual({});
  });

  it('opens a map file from before templates with none', () => {
    const older = {
      schema: 'atlas-vtt', version: 5, background: null, grid: null,
      objects: { tokens: {}, fog: {}, pins: {}, texts: {}, drawings: {}, walls: {}, lights: {}, viewports: {} },
      camera: { x: 0, y: 0, scale: 1 },
    };
    expect(migrateMapFile(older).objects.templates).toEqual({});
  });
});
