import { App, normalizePath, type TFile } from 'obsidian';
import type { CollectionSettings } from '../types/collectionSettingsTypes';
import { ensureFolder } from '../plugin/vaultFolders';
import { normalizeImagePath } from '../utils/pathUtils';
import type { AssetService } from './AssetService';
import { tokenBarsOf, withTokenBars } from './collectionTokenBars';

export interface NewSceneOptions {
  name: string;
  tags: string[];
  /** Vault path of the map image the scene starts with; none makes an empty scene. */
  backgroundPath: string | null;
}

/** Where the map file of the scene `name` in a collection lives. */
export function sceneFilePath(collectionId: string, name: string): string {
  return normalizePath(`atlas-vtt/collections/${collectionId}/scenes/${name.trim()}.atlasmap`);
}

/** Whether the collection has no scene called `name` yet. */
export function sceneNameIsFree(app: App, collectionId: string, name: string): boolean {
  return !app.vault.getAbstractFileByPath(sceneFilePath(collectionId, name));
}

/** Thrown when the collection already has a scene with the chosen name. */
export class SceneNameTakenError extends Error {
  constructor(name: string) {
    super(`A scene named "${name}" already exists`);
  }
}

/** The contents of a new scene's map file: a square grid that detects itself on load, on top of the collection's units and resource bars. */
export function newSceneMapData(settings: CollectionSettings, backgroundPath: string | null): Record<string, unknown> {
  const grid = {
    enabled: true,
    visible: true,
    snapToGrid: true,
    type: 'square',
    size: 70,
    offsetX: 0,
    offsetY: 0,
    opacity: 0.5,
    lineType: 'solid' as const,
    lineWidth: 1,
    autoDetect: true,
    ...(settings.gridDefaults && {
      unitType: settings.gridDefaults.unitType,
      unitDistance: settings.gridDefaults.unitDistance,
      measurementType: settings.gridDefaults.measurementMode === 'abstract' ? 'abstract' as const : 'units' as const,
    }),
  };
  const state = {
    schema: 'atlas-vtt',
    version: 3,
    background: backgroundPath ? normalizeImagePath(backgroundPath) : null,
    grid,
    objects: { tokens: {}, fog: {}, pins: {}, texts: {}, drawings: {} },
    camera: { x: 0, y: 0, scale: 1 },
    // The collection's resource bars, e.g. Daggerheart's Stress
    tokenSettings: withTokenBars(undefined, tokenBarsOf(settings.defaultWidgets)),
  };
  return { state, version: 3 };
}

/**
 * Creates a scene in the collection: its map file and its scene record, written
 * as one step so the vault check never finds the new map without a scene and
 * adds a second one. Returns the map file.
 */
export async function createScene(app: App, assetService: AssetService, collectionId: string, options: NewSceneOptions): Promise<TFile> {
  const collection = await assetService.getCollection(collectionId);
  if (!collection) {
    throw new Error(`Collection "${collectionId}" no longer exists. Select another collection and try again.`);
  }
  const name = options.name.trim();
  const scenePath = sceneFilePath(collection.id, name);
  if (!sceneNameIsFree(app, collection.id, name)) throw new SceneNameTakenError(name);

  const mapData = newSceneMapData(assetService.getCollectionSettings(collection.id), options.backgroundPath);
  return assetService.runExclusive(async () => {
    await ensureFolder(app, scenePath.substring(0, scenePath.lastIndexOf('/')));
    const file = await app.vault.create(scenePath, JSON.stringify(mapData, null, 2));
    await assetService.addAsset({
      type: 'scene',
      name,
      collection: collection.id,
      tags: options.tags,
      data: { mapPath: scenePath },
    });
    return file;
  });
}
