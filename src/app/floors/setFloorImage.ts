import { Notice, TFile, type App } from 'obsidian';
import { importMapImage } from '../mapFromImage/importMapImage';
import { AssetService } from '../services/AssetService';
import type { ViewAtlasStore } from '../storeFactory';
import { FloorImageModal, type FloorImageChoice } from './FloorImageModal';

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg']);
/** Atlas' own files hold the maps already, so they are offered as maps and not again as images. */
const ATLAS_FOLDER = 'atlas-vtt/';

/** What a floor can be given: the maps of the scene's collection first, then the images of the vault. */
export async function floorImageChoices(app: App, assetService: AssetService, mapPath: string | null): Promise<FloorImageChoice[]> {
  const collectionId = mapPath ? assetService.getCollectionForMap(mapPath) : null;
  const maps = await assetService.getAssets(collectionId ?? undefined, 'map');
  const images = app.vault.getFiles()
    .filter(file => IMAGE_EXTENSIONS.has(file.extension.toLowerCase()) && !file.path.startsWith(ATLAS_FOLDER))
    .sort((a, b) => a.path.localeCompare(b.path));
  return [
    ...maps.map((map): FloorImageChoice => ({ kind: 'map', name: map.name, path: map.mapFilePath })),
    ...images.map((file): FloorImageChoice => ({ kind: 'image', name: file.basename, path: file.path })),
  ];
}

/**
 * Asks for an image and makes it the image of the active floor. An image of the
 * vault is imported into the asset library first, as a map, the way the map
 * creator does. Setting the image is one undo step.
 */
export async function setFloorImage(app: App, store: ViewAtlasStore): Promise<void> {
  const assetService = AssetService.getInstance(app);
  const { mapPath } = store.getState();
  const choice = await new FloorImageModal(app, await floorImageChoices(app, assetService, mapPath)).prompt();
  if (!choice) return;

  if (choice.kind === 'map') {
    store.getState().setBackground(choice.path);
    return;
  }

  const source = app.vault.getAbstractFileByPath(choice.path);
  if (!(source instanceof TFile)) {
    new Notice('That image is no longer in the vault.');
    return;
  }
  const progress = new Notice(`Importing "${choice.name}"…`, 0);
  try {
    const collectionId = (mapPath && assetService.getCollectionForMap(mapPath)) || assetService.getDefaultCollectionId();
    const map = await importMapImage(app, assetService, source, { name: choice.name, collectionId });
    store.getState().setBackground(map.mapFilePath);
  } catch (error) {
    console.error('[Atlas] Could not import the floor image:', error);
    new Notice(`Could not import the image: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    progress.hide();
  }
}
