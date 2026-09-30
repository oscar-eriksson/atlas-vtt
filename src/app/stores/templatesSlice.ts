/**
 * Actions for the map's area templates. Each is a single store write, so it is
 * one undo step and one map save.
 */

import type { AreaTemplate } from '../types/areaTemplateTypes';

/** What a new template needs; the store adds its id. */
export type AreaTemplateInput = Omit<AreaTemplate, 'id'>;

export interface TemplatesSlice {
  /** Adds the template, selects nothing, and returns its new id. */
  addTemplate: (input: AreaTemplateInput) => string;
  updateTemplate: (id: string, changes: Partial<Omit<AreaTemplate, 'id'>>) => void;
  deleteTemplate: (id: string) => void;
}

interface TemplatesStoreState {
  objects: { templates: Record<string, AreaTemplate> };
  selectedIds: string[];
}

type ImmerSet = (fn: (draft: TemplatesStoreState) => void) => void;

export function createTemplatesActions(set: ImmerSet): TemplatesSlice {
  return {
    addTemplate: (input) => {
      const id = `template_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      set((draft) => {
        draft.objects.templates[id] = { ...input, id };
      });
      return id;
    },

    updateTemplate: (id, changes) => set((draft) => {
      const template = draft.objects.templates[id];
      if (template) Object.assign(template, changes);
    }),

    deleteTemplate: (id) => set((draft) => {
      delete draft.objects.templates[id];
      draft.selectedIds = draft.selectedIds.filter(selectedId => selectedId !== id);
    }),
  };
}
