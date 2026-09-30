import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { App } from 'obsidian';
import { TFile } from 'obsidian';

const prompt = vi.fn();
const importMapImage = vi.fn();
vi.mock('../../src/app/floors/FloorImageModal', () => ({ FloorImageModal: class { prompt = (...args: unknown[]) => prompt(...args); } }));
vi.mock('../../src/app/mapFromImage/importMapImage', () => ({ importMapImage: (...args: unknown[]) => importMapImage(...args) }));

const assetService = {
  getCollectionForMap: vi.fn((_path: string) => 'campaign' as string | null),
  getDefaultCollectionId: vi.fn(() => 'default'),
  getAssets: vi.fn(async () => [{ name: 'Axeholm', mapFilePath: 'atlas-vtt/assets/Axeholm_1.webp' }]),
};
vi.mock('../../src/app/services/AssetService', () => ({ AssetService: { getInstance: () => assetService } }));

import { floorImageChoices, setFloorImage } from '../../src/app/floors/setFloorImage';

function file(path: string): TFile {
  const f = new TFile();
  Object.assign(f, { path, name: path.split('/').pop(), basename: path.split('/').pop()!.replace(/\.[^.]+$/, ''), extension: path.split('.').pop() });
  return f;
}

const files = [file('Images/tower.png'), file('Images/cellar.JPG'), file('notes/readme.md'), file('atlas-vtt/assets/Axeholm_1.webp'), file('Images/attic.webp')];
const app = { vault: { getFiles: () => files, getAbstractFileByPath: (path: string) => files.find(f => f.path === path) ?? null } } as unknown as App;

function storeWith(mapPath: string | null = 'atlas-vtt/collections/campaign/scenes/Tower.atlasmap') {
  const setBackground = vi.fn();
  return { setBackground, store: { getState: () => ({ mapPath, setBackground }) } as any };
}

beforeEach(() => vi.clearAllMocks());

describe('floorImageChoices', () => {
  it('offers the maps of the scene\'s collection first, then the images of the vault, not Atlas\' own files', async () => {
    const choices = await floorImageChoices(app, assetService as any, 'atlas-vtt/collections/campaign/scenes/Tower.atlasmap');
    expect(assetService.getAssets).toHaveBeenCalledWith('campaign', 'map');
    expect(choices).toEqual([
      { kind: 'map', name: 'Axeholm', path: 'atlas-vtt/assets/Axeholm_1.webp' },
      { kind: 'image', name: 'attic', path: 'Images/attic.webp' },
      { kind: 'image', name: 'cellar', path: 'Images/cellar.JPG' },
      { kind: 'image', name: 'tower', path: 'Images/tower.png' },
    ]);
  });

  it('offers every collection\'s maps for a scene outside any collection', async () => {
    assetService.getCollectionForMap.mockReturnValueOnce(null);
    await floorImageChoices(app, assetService as any, 'loose.atlasmap');
    expect(assetService.getAssets).toHaveBeenCalledWith(undefined, 'map');
  });
});

describe('setFloorImage', () => {
  it('uses a map of the library as it is', async () => {
    const { store, setBackground } = storeWith();
    prompt.mockResolvedValue({ kind: 'map', name: 'Axeholm', path: 'atlas-vtt/assets/Axeholm_1.webp' });
    await setFloorImage(app, store);
    expect(setBackground).toHaveBeenCalledWith('atlas-vtt/assets/Axeholm_1.webp');
    expect(importMapImage).not.toHaveBeenCalled();
  });

  it('imports an image of the vault into the scene\'s collection and uses the map it becomes', async () => {
    const { store, setBackground } = storeWith();
    prompt.mockResolvedValue({ kind: 'image', name: 'tower', path: 'Images/tower.png' });
    importMapImage.mockResolvedValue({ mapFilePath: 'atlas-vtt/assets/tower_9.webp' });
    await setFloorImage(app, store);
    expect(importMapImage).toHaveBeenCalledWith(app, assetService, files[0], { name: 'tower', collectionId: 'campaign' });
    expect(setBackground).toHaveBeenCalledWith('atlas-vtt/assets/tower_9.webp');
  });

  it('imports into the default collection for a scene outside any collection', async () => {
    assetService.getCollectionForMap.mockReturnValue(null);
    const { store } = storeWith('loose.atlasmap');
    prompt.mockResolvedValue({ kind: 'image', name: 'tower', path: 'Images/tower.png' });
    importMapImage.mockResolvedValue({ mapFilePath: 'atlas-vtt/assets/tower_9.webp' });
    await setFloorImage(app, store);
    expect(importMapImage).toHaveBeenCalledWith(app, assetService, files[0], { name: 'tower', collectionId: 'default' });
    assetService.getCollectionForMap.mockReturnValue('campaign');
  });

  it('changes nothing when the import fails', async () => {
    const { store, setBackground } = storeWith();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    prompt.mockResolvedValue({ kind: 'image', name: 'tower', path: 'Images/tower.png' });
    importMapImage.mockRejectedValue(new Error('disk full'));
    await setFloorImage(app, store);
    expect(setBackground).not.toHaveBeenCalled();
  });

  it('changes nothing when the picker is dismissed', async () => {
    const { store, setBackground } = storeWith();
    prompt.mockResolvedValue(null);
    await setFloorImage(app, store);
    expect(setBackground).not.toHaveBeenCalled();
    expect(importMapImage).not.toHaveBeenCalled();
  });

  it('changes nothing when the chosen image has left the vault', async () => {
    const { store, setBackground } = storeWith();
    prompt.mockResolvedValue({ kind: 'image', name: 'gone', path: 'Images/gone.png' });
    await setFloorImage(app, store);
    expect(setBackground).not.toHaveBeenCalled();
    expect(importMapImage).not.toHaveBeenCalled();
  });
});
