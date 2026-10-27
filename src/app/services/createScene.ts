import { normalizePath, type App, type TFile } from 'obsidian';
import { ensureFolder } from '../plugin/vaultFolders';
import { normalizeImagePath } from '../utils/pathUtils';
import { readNamedGrid, type NamedGrid } from '../grid/namedGrid';
import type { Asset, AssetService } from './AssetService';
import { newSceneFile } from './newSceneFile';
import { SettingsService } from './SettingsService';

/** What a new scene is made of: its name, the collection it belongs to, the image it starts on and its tags. */
export interface SceneDraft {
  readonly name: string;
  readonly collectionId: string;
  readonly background: string | null;
  readonly tags?: readonly string[];
}

/** A scene's name that another scene of its collection already has. */
export class SceneNameTakenError extends Error {
  constructor(readonly sceneName: string) {
    super(`A scene named "${sceneName}" already exists.`);
  }
}

/** Where a scene of this name lies in its collection. */
export const scenePathFor = (collectionId: string, name: string): string => normalizePath(`atlas-vtt/collections/${collectionId}/scenes/${name.trim()}.atlasmap`);

/** `name`, or the first of "name 2", "name 3"… that no scene of the collection has yet. */
export function freeSceneName(app: App, collectionId: string, name: string): string {
  const base = name.trim();
  let candidate = base;
  for (let count = 2; app.vault.getAbstractFileByPath(scenePathFor(collectionId, candidate)); count += 1) candidate = `${base} ${count}`;
  return candidate;
}

/** The grid the file name of the map on `background` stated, from the first map of the library on that image that kept one. */
async function namedGridOfBackground(assetService: AssetService, background: string): Promise<NamedGrid | null> {
  const maps = await assetService.getAssets(undefined, 'map');
  for (const map of maps) {
    if (map.type !== 'map' || normalizeImagePath(map.mapFilePath) !== background) continue;
    const grid = readNamedGrid(map.namedGrid);
    if (grid) return grid;
  }
  return null;
}

/**
 * Makes an empty scene on a draft's image: its map file and its record, written as one step, so the
 * vault check never finds the new map without a scene and adds a second one. Throws for a collection
 * that no longer exists and a name its collection already has (`SceneNameTakenError`).
 */
export async function createScene(app: App, assetService: AssetService, draft: SceneDraft): Promise<{ file: TFile; asset: Asset }> {
  const collection = await assetService.getCollection(draft.collectionId);
  if (!collection) throw new Error(`Collection "${draft.collectionId}" no longer exists. Select another collection and try again.`);
  const name = draft.name.trim();
  const background = draft.background ? normalizeImagePath(draft.background) : null;
  const mapData = newSceneFile(
    assetService.getCollectionSettings(collection.id),
    background,
    SettingsService.forApp(app)?.detectsGridOnNewScenes() ?? true,
    background ? await namedGridOfBackground(assetService, background) : null,
  );
  const scenePath = scenePathFor(collection.id, name);
  if (app.vault.getAbstractFileByPath(scenePath)) throw new SceneNameTakenError(name);
  return assetService.runExclusive(async () => {
    await ensureFolder(app, scenePath.substring(0, scenePath.lastIndexOf('/')));
    const file = await app.vault.create(scenePath, JSON.stringify(mapData, null, 2));
    const asset = await assetService.addAsset({ type: 'scene', name, collection: collection.id, tags: [...(draft.tags ?? [])], data: { mapPath: scenePath } });
    return { file, asset };
  });
}
