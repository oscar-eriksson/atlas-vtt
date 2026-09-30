import type { EventEmitter } from 'events';
import { DEFAULT_TEMPLATE_TOOL_SETTINGS, TEMPLATE_SETTINGS_EVENT, type TemplateToolSettings } from './templateToolSettings';

/** Holds the area template tool's settings, which the toolbar changes through the view's event bus. */
export class TemplateTool {
  private settings: TemplateToolSettings = { ...DEFAULT_TEMPLATE_TOOL_SETTINGS };
  private readonly onSettingsChanged = (changes: Partial<TemplateToolSettings>): void => {
    this.settings = { ...this.settings, ...changes };
  };

  constructor(private readonly eventBus: EventEmitter) {
    eventBus.on(TEMPLATE_SETTINGS_EVENT, this.onSettingsChanged);
  }

  getSettings(): Readonly<TemplateToolSettings> {
    return this.settings;
  }

  destroy(): void {
    this.eventBus.off(TEMPLATE_SETTINGS_EVENT, this.onSettingsChanged);
  }
}
