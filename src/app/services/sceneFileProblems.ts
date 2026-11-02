import { type App, type TFile } from 'obsidian';
import { t } from '../i18n';
import { showNotice } from '../ui/notice';
import { isForkSceneState } from './forkSceneMigration';

/** Why an existing scene file cannot be loaded, in the words the GM reads. */
export const SCENE_FILE_PROBLEM = {
  unreadable: 'The scene file could not be read',
  invalidJson: 'The scene file is not valid JSON',
  structure: 'The scene file has an unexpected structure',
  newer: 'The scene was saved by a newer version of Atlas VTT',
} as const;

export class SceneFileError extends Error {
  constructor(readonly problem: keyof typeof SCENE_FILE_PROBLEM) {
    super(SCENE_FILE_PROBLEM[problem]);
  }
}

/** Problems that leave a file the user may want to recover by hand, as the backup notice words them. */
const DAMAGED_FILE_REASONS: Partial<Record<SceneFileError['problem'], string>> = {
  invalidJson: 'invalid JSON',
  structure: 'unexpected structure',
};

/**
 * Keeps a copy of a scene file whose content is damaged, so whatever the user could
 * still recover from it survives whatever happens to the file next.
 */
export async function preserveDamagedSceneFile(app: App, file: TFile, error: SceneFileError): Promise<void> {
  const reason = DAMAGED_FILE_REASONS[error.problem];
  if (!reason) return;
  const backupPath = `${file.path}.${Date.now()}.bak`;
  try {
    await app.vault.copy(file, backupPath);
    showNotice(t('map.readFailed', { file: file.name, reason, backup: backupPath }), 0);
  } catch (copyError) {
    console.error(`[AtlasStorage] Could not back up ${file.path}:`, copyError);
  }
}

/**
 * Keeps a copy of a scene this fork saved before it took upstream's levels (`isForkSceneState`)
 * before it is read as a plain scene and saved over, since that drops its floors and TV frames.
 * One copy per file: a later open finds it there.
 */
export async function backUpForkScene(app: App, file: TFile, content: string): Promise<void> {
  // Cheap check on the start of the file first: the version follows the schema
  if (!/"version"\s*:\s*[6-9]\b/.test(content.slice(0, 600))) return;
  try {
    const state = (JSON.parse(content) as { state?: object | null }).state;
    if (!state || !isForkSceneState(state)) return;
    const backupPath = `${file.path}.fork.bak`;
    if (app.vault.getAbstractFileByPath(backupPath)) return;
    await app.vault.copy(file, backupPath);
    showNotice(t('map.forkSceneBackedUp', { file: file.name, backup: backupPath }));
  } catch (error) {
    console.error(`[AtlasStorage] Could not back up ${file.path}:`, error);
  }
}
