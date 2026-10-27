import { describe, expect, it } from 'vitest';
import { gridHintsInName, gridOfCells, namedGridOf, readNamedGrid } from '../namedGrid';

describe('gridHintsInName', () => {
  it('reads columns by rows', () => {
    expect(gridHintsInName('Tavern_Day_55x42.jpg')).toEqual([{ kind: 'cells', columns: 55, rows: 42 }]);
    expect(gridHintsInName('Cave 30 × 20 night.png')).toEqual([{ kind: 'cells', columns: 30, rows: 20 }]);
  });

  it('reads pixels per cell in the ways map makers write them', () => {
    expect(gridHintsInName('Forest_140pps.webp')).toEqual([{ kind: 'pixels', perCell: 140 }]);
    expect(gridHintsInName('Forest 100 ppi')).toEqual([{ kind: 'pixels', perCell: 100 }]);
    expect(gridHintsInName('Forest_70px per cell')).toEqual([{ kind: 'pixels', perCell: 70 }]);
  });

  it('gives both where a name states both, the count first', () => {
    expect(gridHintsInName('Keep_30x20_140ppi.jpg')).toEqual([
      { kind: 'cells', columns: 30, rows: 20 },
      { kind: 'pixels', perCell: 140 },
    ]);
  });

  it('takes no resolution or pixel size for cells', () => {
    expect(gridHintsInName('Keep_1920x1080.jpg')).toEqual([]);
    expect(gridHintsInName('Keep_30x20px.jpg')).toEqual([]);
    expect(gridHintsInName('Keep_v2.jpg')).toEqual([]);
    expect(gridHintsInName('Token_1x1.png')).toEqual([]);
  });
});

describe('gridOfCells', () => {
  it('gives square cells from the image corner', () => {
    expect(gridOfCells({ width: 7700, height: 5880 }, 55, 42, 1.05)).toEqual({ cellSize: 140 });
  });

  it('stretches the map along the short side of cells that come out as rectangles', () => {
    const grid = gridOfCells({ width: 3000, height: 1900 }, 30, 20, 1.5);
    expect(grid?.cellSize).toBe(100);
    expect(grid?.mapStretch).toEqual({ x: 1, y: 1.05263 });
  });

  it('refuses cells further from square than allowed', () => {
    expect(gridOfCells({ width: 3000, height: 1000 }, 30, 20, 1.5)).toBeNull();
  });
});

describe('namedGridOf', () => {
  it('reads a count on the image as saved, whichever way round it lies', () => {
    expect(namedGridOf('Tavern_55x42.jpg', { width: 5880, height: 7700 }, null)).toEqual({ cellSize: 140 });
  });

  it('holds a count whatever the image was scaled to', () => {
    expect(namedGridOf('Tavern_55x42.jpg', { width: 3850, height: 2940 }, { width: 7700, height: 5880 })).toEqual({ cellSize: 70 });
  });

  it('scales pixels per cell as the image was scaled', () => {
    expect(namedGridOf('Cave_140pps.jpg', { width: 3850, height: 2940 }, { width: 7700, height: 5880 })).toEqual({ cellSize: 70 });
  });

  it('falls back to pixels per cell where the count gives no square cells', () => {
    expect(namedGridOf('Keep_30x10_100ppi.jpg', { width: 3000, height: 2000 }, { width: 3000, height: 2000 })).toEqual({ cellSize: 100 });
  });

  it('states nothing for a name without a grid', () => {
    expect(namedGridOf('Tavern.jpg', { width: 3000, height: 2000 }, { width: 3000, height: 2000 })).toBeNull();
  });
});

describe('readNamedGrid', () => {
  it('reads what a record holds and nothing else', () => {
    expect(readNamedGrid({ cellSize: 140 })).toEqual({ cellSize: 140 });
    expect(readNamedGrid({ cellSize: 100, mapStretch: { x: 1, y: 1.02 } })).toEqual({ cellSize: 100, mapStretch: { x: 1, y: 1.02 } });
    expect(readNamedGrid({ cellSize: 'big' })).toBeNull();
    expect(readNamedGrid({ cellSize: -3 })).toBeNull();
    expect(readNamedGrid(null)).toBeNull();
  });
});
