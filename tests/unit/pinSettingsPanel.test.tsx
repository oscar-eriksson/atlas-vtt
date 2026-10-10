import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const titles = vi.hoisted(() => ({ on: false, size: 1, setOn: null as null | ((show: boolean) => void) }));

vi.mock('../../src/app/keyboard/useMapHotkeys', () => ({
  useAtlasSettings: () => ({
    getShowPinTitles: () => titles.on,
    setShowPinTitles: (show: boolean) => { titles.setOn?.(show); },
    getPinTitleSize: () => titles.size,
    setPinTitleSize: vi.fn(),
  }),
}));

import { PinSettingsPanel } from '../../src/app/react/components/command-palette/PinSettingsPanel';

afterEach(() => {
  cleanup();
  titles.on = false;
  titles.size = 1;
  titles.setOn = null;
});

describe('PinSettingsPanel', () => {
  it('offers the titles as a switch and turns the setting on from it', () => {
    const setOn = vi.fn();
    titles.setOn = setOn;
    render(<PinSettingsPanel />);
    const toggle = screen.getByRole('switch', { name: 'Show pin titles' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(toggle);
    expect(setOn).toHaveBeenCalledWith(true);
  });

  it('offers the size only while titles are shown, and reads it as a percentage', () => {
    const { rerender } = render(<PinSettingsPanel />);
    expect(screen.queryByText('Title size')).toBeNull();

    titles.on = true;
    titles.size = 1.5;
    rerender(<PinSettingsPanel />);
    expect(screen.getByText('Title size')).toBeTruthy();
    expect(screen.getByText('150%')).toBeTruthy();
  });
});
