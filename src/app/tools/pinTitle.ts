/** Longest title a pin shows; longer note names end in an ellipsis. */
export const MAX_PIN_TITLE = 28;

/**
 * The text under a pin: the name of the note it opens, without folders or the `.md` extension, and
 * the heading the link points at after a `#` ("Neverwinter#Mute Lute"). With `headingOnly` a pin that
 * links to a heading shows just that heading (what follows the last `#`). A pin without a note has none.
 */
export function pinTitleOf(notePath: string | undefined, headingOnly = false): string {
  if (!notePath) return '';
  const hash = notePath.indexOf('#');
  const file = hash === -1 ? notePath : notePath.slice(0, hash);
  const name = file.slice(file.lastIndexOf('/') + 1).replace(/\.md$/i, '').trim();
  // A block reference (`#^id`) names no heading to show
  const heading = hash === -1 ? '' : notePath.slice(notePath.lastIndexOf('#') + 1).trim();
  const shown = !heading || heading.startsWith('^') ? name : headingOnly ? heading : `${name}#${heading}`;
  return shown.length > MAX_PIN_TITLE ? `${shown.slice(0, MAX_PIN_TITLE - 1).trimEnd()}…` : shown;
}

/** The sizes titles can take, as a share of their normal size. */
export const PIN_TITLE_SIZES = { min: 0.6, max: 2, step: 0.1, normal: 1 } as const;

/** `size` within the sizes titles can take; the normal size for anything that is no number. */
export function clampPinTitleSize(size: unknown): number {
  if (typeof size !== 'number' || !Number.isFinite(size)) return PIN_TITLE_SIZES.normal;
  return Math.round(Math.min(PIN_TITLE_SIZES.max, Math.max(PIN_TITLE_SIZES.min, size)) * 10) / 10;
}
