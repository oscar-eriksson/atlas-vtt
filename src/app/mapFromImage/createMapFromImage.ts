import type { App, TFile } from 'obsidian';
import { AssetService } from '../services/AssetService';
import { createScene, scenePathFor } from '../services/createScene';
import { showNotice } from '../ui/notice';
import { CreateMapFromImageModal } from './CreateMapFromImageModal';
import { importMapImage } from './importMapImage';

/**
 * Turns an image of the vault into an Atlas map: asks for a name and a
 * collection, imports the image into the asset library, creates a scene on it
 * and opens the scene.
 */
export async function createMapFromImage(app: App, source: TFile): Promise<void> {
  const assetService = AssetService.getInstance(app);
  const collections = await assetService.getCollections();
  const choice = await new CreateMapFromImageModal(app, {
    collections,
    defaultCollectionId: assetService.getDefaultCollectionId(),
    defaultName: source.basename,
    isNameTaken: (collectionId, name) => app.vault.getAbstractFileByPath(scenePathFor(collectionId, name)) !== null,
  }).prompt();
  if (!choice) return;

  const progress = showNotice(`Creating "${choice.name}"…`, 0);
  try {
    const map = await importMapImage(app, assetService, source, choice);
    const { file: sceneFile } = await createScene(app, assetService, { name: choice.name, collectionId: choice.collectionId, background: map.mapFilePath });
    await app.workspace.getLeaf(false).openFile(sceneFile);
  } catch (error) {
    console.error('[Atlas] Could not create a map from an image:', error);
    showNotice(`Could not create the map: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    progress.hide();
  }
}
