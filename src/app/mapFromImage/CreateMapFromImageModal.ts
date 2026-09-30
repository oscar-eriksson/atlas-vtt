import { Modal, Setting, type App } from 'obsidian';
import { ATLAS_NATIVE_MODAL_CLASSES } from '../ui/nativeModal';

export interface MapImageChoice {
  name: string;
  collectionId: string;
}

export interface CreateMapFromImageOptions {
  collections: readonly { id: string; name: string }[];
  defaultCollectionId: string;
  defaultName: string;
  /** Whether the collection already has a scene with this name. */
  isNameTaken: (collectionId: string, name: string) => boolean;
}

/** Asks what to call the new map and which collection it goes in. Resolves with the choice, or `null` when dismissed. */
export class CreateMapFromImageModal extends Modal {
  private choice: MapImageChoice | null = null;
  private resolveChoice: ((choice: MapImageChoice | null) => void) | null = null;
  private name: string;
  private collectionId: string;

  constructor(app: App, private readonly options: CreateMapFromImageOptions) {
    super(app);
    this.name = options.defaultName;
    this.collectionId = options.collections.some(c => c.id === options.defaultCollectionId)
      ? options.defaultCollectionId
      : (options.collections[0]?.id ?? options.defaultCollectionId);
  }

  prompt(): Promise<MapImageChoice | null> {
    return new Promise((resolve) => {
      this.resolveChoice = resolve;
      this.open();
    });
  }

  onOpen(): void {
    const { contentEl, options } = this;
    this.modalEl.addClass(...ATLAS_NATIVE_MODAL_CLASSES);
    this.setTitle('Create Atlas map');

    let problem: HTMLElement;
    let create: HTMLButtonElement;
    const validate = (): void => {
      const name = this.name.trim();
      const message = !name ? 'Give the map a name.' : options.isNameTaken(this.collectionId, name) ? `A scene named "${name}" already exists in this collection.` : '';
      problem.setText(message);
      create.disabled = message !== '';
    };
    const submit = (): void => {
      if (create.disabled) return;
      this.choice = { name: this.name.trim(), collectionId: this.collectionId };
      this.close();
    };

    new Setting(contentEl).setName('Name').addText(text => {
      text.setValue(this.name).onChange((value) => { this.name = value; validate(); });
      text.inputEl.addEventListener('keydown', (event) => { if (event.key === 'Enter') submit(); });
      window.setTimeout(() => { text.inputEl.focus(); text.inputEl.select(); }, 0);
    });
    new Setting(contentEl).setName('Collection').addDropdown(dropdown => {
      for (const { id, name } of options.collections) dropdown.addOption(id, name);
      dropdown.setValue(this.collectionId).onChange((value) => { this.collectionId = value; validate(); });
    });
    problem = contentEl.createDiv({ cls: 'mod-warning' });

    new Setting(contentEl)
      .addButton(button => button.setButtonText('Cancel').onClick(() => this.close()))
      .addButton(button => {
        create = button.buttonEl;
        button.setButtonText('Create').setCta().onClick(submit);
      });
    validate();
  }

  onClose(): void {
    this.contentEl.empty();
    this.resolveChoice?.(this.choice);
    this.resolveChoice = null;
  }
}
