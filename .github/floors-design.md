# Floors: several levels in one scene

## What we want

- A scene can have several floors (a dungeon's levels, a tower). The DM switches floor without changing scene.
- All floors share one grid and one camera, so switching floors never moves the screen.
- Fog, area templates, tokens, pins, drawings, text, walls and lights belong to one floor and stay there.
- The players' screen can show a different floor from the one the DM is editing.

## What the code looks like today

- A map file holds one `background` image, one `grid`, and one `objects` record with a collection per kind of
  object (tokens, fog, pins, texts, drawings, walls, lights, audios, templates, viewports).
- Code reads `objects.tokens` and its siblings in over 300 places (tokens alone: 135 reads in 39 files). Giving
  every object a floor id and filtering at each read would touch all of them.
- Undo tracks `objects`, `grid`, `background` and `widgetValues`. Renderers rebuild from the `objects` they are
  given, which is how undo and redo already refresh them.
- The players' window is a render of the DM's scene (see `PlayerFrameRenderer`), not a second scene.

## The approach: `objects` is the active floor

The map file stores a list of floors, each with its own name, background and `objects`. In memory, `objects` and
`background` are always those of the **active** floor, and switching floors swaps them. Everything that reads
`objects` today keeps working without a change, and fog, templates, tokens and the rest belong to a floor because
they live in that floor's `objects`.

The grid, the camera, widgets, initiative and settings are not per floor.

```
floors: [{ id, name }]                        // every floor in order, the active one included
activeFloorId                                 // which floor `objects` and `background` are
floorData: { [id]: { background, objects } }  // the floors that are not active
```

The map file stores exactly this next to the usual top-level `objects` and `background`, which are the active floor's.

A map file from before floors opens as one floor, "Floor 1".

## Decisions to make

1. **Undo across floors.** Undo restores whole `objects` snapshots, so undo after a switch would put another floor's
   objects on this floor. Decided: a separate undo history per floor, swapped with the floor.
2. **Backgrounds of different sizes.** Decided for now: every floor's image starts at the same corner as the
   grid; a per-floor image offset and scale comes later if needed.
3. **Moving a token to another floor.** Decided: a context menu action "Move to floor", and later a stairs
   pin that does it on click.
4. **What players see by default.** Decided: a follow mode (they see the DM's floor) and a select mode (the DM pins them to a floor).

## The players' floor

The players either follow the DM's floor or are kept on a floor the DM chooses (`playerFloorId`, not saved: a scene
always opens with the players following). Nothing is drawn differently: while the DM is on the floor the players are
kept on, frames are live as always; when the DM moves to another floor, the players stay on the last frame of
theirs (`PlayerWindowService` holds a snapshot, the way it does for a scene change), and go live again when the DM
is back on that floor or lets them follow.

This costs no second scene. The one limit: a floor can only be shown to the players by taking the DM to it first
(Show to players switches to it and keeps the players there), because the players' frame is a render of the
DM's scene. What the players see of a floor they are kept on does not update while the DM is away, which is when
nothing on it can change anyway, and a resized player window keeps the old frame until the DM returns.

## Phases

1. **Floors and switching.** Saved form and migration (a new map version), the store's active floor and switch,
   a floor list in the toolbar (add, rename, delete, reorder, a background for each), per-floor undo history.
   Players follow the DM's floor.
2. **Across floors.** Move tokens to another floor, stairs pins, copy and paste between floors.
3. **The players' own floor.** Follow or keep the players on a floor (done, without a second scene).
4. **Polish.** Show the floor below faintly, scene thumbnails and the dashboard, fit-to-view per floor.

## Risks

- **Switching is a scene change in miniature.** Renderers must rebuild cleanly when `objects` is replaced wholesale;
  undo already does this, but a floor switch also changes the background. Phase 1 must be tested on tokens, fog,
  walls and templates being on the right floor after several switches.
- **The saved format.** A new version means older builds cannot read these maps. The fork's map version must be
  checked against upstream's before every merge (see `docs/fork-workflow.md`).
- **Memory.** Floors that are not active are plain data, not display objects, so they cost little. The players'
  second scene in phase 3 is the only place a second set of display objects exists.
