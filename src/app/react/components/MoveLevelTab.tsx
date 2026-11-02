import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { App } from 'obsidian';
import type { LevelGhost } from '../../pixi/gridAlignment/LevelGhosts';
import { MosaicCanvasService } from '../../pixi/mosaicCanvas/MosaicCanvasService';
import type { AlignmentTabProps } from '../hooks/useGridAlignmentEffects';
import { useLevelDrag } from '../hooks/useLevelDrag';
import { levelBackground } from '../../levels/levelEdits';
import { alignmentPlacement, levelImagePlacement } from '../../levels/levelAlignment';
import { centredOffset, levelWorldRect, movedOffset, placedAlignment, type WorldRect } from '../../levels/levelPlacement';
import { viewedLevelId } from '../../levels/sceneLevels';
import { mosaicCanvasSize } from '../../pixi/mosaicCanvas/mosaicCanvasSize';
import { setCanvasCursor } from '../../pixi/utils/canvasCursor';
import type { Point } from '../../grid/hexGeometry';
import type { ImageSize } from '../../grid/mapStretch';
import { t } from '../../i18n';
import { levelLabel } from './levels/levelEditing';

/** The longest side of a ghost's picture: a faint guide needs no more. */
const GHOST_SIDE = 1024;

/** The picture of the image at `path`, small, with where it lies; null where it cannot be read. */
async function ghostOf(app: App | undefined, path: string | null, rect: WorldRect): Promise<LevelGhost | null> {
  const file = app && path ? app.vault.getFileByPath(path) : null;
  if (!app || !file) return null;
  const service = MosaicCanvasService.forApp(app);
  try {
    const opened = await service.open(file);
    try {
      return { bitmap: await service.overview(opened.handle, GHOST_SIDE), rect };
    } finally {
      service.close(opened.handle);
    }
  } catch {
    return null;
  }
}

/** Another level of the scene, with where its image lies. */
interface NeighbourLevel {
  id: string;
  label: string;
  rect: WorldRect;
}

/**
 * Moves the viewed level's image under the scene's grid by dragging it, by whole cells so the grid
 * printed on it keeps lying on the scene's, or centres it on the level next to it. The outlines of
 * the other levels' images show where they lie. Nothing is written until Apply: the tab only
 * previews the image and reports the alignment it would give the level.
 */
export function MoveLevelTab({ controller, view, setPlacement }: AlignmentTabProps): React.ReactElement | null {
  const store = view?.atlasStore;
  const [neighbours, setNeighbours] = useState<NeighbourLevel[]>([]);
  /** Where the level's image begins when it was last previewed, and where it began when the drag was pressed. */
  const offset = useRef<Point>({ x: 0, y: 0 });
  const pressedAt = useRef<Point>({ x: 0, y: 0 });
  const start = useRef<Point>({ x: 0, y: 0 });
  const size = useRef<ImageSize | null>(null);

  const scene = store?.getState();
  const levelId = scene ? viewedLevelId(scene) : null;
  const grid = scene?.grid ?? null;
  const current = levelId && scene ? scene.levelAlignments?.[levelId] : undefined;

  // The level as it is drawn now, and the others' outlines
  useEffect(() => {
    const state = store?.getState();
    const image = view?.renderer?.getMapImage?.();
    if (!state || !controller || !levelId || !image) return undefined;
    const placement = levelImagePlacement(state, levelId);
    size.current = image.imageSize;
    start.current = offset.current = { x: placement.offset?.x ?? 0, y: placement.offset?.y ?? 0 };
    controller.showPlacement(placement);
    controller.zoomToFullMap();
    let stale = false;
    void (async (): Promise<void> => {
      const found: NeighbourLevel[] = [];
      for (const level of state.levels ?? []) {
        const path = level.id === levelId ? null : levelBackground(state, level.id);
        const known = path && view?.app ? await mosaicCanvasSize(view.app, path).catch(() => null) : null;
        if (known) found.push({ id: level.id, label: levelLabel(state.levels ?? [], level), rect: levelWorldRect(known, levelImagePlacement(state, level.id)) });
      }
      if (stale) return;
      setNeighbours(found);
      controller.showLevelOutlines(found.map(({ rect }) => rect));
      // The level below this one, else the one above, as a faint picture
      const at = (state.levels ?? []).findIndex((level) => level.id === levelId);
      const closest = [state.levels?.[at - 1], state.levels?.[at + 1]].flatMap((level) => found.find((entry) => entry.id === level?.id) ?? []).slice(0, 1);
      const ghosts = (await Promise.all(closest.map((entry) => ghostOf(view?.app, levelBackground(state, entry.id), entry.rect)))).flatMap((ghost) => ghost ?? []);
      if (stale) ghosts.forEach(({ bitmap }) => bitmap.close());
      else controller.showLevelGhosts(ghosts);
    })();
    return () => {
      stale = true;
      controller.showLevelOutlines([]);
      controller.showLevelGhosts([]);
    };
  }, [controller, view, store, levelId]);

  useEffect(() => {
    const canvas = view?.renderer?.getCanvasElement();
    if (!canvas) return undefined;
    const before = canvas.style.cursor;
    setCanvasCursor(canvas, 'grab');
    return () => setCanvasCursor(canvas, before);
  }, [view]);

  const preview = useCallback((at: Point): void => {
    if (!grid) return;
    const alignment = placedAlignment(grid, current, at);
    offset.current = at;
    controller?.showPlacement(alignmentPlacement(alignment));
    // Where the level began, nothing is to be applied
    setPlacement?.(at.x === start.current.x && at.y === start.current.y ? null : alignment);
  }, [grid, current, controller, setPlacement]);

  useLevelDrag(
    controller !== null && grid !== null,
    controller ? (x, y) => controller.screenToWorld(x, y) : null,
    () => { pressedAt.current = offset.current; },
    (delta) => grid && preview(movedOffset(pressedAt.current, delta, grid)),
    () => undefined,
  );

  // The level next to this one, below it where there is one
  const levels = scene?.levels ?? [];
  const at = levels.findIndex((level) => level.id === levelId);
  const neighbour = neighbours.find((entry) => entry.id === levels[at - 1]?.id) ?? neighbours.find((entry) => entry.id === levels[at + 1]?.id);
  const centre = (): void => {
    if (!grid || !neighbour || !size.current || !scene) return;
    const placement = alignmentPlacement(placedAlignment(grid, current, offset.current));
    preview(centredOffset(levelWorldRect(size.current, placement), neighbour.rect, grid));
  };

  if (!grid || !levelId) return null;
  return (
    <div className="atlas-grid-alignment-move">
      <p>{t('align.move.hint')}</p>
      <button className="atlas-grid-alignment-btn atlas-grid-alignment-btn--secondary atlas-grid-alignment-btn--wide" disabled={!neighbour} onClick={centre}>
        {neighbour ? t('align.move.centre', { level: neighbour.label }) : t('align.move.noNeighbour')}
      </button>
    </div>
  );
}
