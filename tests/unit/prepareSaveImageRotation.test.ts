import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProcessedImage } from '../../src/app/imageProcessing/imageProcessing';
import type { TokenPreview } from '../../src/app/packages/components/asset-manager/token-creator/types';

const optimizeUpload = vi.fn();
vi.mock('../../src/app/packages/components/asset-manager/token-creator/tokenImages', () => ({
  optimizeUpload: (...args: unknown[]) => optimizeUpload(...args),
  cropTokenImage: vi.fn(),
}));

import { prepareSaveImage } from '../../src/app/packages/components/asset-manager/token-creator/prepareSaveImages';

const background = { image: new Blob(['whole']) } as unknown as ProcessedImage;
const file = new File(['x'], 'map.png', { type: 'image/png' });

function preview(rotation?: TokenPreview['rotation']): TokenPreview {
  return {
    id: 'p1', file, previewUrl: '', name: 'map', imageScale: 1, imagePosition: { x: 0, y: 0 },
    isSelected: false, isOptimizing: false, rotation,
  };
}

const context = { mode: 'map' as const, waitForOptimized: vi.fn(async () => background) };

beforeEach(() => {
  optimizeUpload.mockReset();
  optimizeUpload.mockResolvedValue({ image: new Blob(['turned']) });
});

describe('the image a map card saves', () => {
  it('reuses the background conversion of a map that is not turned', async () => {
    expect(await prepareSaveImage(file, preview(), context)).toBe(background);
    expect(optimizeUpload).not.toHaveBeenCalled();
  });

  it('converts a turned map again with its turn, since the background one is as uploaded', async () => {
    await prepareSaveImage(file, preview(270), context);
    expect(optimizeUpload).toHaveBeenCalledWith(file, 'map', expect.objectContaining({ rotation: 270, thumbnail: true }));
  });
});
