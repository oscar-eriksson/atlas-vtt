import { RenderTexture, type Application } from 'pixi.js';
import type { Viewport } from 'pixi-viewport';
import type { PlayerCameraState } from '../local-player-view';
import { captureWithLayerVisibility, fitCameraToSize, type FrameSize, type LayerVisibility } from './playerSafeFrame';
import { usesCanvasRenderer } from './utils/rendererType';

declare const __ATLAS_RELEASE_BUILD__: boolean | undefined;

/**
 * Renders the frame players see on a texture of its own, at the size of their
 * window, so their screen gets every pixel it has and the DM's canvas is never
 * drawn on for them. The scene is drawn with the player layers and camera
 * applied for that one render, then everything is put back and the DM's own
 * canvas is drawn again, as it is for any player frame.
 */
export class PlayerFrameRenderer {
  private target: RenderTexture | null = null;

  /** The frame as a canvas of `size`, or `null` where it cannot be rendered apart from the DM's canvas (the software renderer). */
  render(app: Application, viewport: Viewport, layers: readonly LayerVisibility[], size: FrameSize, camera: PlayerCameraState): HTMLCanvasElement | null {
    if (usesCanvasRenderer(app.renderer)) return null;
    const target = this.targetOf(size);
    const framing = fitCameraToSize(camera, { width: viewport.screenWidth, height: viewport.screenHeight }, size);
    this.reportFraming(viewport, size, camera, framing);
    const result: { canvas: HTMLCanvasElement | null } = { canvas: null };
    captureWithLayerVisibility(
      layers,
      () => app.renderer.render({ container: app.stage, target, clear: true, clearColor: app.renderer.background.color }),
      () => { result.canvas = app.renderer.extract.canvas({ target }) as HTMLCanvasElement; },
      { target: { screenWidth: size.width, screenHeight: size.height, position: viewport.position, scale: viewport.scale }, camera: framing },
      // Drawing the DM's canvas again also takes the changes this render made to the scene (layers hidden, camera
      // moved). Left pending, the render scheduler would draw them as a new frame, which the mirror would render
      // a player frame for, which changes the scene again: a loop that never settles.
      () => app.renderer.render(app.stage),
    );
    return result.canvas;
  }

  private frames = 0;

  /** Development builds say how a frame is framed now and then, to check what the players' screen shows against the DM's. */
  private reportFraming(viewport: Viewport, size: FrameSize, camera: PlayerCameraState, framing: PlayerCameraState): void {
    if (typeof __ATLAS_RELEASE_BUILD__ === 'undefined' || __ATLAS_RELEASE_BUILD__ || ++this.frames % 60 !== 1) return;
    const shown = (width: number, height: number, scale: number): string => `${Math.round(width / scale)} x ${Math.round(height / scale)}`;
    console.debug(
      `[Atlas] player framing: DM pane ${viewport.screenWidth}x${viewport.screenHeight}, player frame ${size.width}x${size.height}, `
      + `centre ${Math.round(camera.centerX)},${Math.round(camera.centerY)}, zoom ${camera.scale.toFixed(3)} -> ${framing.scale.toFixed(3)}; `
      + `the DM sees ${shown(viewport.screenWidth, viewport.screenHeight, camera.scale)} map units, players see ${shown(size.width, size.height, framing.scale)}`,
    );
  }

  private targetOf(size: FrameSize): RenderTexture {
    if (!this.target) {
      // Anti-aliased like the DM's canvas: without it a line as thin as the grid's shows only where it happens to
      // cover a pixel's centre, so lines drop out and come back as the camera moves.
      this.target = RenderTexture.create({ width: size.width, height: size.height, resolution: 1, antialias: true });
    } else if (this.target.width !== size.width || this.target.height !== size.height) {
      this.target.resize(size.width, size.height);
    }
    return this.target;
  }

  destroy(): void {
    this.target?.destroy(true);
    this.target = null;
  }
}
