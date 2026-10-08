import { afterEach, describe, expect, it, vi } from 'vitest';
import { Menu } from 'obsidian';
import { augmentImageMenus } from '../../src/app/services/imageMenuAugment';

const file = { path: 'img/map.webp' } as never;
let restore: (() => void) | null = null;
afterEach(() => restore?.());

function event(target: HTMLElement): MouseEvent {
  return { target } as unknown as MouseEvent;
}

describe('menus shown for an image', () => {
  it('carry Atlas items, after a separator, even when another plugin shows the menu itself', () => {
    const shown = vi.fn();
    Menu.prototype.showAtMouseEvent = function (): Menu { shown(); return this; };
    const addItems = vi.fn();
    restore = augmentImageMenus({ imageAt: () => file, addItems, hasItems: () => false });
    const menu = new Menu();
    menu.addSeparator = vi.fn().mockReturnValue(menu);

    menu.showAtMouseEvent(event(document.createElement('img')));

    expect(addItems).toHaveBeenCalledWith(menu, file);
    expect(menu.addSeparator).toHaveBeenCalled();
    expect(shown).toHaveBeenCalled();
  });

  it('are left alone when the click was on no image or the items are already there', () => {
    Menu.prototype.showAtMouseEvent = function (): Menu { return this; };
    const addItems = vi.fn();
    let has = false;
    let image: unknown = null;
    restore = augmentImageMenus({ imageAt: () => image as never, addItems, hasItems: () => has });

    new Menu().showAtMouseEvent(event(document.createElement('div')));
    image = file;
    has = true;
    new Menu().showAtMouseEvent(event(document.createElement('img')));

    expect(addItems).not.toHaveBeenCalled();
  });

  it('puts the original method back', () => {
    const original = function (this: Menu): Menu { return this; };
    Menu.prototype.showAtMouseEvent = original;
    augmentImageMenus({ imageAt: () => null, addItems: vi.fn(), hasItems: () => false })();
    expect(Menu.prototype.showAtMouseEvent).toBe(original);
  });
});
