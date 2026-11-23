import React, { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowUpDown, Eye, EyeOff, Maximize2, Pin, Trash2 } from "lucide-react"
import { formatGameUnits } from "../../../grid/measurementFormat"
import { t } from "../../../i18n"
import { useHotkeyLabels } from "../../../keyboard/useMapHotkeys"
import { levelObjects } from "../../../levels/levelObjects"
import { hasLevels } from "../../../levels/sceneLevels"
import { measureList } from "../../../measure/keptMeasures"
import { colourWithEffect } from "../../../measure/measureLights"
import { DEFAULT_MEASURE_TOOL, MAX_SPACE } from "../../../measure/measureTypes"
import { useAtlasUI } from "../../../react/root/AtlasUIContext"
import { useAtlasStore } from "../../../react/ViewStoreContext"
import { mapMeasurementSettings } from "../../../services/mapMeasurementSettings"
import { rulesLookup } from "../../../services/mapRules"
import { DropdownMenu } from "../primitives/DropdownMenu"
import { DropdownMenuItem } from "../primitives/DropdownMenuItem"
import { DropdownSwatchGrid } from "../primitives/DropdownSwatchGrid"
import { ToolButton } from "../primitives/ToolButton"
import { TooltipProvider } from "../primitives/tooltip"
import { MEASURE_EFFECT_ICONS, MeasureEffectChips } from "./MeasureEffectChips"
import { MEASURE_COLOR_SWATCHES, MEASURE_MODES, PLAYER_MEASURE_MODES, measureColorOfSwatch, measureModeChoice, swatchOfMeasureColor } from "./measureToolChoices"
import { ChoiceButtons, TOOL_BAR_CHOICE_CLASS, ToolOptionsBars } from "./ToolOptionsBar"
import { useUnavailableMeasureModes } from "./useUnavailableMeasureModes"

interface MeasureToolBarProps {
  /** The players' view measures too, but keeps nothing: it gets the modes alone. */
  playerView: boolean
}

/**
 * The measure tool's bars above the main toolbar while the tool is chosen: what a press measures,
 * and beside it what becomes of a measurement (kept, shown to the players, its look: its colour
 * and, for a kept area, an effect) and the button that clears the kept ones. The second bar is the same in every mode, so nothing moves
 * when the mode changes. Measuring is the same in the session view, so the bars take every choice
 * there. Hidden while the toolbar is arranged.
 */
export function MeasureToolBar({ playerView }: MeasureToolBarProps): React.ReactElement {
  const shown = useAtlasStore((state) => state.activeTool === 'measure' && state.heldRulerFrom === undefined && !state.isToolbarEditing && !state.isMapLoading)
  return <ToolOptionsBars shown={shown}><MeasureBars playerView={playerView} /></ToolOptionsBars>
}

function MeasureBars({ playerView }: MeasureToolBarProps): React.ReactElement {
  const mode = useAtlasStore((state) => state.measureTool.mode)
  const setMeasureTool = useAtlasStore((state) => state.setMeasureTool)
  const unavailable = useUnavailableMeasureModes()
  // Ranges is the GM's to point with: the players' view has no such mode. Left where it can no longer be chosen, the tool takes its first mode.
  const rangesLeft = mode === 'ranges' && (playerView || unavailable(mode) !== null)
  useEffect(() => {
    if (rangesLeft) setMeasureTool({ mode: DEFAULT_MEASURE_TOOL.mode })
  }, [rangesLeft, setMeasureTool])
  return (
    <TooltipProvider delayDuration={300}>
      <div role="toolbar" aria-label={t('toolbar.measureModes')} className="atlas-tool-bar atlas-tool-bar--modes">
        <ChoiceButtons kind="mode" locked={null} choices={playerView ? PLAYER_MEASURE_MODES : MEASURE_MODES} value={measureModeChoice(mode).value} unavailable={unavailable}
          onChange={(value) => setMeasureTool({ mode: value })} />
      </div>
      {!playerView && <MeasurementChoices />}
    </TooltipProvider>
  )
}

/** Keep, Players, the look and Clear: the same four in every mode. */
function MeasurementChoices(): React.ReactElement {
  const keep = useAtlasStore((state) => state.measureTool.keep)
  const players = useAtlasStore((state) => state.measureTool.players)
  const setMeasureTool = useAtlasStore((state) => state.setMeasureTool)
  const clearMeasures = useAtlasStore((state) => state.clearMeasures)
  const anyKept = useAtlasStore((state) => measureList(levelObjects(state).measures).length > 0)
  const levelled = useAtlasStore((state) => hasLevels(state.levels))
  const hotkeyLabel = useHotkeyLabels()
  // A scene without levels has no level to name.
  const clearTip = levelled ? t('toolbar.measureClearTip') : t('toolbar.measureClearAllTip')
  const nothingKept = levelled ? t('toolbar.measureNothingKeptOnLevel') : t('toolbar.measureNothingKept')
  return (
    <div role="toolbar" aria-label={t('toolbar.measureChoices')} className="atlas-tool-bar atlas-tool-bar--tools">
      <ToolButton
        icon={Pin}
        label={t('toolbar.measureKeep')}
        shortcut={hotkeyLabel('measureKeep')}
        subtitle={t('toolbar.measureKeepTip')}
        isActive={keep}
        pressed={keep}
        onClick={() => setMeasureTool({ keep: !keep })}
        className={TOOL_BAR_CHOICE_CLASS}
      />
      <ToolButton
        icon={players ? Eye : EyeOff}
        label={t('toolbar.measurePlayers')}
        isActive={players}
        pressed={players}
        onClick={() => setMeasureTool({ players: !players })}
        className={TOOL_BAR_CHOICE_CLASS}
      />
      <MeasureLook />
      <MeasureSize />
      <MeasureRise />
      <ToolButton
        icon={Trash2}
        label={t('toolbar.measureClear')}
        subtitle={anyKept ? clearTip : nothingKept}
        isActive={false}
        disabled={!anyKept}
        onClick={clearMeasures}
      />
    </div>
  )
}

/** The widths a line is offered in, in cells. */
const LINE_WIDTHS: readonly number[] = [0.5, 1, 2, 3, 4, 5, 6]

/** The lengths a cone with a height is offered in, in cells. */
const CONE_LENGTHS: readonly number[] = [1, 2, 3, 4, 6, 8, 10, 12, 18, 24]

/** The size the button stands for as it shows it, so what is chosen can be read without opening the menu: a creature "2×2", a line "↔1", a cone "60ft". */
function SizeIcon(): React.ReactElement {
  const space = useAtlasStore((state) => state.measureTool.space)
  const width = useAtlasStore((state) => state.measureTool.lineWidth)
  const coneLength = useAtlasStore((state) => state.measureTool.coneLength)
  const mode = useAtlasStore((state) => state.measureTool.mode)
  const written = useDistanceText()
  const text = mode === 'line' ? `↔${width}` : mode === 'cone' ? written(coneLength) : `${space}×${space}`
  return <span className="atlas-tool-bar__text" aria-hidden="true">{text}</span>
}

/**
 * The size of what the next measurement is made around: the creature an emanation reaches out
 * from, or the width of a line. Always on the bar, and shown but not to be chosen in the other modes.
 */
function MeasureSize(): React.ReactElement {
  const space = useAtlasStore((state) => state.measureTool.space)
  const width = useAtlasStore((state) => state.measureTool.lineWidth)
  const coneLength = useAtlasStore((state) => state.measureTool.coneLength)
  const rise = useAtlasStore((state) => state.measureTool.rise)
  const mode = useAtlasStore((state) => state.measureTool.mode)
  const setMeasureTool = useAtlasStore((state) => state.setMeasureTool)
  const written = useDistanceText()
  const [open, setOpen] = useState(false)
  const toggle = useCallback((): void => setOpen((before) => !before), [])
  const line = mode === 'line'
  // A cone is sized by its drag, unless it starts above the floor: then its drag only aims it.
  const cone = mode === 'cone'
  const usable = line || mode === 'emanation' || (cone && rise > 0)
  const label = line ? t('measure.lineWidth') : cone ? t('measure.coneLength') : t('measure.space')
  const choices = line ? LINE_WIDTHS : cone ? CONE_LENGTHS : Array.from({ length: MAX_SPACE }, (_, index) => index + 1)
  const chosen = line ? width : cone ? coneLength : space
  const named = (size: number): string => (line ? t('measure.widthCells', { count: size }) : cone ? written(size) : t('measure.spaceCells', { count: size }))
  const idle = cone ? t('measure.coneLengthNeedsHeight') : t('measure.sizeNeedsMode')
  return (
    <DropdownMenu
      isOpen={open && usable}
      onToggle={toggle}
      label={label}
      position="top"
      align="center"
      triggerButton={
        <ToolButton icon={SizeIcon} label={label} subtitle={usable ? named(chosen) : idle} isActive={false} disabled={!usable} menuExpanded={open && usable} onClick={() => undefined} />
      }
    >
      <div className="atlas-dropdown-section">
        {choices.map((size) => (
          <DropdownMenuItem key={size} icon={Maximize2} label={named(size)} isActive={size === chosen}
            onClick={() => {
              setMeasureTool(line ? { lineWidth: size } : cone ? { coneLength: size } : { space: size })
              setOpen(false)
            }} />
        ))}
      </div>
    </DropdownMenu>
  )
}

/** The height differences offered, in cells: what a measurement across a height is given. */
const RISES: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 20]

/** What the map writes a distance of `cells` as: "20ft". */
function useDistanceText(): (cells: number) => string {
  const { app } = useAtlasUI()
  const rules = useMemo(() => rulesLookup(app), [app])
  const unitType = useAtlasStore((state) => mapMeasurementSettings(rules, state).unitType)
  const unitName = useAtlasStore((state) => mapMeasurementSettings(rules, state).unitName)
  const unitDistance = useAtlasStore((state) => mapMeasurementSettings(rules, state).unitDistance)
  return useCallback((cells: number): string => formatGameUnits(cells * unitDistance, { unitType, ...(unitName !== undefined && { unitName }) }), [unitType, unitName, unitDistance])
}

/** The height difference chosen, as the button that opens the choices shows it: "↑20ft". */
function RiseIcon(): React.ReactElement {
  const rise = useAtlasStore((state) => state.measureTool.rise)
  const written = useDistanceText()
  return <span className="atlas-tool-bar__text" aria-hidden="true">{`↑${written(rise)}`}</span>
}

/**
 * How far above or below the start the next measurement ends, for a map without tokens at its
 * ends: a ruler counts it in its length, and an area, whose size is its true distance, lies on the
 * floor as far as that distance reaches along it.
 */
function MeasureRise(): React.ReactElement {
  const rise = useAtlasStore((state) => state.measureTool.rise)
  const mode = useAtlasStore((state) => state.measureTool.mode)
  const setMeasureTool = useAtlasStore((state) => state.setMeasureTool)
  const written = useDistanceText()
  const [open, setOpen] = useState(false)
  const toggle = useCallback((): void => setOpen((before) => !before), [])
  const usable = mode !== 'ranges'
  const label = t('measure.rise')
  const named = (cells: number): string => (cells === 0 ? t('measure.riseLevel') : written(cells))
  return (
    <DropdownMenu
      isOpen={open && usable}
      onToggle={toggle}
      label={label}
      position="top"
      align="center"
      triggerButton={
        <ToolButton icon={RiseIcon} label={label} subtitle={named(rise)} isActive={false} disabled={!usable} menuExpanded={open && usable} onClick={() => undefined} />
      }
    >
      <div className="atlas-dropdown-section">
        {RISES.map((cells) => (
          <DropdownMenuItem key={cells} icon={ArrowUpDown} label={named(cells)} isActive={cells === rise}
            onClick={() => {
              setMeasureTool({ rise: cells })
              setOpen(false)
            }} />
        ))}
      </div>
    </DropdownMenu>
  )
}

/** The look the next measurement takes, as the look button shows it: a dot of its colour, or the glyph of the effect chosen in that colour. */
function MeasureLookIcon(): React.ReactElement {
  const color = useAtlasStore((state) => state.measureTool.color)
  const effect = useAtlasStore((state) => state.measureTool.effect)
  if (!effect) return <span className="atlas-tool-bar__dot" style={{ backgroundColor: swatchOfMeasureColor(color) }} />
  const Glyph = MEASURE_EFFECT_ICONS[effect]
  return <Glyph style={{ color: swatchOfMeasureColor(color) }} />
}

/**
 * The button that opens the look above the bar: the colours, and the effect the next kept area is
 * drawn with. An effect brings its usual colour (`colourWithEffect`), which the swatches then
 * change; a colour closes the menu, an effect leaves it open for that.
 */
function MeasureLook(): React.ReactElement {
  const color = useAtlasStore((state) => state.measureTool.color)
  const effect = useAtlasStore((state) => state.measureTool.effect)
  const setMeasureTool = useAtlasStore((state) => state.setMeasureTool)
  const [open, setOpen] = useState(false)
  const toggle = useCallback((): void => setOpen((before) => !before), [])
  return (
    <DropdownMenu
      isOpen={open}
      onToggle={toggle}
      label={t('measure.look')}
      position="top"
      align="center"
      // The wrapper around the trigger takes the click.
      triggerButton={<ToolButton icon={MeasureLookIcon} label={t('measure.look')} isActive={false} menuExpanded={open} onClick={() => undefined} />}
    >
      <div className="atlas-dropdown-section">
        <DropdownSwatchGrid
          label={t('toolbar.colour')}
          swatches={MEASURE_COLOR_SWATCHES}
          value={swatchOfMeasureColor(color)}
          onChange={(swatch) => {
            setMeasureTool({ color: measureColorOfSwatch(swatch) })
            setOpen(false)
          }}
        />
        <MeasureEffectChips labelled value={effect} color={color} onChange={(next) => setMeasureTool(next ? { effect: next, color: colourWithEffect(color, effect, next) } : { effect: null })} />
      </div>
    </DropdownMenu>
  )
}
