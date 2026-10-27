import { readMapStretch, sameStretch, stretchForAspect, NO_STRETCH } from './mapStretch';
import type { MapStretch } from './mapStretch';
import { isRecord } from '../utils/guards';

/** A grid stated outright rather than found: its cell size in the image's pixels and the stretch that makes its cells square. */
export interface NamedGrid {
  cellSize: number;
  mapStretch?: MapStretch;
}

/** What a map's file name says about its grid: how many cells it holds, or how many pixels a cell has. */
export type GridNameHint =
  | { kind: 'cells'; columns: number; rows: number }
  | { kind: 'pixels'; perCell: number };

interface Size {
  width: number;
  height: number;
}

/** Cells smaller than this are no grid a map is played on. */
export const MIN_NAMED_CELL = 8;
/** A cell count above this in a name is a resolution ("1920x1080"), not cells. */
const MAX_CELLS = 400;
/** A name's pixels per cell outside this range is something else. */
const PIXELS_PER_CELL = { min: 10, max: 1000 };
/** Cells whose sides differ by less than this share are square: the difference is the image's rounding. */
const SQUARE_WITHIN = 0.002;
/** A name counts only when its cells are this close to square; a typed count may stretch the map as far as any alignment. */
export const NAMED_STRETCH_LIMIT = 1.05;

/** "140pps", "140 ppi", "70ppg", "100px per cell": pixels per cell as map makers name them. */
const PIXELS_PATTERN = /(?<![\d.])(\d{1,4}(?:\.\d+)?)\s*(?:pps|ppi|ppg|ppc|px\s*per\s*(?:cell|square|grid|tile|inch))(?![a-z])/gi;
/** "55x42", "30 × 20": columns by rows, never a pixel resolution ("30x20px"). */
const CELLS_PATTERN = /(?<![\d.])(\d{1,3})\s*[x×]\s*(\d{1,3})(?![\d.])(?!\s*(?:px|pps|ppi|ppg|ppc))/gi;

/** The last match of `pattern` in `name`: map makers put the grid at the end of a name. */
function lastMatch(pattern: RegExp, name: string): RegExpExecArray | null {
  let last: RegExpExecArray | null = null;
  for (const match of name.matchAll(pattern)) last = match;
  return last;
}

/** What a file name (with or without its extension) states about its map's grid, both where it states both. */
export function gridHintsInName(name: string): GridNameHint[] {
  const base = name.replace(/\.[a-z0-9]+$/i, '');
  const hints: GridNameHint[] = [];
  const cells = lastMatch(CELLS_PATTERN, base);
  const columns = Number(cells?.[1]);
  const rows = Number(cells?.[2]);
  if (columns >= 2 && rows >= 2 && columns <= MAX_CELLS && rows <= MAX_CELLS) hints.push({ kind: 'cells', columns, rows });
  const pixels = Number(lastMatch(PIXELS_PATTERN, base)?.[1]);
  if (pixels >= PIXELS_PER_CELL.min && pixels <= PIXELS_PER_CELL.max) hints.push({ kind: 'pixels', perCell: pixels });
  return hints;
}

/**
 * The square grid of `columns` × `rows` cells that covers an image of `size` from its corner. Cells
 * that come out as rectangles are made square by stretching the map along their short side, at most
 * `maxStretch` times; null where that is not enough or the cells are too small.
 */
export function gridOfCells(size: Size, columns: number, rows: number, maxStretch: number): NamedGrid | null {
  if (!(columns > 0 && rows > 0 && size.width > 0 && size.height > 0)) return null;
  const across = size.width / columns;
  const down = size.height / rows;
  const aspect = down / across;
  if (Math.max(aspect, 1 / aspect) > maxStretch) return null;
  if (Math.abs(aspect - 1) <= SQUARE_WITHIN) return across >= MIN_NAMED_CELL ? { cellSize: across } : null;
  const cellSize = Math.max(across, down);
  return cellSize >= MIN_NAMED_CELL ? { cellSize, mapStretch: stretchForAspect(aspect) } : null;
}

/**
 * The grid a map's original file name states, in the pixels of the image as it was saved (`saved`):
 * a cell count is read on the saved image itself, either way round (a turned image has its columns
 * as rows), and pixels per cell are scaled as the image was (`original` is the upload's size, unknown
 * for a vector). A count wins where it gives square cells, since it holds whatever the image was scaled to.
 */
export function namedGridOf(name: string, saved: Size, original: Size | null): NamedGrid | null {
  for (const hint of gridHintsInName(name)) {
    if (hint.kind === 'cells') {
      const grid = gridOfCells(saved, hint.columns, hint.rows, NAMED_STRETCH_LIMIT)
        ?? gridOfCells(saved, hint.rows, hint.columns, NAMED_STRETCH_LIMIT);
      if (grid) return grid;
    } else if (original && original.width > 0) {
      const scale = Math.max(saved.width, saved.height) / Math.max(original.width, original.height);
      const cellSize = hint.perCell * scale;
      if (cellSize >= MIN_NAMED_CELL && Number.isFinite(cellSize)) return { cellSize };
    }
  }
  return null;
}

/** A named grid as a record holds it: anything that is no positive finite size reads as none, a stretch out of range as no stretch. */
export function readNamedGrid(value: unknown): NamedGrid | null {
  if (!isRecord(value)) return null;
  const { cellSize } = value;
  if (typeof cellSize !== 'number' || !Number.isFinite(cellSize) || cellSize < MIN_NAMED_CELL) return null;
  const mapStretch = readMapStretch(value.mapStretch);
  return sameStretch(mapStretch, NO_STRETCH) ? { cellSize } : { cellSize, mapStretch };
}
