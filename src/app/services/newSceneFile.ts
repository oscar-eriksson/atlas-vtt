import { newSceneTokenSettings } from '../resources/sceneVisibility';
import { DEFAULT_TOKEN_SETTINGS } from '../storeFactory';
import type { CollectionSettings, GridUnitType } from '../types/collectionSettingsTypes';
import type { SceneLighting } from '../types/lightingTypes';
import { ATLAS_SCHEMA, ATLAS_VERSION, type MapFile } from './MapPersistence';
import type { GridState } from '../types/gridTypes';
import type { NamedGrid } from '../grid/namedGrid';

type SceneObjects = MapFile['objects'];

/** The content of a new scene's `.atlasmap` file: the persisted envelope around its state. */
export interface NewSceneFile {
  state: Pick<MapFile, 'schema' | 'version' | 'background' | 'camera'> & {
    /** The unit is the collection's own, which may be one a map alone cannot name. */
    grid: Omit<GridState, 'unitType'> & { unitType?: GridUnitType };
    objects: Omit<SceneObjects, 'walls' | 'lights'> & Partial<Pick<SceneObjects, 'walls' | 'lights'>>;
    tokenSettings: Record<string, unknown>;
    lighting?: SceneLighting;
  };
  version: number;
}

/**
 * An empty scene on `background` for a collection with `settings`: Atlas' default grid, to be
 * aligned to the image on the first load, measuring as the collection does, and the token
 * settings a new scene of the collection starts with. Without `detectGrid` (a table that plays
 * without a grid) the scene has none until the GM aligns one: no lines, and nothing snaps. A grid
 * the map's file name stated (`named`) is taken as it is, from the image's corner, and nothing is detected.
 */
export function newSceneFile(settings: CollectionSettings, background: string | null, detectGrid = true, named: NamedGrid | null = null): NewSceneFile {
  const { gridDefaults } = settings;
  const stated = detectGrid ? named : null;
  return {
    state: {
      schema: ATLAS_SCHEMA,
      version: ATLAS_VERSION,
      background,
      grid: {
        enabled: true,
        visible: detectGrid,
        snapToGrid: detectGrid,
        type: 'square',
        size: stated?.cellSize ?? 70,
        offsetX: 0,
        offsetY: 0,
        opacity: 0.5,
        lineType: 'solid',
        lineWidth: 1,
        ...(stated?.mapStretch && { mapStretch: stated.mapStretch }),
        ...(detectGrid && !stated && { autoDetect: true }),
        ...(gridDefaults && {
          unitType: gridDefaults.unitType,
          unitDistance: gridDefaults.unitDistance,
          measurementType: gridDefaults.measurementMode === 'abstract' ? 'abstract' : 'units',
        }),
      },
      objects: { tokens: {}, fog: {}, pins: {}, texts: {}, drawings: {} },
      camera: { x: 0, y: 0, scale: 1 },
      // A map file's token settings replace the defaults as a whole, so write complete settings
      tokenSettings: newSceneTokenSettings(settings.defaultWidgets, DEFAULT_TOKEN_SETTINGS),
    },
    version: ATLAS_VERSION,
  };
}
