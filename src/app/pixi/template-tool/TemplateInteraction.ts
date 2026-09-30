import { FederatedPointerEvent, Graphics, Text } from 'pixi.js';
import type { Viewport } from 'pixi-viewport';
import type { GridSystem } from '../../grid/GridSystem';
import { formatDistance, resolveMeasurementSettings, type MeasurementSettings } from '../../grid/measurementFormat';
import type { ViewAtlasStore } from '../../storeFactory';
import { templateFromDrag } from '../../templates/templateDrag';
import { templateContainsPoint } from '../../templates/templateGeometry';
import { resolveOriginSnap, snapTemplateOrigin } from '../../templates/templateOrigin';
import { beginHistoryTransaction, endHistoryTransaction } from '../../stores/history';
import type { TemplateTool } from '../../tools/TemplateTool';
import type { AreaTemplate, AreaTemplateInput, TemplateOriginSnap, TemplateShape } from '../../types/areaTemplateTypes';
import { cssColorToHexNumber, getObsidianAccentColor } from '../utils/colorUtils';
import { createMeasureLabelText, drawMeasureLabel, measureLabelFontSize } from '../utils/measureDrawing';
import { destroyTree } from '../utils/destroyTree';
import { showTemplate } from './templateGraphics';

const SHAPE_NAMES: Record<TemplateShape, string> = { line: 'line', cone: 'cone', cube: 'cube', sphere: 'sphere', emanation: 'emanation' };
const HOVER_MARKER_RADIUS = 5;
/** How close, in screen pixels, a press must be to a template's origin dot to grab it. */
const ORIGIN_GRAB_RADIUS = 12;

interface Point { x: number; y: number }

/**
 * Places area templates: hovering shows the snapped origin, pressing sets it
 * and dragging sets the direction and length, releasing stores the template.
 * The origin snaps to the nearest cell centre, corner or edge middle.
 * Pressing a template's origin dot, or the body of the selected template, moves
 * it instead; the move keeps the template's own snap and is one undo step.
 */
export class TemplateInteraction {
  /** Measurement settings of the current map, for the size label. */
  measurementSettingsProvider: (() => MeasurementSettings) | null = null;

  private readonly outline = new Graphics();
  private readonly hoverMarker = new Graphics();
  private readonly pill = new Graphics();
  private readonly label: Text = createMeasureLabelText();
  private drag: { origin: Point; snap: TemplateOriginSnap; pressedAt: Point } | null = null;
  private draft: AreaTemplateInput | null = null;
  private moving: { id: string; offset: Point; snap: TemplateOriginSnap } | null = null;
  private outlineKey: string | undefined;
  private enabled = false;
  private readonly unsubscribeTool: () => void;

  private readonly onDown = (event: FederatedPointerEvent): void => this.handleDown(event);
  private readonly onMove = (event: FederatedPointerEvent): void => this.handleMove(event);
  private readonly onUp = (): void => this.handleUp();

  constructor(
    private readonly viewport: Viewport,
    private readonly store: ViewAtlasStore,
    private readonly gridSystem: GridSystem,
    private readonly tool: TemplateTool,
  ) {
    for (const item of [this.outline, this.hoverMarker, this.pill, this.label]) {
      item.eventMode = 'none';
      item.visible = false;
      viewport.addChild(item);
    }
    this.unsubscribeTool = store.subscribe(
      (state) => state.activeTool === 'template' && !state.isPlayerView,
      (active) => this.setEnabled(active),
      { fireImmediately: true },
    );
  }

  private setEnabled(enabled: boolean): void {
    if (enabled === this.enabled) return;
    this.enabled = enabled;
    const method = enabled ? 'on' : 'off';
    this.viewport[method]('pointerdown', this.onDown);
    this.viewport[method]('pointermove', this.onMove);
    this.viewport[method]('pointerup', this.onUp);
    this.viewport[method]('pointerupoutside', this.onUp);
    if (!enabled) this.clear();
  }

  private snapAt(event: FederatedPointerEvent): { origin: Point; snap: TemplateOriginSnap; pressedAt: Point } {
    const settings = this.tool.getSettings();
    const snap = resolveOriginSnap(settings.shape, settings.footprint);
    const world = this.viewport.toWorld(event.global);
    return { origin: snapTemplateOrigin(this.gridSystem.getOptions(), world, snap), snap, pressedAt: world };
  }

  private handleDown(event: FederatedPointerEvent): void {
    // The right button is left to the viewport, which pans with it.
    if (event.button !== 0) return;
    event.stopPropagation();
    this.hoverMarker.visible = false;
    const grabbed = this.grabbedTemplate(this.viewport.toWorld(event.global));
    if (grabbed) this.startMove(grabbed, this.viewport.toWorld(event.global));
    else this.drag = this.snapAt(event);
  }

  /** The template a press at `point` takes hold of: one whose origin dot is there, or the selected one's body. */
  private grabbedTemplate(point: Point): AreaTemplate | undefined {
    const { objects, selectedIds } = this.store.getState();
    const scale = this.viewport.scale.x;
    const cellSize = this.gridSystem.getOptions().size;
    return Object.values(objects.templates).reverse().find(template =>
      Math.hypot(point.x - template.x, point.y - template.y) * scale <= ORIGIN_GRAB_RADIUS
      || (selectedIds.includes(template.id) && templateContainsPoint(template, cellSize, point)));
  }

  private startMove(template: AreaTemplate, point: Point): void {
    beginHistoryTransaction(this.store);
    this.store.getState().setSelection([template.id]);
    this.moving = { id: template.id, offset: { x: point.x - template.x, y: point.y - template.y }, snap: template.snap };
  }

  /** Moves the template with the pointer, its origin snapping the way it was placed. */
  private moveTo(point: Point): void {
    if (!this.moving) return;
    const { id, offset, snap } = this.moving;
    const origin = snapTemplateOrigin(this.gridSystem.getOptions(), { x: point.x - offset.x, y: point.y - offset.y }, snap);
    const current = this.store.getState().objects.templates[id];
    if (current && (current.x !== origin.x || current.y !== origin.y)) this.store.getState().updateTemplate(id, origin);
  }

  private handleMove(event: FederatedPointerEvent): void {
    if (this.moving) {
      event.stopPropagation();
      this.moveTo(this.viewport.toWorld(event.global));
      return;
    }
    if (!this.drag) {
      this.showHoverMarker(this.snapAt(event).origin);
      return;
    }
    event.stopPropagation();
    this.draft = templateFromDrag(this.tool.getSettings(), this.gridSystem.getOptions(), this.drag.origin, this.drag.snap, this.viewport.toWorld(event.global));
    this.showDraft(this.viewport.toWorld(event.global));
  }

  private handleUp(): void {
    if (this.draft) this.store.getState().addTemplate(this.draft);
    else if (this.drag) this.selectAt(this.drag.pressedAt);
    this.clear();
  }

  /** A click without a drag picks the template under it, the newest first, or clears the selection. */
  private selectAt(point: Point): void {
    const cellSize = this.gridSystem.getOptions().size;
    const templates = Object.values(this.store.getState().objects.templates);
    const hit = templates.reverse().find(template => templateContainsPoint(template, cellSize, point));
    this.store.getState().setSelection(hit ? [hit.id] : []);
  }

  private showHoverMarker(origin: Point): void {
    this.hoverMarker.clear();
    this.hoverMarker.circle(origin.x, origin.y, HOVER_MARKER_RADIUS / this.viewport.scale.x);
    this.hoverMarker.fill({ color: cssColorToHexNumber(getObsidianAccentColor()), alpha: 0.9 });
    this.hoverMarker.visible = true;
  }

  private showDraft(pointer: Point): void {
    const draft = this.draft;
    this.outline.visible = draft !== null;
    this.label.visible = this.pill.visible = draft !== null;
    if (!draft) return;

    this.outlineKey = showTemplate(this.outline, { ...draft, id: 'preview' }, this.gridSystem.getOptions().size, this.outlineKey);
    const settings = this.measurementSettingsProvider?.() ?? resolveMeasurementSettings(undefined, this.store.getState().grid);
    const scale = this.viewport.scale.x;
    this.label.text = `${formatDistance(draft.size, settings)} ${SHAPE_NAMES[draft.shape]}`;
    this.label.style.fontSize = measureLabelFontSize(scale);
    drawMeasureLabel(this.pill, this.label, { x: pointer.x, y: pointer.y - 30 / scale }, scale);
  }

  private clear(): void {
    if (this.moving) endHistoryTransaction(this.store);
    this.moving = null;
    this.drag = null;
    this.draft = null;
    this.outlineKey = undefined;
    this.outline.clear();
    this.pill.clear();
    for (const item of [this.outline, this.hoverMarker, this.pill, this.label]) item.visible = false;
  }

  destroy(): void {
    this.unsubscribeTool();
    this.setEnabled(false);
    for (const item of [this.outline, this.hoverMarker, this.pill, this.label]) {
      item.parent?.removeChild(item);
      destroyTree(item);
    }
  }
}
