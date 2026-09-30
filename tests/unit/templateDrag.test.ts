import { describe, expect, it } from 'vitest';
import { templateFromDrag } from '../../src/app/templates/templateDrag';
import { resolveOriginSnap } from '../../src/app/templates/templateOrigin';
import { DEFAULT_TEMPLATE_TOOL_SETTINGS, type TemplateToolSettings } from '../../src/app/tools/templateToolSettings';

const grid = { type: 'square' as const, size: 70, offsetX: 0, offsetY: 0 };
const origin = { x: 140, y: 140 };
const settings = (changes: Partial<TemplateToolSettings> = {}): TemplateToolSettings => ({ ...DEFAULT_TEMPLATE_TOOL_SETTINGS, ...changes });

describe('templateFromDrag', () => {
  it('points at the pointer and is as long as the drag, in whole cells', () => {
    const template = templateFromDrag(settings({ shape: 'cone' }), grid, origin, 'intersection', { x: 140 + 3.2 * 70, y: 140 });
    expect(template).toMatchObject({ shape: 'cone', x: 140, y: 140, snap: 'intersection', size: 3, angle: 0, visibleToPlayers: true });
  });

  it('grows a cube from its centre: the side is twice the larger drag', () => {
    // 1.5 cells right and 0.5 down: the edge follows the larger, so a 3-cell cube.
    expect(templateFromDrag(settings({ shape: 'cube' }), grid, origin, 'intersection', { x: 140 + 1.5 * 70, y: 140 + 0.5 * 70 })).toMatchObject({ shape: 'cube', size: 3 });
    expect(templateFromDrag(settings({ shape: 'cube' }), grid, origin, 'intersection', { x: 140 - 70, y: 140 - 2 * 70 })).toMatchObject({ size: 4 });
  });

  it('turns with the pointer', () => {
    const template = templateFromDrag(settings(), grid, origin, 'intersection', { x: 140, y: 140 + 140 });
    expect(template?.angle).toBeCloseTo(Math.PI / 2);
    expect(template?.size).toBe(2);
  });

  it('makes nothing from a click or a tiny drag', () => {
    expect(templateFromDrag(settings(), grid, origin, 'intersection', origin)).toBeNull();
    expect(templateFromDrag(settings(), grid, origin, 'intersection', { x: 145, y: 140 })).toBeNull();
  });

  it('is at least one cell long', () => {
    expect(templateFromDrag(settings(), grid, origin, 'intersection', { x: 140 + 0.4 * 70, y: 140 })?.size).toBe(1);
  });

  it('gives a line its width', () => {
    const template = templateFromDrag(settings({ shape: 'line', lineWidth: 2 }), grid, origin, 'intersection', { x: 350, y: 140 });
    expect(template).toMatchObject({ shape: 'line', width: 2, size: 3 });
    expect(templateFromDrag(settings({ shape: 'cone' }), grid, origin, 'intersection', { x: 350, y: 140 })).not.toHaveProperty('width');
  });

  it('measures an emanation from the edge of the creature, not its centre', () => {
    // A 2-cell footprint: the pointer 4 cells out is 3 cells beyond the creature's edge.
    const template = templateFromDrag(settings({ shape: 'emanation', footprint: 2 }), grid, origin, 'intersection', { x: 140 + 4 * 70, y: 140 });
    expect(template).toMatchObject({ shape: 'emanation', footprint: 2, size: 3 });
  });

  it('carries the chosen colour, and none when the theme colour is used', () => {
    expect(templateFromDrag(settings({ color: '#3e63dd' }), grid, origin, 'intersection', { x: 350, y: 140 })?.color).toBe('#3e63dd');
    expect(templateFromDrag(settings(), grid, origin, 'intersection', { x: 350, y: 140 })).not.toHaveProperty('color');
  });

  it('carries the coverage rule, half by default', () => {
    expect(templateFromDrag(settings(), grid, origin, 'any', { x: 350, y: 140 })?.coverage).toBe('half');
    expect(templateFromDrag(settings({ coverage: 'off' }), grid, origin, 'any', { x: 350, y: 140 })?.coverage).toBe('off');
  });

  it('keeps the visibility choice', () => {
    expect(templateFromDrag(settings({ visibleToPlayers: false }), grid, origin, 'intersection', { x: 350, y: 140 })?.visibleToPlayers).toBe(false);
  });
});

describe('resolveOriginSnap', () => {
  it('lets every shape but an emanation snap to any cell centre, corner or edge middle', () => {
    for (const shape of ['line', 'cone', 'cube', 'sphere'] as const) expect(resolveOriginSnap(shape, 1)).toBe('any');
  });

  it('centres an emanation on its footprint', () => {
    expect(resolveOriginSnap('emanation', 1)).toBe('cell-center');
    expect(resolveOriginSnap('emanation', 2)).toBe('intersection');
    expect(resolveOriginSnap('emanation', 3)).toBe('cell-center');
  });
});
