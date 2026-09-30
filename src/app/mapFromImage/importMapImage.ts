import type { App, TFile } from 'obsidian';
import { optimizeUpload } from '../packages/components/asset-manager/token-creator/tokenImages';
import { AssetRegistrationUncertainError } from '../services/assetRegistrationRecovery';
import { discardAssetFiles, writeAssetImage } from '../services/assetImageFiles';
import { AssetThumbnailService } from '../services/AssetThumbnailService';
import type { AssetService, MapAsset } from '../services/AssetService';

export interface MapImageOptions {
  name: string;
  collectionId: string;
  tags?: string[];
  signal?: AbortSignal;
}

const IMAGE_TYPES: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', svg: 'image/svg+xml', webp: 'image/webp',
};

/**
 * Imports an image of the vault as a map of the asset library, the way the map
 * creator does: converted off the main thread, written to Atlas' shared assets,
 * given a thumbnail and registered in the collection. The original file is left
 * as it is, and nothing stays behind if the image cannot be registered.
 */
export async function importMapImage(app: App, assetService: AssetService, source: TFile, options: MapImageOptions): Promise<MapAsset> {
  const file = new File([await app.vault.readBinary(source)], source.name, { type: IMAGE_TYPES[source.extension.toLowerCase()] ?? '' });
  const { image, thumbnail } = await optimizeUpload(file, 'map', { signal: options.signal, thumbnail: true });

  let imagePath: string | undefined;
  let thumbnailPath: string | undefined;
  try {
    imagePath = await writeAssetImage(app, options.name, await image.arrayBuffer());
    thumbnailPath = await AssetThumbnailService.getInstance(app, assetService).tryThumbnailForImage(imagePath, thumbnail);
    const asset = await assetService.addAsset({
      type: 'map',
      name: options.name,
      mapFilePath: imagePath,
      collection: options.collectionId,
      tags: options.tags ?? [],
      ...(thumbnailPath && { thumbnailPath }),
    });
    if (asset.type !== 'map') throw new Error('The asset library did not return the map it was given.');
    return asset;
  } catch (error) {
    // An unconfirmed write may have committed, and then its files must stay.
    if (!(error instanceof AssetRegistrationUncertainError)) await discardAssetFiles(app, [imagePath, thumbnailPath]);
    throw error;
  }
}
