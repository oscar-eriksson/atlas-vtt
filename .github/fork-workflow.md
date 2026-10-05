# Working on this fork

This fork's `main` is upstream's `beta` plus the features in the `feature/*` branches, so the game build has
everything. The feature branches stay separate so each can still become a pull request to upstream, or be
dropped once upstream ships its own version.

## Remotes

- `origin` is upstream, `ByteMirror/atlas-vtt`.
- `fork` is this fork, `oscar-eriksson/atlas-vtt`.

## Branches

The features are a stack, each branch on top of the one before:

`origin/beta` → `feature/tv-viewport` → `feature/area-templates` → `feature/create-map-from-image`
→ `feature/player-second-render` → `feature/floors`

The toolbar no longer has a feature branch of its own: upstream shipped the toolbar editor in 0.6.0, and every
control here is registered in its catalog (`src/app/toolbar/toolbarCatalog.ts`).

`feature/tv-viewport-pr` is the pull request for the TV viewport: one clean commit on `origin/beta`, kept apart from
the stack's work-in-progress copy. Once upstream merges it, drop the copy in the stack by rebasing the rest onto
`origin/beta`.

`main` is the stack up to `feature/player-second-render` plus this file; `feature/floors` is still on top of it. A new feature branches from `main`, and once it works it is merged
back into `main`. A feature meant for upstream is moved onto `origin/beta` for its pull request:
`git rebase --onto origin/beta <the branch below it> <the feature>`.

Rebasing the whole stack: `git rebase --onto origin/beta <old base> feature/floors --update-refs` moves every branch
that points into the stack. That includes any backup branch you made, so back up with a tag
(`git tag backup/<name> <branch>`), which `--update-refs` leaves alone, or rely on the `fork/*` refs.

## Taking in upstream

1. `git fetch origin`
2. Look at `ATLAS_VERSION` in `src/app/services/MapPersistence.ts` on `origin/beta`. This fork saves maps at its own
   version (TV viewports at 5, area templates at 6, floors at 7, viewports out of the floor's objects at 8). If upstream used the same number for something else, renumber
   ours before merging, or maps will be read wrongly.
3. `git switch main && git merge origin/beta`
4. Fix conflicts. `rerere` is on, so a conflict fixed once is fixed the same way next time. The files both sides
   change most are `storeFactory.ts`, `MapPersistence.ts`, `MainToolbar.tsx`, `PixiRendererOrchestrator.ts` and
   `PlayerWindowService.ts`.
5. `npm run build:ci`, `npx vitest run` and `npx tsc --noEmit -p .`
6. `git push fork main`, then tag a build that is known to work before a game night.

If upstream merges a feature that is also here, merge it in and delete this fork's copy of it.

## Maps

An upstream build drops the `templates` and `viewports` it does not know when it saves a map, so do not open this
fork's maps with an upstream build.
