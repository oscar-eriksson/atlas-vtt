import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { SettingsService } from '../../src/app/services/SettingsService';
import { PlayerWindowService } from '../../src/app/services/PlayerWindowService';

vi.mock('../../src/app/atlas-view', () => ({ AtlasView: class {}, ATLAS_VIEW_TYPE: 'atlas-vtt' }));

const app = { vault: { adapter: { exists: async () => true, write: async () => {} } } } as any;
afterEach(() => { PlayerWindowService.getInstance()?.destroy(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

interface WindowShape { innerWidth: number; innerHeight: number; devicePixelRatio: number }

/** A service mirroring into a fake popout of the given size, from a source that renders its own frame. */
function mirror(window: WindowShape, renderPlayerFrame: (() => HTMLCanvasElement | null) | undefined) {
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const settings = new SettingsService(app);
  const service = new PlayerWindowService(app, createStore(() => ({})) as any, settings);
  const doc = document.implementation.createHTMLDocument();
  const context = { clearRect: vi.fn(), drawImage: vi.fn() };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as any);
  Object.defineProperty(doc, 'readyState', { value: 'complete' });
  (service as any).playerWindow = {
    ...window, document: doc, closed: false, requestAnimationFrame, cancelAnimationFrame,
    addEventListener: vi.fn(), removeEventListener: vi.fn(), close: vi.fn(),
  };
  const withPlayerSafeFrame = vi.fn();
  const source = { canvas: document.createElement('canvas'), withPlayerSafeFrame, getCamera: () => ({ centerX: 10, centerY: 20, scale: 2 }), ...(renderPlayerFrame && { renderPlayerFrame: vi.fn(renderPlayerFrame) }) };
  (service as any).streamSource = source;
  (service as any).setupPlayerWindow();
  const nextFrame = (): void => vi.mocked(requestAnimationFrame).mock.calls.at(-1)![0](0);
  return { source, service, withPlayerSafeFrame, context, doc, nextFrame, window: (service as any).playerWindow as WindowShape };
}

const frameOf = (width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

describe('player window frames rendered at the window\'s own size', () => {
  it('asks for a frame the size of the window and shows it at that size, leaving the DM canvas alone', () => {
    const frame = frameOf(1920, 1080);
    const { source, withPlayerSafeFrame, context, doc } = mirror({ innerWidth: 1920, innerHeight: 1080, devicePixelRatio: 1 }, () => frame);
    expect((source as any).renderPlayerFrame).toHaveBeenCalledWith({ width: 1920, height: 1080 }, expect.anything(), { camera: { centerX: 10, centerY: 20, scale: 2 } });
    expect(withPlayerSafeFrame).not.toHaveBeenCalled();
    expect(context.drawImage).toHaveBeenCalledWith(frame, 0, 0);
    const target = doc.getElementById('atlas-player-canvas') as HTMLCanvasElement;
    expect([target.width, target.height]).toEqual([1920, 1080]);
  });

  it('counts the screen\'s pixel density, so a sharp display gets a sharp frame', () => {
    const { source } = mirror({ innerWidth: 960, innerHeight: 540, devicePixelRatio: 2 }, () => frameOf(1920, 1080));
    expect((source as any).renderPlayerFrame).toHaveBeenCalledWith({ width: 1920, height: 1080 }, expect.anything(), expect.anything());
  });

  it('never asks for a frame larger than the cap, however big the window is', () => {
    const { source } = mirror({ innerWidth: 10000, innerHeight: 6000, devicePixelRatio: 1 }, () => frameOf(4096, 4096));
    expect((source as any).renderPlayerFrame).toHaveBeenCalledWith({ width: 4096, height: 4096 }, expect.anything(), expect.anything());
  });

  it('copies the DM canvas as before when no frame can be rendered apart from it', () => {
    const { withPlayerSafeFrame } = mirror({ innerWidth: 1920, innerHeight: 1080, devicePixelRatio: 1 }, () => null);
    expect(withPlayerSafeFrame).toHaveBeenCalledTimes(1);
  });

  it('copies the DM canvas as before for a source that cannot render its own frame', () => {
    const { withPlayerSafeFrame } = mirror({ innerWidth: 1920, innerHeight: 1080, devicePixelRatio: 1 }, undefined);
    expect(withPlayerSafeFrame).toHaveBeenCalledTimes(1);
  });

  it('copies the DM canvas when the window has no size yet', () => {
    const { source, withPlayerSafeFrame } = mirror({ innerWidth: 0, innerHeight: 0, devicePixelRatio: 1 }, () => frameOf(10, 10));
    expect((source as any).renderPlayerFrame).not.toHaveBeenCalled();
    expect(withPlayerSafeFrame).toHaveBeenCalledTimes(1);
  });

  it('fits the followed viewport rectangle into the window, not the DM\'s camera', () => {
    const { source, service, nextFrame } = mirror({ innerWidth: 1883, innerHeight: 960, devicePixelRatio: 1 }, () => frameOf(1883, 960));
    const rect = { id: 'v', active: true, x: 100, y: 200, width: 915, height: 515, locked: true };
    (service as any).streamSource.store = createStore(() => ({ objects: { viewports: { v: rect } }, setFollowViewport: () => {} }));
    (source as any).getRenderedFrames = () => 1;
    (service as any).toggleViewportFollow();
    nextFrame();
    expect((source as any).renderPlayerFrame).toHaveBeenLastCalledWith({ width: 1883, height: 960 }, expect.anything(), { rect });
  });

  it('renders a new frame when the window changes size, though the scene did not change', () => {
    const { source, nextFrame, window } = mirror({ innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1 }, () => frameOf(1280, 720));
    (source as any).getRenderedFrames = () => 5;
    nextFrame();
    const calls = (source as any).renderPlayerFrame.mock.calls.length;
    nextFrame();
    expect((source as any).renderPlayerFrame).toHaveBeenCalledTimes(calls);

    window.innerWidth = 1920;
    window.innerHeight = 1080;
    nextFrame();
    expect((source as any).renderPlayerFrame).toHaveBeenLastCalledWith({ width: 1920, height: 1080 }, expect.anything(), expect.anything());
  });
});
