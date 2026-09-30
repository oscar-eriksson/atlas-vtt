import React, { useState } from "react"
import { CircleDot, Dot, Minus, Plus, Square, Triangle, Circle } from "lucide-react"
import { useHotkeyLabels } from "../../../keyboard/useMapHotkeys"
import { DEFAULT_TEMPLATE_TOOL_SETTINGS, TEMPLATE_SETTINGS_EVENT, type TemplateToolSettings } from "../../../tools/templateToolSettings"
import type { TemplateShape } from "../../../types/areaTemplateTypes"
import { DropdownMenuItem } from "../primitives/DropdownMenuItem"
import { DropdownModeSelector } from "../primitives/DropdownModeSelector"
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

/** Area templates that stay on the map: the shape to place, where its origin sits and who sees it. DM only. */
export function TemplateToolGroup({ activeTool, selectTool, menuOpen, toggleMenu }: ToolGroupControls): React.ReactElement {
  const hotkeyLabel = useHotkeyLabels()
  const emit = useEmitViewEvent()
  const [settings, setSettings] = useState<TemplateToolSettings>(DEFAULT_TEMPLATE_TOOL_SETTINGS)
  const face = templateToolFace(activeTool)

  /** The tool keeps its own copy, which it takes from the view's event bus. */
  const update = (changes: Partial<TemplateToolSettings>): void => {
    setSettings(current => ({ ...current, ...changes }))
    emit(TEMPLATE_SETTINGS_EVENT, changes)
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

      <div className="atlas-dropdown-separator"></div>

      <div className="atlas-dropdown-section">
        <div className="space-y-3">
          {settings.shape === "emanation" ? (
            <DropdownSliderRow
              label="Creature size (cells)"
              value={settings.footprint}
              min={1}
              max={6}
              unit=""
              onChange={(footprint) => update({ footprint })}
            />
          ) : (
            <DropdownModeSelector
              label="Origin (Shift flips)"
              value={settings.snap}
              options={[
                { value: "intersection" as const, icon: Plus, label: "Corner" },
                { value: "cell-center" as const, icon: Dot, label: "Cell centre" },
              ]}
              onChange={(snap) => update({ snap })}
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
      </div>

      <div className="atlas-dropdown-separator"></div>

      <div className="atlas-dropdown-section">
        <DropdownToggleRow
          label="Visible to players"
          value={settings.visibleToPlayers}
          onChange={() => update({ visibleToPlayers: !settings.visibleToPlayers })}
        />
      </div>
    </ToolGroup>
  )
}
