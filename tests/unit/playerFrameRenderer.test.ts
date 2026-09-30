import { beforeEach, describe, expect, it, vi } from 'vitest';

const texture = { width: 0, height: 0, resize: vi.fn(function (this: { width: number; height: number }, w: number, h: number) { this.width = w; this.height = h; }), destroy: vi.fn() };
vi.mock('pixi.js', () => ({
  RenderTexture: { create: vi.fn((options: { width: number; height: number }) => { texture.width = options.width; texture.height = options.height; return texture; }) },
}));

import { PlayerFrameRenderer } from '../../src/app/pixi/PlayerFrameRenderer';

const point = () => ({ x: 10, y: 20, set(x: number, y: number) { this.x = x; this.y = y; } });

function setup(rendererName = 'webgl') {
  const canvas = document.createElement('canvas');
  const render = vi.fn();
  const extract = vi.fn(() => canvas);
  const stage = { label: 'stage' };
  const app = { stage, renderer: { name: rendererName, render, extract: { canvas: extract }, background: { color: 0x112233 } } };
  const viewport = { screenWidth: 500, screenHeight: 300, position: point(), scale: { ...point(), x: 2, y: 2 } };
  const layer = { visible: true };
  return { canvas, render, extract, stage, app: app as any, viewport: viewport as any, layer };
}

beforeEach(() => vi.clearAllMocks());

describe('PlayerFrameRenderer', () => {
  it('renders the scene onto its own texture, then draws the DM canvas again so no changes are left pending', () => {
    const { app, render, stage, viewport, layer, canvas } = setup();
    const frame = new PlayerFrameRenderer().render(app, viewport, [{ layer, visible: false }], { width: 1000, height: 600 }, { camera: { centerX: 100, centerY: 50, scale: 2 } });

    expect(frame).toBe(canvas);
    expect(render).toHaveBeenCalledTimes(2);
    expect(render.mock.calls[0]![0]).toMatchObject({ container: stage, target: texture, clear: true, clearColor: 0x112233 });
    // The second draw is the DM's own canvas: the stage alone, with no texture to draw on.
    expect(render.mock.calls[1]).toEqual([stage]);
  });

  it('shows players the layers and camera it was given while rendering, and puts both back', () => {
    const { app, render, viewport, layer } = setup();
    const seen: { visible: boolean; scale: number }[] = [];
    render.mockImplementation(() => seen.push({ visible: layer.visible, scale: viewport.scale.x }));

    new PlayerFrameRenderer().render(app, viewport, [{ layer, visible: false }], { width: 1000, height: 600 }, { camera: { centerX: 100, centerY: 50, scale: 2 } });

    // The pane is 500 wide and the frame 1000: twice the zoom. The DM's own redraw sees the DM's camera again.
    expect(seen[0]).toEqual({ visible: false, scale: 4 });
    expect(seen[1]).toEqual({ visible: true, scale: 2 });
    expect(layer.visible).toBe(true);
    expect(viewport.position).toMatchObject({ x: 10, y: 20 });
  });

  it('draws on an anti-aliased texture, so thin grid lines do not drop out', async () => {
    const { RenderTexture } = await import('pixi.js');
    const { app, viewport } = setup();
    new PlayerFrameRenderer().render(app, viewport, [], { width: 1000, height: 600 }, { camera: { centerX: 0, centerY: 0, scale: 1 } });
    expect(RenderTexture.create).toHaveBeenCalledWith(expect.objectContaining({ antialias: true, resolution: 1 }));
  });

  it('fits a viewport rectangle whole into the frame when that is what players follow', () => {
    const { app, render, viewport } = setup();
    const seen: { scale: number; x: number }[] = [];
    render.mockImplementation(() => seen.push({ scale: viewport.scale.x, x: viewport.position.x }));

    new PlayerFrameRenderer().render(app, viewport, [], { width: 1883, height: 960 }, { rect: { x: 0, y: 0, width: 915, height: 515 } });

    // The frame is wider than the rectangle: the height limits the zoom, and the rectangle is centred.
    expect(seen[0]!.scale).toBeCloseTo(960 / 515);
    expect(seen[0]!.x).toBeCloseTo(1883 / 2 - 457.5 * (960 / 515));
  });

  it('keeps one texture for one size and resizes it when the size changes', () => {
    const { app, viewport } = setup();
    const renderer = new PlayerFrameRenderer();
    renderer.render(app, viewport, [], { width: 1280, height: 720 }, { camera: { centerX: 0, centerY: 0, scale: 1 } });
    renderer.render(app, viewport, [], { width: 1280, height: 720 }, { camera: { centerX: 0, centerY: 0, scale: 1 } });
    expect(texture.resize).not.toHaveBeenCalled();
    renderer.render(app, viewport, [], { width: 1920, height: 1080 }, { camera: { centerX: 0, centerY: 0, scale: 1 } });
    expect(texture.resize).toHaveBeenCalledWith(1920, 1080);
  });

  it('renders nothing for the software renderer, which cannot draw apart from the DM canvas', () => {
    const { app, render, viewport } = setup('canvas');
    expect(new PlayerFrameRenderer().render(app, viewport, [], { width: 1000, height: 600 }, { camera: { centerX: 0, centerY: 0, scale: 1 } })).toBeNull();
    expect(render).not.toHaveBeenCalled();
  });

  it('frees its texture when destroyed', () => {
    const { app, viewport } = setup();
    const renderer = new PlayerFrameRenderer();
    renderer.render(app, viewport, [], { width: 100, height: 100 }, { camera: { centerX: 0, centerY: 0, scale: 1 } });
    renderer.destroy();
    expect(texture.destroy).toHaveBeenCalledWith(true);
  });
});
