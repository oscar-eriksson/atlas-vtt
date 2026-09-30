import { describe, expect, it, vi } from 'vitest';
import { captureWithLayerVisibility, fitCameraToSize, framingForSize } from '../../src/app/pixi/playerSafeFrame';

describe('fitCameraToSize', () => {
  const camera = { centerX: 500, centerY: 300, scale: 1.5 };

  it('keeps the centre and scales the zoom by the size of the new surface', () => {
    expect(fitCameraToSize(camera, { width: 1000, height: 600 }, { width: 2000, height: 1200 })).toEqual({ centerX: 500, centerY: 300, scale: 3 });
  });

  it('fits the whole view into a surface of another shape', () => {
    // A wider window: the height is what limits, so all of the view still shows.
    expect(fitCameraToSize(camera, { width: 1000, height: 600 }, { width: 2400, height: 1200 }).scale).toBeCloseTo(3);
    // A taller one: the width limits.
    expect(fitCameraToSize(camera, { width: 1000, height: 600 }, { width: 1000, height: 1200 }).scale).toBeCloseTo(1.5);
  });

  it('leaves the camera alone when the DM pane has no size', () => {
    expect(fitCameraToSize(camera, { width: 0, height: 0 }, { width: 1920, height: 1080 })).toBe(camera);
  });
});

describe('framingForSize', () => {
  const pane = { width: 918, height: 950 };

  it('scales a camera from the DM pane to the surface', () => {
    const camera = { centerX: 10, centerY: 20, scale: 2 };
    expect(framingForSize({ camera }, pane, { width: 1836, height: 1900 })).toEqual(fitCameraToSize(camera, pane, { width: 1836, height: 1900 }));
  });

  it('fits a rectangle whole into the surface, centred on it', () => {
    const rect = { x: 1000, y: 500, width: 3000, height: 1600 };
    const camera = framingForSize({ rect }, pane, { width: 1920, height: 1080 });
    expect([camera.centerX, camera.centerY]).toEqual([2500, 1300]);
    expect(camera.scale).toBeCloseTo(Math.min(1920 / 3000, 1080 / 1600));
    // Everything in the rectangle shows.
    expect(1920 / camera.scale).toBeGreaterThanOrEqual(rect.width - 1e-6);
    expect(1080 / camera.scale).toBeGreaterThanOrEqual(rect.height - 1e-6);
  });

  it('gives the rectangle its own size whatever shape the DM pane is', () => {
    // A wide rectangle, a near-square pane and a wide window: fitting the rectangle into the pane first and scaling
    // that to the window would lose its size and show far too little of the map.
    const rect = { x: 0, y: 0, width: 915, height: 515 };
    const wide = { width: 1883, height: 960 };
    const direct = framingForSize({ rect }, pane, wide).scale;
    expect(direct).toBeCloseTo(Math.min(1883 / 915, 960 / 515));
    const viaPane = fitCameraToSize({ centerX: 0, centerY: 0, scale: Math.min(pane.width / 915, pane.height / 515) }, pane, wide).scale;
    expect(direct).toBeGreaterThan(viaPane * 1.5);
  });
});

describe('captureWithLayerVisibility', () => {
  const layer = () => ({ visible: true, alpha: 1 as number | undefined });

  it('draws the DM frame again after a capture, by default', () => {
    const render = vi.fn();
    const hidden = layer();
    captureWithLayerVisibility([{ layer: hidden, visible: false }], render, () => { expect(hidden.visible).toBe(false); });
    // Once for the capture and once to put the DM's frame back.
    expect(render).toHaveBeenCalledTimes(2);
    expect(hidden.visible).toBe(true);
  });

  it('restores layers without drawing again when the capture was drawn elsewhere', () => {
    const render = vi.fn();
    const restore = vi.fn();
    const hidden = layer();
    captureWithLayerVisibility([{ layer: hidden, visible: false }], render, () => undefined, undefined, restore);
    expect(render).toHaveBeenCalledTimes(1);
    expect(restore).toHaveBeenCalledTimes(1);
    expect(hidden.visible).toBe(true);
  });

  it('puts the camera back even when the capture throws', () => {
    const position = { x: 10, y: 20, set(x: number, y: number) { this.x = x; this.y = y; } };
    const scale = { x: 2, y: 2, set(x: number, y: number) { this.x = x; this.y = y; } };
    const target = { screenWidth: 1920, screenHeight: 1080, position, scale };
    expect(() => captureWithLayerVisibility([], () => undefined, () => { throw new Error('no frame'); }, { target, camera: { centerX: 0, centerY: 0, scale: 1 } }, () => undefined)).toThrow('no frame');
    expect(position).toMatchObject({ x: 10, y: 20 });
    expect(scale).toMatchObject({ x: 2, y: 2 });
  });
});
