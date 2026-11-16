# Working on this fork

This fork is Atlas VTT as upstream ships it, plus the features its owner plays with. It is **not** sent upstream:
upstream did not take these changes, so the fork keeps them itself and follows upstream by rebasing.

## Remotes

- `origin` is Atlas VTT, `atlas-vtt/atlas-vtt` (formerly `ByteMirror/atlas-vtt`).
- `fork` is this fork, `oscar-eriksson/atlas-vtt`.

## One branch

`main` is upstream's stable release (`origin/main`, currently 0.16.0) with the fork's commits on top, in a straight
line: create-map-from-image (right-click menu and command), the statblock import's count filters, the grid read from
a map's file name, the Size tab of Grid Alignment, moving a level's image under the grid (with ghosts of the levels
next to it), a TrueScale toggle (Shift+K and the command palette), the command that shows or hides every pin's name,
and a ring for timers in the player view. Opening scenes the fork saved before it took upstream's levels
(`forkSceneMigration.ts`) is one too. The fork's own notes (this file) are commits in the same line.

Area templates, map rotation on import, pin titles, floors and the TV viewport are gone: upstream ships the same
itself (the Measure tool's areas, TrueScale's turn, pin names, scene levels, TrueScale), and the fork uses those.

New work is a commit on `main`. Keep each feature in its own commits, so a feature that upstream ships itself can
be dropped later.

## Taking in upstream

Upstream's `main` holds the stable releases, merged from `release/x.y.z`; it develops on `beta`, which the fork does
not follow.

1. `git fetch origin`
2. Back up: `git tag backup/pre-<upstream version> main`
3. Cherry-pick the fork's commits (`git log --oneline <the release the fork sits on>..main`, oldest first) onto a
   branch of `origin/main`, leaving out the ones upstream now does itself, then move `main` there. Keep in mind:
   - Objects belong to a level: a new kind of map object extends `OnOneLevel`, is placed with
     `placedOnViewedLevel` and is read with `levelObjects(state)` (a lint rule rejects `state.objects.<kind>`).
   - Toolbar controls take their label and description from `t('toolbarEdit.<id>.label')` and `.description`
     (English and Russian in `src/app/i18n/locales/*/toolbarEdit.ts`).
   - Messages go through `showNotice` (`src/app/ui/notice.ts`); a lint rule rejects `new Notice`.
   - Upstream deletes `changelog/Unreleased.md` with each release: the fork's lines go back into a new one, then
     `npm run changelog:generate`. The fork's release notes are its own `changelog/<version>.md`.
   - Hotkeys must not clash with upstream's (`src/app/keyboard/mapHotkeys.ts`).
   - `rerere` is on, so a conflict fixed once is fixed the same way next time.
4. `npx tsc --noEmit -p .`, `npm run lint`, `npx vitest run --project unit`, `npm run build`
5. Look at the map in Obsidian, then `git push --force-with-lease fork main`.

## Releasing

Bump the version in `package.json`, `manifest.json` and `versions.json`, move `changelog/Unreleased.md` to
`changelog/<version>.md` (with its frontmatter), build, push, and publish the release on the fork with
`main.js`, `manifest.json` and `styles.css` from `dist/`.
