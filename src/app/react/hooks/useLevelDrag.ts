import { useEffect, useRef } from 'react';
import type { AlignmentPoint } from '../../pixi/GridAlignmentController';

/**
 * Left presses on the map canvas become a drag that the map's own tools never hear of: the press,
 * its moves and its release are taken on the window in the capture phase. `onMove` is handed how far
 * the pointer is from where it was pressed, in the world; `onEnd` follows the release. Right-drags
 * stay the map's, so panning works as ever.
 */
export function useLevelDrag(
  active: boolean,
  toWorld: ((clientX: number, clientY: number) => AlignmentPoint) | null,
  onStart: () => void,
  onMove: (delta: AlignmentPoint) => void,
  onEnd: () => void,
): void {
  const handlers = useRef({ toWorld, onStart, onMove, onEnd });
  handlers.current = { toWorld, onStart, onMove, onEnd };

  useEffect(() => {
    if (!active) return undefined;
    let from: AlignmentPoint | null = null;

    const own = (event: PointerEvent): boolean => from !== null && event.button !== 2;
    const down = (event: PointerEvent): void => {
      const { toWorld: world, onStart: start } = handlers.current;
      if (event.button !== 0 || !world || (event.target as HTMLElement | null)?.tagName !== 'CANVAS') return;
      event.stopImmediatePropagation();
      from = world(event.clientX, event.clientY);
      start();
    };
    const move = (event: PointerEvent): void => {
      const { toWorld: world, onMove: moved } = handlers.current;
      if (!own(event) || !world || !from) return;
      event.stopImmediatePropagation();
      const now = world(event.clientX, event.clientY);
      moved({ x: now.x - from.x, y: now.y - from.y });
    };
    const up = (event: PointerEvent): void => {
      if (!own(event)) return;
      event.stopImmediatePropagation();
      from = null;
      handlers.current.onEnd();
    };

    window.addEventListener('pointerdown', down, true);
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', up, true);
    return () => {
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', up, true);
    };
  }, [active]);
}
