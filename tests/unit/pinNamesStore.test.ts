import { describe, expect, it } from 'vitest';
import { createViewAtlasStore } from '../../src/app/storeFactory';
import { getHistoryStore } from '../../src/app/stores/history';
import { createInMemoryApp } from '../mocks/inMemoryVault';

function setupStore(): ReturnType<typeof createViewAtlasStore> {
  const { app } = createInMemoryApp({ files: {} });
  const store = createViewAtlasStore(app, 'pin-names-store');
  store.getState().setPersistenceEnabled(false);
  store.getState().setMapPath('maps/town.atlasmap');
  return store;
}

describe('setAllPinNames', () => {
  it('shows every pin\'s name, and removes the switch again when hiding them, as one undo step each', () => {
    const store = setupStore();
    const a = store.getState().addNotePin(0, 0, 'Places/A.md');
    const b = store.getState().addNotePin(10, 10, 'Places/B.md', undefined, { showName: true });
    const steps = (): number => getHistoryStore(store)!.getState().pastStates.length;
    const before = steps();

    store.getState().setAllPinNames(true);
    expect(store.getState().objects.pins[a]?.showName).toBe(true);
    expect(store.getState().objects.pins[b]?.showName).toBe(true);
    expect(steps()).toBe(before + 1);

    store.getState().setAllPinNames(false);
    expect('showName' in store.getState().objects.pins[a]!).toBe(false);
    expect('showName' in store.getState().objects.pins[b]!).toBe(false);
    expect(steps()).toBe(before + 2);

    getHistoryStore(store)!.getState().undo();
    expect(store.getState().objects.pins[a]?.showName).toBe(true);
  });
});
