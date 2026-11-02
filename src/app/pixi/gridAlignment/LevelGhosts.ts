import { ImageSource, Sprite, Texture } from 'pixi.js';
import type { Viewport } from 'pixi-viewport';
import type { MapBounds } from '../gridAlignmentMath';
import { MAP_LAYER_Z } from '../mapLayerOrder';

/** How much of a neighbouring level shows through over the one being moved. */
const GHOST_ALPHA = 0.35;

/** A level's picture and where it lies in the world. */
export interface LevelGhost {
  bitmap: ImageBitmap;
  rect: MapBounds;
}

/**
 * The faint pictures of the levels next to the one the alignment moves, drawn over the map at the
 * rects their images lie in, so the moved image can be put where the others are. A ghost owns its
 * bitmap and texture; `show` and `clear` free what they replace.
 */
export class LevelGhosts {
  private sprites: Sprite[] = [];

  constructor(private readonly viewport: Viewport) {}

  /** Shows `ghosts` in place of the ones shown. */
  show(ghosts: readonly LevelGhost[]): void {
    this.clear();
    for (const { bitmap, rect } of ghosts) {
      const source = new ImageSource({ resource: bitmap, scaleMode: 'linear' });
      // Collected, the texture would upload again from a bitmap closed with it
      source.autoGarbageCollect = false;
      const sprite = new Sprite(new Texture({ source }));
      sprite.position.set(rect.x, rect.y);
      sprite.width = rect.width;
      sprite.height = rect.height;
      sprite.alpha = GHOST_ALPHA;
      sprite.eventMode = 'none';
      sprite.zIndex = MAP_LAYER_Z.gridAlignment;
      this.viewport.addChild(sprite);
      this.sprites.push(sprite);
    }
  }

  clear(): void {
    for (const sprite of this.sprites) {
      const bitmap = sprite.texture.source.resource as ImageBitmap;
      sprite.destroy({ texture: true, textureSource: true });
      bitmap.close();
    }
    this.sprites = [];
  }
}
