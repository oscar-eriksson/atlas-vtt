import { FuzzySuggestModal, type App, type TFile } from 'obsidian';
import { t } from '../i18n';
import { IMAGE_EXTENSIONS } from './imageExtensions';

/** Asks for one of the vault's images by name. Resolves with the file, or `null` when dismissed. */
export class ImageFilePicker extends FuzzySuggestModal<TFile> {
  private picked: TFile | null = null;
  private resolvePicked: ((file: TFile | null) => void) | null = null;

  constructor(app: App) {
    super(app);
    this.setPlaceholder(t('command.pickImage'));
  }

  prompt(): Promise<TFile | null> {
    return new Promise((resolve) => {
      this.resolvePicked = resolve;
      this.open();
    });
  }

  getItems(): TFile[] {
    return this.app.vault.getFiles().filter((file) => IMAGE_EXTENSIONS.includes(file.extension.toLowerCase()));
  }

  getItemText(file: TFile): string {
    return file.path;
  }

  onChooseItem(file: TFile): void {
    this.picked = file;
  }

  onClose(): void {
    // Obsidian closes the modal before it calls onChooseItem, so the answer waits a tick
    window.setTimeout(() => {
      this.resolvePicked?.(this.picked);
      this.resolvePicked = null;
    }, 0);
  }
}
