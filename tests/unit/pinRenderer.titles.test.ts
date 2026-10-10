import { afterEach, describe, expect, it, vi } from 'vitest';
import { Text, Texture, type Container, type EventSystem } from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import { EventEmitter } from 'events';
import { PinRenderer, type PinTitleSetting } from '../../src/app/pixi/PinRenderer';
import { createViewAtlasStore } from '../../src/app/storeFactory';
import { createInMemoryApp } from '../mocks/inMemoryVault';
import { stubJsdomGraphics } from '../mocks/jsdomGraphics';

// jsdom has no 2D canvas, so pin glyphs cannot be rasterised here.
vi.mock('../../src/app/pixi/utils/pinIconTexture', () => ({
  createPinIconTexture: vi.fn(() => new Texture()),
}));

let cleanup: (() => void) | null = null;
let restoreGraphics: (() => void) | null = null;

/** A setting the test switches by hand. */
function titleSetting(initial: boolean): PinTitleSetting & { set(on: boolean): void; resize(size: number): void } {
  let on = initial;
  let size = 1;
  const listeners = new Set<() => void>();
  return {
    isOn: () => on,
    size: () => size,
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    set: (value) => { on = value; listeners.forEach((listener) => listener()); },
    resize: (value) => { size = value; listeners.forEach((listener) => listener()); },
  };
}

function setup(titles: PinTitleSetting): { renderer: PinRenderer; store: ReturnType<typeof createViewAtlasStore> } {
  // Text is measured on a 2D canvas, which jsdom does not have
  restoreGraphics = stubJsdomGraphics();
  const events = { domElement: document.createElement('canvas') } as unknown as EventSystem;
  const viewport = new Viewport({ screenWidth: 800, screenHeight: 600, events });
  const { app } = createInMemoryApp({ files: { 'Places/Conyberry.md': '# A', 'b.md': '# B' } });
  const store = createViewAtlasStore(app, 'pin-titles-view');
  store.getState().setPersistenceEnabled(false);
  store.getState().setMapPath('maps/pins.atlasmap');
  const renderer = new PinRenderer(viewport, new EventEmitter(), store, false, titles);
  cleanup = () => { renderer.destroy(); viewport.destroy(); };
  return { renderer, store };
}

/** The words written under the pins of the renderer, in pin order. */
/** The text objects under the pins, for their sizes. */
function titleTexts(renderer: PinRenderer): Text[] {
  return renderer.getPinContainer().children.flatMap((group) => ((group as Container).children[0] as Container).children.filter((child): child is Text => child instanceof Text && child.text !== ''));
}

function titlesOf(renderer: PinRenderer): string[] {
  return renderer.getPinContainer().children.flatMap((group) => {
    const graphics = (group as Container).children[0] as Container | undefined;
    return (graphics?.children ?? []).filter((child): child is Text => child instanceof Text && child.text !== '').map((text) => text.text);
  });
}

describe('PinRenderer titles', () => {
  afterEach(() => { cleanup?.(); cleanup = null; restoreGraphics?.(); restoreGraphics = null; });

  it('shows the name of a pin\'s note under it while the setting is on', () => {
    const { renderer, store } = setup(titleSetting(true));
    store.getState().addNotePin(10, 20, 'Places/Conyberry.md');
    store.getState().addNotePin(30, 40, 'b.md');
    expect(titlesOf(renderer)).toEqual(['Conyberry', 'b']);
  });

  it('shows none while it is off, and draws the pins again when it is switched', () => {
    const setting = titleSetting(false);
    const { renderer, store } = setup(setting);
    store.getState().addNotePin(10, 20, 'Places/Conyberry.md');
    expect(titlesOf(renderer)).toEqual([]);

    setting.set(true);
    expect(titlesOf(renderer)).toEqual(['Conyberry']);

    setting.set(false);
    expect(titlesOf(renderer)).toEqual([]);
  });

  it('follows the note a pin is changed to', () => {
    const { renderer, store } = setup(titleSetting(true));
    const id = store.getState().addNotePin(10, 20, 'Places/Conyberry.md');
    store.getState().updateNotePin(id, { notePath: 'b.md' });
    expect(titlesOf(renderer)).toEqual(['b']);
  });

  it('writes no title for a pin without a note', () => {
    const { renderer, store } = setup(titleSetting(true));
    store.getState().addNotePin(10, 20, '');
    expect(titlesOf(renderer)).toEqual([]);
  });

  it('draws the titles larger or smaller as the size setting says, and again when it changes', () => {
    const setting = titleSetting(true);
    const { renderer, store } = setup(setting);
    store.getState().addNotePin(10, 20, 'b.md');
    const normal = Number(titleTexts(renderer)[0]?.style.fontSize);

    setting.resize(2);
    expect(Number(titleTexts(renderer)[0]?.style.fontSize)).toBeCloseTo(normal * 2);

    setting.resize(0.6);
    expect(Number(titleTexts(renderer)[0]?.style.fontSize)).toBeCloseTo(normal * 0.6);
  });
});
