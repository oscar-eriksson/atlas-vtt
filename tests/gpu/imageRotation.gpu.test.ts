import { describe, expect, it } from 'vitest';
import type { QuarterTurn } from '../../src/app/imageProcessing/imageJob';
import { renderImageJob } from '../../src/app/imageProcessing/imageRenderer';

const RED = [255, 0, 0];
const BLUE = [0, 0, 255];

/** A 4 x 2 picture: red on its left half, blue on its right half. */
async function redAndBlue(): Promise<Blob> {
  const canvas = new OffscreenCanvas(4, 2);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgb(255,0,0)';
  ctx.fillRect(0, 0, 2, 2);
  ctx.fillStyle = 'rgb(0,0,255)';
  ctx.fillRect(2, 0, 2, 2);
  return canvas.convertToBlob({ type: 'image/png' });
}

async function turned(rotation: QuarterTurn): Promise<{ width: number; height: number; at: (x: number, y: number) => number[] }> {
  const { image } = await renderImageJob({
    source: await redAndBlue(),
    layout: { kind: 'fit', maxWidth: 8192, maxHeight: 8192 },
    quality: 1,
    rotation,
  });
  const bitmap = await createImageBitmap(image);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);
  return { width: bitmap.width, height: bitmap.height, at: (x, y) => Array.from(ctx.getImageData(x, y, 1, 1).data).slice(0, 3) };
}

function near(actual: number[], expected: number[]): void {
  actual.forEach((channel, i) => expect(Math.abs(channel - expected[i]!)).toBeLessThan(40));
}

describe('turning a map as it is imported', () => {
  it('leaves the picture as it is without a turn', async () => {
    const result = await turned(0);
    expect([result.width, result.height]).toEqual([4, 2]);
    near(result.at(0, 0), RED);
    near(result.at(3, 0), BLUE);
  });

  it('puts the left of the picture on top after a quarter turn clockwise', async () => {
    const result = await turned(90);
    expect([result.width, result.height]).toEqual([2, 4]);
    near(result.at(0, 0), RED);
    near(result.at(0, 3), BLUE);
  });

  it('swaps left and right after a half turn', async () => {
    const result = await turned(180);
    expect([result.width, result.height]).toEqual([4, 2]);
    near(result.at(0, 0), BLUE);
    near(result.at(3, 0), RED);
  });

  it('puts the left of the picture at the bottom after three quarter turns', async () => {
    const result = await turned(270);
    expect([result.width, result.height]).toEqual([2, 4]);
    near(result.at(0, 0), BLUE);
    near(result.at(0, 3), RED);
  });
});
