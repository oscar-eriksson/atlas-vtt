import { Container, Graphics } from 'pixi.js';
import type { Viewport } from 'pixi-viewport';
import type { ViewAtlasStore } from '../../storeFactory';
import type { GridSystem } from '../../grid/GridSystem';
import type { AreaTemplate } from '../../types/areaTemplateTypes';
import { destroyTree } from '../utils/destroyTree';
import { showTemplate } from './templateGraphics';

interface TemplateView {
  graphics: Graphics;
  /** What the outline was last drawn from; a change here means a redraw, a move does not. */
  shapeKey: string;
  template: AreaTemplate;
}

/**
 * Draws the map's area templates. Each is drawn once around its own origin and
 * then moved and turned, and is drawn again only when its shape, size or
 * colour changes. Templates players may see and those only the GM sees sit in
 * separate containers, so the player mirror hides one and the session view the other.
 */
export class TemplateRenderer {
  /** Templates every player sees. */
  readonly playerContainer: Container;
  /** GM-only templates; hidden in the session view and the player mirror. */
  readonly gmContainer: Container;
  private readonly views = new Map<string, TemplateView>();
  private readonly unsubscribe: () => void;

  constructor(
    viewport: Viewport,
    private readonly store: ViewAtlasStore,
    private readonly gridSystem: GridSystem,
  ) {
    this.playerContainer = this.createContainer('templates');
    this.gmContainer = this.createContainer('gmTemplates');
    viewport.addChild(this.playerContainer, this.gmContainer);

    const stop = [
      store.subscribe((state) => state.objects.templates, () => this.sync()),
      store.subscribe((state) => state.grid, () => this.sync(true)),
      store.subscribe((state) => state.isGMView, () => this.updateVisibility()),
    ];
    this.unsubscribe = () => stop.forEach(unsubscribe => unsubscribe());
    this.updateVisibility();
    this.sync();
  }

  /** The state of a drawn template, for hit-testing. */
  getTemplate(id: string): AreaTemplate | undefined {
    return this.views.get(id)?.template;
  }

  private createContainer(label: string): Container {
    const container = new Container();
    container.label = label;
    container.eventMode = 'none';
    container.interactiveChildren = false;
    return container;
  }

  private updateVisibility(): void {
    const { isGMView, isPlayerView } = this.store.getState();
    this.gmContainer.visible = isGMView && !isPlayerView;
  }

  /** Brings the drawn templates in line with the store: only the changed ones are touched. */
  private sync(redrawAll = false): void {
    const templates = this.store.getState().objects.templates;
    const cellSize = this.gridSystem.getOptions().size;

    for (const [id, view] of this.views) {
      if (templates[id]) continue;
      destroyTree(view.graphics);
      this.views.delete(id);
    }

    for (const template of Object.values(templates)) {
      const view = this.views.get(template.id);
      if (view?.template === template && !redrawAll) continue;
      this.apply(template, view, cellSize);
    }
  }

  private apply(template: AreaTemplate, existing: TemplateView | undefined, cellSize: number): void {
    const graphics = existing?.graphics ?? new Graphics();
    const shapeKey = showTemplate(graphics, template, cellSize, existing?.shapeKey);

    const container = template.visibleToPlayers ? this.playerContainer : this.gmContainer;
    if (graphics.parent !== container) container.addChild(graphics);
    this.views.set(template.id, { graphics, shapeKey, template });
  }

  destroy(): void {
    this.unsubscribe();
    this.views.clear();
    for (const container of [this.playerContainer, this.gmContainer]) {
      container.parent?.removeChild(container);
      destroyTree(container);
    }
  }
}
