import { App, TFile, normalizePath } from 'obsidian';
import { Assets, Texture } from 'pixi.js';
import type { MapFile } from './services/MapPersistence';
import { migrateMapFile, isLegacyMapFile, isPersistedMapEnvelope } from './services/MapPersistence';
import { AssetValidationService, type MissingAsset } from './services/AssetValidationService';
import { backgroundTextureCache } from './pixi/backgroundTextureCache';

export interface LoadedMap {
  mapData: MapFile;
  texture: InstanceType<typeof Texture>;
  hasBackground: boolean; // Indicate if this is a real background or placeholder
  /** URL acquired from the background texture cache; the caller releases it when the map is left. */
  backgroundUrl: string | null;
  missingAssets?: MissingAsset[]; // Track missing assets for reporting
}

/** A map image loaded as a texture, or the placeholder that stands in for a missing or absent one. */
export interface BackgroundTexture {
  texture: InstanceType<typeof Texture>;
  /** Whether this is a real image and not a placeholder. */
  hasBackground: boolean;
  /** URL acquired from the background texture cache; the caller releases it when the image is left. */
  backgroundUrl: string | null;
}

/** Loads the map image at `background` (a vault path, or none) as a texture for a map whose grid cells are `gridSize` wide. */
export async function loadBackgroundTexture(
  app: App,
  background: string | null,
  gridSize: number,
  assetValidationService = new AssetValidationService({ app }),
): Promise<BackgroundTexture> {
  if (!background) return { texture: createPlaceholderTexture(gridSize), hasBackground: false, backgroundUrl: null };

  // Preload background image as a PIXI texture
  const imgFile = app.vault.getAbstractFileByPath(normalizePath(background));
  if (!(imgFile instanceof TFile)) {
    console.error(`[MapLoader] Background image not found: ${background}`);
    const placeholder = assetValidationService.getMissingAssetPlaceholder();
    const texture = placeholder ? await Assets.load<Texture>(placeholder) : createPlaceholderTexture(gridSize);
    return { texture, hasBackground: false, backgroundUrl: null };
  }
  const url = app.vault.adapter.getResourcePath(imgFile.path);
  return { texture: await backgroundTextureCache.acquire(url), hasBackground: true, backgroundUrl: url };
}

/**
 * Pure helper that reads the .atlasmap JSON and preloads the background image as a PIXI texture.
 * All vault / IO logic lives here so AtlasView remains an orchestrator only.
 */
export class MapLoader {
  static async load(app: App, mapFilePath: string): Promise<LoadedMap> {
    const assetValidationService = new AssetValidationService({ app });
    // Read and parse the map JSON file from the vault
    const file = app.vault.getAbstractFileByPath(normalizePath(mapFilePath));
    if (!(file instanceof TFile)) {
      throw new Error(`[MapLoader] Map file not found: ${mapFilePath}`);
    }
    const raw = await app.vault.read(file);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('[MapLoader] Failed to parse map JSON');
    }
    // Support Zustand persist format: wrap under `state` key
    const data = isPersistedMapEnvelope(parsed) && parsed.state ? parsed.state : parsed;
    if (!isLegacyMapFile(data)) {
      throw new Error('[MapLoader] Map file has an unexpected structure');
    }

    // Apply migration to convert app:// URLs to relative paths
    const mapData = migrateMapFile(data);

    const validationResult = await assetValidationService.validateMapAssets(mapData);
    if (!validationResult.valid) {
      assetValidationService.showMissingAssetsNotice(validationResult.missingAssets);
    }
    
    const { texture, hasBackground, backgroundUrl } = await loadBackgroundTexture(app, mapData.background, mapData.grid?.size || 70, assetValidationService);

    return { 
      mapData, 
      texture, 
      hasBackground,
      backgroundUrl,
      missingAssets: validationResult.missingAssets
    };
  }
}

/**
 * Transparent placeholders by grid size, shared by every map without a background.
 * Nothing unloads a placeholder when the scene changes, so a new one per load leaked its canvas.
 */
const placeholderTextures = new Map<number, Texture>();

/** Transparent 20x20-cell texture for maps without a background image. */
function createPlaceholderTexture(gridSize: number): Texture {
  const cached = placeholderTextures.get(gridSize);
  if (cached && !cached.destroyed) return cached;
  const canvas = createEl('canvas');
  canvas.width = gridSize * 20;
  canvas.height = gridSize * 20;
  if (!canvas.getContext('2d')) return Texture.EMPTY;
  const texture = Texture.from(canvas);
  placeholderTextures.set(gridSize, texture);
  return texture;
}
