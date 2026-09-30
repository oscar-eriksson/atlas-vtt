import React, { useCallback, useEffect, useState } from "react"
import { Trash2 } from "lucide-react"
import { useStore } from "zustand"
import { useHotkeyLabels } from "../../../keyboard/useMapHotkeys"
import { useAtlasStore, useViewStoreHook } from "src/app/react/ViewStoreContext"
import { useAtlasUI } from "src/app/react/root/AtlasUIContext"
import { PlayerWindowService } from "../../../services/PlayerWindowService"
import { runHistoryTransaction } from "../../../stores/history"
import { playerWindowStore } from "../../../stores/playerWindowStore"
import type { TVCalibrationSettings } from "../../../types/viewportTypes"
import { calibratedViewportSize, physicalCmPerSquare } from "../../../utils/viewportPhysicalScale"
import { SettingRow, SettingToggleRow } from "../../../react/components/command-palette/SettingRows"
import { DropdownMenuItem } from "../primitives/DropdownMenuItem"
import { ToolGroup, type ToolGroupControls } from "./ToolGroup"
import { viewportToolFace } from "./toolFaces"

const DEFAULT_CALIBRATION: TVCalibrationSettings = {
  diagonalInches: 55,
  resolutionWidth: 3840,
  resolutionHeight: 2160,
  targetSquareCm: 2.5,
};

/** TV viewport calibration and follow controls. DM only, behind TV_VIEWPORT_ENABLED. */
export function ViewportToolGroup({ activeTool, selectTool, menuOpen, toggleMenu, closeMenu }: ToolGroupControls): React.ReactElement {
  const hotkeyLabel = useHotkeyLabels()
  const { view } = useAtlasUI()
  const settingsService = view?.serviceManager?.getSettingsService()
  const face = viewportToolFace(activeTool)

  const [calibration, setCalibration] = useState<TVCalibrationSettings>(
    () => settingsService?.getTVCalibration() ?? DEFAULT_CALIBRATION,
  )
  useEffect(() => {
    if (!settingsService) return
    setCalibration(settingsService.getTVCalibration())
    return settingsService.onChange((settings) => setCalibration(settings.tvCalibration))
  }, [settingsService])

  const updateCalibration = useCallback(
    (updates: Partial<TVCalibrationSettings>): void => {
      settingsService?.setTVCalibration(updates)
    },
    [settingsService],
  )

  const viewports = useAtlasStore((state) => state.objects.viewports)
  const gridSize = useAtlasStore((state) => state.grid?.size ?? 70)
  const updateViewport = useAtlasStore((state) => state.updateViewport)
  const store = useViewStoreHook()
  const activeRect = Object.values(viewports).find((vp) => vp.active)
  const isFollowingViewport = useStore(playerWindowStore, (s) => s.isFollowingViewport)

  const toggleLocked = useCallback((): void => {
    if (!activeRect) return
    updateViewport(activeRect.id, { locked: !activeRect.locked })
  }, [activeRect, updateViewport])

  // While the active rect is locked to physical scale, its size follows the
  // calibration settings (and the current grid) live — this is what makes
  // editing TV diagonal/resolution/target-square actually resize the rect.
  useEffect(() => {
    if (!activeRect || !activeRect.locked) return
    const { width, height } = calibratedViewportSize(calibration, gridSize)
    if (Math.abs(width - activeRect.width) < 0.01 && Math.abs(height - activeRect.height) < 0.01) return
    const centerX = activeRect.x + activeRect.width / 2
    const centerY = activeRect.y + activeRect.height / 2
    updateViewport(activeRect.id, { x: centerX - width / 2, y: centerY - height / 2, width, height })
  }, [activeRect, calibration, gridSize, updateViewport])

  /** Takes the rectangle off the map; the players' view then follows the DM's camera again. One undo step. */
  const removeViewports = useCallback((): void => {
    runHistoryTransaction(store, () => {
      const { objects, deleteViewport } = store.getState()
      for (const id of Object.keys(objects.viewports)) deleteViewport(id)
    })
    closeMenu()
  }, [store, closeMenu])

  const toggleFollow = useCallback((): void => {
    PlayerWindowService.getInstance()?.toggleViewportFollow()
  }, [])

  const cmPerSquare = activeRect && !activeRect.locked
    ? physicalCmPerSquare(calibration, gridSize, activeRect.width)
    : null

  return (
    <ToolGroup
      face={face}
      shortcut={hotkeyLabel('viewport')}
      menuLabel="TV Viewport Options"
      menuOpen={menuOpen}
      onSelect={() => selectTool(face.tool)}
      onMenuToggle={toggleMenu}
    >
      <div className="atlas-dropdown-section">
        <SettingRow label="TV diagonal (in)">
          <input
            type="number"
            min={1}
            value={calibration.diagonalInches}
            onChange={(e) => updateCalibration({ diagonalInches: Number(e.target.value) })}
          />
        </SettingRow>
        <SettingRow label="Resolution width">
          <input
            type="number"
            min={1}
            value={calibration.resolutionWidth}
            onChange={(e) => updateCalibration({ resolutionWidth: Number(e.target.value) })}
          />
        </SettingRow>
        <SettingRow label="Resolution height">
          <input
            type="number"
            min={1}
            value={calibration.resolutionHeight}
            onChange={(e) => updateCalibration({ resolutionHeight: Number(e.target.value) })}
          />
        </SettingRow>
        <SettingRow label="Target square size (cm)" hint="e.g. 2.5 for 25mm minis">
          <input
            type="number"
            min={0.1}
            step={0.1}
            value={calibration.targetSquareCm}
            onChange={(e) => updateCalibration({ targetSquareCm: Number(e.target.value) })}
          />
        </SettingRow>
      </div>

      <div className="atlas-dropdown-section">
        <SettingToggleRow
          label="Locked to physical scale"
          hint="Off: drag the corner handle to fit the frame to the map instead."
          value={activeRect?.locked ?? true}
          onToggle={toggleLocked}
        />
        {cmPerSquare !== null && (
          <SettingRow label="At this zoom" hint="Real-world size of one grid square on the TV">
            <span>{cmPerSquare.toFixed(1)} cm/square</span>
          </SettingRow>
        )}
        <SettingToggleRow
          label="Follow viewport"
          hint="Player window camera locks onto this rectangle."
          value={isFollowingViewport}
          onToggle={toggleFollow}
        />
      </div>

      {activeRect && (
        <div className="atlas-dropdown-section">
          <DropdownMenuItem icon={Trash2} label="Remove viewport" destructive onClick={removeViewports} />
        </div>
      )}
    </ToolGroup>
  )
}
