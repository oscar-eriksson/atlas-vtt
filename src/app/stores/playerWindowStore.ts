import { createStore, type StoreApi } from 'zustand/vanilla';

export interface PlayerWindowState {
  isOpen: boolean;
  isFrozen: boolean;
  /** True when the player camera is locked onto the scene's active TV viewport rect. */
  isFollowingViewport: boolean;
  /** Scene tab whose map the player window currently shows, or null when nothing is presented. */
  presentedTabId: string | null;
}

export type PlayerWindowStore = StoreApi<PlayerWindowState>;

const INITIAL_STATE: PlayerWindowState = {
  isOpen: false,
  isFrozen: false,
  isFollowingViewport: false,
  presentedTabId: null,
};

/**
 * Reactive mirror of the player window's lifecycle, written by
 * `PlayerWindowService` and read by UI such as the scene tab bar.
 * A single module-level store matches the service's singleton lifetime.
 */
export const playerWindowStore: PlayerWindowStore = createStore<PlayerWindowState>(() => INITIAL_STATE);

export function resetPlayerWindowStore(): void {
  playerWindowStore.setState(INITIAL_STATE);
}
