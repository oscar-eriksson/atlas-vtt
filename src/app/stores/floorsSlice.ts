/**
 * Floors: several levels of one scene. The store's `objects` and `background`
 * are always those of the active floor, so code that reads them needs no change;
 * the floors that are not active are kept as data in `floorData`. Switching
 * swaps the two. Each action is one store write.
 */

import type { ViewAtlasState } from '../storeFactory';
import { getHistoryStore, type HistoryHost } from './history';

/** The objects of one floor: a record per kind of map object. */
export type MapObjects = ViewAtlasState['objects'];

export interface FloorInfo {
  id: string;
  name: string;
}

/** What a floor that is not active holds. */
export interface FloorData {
  background: string | null;
  objects: MapObjects;
}

export const DEFAULT_FLOOR_ID = 'floor-1';

export function emptyMapObjects(): MapObjects {
  return { tokens: {}, fog: {}, pins: {}, texts: {}, drawings: {}, walls: {}, lights: {}, audios: {}, viewports: {}, templates: {} };
}

/** A scene that has never had floors: the one floor it always had. */
export function initialFloors(): Pick<FloorsSlice, 'floors' | 'activeFloorId' | 'floorData'> {
  return { floors: [{ id: DEFAULT_FLOOR_ID, name: 'Floor 1' }], activeFloorId: DEFAULT_FLOOR_ID, floorData: {} };
}

export interface FloorsSlice {
  /** The floors in order, the active one included. */
  floors: FloorInfo[];
  activeFloorId: string;
  /** The floors that are not active. */
  floorData: Record<string, FloorData>;
  /** Adds an empty floor after the last and returns its id. The active floor stays. */
  addFloor: (name?: string) => string;
  renameFloor: (id: string, name: string) => void;
  /** Removes a floor that is not active, with everything on it; the last floor and the active one stay. */
  removeFloor: (id: string) => void;
  /** Moves a floor to `index` in the order. */
  moveFloor: (id: string, index: number) => void;
  /** Makes a floor the active one: its objects and background replace the current ones. Not an undo step. */
  switchFloor: (id: string) => void;
}

type FloorsStoreState = Pick<ViewAtlasState, 'floors' | 'activeFloorId' | 'floorData' | 'objects' | 'background' | 'selectedIds' | '_visionDirty' | '_audioDirty'>;
type ImmerSet = (fn: (draft: FloorsStoreState) => void) => void;

function newFloorId(): string {
  return `floor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** The next free "Floor N". */
function nextFloorName(floors: readonly FloorInfo[]): string {
  const names = new Set(floors.map(floor => floor.name));
  for (let n = floors.length + 1; ; n++) if (!names.has(`Floor ${n}`)) return `Floor ${n}`;
}

export function createFloorsActions(set: ImmerSet): Pick<FloorsSlice, 'addFloor' | 'renameFloor' | 'removeFloor' | 'moveFloor' | 'switchFloor'> {
  return {
    addFloor: (name) => {
      const id = newFloorId();
      set((draft) => {
        draft.floors.push({ id, name: name?.trim() || nextFloorName(draft.floors) });
        draft.floorData[id] = { background: null, objects: emptyMapObjects() };
      });
      return id;
    },

    renameFloor: (id, name) => set((draft) => {
      const floor = draft.floors.find(candidate => candidate.id === id);
      if (floor && name.trim()) floor.name = name.trim();
    }),

    removeFloor: (id) => set((draft) => {
      if (draft.floors.length <= 1 || id === draft.activeFloorId) return;
      const index = draft.floors.findIndex(floor => floor.id === id);
      if (index < 0) return;
      draft.floors.splice(index, 1);
      delete draft.floorData[id];
    }),

    moveFloor: (id, index) => set((draft) => {
      const from = draft.floors.findIndex(floor => floor.id === id);
      if (from < 0) return;
      const [floor] = draft.floors.splice(from, 1);
      draft.floors.splice(Math.max(0, Math.min(index, draft.floors.length)), 0, floor!);
    }),

    switchFloor: (id) => set((draft) => {
      if (id === draft.activeFloorId || !draft.floors.some(floor => floor.id === id)) return;
      draft.floorData[draft.activeFloorId] = { background: draft.background, objects: draft.objects };
      const target = draft.floorData[id] ?? { background: null, objects: emptyMapObjects() };
      draft.objects = target.objects;
      draft.background = target.background;
      delete draft.floorData[id];
      draft.activeFloorId = id;
      // What is selected is on the floor being left.
      draft.selectedIds = [];
      draft._visionDirty = true;
      draft._audioDirty = true;
    }),
  };
}

interface HistoryStacks {
  past: unknown[];
  future: unknown[];
}

/** Each floor's undo and redo steps, kept while another floor is active. */
const floorHistories = new WeakMap<object, Map<string, HistoryStacks>>();

function historiesOf(store: HistoryHost): Map<string, HistoryStacks> {
  let histories = floorHistories.get(store);
  if (!histories) {
    histories = new Map<string, HistoryStacks>();
    floorHistories.set(store, histories);
  }
  return histories;
}

/** A view store, as far as switching floors needs it. */
interface FloorStore {
  getState: () => Pick<ViewAtlasState, 'activeFloorId' | 'switchFloor'>;
}

/** A view store, as far as removing a floor needs it. */
interface FloorListStore {
  getState: () => Pick<ViewAtlasState, 'activeFloorId' | 'floors' | 'switchFloor' | 'removeFloor'>;
}

/**
 * Makes `id` the active floor with its own undo history: the steps of the floor
 * being left are kept for when it is active again, and the new floor's steps
 * replace them. The switch itself is no undo step. Undo restores whole snapshots
 * of a floor's objects, so a history shared by floors would put one floor's objects on another.
 */
export function switchFloorWithHistory(store: FloorStore, id: string): void {
  const state = store.getState();
  if (id === state.activeFloorId) return;
  const history = getHistoryStore(store);
  const histories = historiesOf(store);
  if (history) {
    const { pastStates, futureStates } = history.getState();
    histories.set(state.activeFloorId, { past: pastStates, future: futureStates });
  }
  const swap = (): void => state.switchFloor(id);
  if (history) history.getState().untracked(swap);
  else swap();
  const restored = histories.get(id);
  history?.setState({ pastStates: (restored?.past ?? []) as never, futureStates: (restored?.future ?? []) as never });
}

/** Forgets the undo steps of a floor that was removed. */
export function forgetFloorHistory(store: HistoryHost, id: string): void {
  floorHistories.get(store)?.delete(id);
}

/**
 * Removes a floor with everything on it. When it is the active one, the floor
 * before it (or after it, for the first) becomes active first. The last floor
 * is never removed. Returns whether a floor was removed.
 */
export function removeFloorWithHistory(store: FloorListStore, id: string): boolean {
  const { floors, activeFloorId } = store.getState();
  const index = floors.findIndex(floor => floor.id === id);
  if (index < 0 || floors.length <= 1) return false;
  if (id === activeFloorId) switchFloorWithHistory(store, floors[index === 0 ? 1 : index - 1]!.id);
  store.getState().removeFloor(id);
  forgetFloorHistory(store, id);
  return true;
}
