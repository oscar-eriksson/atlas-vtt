import { FuzzySuggestModal, type App } from 'obsidian';
import { ATLAS_NATIVE_MODAL_CLASSES } from '../ui/nativeModal';

/** A map image a floor can be given: one Atlas already has as a map, or an image of the vault it would import. */
export type FloorImageChoice =
  | { kind: 'map'; name: string; path: string }
  | { kind: 'image'; name: string; path: string };

/** Picks the image of a floor from the maps of the asset library and the images of the vault. Resolves with the choice, or `null` when dismissed. */
export class FloorImageModal extends FuzzySuggestModal<FloorImageChoice> {
  private choice: FloorImageChoice | null = null;
  private resolveChoice: ((choice: FloorImageChoice | null) => void) | null = null;

  constructor(app: App, private readonly choices: readonly FloorImageChoice[]) {
    super(app);
    this.setPlaceholder('Choose an image for this floor');
  }

  prompt(): Promise<FloorImageChoice | null> {
    return new Promise((resolve) => {
      this.resolveChoice = resolve;
      this.open();
    });
  }

  onOpen(): void {
    void super.onOpen();
    this.modalEl.addClass(...ATLAS_NATIVE_MODAL_CLASSES);
  }

  getItems(): FloorImageChoice[] {
    return [...this.choices];
  }

  getItemText(choice: FloorImageChoice): string {
    return choice.kind === 'map' ? `Map · ${choice.name}` : `Image · ${choice.path}`;
  }

  onChooseItem(choice: FloorImageChoice): void {
    this.choice = choice;
  }

  onClose(): void {
    super.onClose();
    // Obsidian closes the modal before it reports the choice, so settle once that has run.
    window.setTimeout(() => {
      this.resolveChoice?.(this.choice);
      this.resolveChoice = null;
    }, 0);
  }
}
