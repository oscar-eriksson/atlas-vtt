import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { App, TFile } from 'obsidian';
import type { AssetService } from '../../src/app/services/AssetService';
import { AssetRegistrationUncertainError } from '../../src/app/services/assetRegistrationRecovery';
import { importMapImage } from '../../src/app/mapFromImage/importMapImage';

const optimizeUpload = vi.fn();
const writeAssetImage = vi.fn();
const discardAssetFiles = vi.fn();
const tryThumbnailForImage = vi.fn();

vi.mock('../../src/app/packages/components/asset-manager/token-creator/tokenImages', () => ({
  optimizeUpload: (...args: unknown[]) => optimizeUpload(...args),
}));
vi.mock('../../src/app/services/assetImageFiles', () => ({
  writeAssetImage: (...args: unknown[]) => writeAssetImage(...args),
  discardAssetFiles: (...args: unknown[]) => discardAssetFiles(...args),
}));
vi.mock('../../src/app/services/AssetThumbnailService', () => ({
  AssetThumbnailService: { getInstance: () => ({ tryThumbnailForImage: (...args: unknown[]) => tryThumbnailForImage(...args) }) },
}));

const source = { name: 'axeholm.png', extension: 'png', basename: 'axeholm' } as TFile;
const app = { vault: { readBinary: vi.fn(async () => new ArrayBuffer(8)) } } as unknown as App;
const options = { name: 'Axeholm', collectionId: 'default' };

let addAsset: ReturnType<typeof vi.fn>;
const assets = (): AssetService => ({ addAsset } as unknown as AssetService);

beforeEach(() => {
  vi.clearAllMocks();
  // jsdom's Blob has no arrayBuffer(), which the converter's result is read with.
  optimizeUpload.mockResolvedValue({ image: { arrayBuffer: async () => new ArrayBuffer(4) }, thumbnail: new Blob(['thumb']) });
  writeAssetImage.mockResolvedValue('atlas-vtt/assets/Axeholm_1_a.webp');
  tryThumbnailForImage.mockResolvedValue('atlas-vtt/assets/thumbnails/Axeholm.webp');
  addAsset = vi.fn(async (asset) => ({ ...asset, id: 'map-1' }));
});

describe('importMapImage', () => {
  it('converts the image as a map and registers it in the collection with its thumbnail', async () => {
    const map = await importMapImage(app, assets(), source, options);
    expect(optimizeUpload).toHaveBeenCalledWith(expect.any(File), 'map', expect.objectContaining({ thumbnail: true }));
    expect(addAsset).toHaveBeenCalledWith({
      type: 'map', name: 'Axeholm', mapFilePath: 'atlas-vtt/assets/Axeholm_1_a.webp', collection: 'default', tags: [],
      thumbnailPath: 'atlas-vtt/assets/thumbnails/Axeholm.webp',
    });
    expect(map).toMatchObject({ id: 'map-1', mapFilePath: 'atlas-vtt/assets/Axeholm_1_a.webp' });
    expect(discardAssetFiles).not.toHaveBeenCalled();
  });

  it('hands the converter the image with its type, so an SVG is rasterised', async () => {
    await importMapImage(app, assets(), { ...source, name: 'map.svg', extension: 'SVG' } as TFile, options);
    const file = optimizeUpload.mock.calls[0]![0] as File;
    expect(file.type).toBe('image/svg+xml');
    expect(file.name).toBe('map.svg');
  });

  it('registers a map without a thumbnail when none could be made', async () => {
    tryThumbnailForImage.mockResolvedValue(undefined);
    await importMapImage(app, assets(), source, options);
    expect(addAsset.mock.calls[0]![0]).not.toHaveProperty('thumbnailPath');
  });

  it('leaves no files behind when the map cannot be registered', async () => {
    addAsset.mockRejectedValue(new Error('disk full'));
    await expect(importMapImage(app, assets(), source, options)).rejects.toThrow('disk full');
    expect(discardAssetFiles).toHaveBeenCalledWith(app, ['atlas-vtt/assets/Axeholm_1_a.webp', 'atlas-vtt/assets/thumbnails/Axeholm.webp']);
  });

  it('keeps the files when it cannot tell whether the registration committed', async () => {
    addAsset.mockRejectedValue(new AssetRegistrationUncertainError());
    await expect(importMapImage(app, assets(), source, options)).rejects.toBeInstanceOf(AssetRegistrationUncertainError);
    expect(discardAssetFiles).not.toHaveBeenCalled();
  });

  it('writes nothing when the image cannot be converted', async () => {
    optimizeUpload.mockRejectedValue(new Error('not an image'));
    await expect(importMapImage(app, assets(), source, options)).rejects.toThrow('not an image');
    expect(writeAssetImage).not.toHaveBeenCalled();
  });
});
