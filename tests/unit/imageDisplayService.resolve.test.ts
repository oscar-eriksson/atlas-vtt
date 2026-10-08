import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/app/react/root/ContextMenuContext', () => ({ openContextMenuGlobal: vi.fn() }));

import { ImageDisplayService } from '../../src/app/services/ImageDisplayService';

const files = ['10 - Kallor/img/001-map-sc.webp', 'img/001-map-sc.webp', 'notes/001-map-sc.md'].map((path) => ({ path, extension: path.split('.').pop()! }));

function service(): { imageFileEndingTheSrc: (src: string) => { path: string } | null } {
  const app = { workspace: {}, vault: { getFiles: () => files } } as never;
  return new ImageDisplayService(app) as never;
}

describe('which vault image an img src names', () => {
  it('finds it from its path wherever the vault lies, through spaces, a query and a link #subpath', () => {
    const src = 'app://abc123/home/ubuntu/Documents/dnd%20vault/10%20-%20Kallor/img/001-map-sc.webp?1791484125#gallery';
    expect(service().imageFileEndingTheSrc(src)?.path).toBe('10 - Kallor/img/001-map-sc.webp');
  });

  it('prefers the longest path when two images end the same way', () => {
    expect(service().imageFileEndingTheSrc('app://x/vault/img/001-map-sc.webp')?.path).toBe('img/001-map-sc.webp');
  });

  it('finds nothing for a file that is not an image of the vault', () => {
    expect(service().imageFileEndingTheSrc('app://x/vault/notes/001-map-sc.md')).toBeNull();
    expect(service().imageFileEndingTheSrc('data:image/png;base64,AAAA')).toBeNull();
  });
});
