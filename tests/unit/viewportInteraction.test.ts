import { describe, expect, it } from 'vitest';
import { ViewportInteraction } from '../../src/app/pixi/viewport-tool/ViewportInteraction';
import type { ViewportRectRenderer } from '../../src/app/pixi/viewport-tool/ViewportRectRenderer';
import { createViewAtlasStore } from '../../src/app/storeFactory';
import { createInMemoryApp } from '../mocks/inMemoryVault';

function setup(locked: boolean) {
  const { app } = createInMemoryApp({ files: {} });
  const store = createViewAtlasStore(app, 'viewport-interaction');
  store.getState().setPersistenceEnabled(false);
  store.getState().setMapPath('maps/town.atlasmap');
  const id = store.getState().addViewport({ x: 100, y: 100, width: 400, height: 200, locked, active: true });
  const hits = {
    hitTestHandle: (x: number, y: number): string | null => (!locked && Math.hypot(x - 500, y - 300) < 16 ? id : null),
    hitTestBody: (x: number, y: number): string | null => (x >= 100 && x <= 500 && y >= 100 && y <= 300 ? id : null),
  };
  const interaction = new ViewportInteraction(store, hits as unknown as ViewportRectRenderer);
  return { store, id, interaction };
}

describe('dragging a TV viewport', () => {
  it('moves the frame with the pointer ', () => {
    const { store, id, interaction } = setup(true);

    expect(interaction.handlePointerDown(200, 150)).toBe(true);
    for (let x = 201; x <= 260; x++) interaction.handlePointerMove(x, 150 + (x - 200));
    interaction.handlePointerUp();

    expect(store.getState().viewports[id]).toMatchObject({ x: 160, y: 160, width: 400, height: 200 });
  });

  it('resizes an unlocked frame from its corner at the same aspect ratio', () => {
    const { store, id, interaction } = setup(false);

    expect(interaction.handlePointerDown(500, 300)).toBe(true);
    for (let x = 510; x <= 700; x += 10) interaction.handlePointerMove(x, 300);
    interaction.handlePointerUp();

    const rect = store.getState().viewports[id]!;
    expect(rect.width).toBe(600);
    expect(rect.width / rect.height).toBeCloseTo(2);
  });

  it('takes no corner handle while the frame is locked to physical scale', () => {
    const { interaction, store, id } = setup(true);
    interaction.handlePointerDown(500, 300);
    interaction.handlePointerMove(700, 300);
    interaction.handlePointerUp();
    // The corner is inside the body, so this was a move, never a resize.
    expect(store.getState().viewports[id]).toMatchObject({ width: 400, height: 200 });
  });

  it('ignores a press that misses the frame', () => {
    const { interaction } = setup(true);
    expect(interaction.handlePointerDown(900, 900)).toBe(false);
    expect(interaction.isDragging()).toBe(false);
  });
});
