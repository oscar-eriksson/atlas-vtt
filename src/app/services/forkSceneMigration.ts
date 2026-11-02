import { LEVELS_FILE_VERSION, SINGLE_LEVEL_FILE_VERSION } from '../levels/levelFile';

/**
 * Scenes saved by this fork before it took upstream's levels (file versions 6 to 8) carry the fork's
 * own keys: TV viewports (`viewports`, `followViewport`) and floors (`floors`, `activeFloorId`,
 * `floorData`). Upstream refuses such versions as newer. TrueScale and scene levels replace both,
 * and the fork does not carry them over: the scene opens on the floor it was saved on, with the
 * fork's keys gone. Nothing is written until the scene is saved, and then as version 4.
 */
const FORK_KEYS = ['viewports', 'followViewport', 'floors', 'activeFloorId', 'floorData'] as const;

/** Whether a scene state was written by this fork's file versions. */
export function isForkSceneState(state: object): boolean {
  const { version } = state as { version?: unknown };
  return typeof version === 'number' && version > LEVELS_FILE_VERSION && FORK_KEYS.some((key) => key in state);
}

/** `state` without the fork's keys, as a scene file of version 4. */
export function upgradeForkSceneState<T extends object>(state: T): T {
  const upgraded: Record<string, unknown> = { ...state, version: SINGLE_LEVEL_FILE_VERSION };
  for (const key of FORK_KEYS) delete upgraded[key];
  return upgraded as T;
}
