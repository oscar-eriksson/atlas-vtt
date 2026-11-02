# Working on this fork

This fork is Atlas VTT as upstream ships it, plus the features its owner plays with. It is **not** sent upstream:
upstream did not take these changes, so the fork keeps them itself and follows upstream by rebasing.

## Remotes

- `upstream` is Atlas VTT, `atlas-vtt/atlas-vtt` (formerly `ByteMirror/atlas-vtt`).
- `origin` is this fork, `oscar-eriksson/atlas-vtt`.

## One branch

`main` is upstream's stable release (`upstream/main`, currently 0.12.1) with the fork's commits on top, in a straight
line: area templates, create-map-from-image (right-click menu and command), map rotation on import, pin titles, the
statblock import's status filter, the grid read from a map's file name and the Size tab of Grid Alignment. The
fork's own notes (this file) are commits in the same line.

The TV viewport and floors that the fork once had are gone: upstream ships both itself (TrueScale and scene levels),
and the fork uses those.

New work is a commit on `main` (or a short branch merged by fast-forward). Keep each feature in its own commits,
so a feature that upstream ships itself can be dropped later.

## Taking in upstream

The fork follows upstream's `main`, which holds one squashed commit per release. Upstream develops on `beta`; the
fork does not follow it, so it only moves when a release is out.

1. `git fetch upstream`
2. Back up: `git tag backup/pre-<upstream version> main`
3. `git rebase --onto upstream/main <the release the fork sits on> main`. The release is the commit the fork's first
   commit was put on (`git log --oneline upstream/main` shows them); use its hash, not `upstream/main`, or the
   rebase replays every release in between. Do it commit by commit and keep these in mind:
   - Upstream renames things under the fork's commits. A commit whose job upstream now does itself is skipped.
   - Objects belong to a level: a new kind of map object extends `OnOneLevel`, is placed with
     `placedOnViewedLevel` and is read with `levelObjects(state)` (a lint rule rejects `state.objects.<kind>`).
   - Toolbar controls take their label and description from `t('toolbarEdit.<id>.label')` and `.description`
     (English and Russian in `src/app/i18n/locales/*/toolbarEdit.ts`).
   - Messages go through `showNotice` (`src/app/ui/notice.ts`); a lint rule rejects `new Notice`.
   - `changelog/Unreleased.md` conflicts every time: keep upstream's file and add only this commit's lines, then
     `npm run changelog:generate`. The fork's version is `<next upstream version>-beta.N`.
   - `rerere` is on, so a conflict fixed once is fixed the same way next time.
4. `npm install`, `npx tsc --noEmit -p .`, `npm run lint`, `npx vitest run --project unit`, `npm run build`
5. Look at the map in Obsidian, then `git push --force-with-lease origin main`.

## Maps

An upstream build drops the `templates` it does not know when it saves a map, so do not open this fork's maps
with an upstream build.
