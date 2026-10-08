import { Menu, type TFile } from 'obsidian';

export interface ImageMenuAugment {
  /** The vault image a right-click landed on, or null when it landed on none. */
  imageAt: (target: HTMLElement) => TFile | null;
  /** Adds Atlas' items for `file` to a menu that is about to open. */
  addItems: (menu: Menu, file: TFile) => void;
  /** Whether Atlas' items are in the menu already, so they are never added twice. */
  hasItems: (menu: Menu) => boolean;
}

type ShowAtMouseEvent = (this: Menu, event: MouseEvent) => Menu;

function isShowAtMouseEvent(value: unknown): value is ShowAtMouseEvent {
  return typeof value === 'function';
}

/**
 * Makes every menu shown for a right-click on an image carry Atlas' items. Other plugins (Image
 * Converter) cancel the click and show a menu of their own without telling the workspace, so
 * `file-menu` and `editor-menu` never fire for it; the one thing every such menu does is open
 * through `Menu.showAtMouseEvent`. Returns a function that puts the original back.
 */
export function augmentImageMenus(augment: ImageMenuAugment): () => void {
  // Kept to be called on the menu it was taken from, and put back unchanged
  const original: unknown = Object.getOwnPropertyDescriptor(Menu.prototype, 'showAtMouseEvent')?.value;
  if (!isShowAtMouseEvent(original)) return () => undefined;
  Menu.prototype.showAtMouseEvent = function (this: Menu, event: MouseEvent): Menu {
    const target = event.target;
    if (target instanceof HTMLElement && !augment.hasItems(this)) {
      const file = augment.imageAt(target);
      if (file) {
        this.addSeparator();
        augment.addItems(this, file);
      }
    }
    return original.call(this, event);
  };
  return (): void => { Menu.prototype.showAtMouseEvent = original; };
}
