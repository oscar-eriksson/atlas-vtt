import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'events';

const loadBackgroundTexture = vi.fn();
const release = vi.fn();
vi.mock('../../src/app/MapLoader', () => ({ loadBackgroundTexture: (...args: unknown[]) => loadBackgroundTexture(...args), MapLoader: {} }));
vi.mock('../../src/app/MapController', () => ({ MapController: {}, backgroundSpriteFrom: (texture: unknown) => ({ texture }) }));
vi.mock('../../src/app/pixi/backgroundTextureCache', () => ({ backgroundTextureCache: { release: (...args: unknown[]) => release(...args), acquire: vi.fn() } }));

import { MapService } from '../../src/app/services/MapService';
import { createViewAtlasStore } from '../../src/app/storeFactory';
import { createInMemoryApp } from '../mocks/inMemoryVault';

let storeCount = 0;
function setup(withRenderer = true) {
  const { app } = createInMemoryApp({ files: {} });
  const store = createViewAtlasStore(app, `map-service-${storeCount++}`);
  store.getState().setPersistenceEnabled(false);
  store.getState().setMapPath('maps/tower.atlasmap');
  const viewport = {
    destroyed: false,
    center: { x: 3000, y: 2000 },
    scale: { x: 0.4 },
    moveCenter: vi.fn(function (this: any, x: number, y: number) { viewport.center = { x, y }; }),
    setZoom: vi.fn((scale: number) => { viewport.scale = { x: scale }; }),
  };
  const renderer = { setBackgroundSprite: vi.fn(), getViewportInstance: () => viewport };
  const service = new MapService(app as any, new EventEmitter(), store);
  if (withRenderer) (service as any).rendererService = { getRenderer: () => renderer };
  return { store, renderer, service, viewport };
}

/** A promise that settles when told to, to hold an image "still loading". */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

const flush = (): Promise<void> => new Promise((done) => setTimeout(done, 0));

beforeEach(() => {
  vi.clearAllMocks();
  loadBackgroundTexture.mockImplementation(async (_app: unknown, background: string | null) => ({
    texture: { path: background }, hasBackground: background !== null, backgroundUrl: background && `url:${background}`,
  }));
});

describe('MapService showing the background of another floor', () => {
  it('shows a new background on the canvas, at the grid\'s size, and releases the one it replaces', async () => {
    const { store, renderer } = setup();
    store.getState().setBackground('maps/a.webp');
    await flush();
    store.getState().setBackground('maps/b.webp');
    await flush();
    expect(renderer.setBackgroundSprite).toHaveBeenCalledTimes(2);
    expect(renderer.setBackgroundSprite).toHaveBeenLastCalledWith({ texture: { path: 'maps/b.webp' } });
    expect(release).toHaveBeenCalledWith('url:maps/a.webp');
  });

  it('shows the image of the floor switched to, and a floor without an image as a placeholder', async () => {
    const { store, renderer } = setup();
    store.getState().setBackground('maps/ground.webp');
    await flush();
    const upstairs = store.getState().addFloor();
    store.getState().switchFloor(upstairs);
    await flush();
    expect(loadBackgroundTexture).toHaveBeenLastCalledWith(expect.anything(), null, expect.any(Number));
    expect(renderer.setBackgroundSprite).toHaveBeenLastCalledWith({ texture: { path: null } });
  });

  it('does nothing while a map is loading, when the load puts the image on the canvas itself', async () => {
    const { store, renderer } = setup();
    store.getState().setMapLoading(true, 10, 'Loading');
    store.getState().setBackground('maps/a.webp');
    await flush();
    expect(renderer.setBackgroundSprite).not.toHaveBeenCalled();
  });

  it('never lets an image that loads late replace a newer one', async () => {
    const { store, renderer } = setup();
    const slow = deferred<unknown>();
    loadBackgroundTexture.mockImplementationOnce(() => slow.promise);
    store.getState().setBackground('maps/slow.webp');
    store.getState().setBackground('maps/fast.webp');
    await flush();
    slow.resolve({ texture: { path: 'maps/slow.webp' }, hasBackground: true, backgroundUrl: 'url:maps/slow.webp' });
    await flush();
    expect(renderer.setBackgroundSprite).toHaveBeenCalledTimes(1);
    expect(renderer.setBackgroundSprite).toHaveBeenCalledWith({ texture: { path: 'maps/fast.webp' } });
    // The image that lost is given back.
    expect(release).toHaveBeenCalledWith('url:maps/slow.webp');
  });

  it('does nothing before a map has a renderer', async () => {
    const { store } = setup(false);
    store.getState().setBackground('maps/a.webp');
    await flush();
    expect(loadBackgroundTexture).not.toHaveBeenCalled();
  });

  it('stops watching once destroyed', async () => {
    const { store, renderer, service } = setup();
    service.destroy();
    store.getState().setBackground('maps/a.webp');
    await flush();
    expect(renderer.setBackgroundSprite).not.toHaveBeenCalled();
  });

  describe('keeping the camera where the DM is looking', () => {
    const frames: FrameRequestCallback[] = [];
    const runFrames = (): void => { while (frames.length) frames.shift()!(0); };
    beforeEach(() => {
      frames.length = 0;
      vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback));
    });

    it('leaves the camera alone when the swap does not move it', async () => {
      const { store, viewport } = setup();
      store.getState().setBackground('maps/a.webp');
      await flush();
      runFrames();
      expect(viewport.moveCenter).not.toHaveBeenCalled();
      expect(viewport.setZoom).not.toHaveBeenCalled();
    });

    it('puts the camera back at once when the swap recentres it', async () => {
      const { store, renderer, viewport } = setup();
      renderer.setBackgroundSprite.mockImplementation(() => { viewport.center = { x: 700, y: 700 }; viewport.scale = { x: 0.1 }; });
      store.getState().setBackground('maps/a.webp');
      await flush();
      expect(viewport.center).toEqual({ x: 3000, y: 2000 });
      expect(viewport.scale.x).toBeCloseTo(0.4);
    });

    it('puts the camera back when something recentres it a frame later', async () => {
      const { store, viewport } = setup();
      store.getState().setBackground('maps/a.webp');
      await flush();
      // The grid is rebuilt a moment after the swap.
      viewport.center = { x: 700, y: 700 };
      runFrames();
      expect(viewport.center).toEqual({ x: 3000, y: 2000 });
    });

    it('does not touch a camera that has been destroyed with its view', async () => {
      const { store, viewport } = setup();
      store.getState().setBackground('maps/a.webp');
      await flush();
      viewport.destroyed = true;
      viewport.center = { x: 1, y: 1 };
      runFrames();
      expect(viewport.moveCenter).not.toHaveBeenCalled();
    });
  });
});
