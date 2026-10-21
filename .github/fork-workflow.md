# Working on this fork

This fork is Atlas VTT as upstream ships it, plus the features its owner plays with. It is **not** sent upstream:
upstream did not take these changes, so the fork keeps them itself and follows upstream by rebasing.

## Remotes

- `origin` is upstream, `ByteMirror/atlas-vtt` (now `atlas-vtt/atlas-vtt`).
- `fork` is this fork, `oscar-eriksson/atlas-vtt`.

## One branch

`main` is `origin/beta` with the fork's commits on top, in a straight line:

TV viewport, area templates, create-map-from-image (right-click menu and command), map rotation on import,
floors, pin titles, and the statblock import's status filter. The fork's own notes (this file, the floors design)
are commits in the same line.

New work is a commit on `main` (or a short branch merged by fast-forward). Keep each feature in its own commits,
so a feature that upstream ships itself can be dropped later.

## Taking in upstream

1. `git fetch origin`
2. Back up: `git tag backup/pre-<upstream version> main`
3. `git rebase origin/beta main`. Do it commit by commit and keep these in mind:
   - Upstream renames things under the fork's commits. A commit whose job upstream now does itself is skipped
     (`git rebase --skip`), as happened with the scene-creation move, floors' background swap and the `%20` image
     paths.
   - Toolbar controls take their label and description from `t('toolbarEdit.<id>.label')` and `.description`
     (English and Russian in `src/app/i18n/locales/*/toolbarEdit.ts`).
   - Messages go through `showNotice` (`src/app/ui/notice.ts`); a lint rule rejects `new Notice`.
   - `changelog/Unreleased.md` conflicts every time: keep upstream's file and add only this commit's lines, then
     `npm run changelog:generate`.
   - `rerere` is on, so a conflict fixed once is fixed the same way next time.
4. `npm install`, `npx tsc --noEmit -p .`, `npm run lint`, `npx vitest run --project unit`, `npm run build`
5. Look at the map in Obsidian, then `git push --force-with-lease fork main`.

Which upstream branch to follow: `beta`, since that is what the fork started from. `main` is the stable release.

## Maps

An upstream build drops the `templates`, `viewports` and `floors` it does not know when it saves a map, so do not
open this fork's maps with an upstream build.
