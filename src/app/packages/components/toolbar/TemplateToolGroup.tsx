import React, { useState } from "react"
import { CircleDot, Minus, Square, Triangle, Circle } from "lucide-react"
import { useAtlasStore, useViewStoreHook } from "src/app/react/ViewStoreContext"
import { useHotkeyLabels } from "../../../keyboard/useMapHotkeys"
import { runHistoryTransaction } from "../../../stores/history"
import { TEMPLATE_COLORS } from "../../../templates/templateColors"
import { DEFAULT_TEMPLATE_TOOL_SETTINGS, TEMPLATE_SETTINGS_EVENT, type TemplateToolSettings } from "../../../tools/templateToolSettings"
import type { TemplateShape } from "../../../types/areaTemplateTypes"
import { DropdownMenuItem } from "../primitives/DropdownMenuItem"
import { DropdownSliderRow } from "../primitives/DropdownSliderRow"
import { DropdownToggleRow } from "../primitives/DropdownToggleRow"
import { ToolGroup, type ToolGroupControls } from "./ToolGroup"
import { templateToolFace } from "./toolFaces"
import { useEmitViewEvent } from "./useEmitViewEvent"

const SHAPE_OPTIONS: readonly { shape: TemplateShape; icon: typeof Minus; label: string }[] = [
  { shape: "line", icon: Minus, label: "Line" },
  { shape: "cone", icon: Triangle, label: "Cone" },
  { shape: "cube", icon: Square, label: "Cube" },
  { shape: "sphere", icon: Circle, label: "Sphere" },
  { shape: "emanation", icon: CircleDot, label: "Emanation" },
]

/** Area templates that stay on the map: the shape to place, its colour and who sees it. DM only. */
export function TemplateToolGroup({ activeTool, selectTool, menuOpen, toggleMenu }: ToolGroupControls): React.ReactElement {
  const hotkeyLabel = useHotkeyLabels()
  const emit = useEmitViewEvent()
  const store = useViewStoreHook()
  /** The colour of the selected templates, `theme` for the accent or `mixed`; none when no template is selected. */
  const selectedColor = useAtlasStore((state): string | null => {
    const picked = state.selectedIds.flatMap(id => state.objects.templates[id] ?? [])
    if (picked.length === 0) return null
    return picked.every(template => template.color === picked[0]!.color) ? (picked[0]!.color ?? "theme") : "mixed"
  })
  const [settings, setSettings] = useState<TemplateToolSettings>(DEFAULT_TEMPLATE_TOOL_SETTINGS)
  const face = templateToolFace(activeTool)
  /** Only a line and an emanation have a size to set before placing. */
  const hasSizeOptions = settings.shape === "line" || settings.shape === "emanation"
  /** The swatch to mark: what the selection has, or else what the next template gets. */
  const shownColor = selectedColor ?? settings.color ?? "theme"

  /** The tool keeps its own copy, which it takes from the view's event bus. */
  const update = (changes: Partial<TemplateToolSettings>): void => {
    setSettings(current => ({ ...current, ...changes }))
    emit(TEMPLATE_SETTINGS_EVENT, changes)
  }

  /** The colour applies to the selected templates and to the ones placed next; no colour is the theme's accent. */
  const chooseColor = (color: string | undefined): void => {
    update({ color })
    runHistoryTransaction(store, () => {
      const { selectedIds, objects, updateTemplate } = store.getState()
      for (const id of selectedIds) if (objects.templates[id]) updateTemplate(id, { color })
    })
  }

  return (
    <ToolGroup
      face={face}
      shortcut={hotkeyLabel('template')}
      menuLabel="Area Template Options"
      menuOpen={menuOpen}
      onSelect={() => selectTool(face.tool)}
      onMenuToggle={toggleMenu}
    >
      <div className="atlas-dropdown-section">
        {SHAPE_OPTIONS.map(({ shape, icon, label }) => (
          <DropdownMenuItem
            key={shape}
            icon={icon}
            label={label}
            isActive={face.isActive && settings.shape === shape}
            onClick={() => {
              update({ shape })
              selectTool(face.tool)
            }}
          />
        ))}
      </div>

      {hasSizeOptions && <div className="atlas-dropdown-separator"></div>}

      {hasSizeOptions && <div className="atlas-dropdown-section">
        <div className="space-y-3">
          {settings.shape === "emanation" && (
            <DropdownSliderRow
              label="Creature size (cells)"
              value={settings.footprint}
              min={1}
              max={6}
              unit=""
              onChange={(footprint) => update({ footprint })}
            />
          )}
          {settings.shape === "line" && (
            <DropdownSliderRow
              label="Width (cells)"
              value={settings.lineWidth}
              min={1}
              max={4}
              unit=""
              onChange={(lineWidth) => update({ lineWidth })}
            />
          )}
        </div>
      </div>}

      <div className="atlas-dropdown-separator"></div>

      <div className="atlas-dropdown-section">
        <div className="atlas-template-swatches" role="group" aria-label="Template colour">
          <button
            type="button"
            className="atlas-template-swatch"
            aria-label="Theme colour"
            aria-pressed={shownColor === "theme"}
            onClick={() => chooseColor(undefined)}
          />
          {TEMPLATE_COLORS.map(({ hex, label }) => (
            <button
              key={hex}
              type="button"
              className="atlas-template-swatch"
              style={{ "--swatch": hex } as React.CSSProperties}
              aria-label={label}
              aria-pressed={shownColor === hex}
              onClick={() => chooseColor(hex)}
            />
          ))}
        </div>
        <DropdownToggleRow
          label="Visible to players"
          value={settings.visibleToPlayers}
          onChange={() => update({ visibleToPlayers: !settings.visibleToPlayers })}
        />
      </div>
    </ToolGroup>
  )
}
