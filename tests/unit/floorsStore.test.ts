import { describe, expect, it } from 'vitest';
import { createViewAtlasStore } from '../../src/app/storeFactory';
import { getHistoryStore } from '../../src/app/stores/history';
import { playerFloorHolds, removeFloorWithHistory, showFloorToPlayers, switchFloorWithHistory } from '../../src/app/stores/floorsSlice';
import { ATLAS_VERSION } from '../../src/app/services/MapPersistence';
import type { AreaTemplateInput } from '../../src/app/types/areaTemplateTypes';
import { createInMemoryApp } from '../mocks/inMemoryVault';

const template: AreaTemplateInput = { shape: 'cone', x: 100, y: 100, snap: 'any', size: 3, angle: 0, visibleToPlayers: true };

let storeCount = 0;
function setupStore(): ReturnType<typeof createViewAtlasStore> {
  const { app } = createInMemoryApp({ files: {} });
  const store = createViewAtlasStore(app, `floors-test-${storeCount++}`);
  store.getState().setPersistenceEnabled(false);
  store.getState().setMapPath('maps/tower.atlasmap');
  return store;
}

const templateIds = (store: ReturnType<typeof setupStore>): string[] => Object.keys(store.getState().objects.templates);
const undoSteps = (store: ReturnType<typeof setupStore>): number => getHistoryStore(store)!.getState().pastStates.length;

describe('floors', () => {
  it('starts every scene with one floor', () => {
    const { floors, activeFloorId, floorData } = setupStore().getState();
    expect(floors).toEqual([{ id: activeFloorId, name: 'Floor 1' }]);
    expect(floorData).toEqual({});
  });

  it('adds an empty floor after the last without switching to it', () => {
    const store = setupStore();
    const first = store.getState().activeFloorId;
    const id = store.getState().addFloor();
    expect(store.getState().floors.map(floor => floor.name)).toEqual(['Floor 1', 'Floor 2']);
    expect(store.getState().activeFloorId).toBe(first);
    expect(store.getState().floorData[id]).toEqual({ background: null, objects: expect.objectContaining({ tokens: {}, fog: {}, templates: {} }) });
  });

  it('names a new floor after the next free number, and keeps a name it is given', () => {
    const store = setupStore();
    store.getState().addFloor('Cellar');
    store.getState().addFloor();
    expect(store.getState().floors.map(floor => floor.name)).toEqual(['Floor 1', 'Cellar', 'Floor 3']);
  });

  it('swaps the objects and the background when switching floors, and back', () => {
    const store = setupStore();
    const ground = store.getState().activeFloorId;
    store.getState().setBackground('maps/ground.webp');
    const groundTemplate = store.getState().addTemplate(template);
    const upstairs = store.getState().addFloor('Upstairs');

    store.getState().switchFloor(upstairs);
    expect(store.getState().activeFloorId).toBe(upstairs);
    expect(store.getState().background).toBeNull();
    expect(templateIds(store)).toEqual([]);
    const upTemplate = store.getState().addTemplate(template);
    store.getState().setBackground('maps/upstairs.webp');

    store.getState().switchFloor(ground);
    expect(store.getState().background).toBe('maps/ground.webp');
    expect(templateIds(store)).toEqual([groundTemplate]);
    // The floor left behind keeps what it had.
    expect(store.getState().floorData[upstairs]).toMatchObject({ background: 'maps/upstairs.webp' });
    expect(Object.keys(store.getState().floorData[upstairs]!.objects.templates)).toEqual([upTemplate]);
    // The active floor is not kept twice.
    expect(store.getState().floorData[ground]).toBeUndefined();
  });

  it('clears the selection on a switch, since it is on the floor being left', () => {
    const store = setupStore();
    const id = store.getState().addTemplate(template);
    store.getState().setSelection([id]);
    store.getState().switchFloor(store.getState().addFloor());
    expect(store.getState().selectedIds).toEqual([]);
  });

  it('ignores a switch to the active floor or to one that does not exist', () => {
    const store = setupStore();
    const active = store.getState().activeFloorId;
    store.getState().addTemplate(template);
    store.getState().switchFloor(active);
    store.getState().switchFloor('missing');
    expect(store.getState().activeFloorId).toBe(active);
    expect(templateIds(store)).toHaveLength(1);
  });

  it('removes a floor that is not active, and never the active or the last one', () => {
    const store = setupStore();
    const first = store.getState().activeFloorId;
    store.getState().removeFloor(first);
    expect(store.getState().floors).toHaveLength(1);

    const second = store.getState().addFloor();
    store.getState().removeFloor(first);
    expect(store.getState().floors).toHaveLength(2);

    store.getState().removeFloor(second);
    expect(store.getState().floors.map(floor => floor.id)).toEqual([first]);
    expect(store.getState().floorData[second]).toBeUndefined();
  });

  it('renames and reorders floors', () => {
    const store = setupStore();
    const first = store.getState().activeFloorId;
    const second = store.getState().addFloor();
    store.getState().renameFloor(second, '  Attic ');
    store.getState().renameFloor(first, '   ');
    expect(store.getState().floors.map(floor => floor.name)).toEqual(['Floor 1', 'Attic']);

    store.getState().moveFloor(second, 0);
    expect(store.getState().floors.map(floor => floor.id)).toEqual([second, first]);
  });

  it('starts over when the scene changes', () => {
    const store = setupStore();
    store.getState().addFloor();
    store.getState().clearMapState();
    expect(store.getState().floors).toHaveLength(1);
    expect(store.getState().floorData).toEqual({});
  });

  it('saves the floors with the scene and restores them', () => {
    const store = setupStore();
    const ground = store.getState().activeFloorId;
    store.getState().addTemplate(template);
    const cellar = store.getState().addFloor('Cellar');
    store.getState().setPersistenceEnabled(true);

    const options = (store as any).persist.getOptions();
    const saved = options.partialize(store.getState());
    expect(saved).toMatchObject({ activeFloorId: ground, floors: [{ id: ground }, { id: cellar, name: 'Cellar' }] });
    expect(Object.keys(saved.floorData)).toEqual([cellar]);
    expect(ATLAS_VERSION).toBe(8);

    // A scene from before floors has none of these, and keeps the one floor a new scene starts with.
    const restored = options.merge({ objects: saved.objects }, setupStore().getState());
    expect(restored.floors).toHaveLength(1);
    const reopened = options.merge(JSON.parse(JSON.stringify(saved)), setupStore().getState());
    expect(reopened.floors.map((floor: { name: string }) => floor.name)).toEqual(['Floor 1', 'Cellar']);
    expect(Object.keys(reopened.floorData)).toEqual([cellar]);
  });
});

describe('the TV viewports across floors', () => {
  const rect = { x: 100, y: 200, width: 915, height: 515, locked: true, active: true };

  it('are the same on every floor, since they belong to the table', () => {
    const store = setupStore();
    const id = store.getState().addViewport(rect);
    const upstairs = store.getState().addFloor();
    store.getState().switchFloor(upstairs);
    expect(store.getState().viewports[id]).toMatchObject(rect);
    store.getState().updateViewport(id, { x: 500 });
    store.getState().switchFloor(store.getState().floors[0]!.id);
    expect(store.getState().viewports[id]).toMatchObject({ x: 500 });
  });

  it('are not kept in the objects of a floor', () => {
    const store = setupStore();
    store.getState().addViewport(rect);
    expect(store.getState().objects).not.toHaveProperty('viewports');
    store.getState().switchFloor(store.getState().addFloor());
    expect(store.getState().floorData).not.toHaveProperty('viewports');
  });

  it('are not touched by undo on a floor', () => {
    const store = setupStore();
    store.getState().addTemplate({ shape: 'cone', x: 0, y: 0, snap: 'any', size: 3, angle: 0, visibleToPlayers: true });
    const id = store.getState().addViewport(rect);
    store.getState().updateViewport(id, { x: 900 });
    getHistoryStore(store)!.getState().undo();
    expect(store.getState().viewports[id]).toMatchObject({ x: 900 });
  });
});

describe('the undo history of each floor', () => {
  it('is not changed by switching floors', () => {
    const store = setupStore();
    store.getState().addTemplate(template);
    const before = undoSteps(store);
    switchFloorWithHistory(store, store.getState().addFloor());
    expect(store.getState().activeFloorId).not.toBe(store.getState().floors[0]!.id);
    expect(undoSteps(store)).toBe(0);
    switchFloorWithHistory(store, store.getState().floors[0]!.id);
    expect(undoSteps(store)).toBe(before);
  });

  it('keeps an undo on one floor from reaching another floor', () => {
    const store = setupStore();
    const ground = store.getState().activeFloorId;
    const groundTemplate = store.getState().addTemplate(template);
    const upstairs = store.getState().addFloor();

    switchFloorWithHistory(store, upstairs);
    store.getState().addTemplate(template);
    getHistoryStore(store)!.getState().undo();
    expect(templateIds(store)).toEqual([]);
    // Nothing more to undo here: the ground floor's step is not on this floor's history.
    getHistoryStore(store)!.getState().undo();
    expect(templateIds(store)).toEqual([]);

    switchFloorWithHistory(store, ground);
    expect(templateIds(store)).toEqual([groundTemplate]);
    getHistoryStore(store)!.getState().undo();
    expect(templateIds(store)).toEqual([]);
  });
});

describe('removing a floor with its history', () => {
  it('moves to the floor before it when the active floor is removed, with that floor\'s own undo steps', () => {
    const store = setupStore();
    const ground = store.getState().activeFloorId;
    store.getState().addTemplate(template);
    const upstairs = store.getState().addFloor();
    switchFloorWithHistory(store, upstairs);
    store.getState().addTemplate(template);

    expect(removeFloorWithHistory(store, upstairs)).toBe(true);
    expect(store.getState().activeFloorId).toBe(ground);
    expect(store.getState().floors.map(floor => floor.id)).toEqual([ground]);
    expect(store.getState().floorData).toEqual({});
    expect(templateIds(store)).toHaveLength(1);
    expect(undoSteps(store)).toBe(1);
  });

  it('moves to the floor after it when the first floor is removed', () => {
    const store = setupStore();
    const ground = store.getState().activeFloorId;
    const upstairs = store.getState().addFloor();
    expect(removeFloorWithHistory(store, ground)).toBe(true);
    expect(store.getState().activeFloorId).toBe(upstairs);
  });

  it('removes a floor that is not active and leaves the active one as it is', () => {
    const store = setupStore();
    const ground = store.getState().activeFloorId;
    store.getState().addTemplate(template);
    const cellar = store.getState().addFloor();
    expect(removeFloorWithHistory(store, cellar)).toBe(true);
    expect(store.getState().activeFloorId).toBe(ground);
    expect(templateIds(store)).toHaveLength(1);
  });

  it('never removes the last floor, or one that does not exist', () => {
    const store = setupStore();
    expect(removeFloorWithHistory(store, store.getState().activeFloorId)).toBe(false);
    store.getState().addFloor();
    expect(removeFloorWithHistory(store, 'missing')).toBe(false);
    expect(store.getState().floors).toHaveLength(2);
  });
});

describe('the floor of the players', () => {
  it('follows the DM until a floor is chosen', () => {
    const store = setupStore();
    expect(store.getState().playerFloorId).toBeNull();
    const { floors } = store.getState();
    const upstairs = store.getState().addFloor();
    store.getState().setPlayerFloor(upstairs);
    expect(store.getState().playerFloorId).toBe(upstairs);
    store.getState().setPlayerFloor(null);
    expect(store.getState().playerFloorId).toBeNull();
    expect(floors).toHaveLength(1);
  });

  it('ignores a floor that does not exist', () => {
    const store = setupStore();
    store.getState().setPlayerFloor('missing');
    expect(store.getState().playerFloorId).toBeNull();
  });

  it('goes back to following when the floor they are kept on is deleted', () => {
    const store = setupStore();
    const cellar = store.getState().addFloor();
    store.getState().setPlayerFloor(cellar);
    removeFloorWithHistory(store, cellar);
    expect(store.getState().playerFloorId).toBeNull();
  });

  it('starts following again when the scene changes, and is never saved', () => {
    const store = setupStore();
    store.getState().setPlayerFloor(store.getState().addFloor());
    store.getState().setPersistenceEnabled(true);
    expect((store as any).persist.getOptions().partialize(store.getState())).not.toHaveProperty('playerFloorId');
    store.getState().clearMapState();
    expect(store.getState().playerFloorId).toBeNull();
  });

  it('takes the DM to the floor and keeps the players on it', () => {
    const store = setupStore();
    const upstairs = store.getState().addFloor();
    showFloorToPlayers(store, upstairs);
    expect(store.getState().activeFloorId).toBe(upstairs);
    expect(store.getState().playerFloorId).toBe(upstairs);
  });

  it('holds the players\' frame only while the DM is on another floor than theirs', () => {
    const store = setupStore();
    const ground = store.getState().activeFloorId;
    const upstairs = store.getState().addFloor();
    expect(playerFloorHolds(store.getState())).toBe(false);

    showFloorToPlayers(store, upstairs);
    expect(playerFloorHolds(store.getState())).toBe(false);

    switchFloorWithHistory(store, ground);
    expect(playerFloorHolds(store.getState())).toBe(true);

    store.getState().setPlayerFloor(null);
    expect(playerFloorHolds(store.getState())).toBe(false);
  });

  it('holds nothing for a store that knows no floors', () => {
    expect(playerFloorHolds({} as any)).toBe(false);
  });
});
