import React from "react"
import { ImageIcon, Layers, Monitor, Pencil, Plus, Trash2, Users } from "lucide-react"
import { useAtlasStore, useViewStoreHook } from "src/app/react/ViewStoreContext"
import { useAtlasUI } from "src/app/react/root/AtlasUIContext"
import { setFloorImage } from "../../../floors/setFloorImage"
import { ChoiceModal } from "../../../plugin/ChoiceModal"
import { removeFloorWithHistory, showFloorToPlayers, switchFloorWithHistory } from "../../../stores/floorsSlice"
import { promptForText } from "../../../ui/textInputDialog"
import { DropdownMenuItem } from "../primitives/DropdownMenuItem"
import { ToolGroup, type ToolGroupControls } from "./ToolGroup"

/**
 * The floors of the scene: the button goes to the next floor, the menu picks one, says which floor the players see
 * (the DM's, or one they are kept on), and adds, renames, sets the image of, or deletes the floor in use. DM only.
 */
export function FloorToolGroup({ activeTool, menuOpen, toggleMenu, closeMenu }: ToolGroupControls): React.ReactElement {
  const { app } = useAtlasUI()
  const store = useViewStoreHook()
  const floors = useAtlasStore(state => state.floors)
  const activeFloorId = useAtlasStore(state => state.activeFloorId)
  const playerFloorId = useAtlasStore(state => state.playerFloorId)
  const active = floors.find(floor => floor.id === activeFloorId) ?? floors[0]!
  const next = floors[(floors.findIndex(floor => floor.id === active.id) + 1) % floors.length]!

  const add = (): void => {
    switchFloorWithHistory(store, store.getState().addFloor())
    closeMenu()
  }

  const rename = async (): Promise<void> => {
    closeMenu()
    const name = await promptForText({ title: "Rename floor", confirmLabel: "Rename", initialValue: active.name })
    if (name) store.getState().renameFloor(active.id, name)
  }

  const chooseImage = (): void => {
    closeMenu()
    void setFloorImage(app, store)
  }

  const remove = async (): Promise<void> => {
    closeMenu()
    const confirmed = await new ChoiceModal<true>(app, {
      title: `Delete ${active.name}`,
      message: [`Delete ${active.name} with everything on it: its tokens, fog, drawings, pins, templates and image?`],
      hint: "Undo cannot bring a deleted floor back.",
      buttons: [{ text: "Delete floor", value: true, variant: "warning" }],
    }).prompt()
    if (confirmed) removeFloorWithHistory(store, active.id)
  }

  return (
    <ToolGroup
      face={{ icon: Layers, label: active.name, tool: activeTool, isActive: false }}
      shortcut=""
      menuLabel="Floors"
      menuOpen={menuOpen}
      onSelect={() => switchFloorWithHistory(store, next.id)}
      onMenuToggle={toggleMenu}
    >
      <div className="atlas-dropdown-section">
        {floors.map(floor => (
          <DropdownMenuItem
            key={floor.id}
            icon={Layers}
            label={floor.name}
            isActive={floor.id === active.id}
            onClick={() => {
              switchFloorWithHistory(store, floor.id)
              closeMenu()
            }}
          />
        ))}
      </div>

      <div className="atlas-dropdown-separator"></div>

      <div className="atlas-dropdown-section">
        <DropdownMenuItem
          icon={Users}
          label="Players follow my floor"
          isActive={playerFloorId === null}
          onClick={() => {
            store.getState().setPlayerFloor(null)
            closeMenu()
          }}
        />
        {floors.map(floor => (
          <DropdownMenuItem
            key={floor.id}
            icon={Monitor}
            label={`Show ${floor.name} to players`}
            isActive={floor.id === playerFloorId}
            onClick={() => {
              showFloorToPlayers(store, floor.id)
              closeMenu()
            }}
          />
        ))}
      </div>

      <div className="atlas-dropdown-separator"></div>

      <div className="atlas-dropdown-section">
        <DropdownMenuItem icon={Plus} label="Add floor" onClick={add} />
        <DropdownMenuItem icon={ImageIcon} label="Set floor image…" onClick={chooseImage} />
        <DropdownMenuItem icon={Pencil} label="Rename floor…" onClick={() => void rename()} />
      </div>

      {floors.length > 1 && (
        <div className="atlas-dropdown-section">
          <DropdownMenuItem icon={Trash2} label="Delete floor…" destructive onClick={() => void remove()} />
        </div>
      )}
    </ToolGroup>
  )
}
