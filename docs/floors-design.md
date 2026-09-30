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

While the DM and the players are on the same floor, nothing changes: the players' frame is rendered from the DM's
scene. When they are on different floors, the players' floor is not in the DM's scene at all (`objects` is the
DM's floor). Because the DM is editing another floor, the players' floor stays as it is until the DM switches
to it, so it can be a scene of its own built once from the saved floor and redrawn only when that floor changes.
`PlayerView` shows the pieces already exist to run a second scene from a second store. This is the largest and
least certain part, so it comes last.

## Phases

1. **Floors and switching.** Saved form and migration (a new map version), the store's active floor and switch,
   a floor list in the toolbar (add, rename, delete, reorder, a background for each), per-floor undo history.
   Players follow the DM's floor.
2. **Across floors.** Move tokens to another floor, stairs pins, copy and paste between floors.
3. **The players' own floor.** A second scene for a floor the DM is not on, and a control to pin the players.
4. **Polish.** Show the floor below faintly, scene thumbnails and the dashboard, fit-to-view per floor.

## Risks

- **Switching is a scene change in miniature.** Renderers must rebuild cleanly when `objects` is replaced wholesale;
  undo already does this, but a floor switch also changes the background. Phase 1 must be tested on tokens, fog,
  walls and templates being on the right floor after several switches.
- **The saved format.** A new version means older builds cannot read these maps. The fork's map version must be
  checked against upstream's before every merge (see `docs/fork-workflow.md`).
- **Memory.** Floors that are not active are plain data, not display objects, so they cost little. The players'
  second scene in phase 3 is the only place a second set of display objects exists.
