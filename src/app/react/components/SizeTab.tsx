import React, { useEffect, useId, useMemo, useState } from 'react';
import { MAX_STRETCH_FACTOR } from '../../grid/mapStretch';
import { gridOfCells, MIN_NAMED_CELL } from '../../grid/namedGrid';
import type { AlignmentResult } from '../../pixi/gridAlignmentMath';
import { useAlignmentPreview } from '../hooks/useGridAlignmentEffects';
import type { AlignmentTabProps } from '../hooks/useGridAlignmentEffects';
import { t } from '../../i18n';

/** Which of the fields the GM typed in last: that one says what the grid is. */
type SizeSource = 'pixels' | 'cells';

/** A typed number, a decimal comma read as a point; NaN where the field holds none. */
const typed = (text: string): number => (text.trim() === '' ? NaN : Number(text.replace(',', '.')));

/**
 * Sets the grid by numbers instead of by eye: the pixels of the map image one cell spans, or how
 * many columns and rows of square cells the map holds (cells that come out as rectangles stretch the
 * map, as an alignment does). The grid starts at the image's corner and is never fitted to the map's lines.
 */
export function SizeTab({ controller, view, setResult, gridType }: AlignmentTabProps): React.ReactElement {
  const id = useId();
  const [pixels, setPixels] = useState('');
  const [columns, setColumns] = useState('');
  const [rows, setRows] = useState('');
  const [source, setSource] = useState<SizeSource>('pixels');
  const imageSize = view?.renderer?.getMapImage?.()?.imageSize ?? null;
  // Columns and rows of hexes do not span the image as squares do: a count is for square grids.
  const countsCells = gridType === 'square';

  const result = useMemo((): AlignmentResult | null => {
    if (source === 'pixels' || !countsCells) {
      const cellSize = typed(pixels);
      return cellSize >= MIN_NAMED_CELL && Number.isFinite(cellSize) ? { cellSize, offsetX: 0, offsetY: 0, gridType } : null;
    }
    if (!imageSize) return null;
    const grid = gridOfCells(imageSize, Math.round(typed(columns)), Math.round(typed(rows)), MAX_STRETCH_FACTOR);
    return grid && { cellSize: grid.cellSize, offsetX: 0, offsetY: 0, gridType, ...(grid.mapStretch && { mapStretch: grid.mapStretch }) };
  }, [source, countsCells, pixels, columns, rows, imageSize, gridType]);
  useAlignmentPreview(result, controller, setResult);

  // The scene's current grid would only mislead while no size is typed; leaving the tab restores it.
  useEffect(() => {
    if (!result) controller?.hidePreview();
  }, [controller, result]);

  // A grid by numbers spans the whole map, so the whole map is what shows whether it fits.
  useEffect(() => {
    controller?.zoomToFullMap();
  }, [controller]);

  useEffect(() => () => view?.renderer?.cancelGridAlignment(), [view]);

  const cellsTyped = typed(columns) > 0 && typed(rows) > 0;
  const tooUneven = source === 'cells' && countsCells && cellsTyped && imageSize !== null && !result;

  return (
    <div className="atlas-grid-alignment-size">
      <label className="atlas-grid-alignment-size-row" htmlFor={`${id}-pixels`}>
        <span>{t('align.size.pixels')}</span>
        <input
          id={`${id}-pixels`}
          type="text"
          inputMode="decimal"
          value={pixels}
          placeholder="70"
          onChange={(e) => { setPixels(e.target.value); setSource('pixels'); }}
        />
      </label>
      <div className="atlas-grid-alignment-size-row" role="group" aria-label={t('align.size.cells')}>
        <span>{t('align.size.cells')}</span>
        <input
          type="text"
          inputMode="numeric"
          value={columns}
          placeholder="30"
          aria-label={t('align.size.columns')}
          disabled={!countsCells}
          onChange={(e) => { setColumns(e.target.value); setSource('cells'); }}
        />
        <span aria-hidden="true">×</span>
        <input
          type="text"
          inputMode="numeric"
          value={rows}
          placeholder="20"
          aria-label={t('align.size.rows')}
          disabled={!countsCells}
          onChange={(e) => { setRows(e.target.value); setSource('cells'); }}
        />
      </div>
      <p className="atlas-grid-alignment-instruction">{t(tooUneven ? 'align.size.uneven' : 'align.size.hint')}</p>
    </div>
  );
}
