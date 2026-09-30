import type { TemplateShape } from '../types/areaTemplateTypes';

/** What the toolbar lets the GM choose before placing a template. */
export interface TemplateToolSettings {
  shape: TemplateShape;
  /** Cells across the creature an emanation spreads from. */
  footprint: number;
  /** Width of a line, in cells. */
  lineWidth: number;
  /** Hex colour of templates placed next; unset uses the theme's accent. */
  color?: string | undefined;
  visibleToPlayers: boolean;
}

export const DEFAULT_TEMPLATE_TOOL_SETTINGS: TemplateToolSettings = {
  shape: 'cone',
  footprint: 1,
  lineWidth: 1,
  visibleToPlayers: true,
};

/** Event on the view's event bus that carries changes to the settings. */
export const TEMPLATE_SETTINGS_EVENT = 'template-settings-changed';
