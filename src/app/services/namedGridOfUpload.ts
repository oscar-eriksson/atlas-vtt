import { namedGridOf, type NamedGrid } from '../grid/namedGrid';
import { imageDimensions } from '../imageProcessing/imageDimensions';

/**
 * The grid the upload's own file name states ("Tavern 55x42.jpg", "Cave_140pps.png"), in the
 * pixels of the image Atlas saved from it, or null where the name states none. Read from the
 * upload's name, not the name the map is given, which the GM may have changed. A size that
 * cannot be read states nothing: the map is saved all the same and its grid is detected.
 */
export async function namedGridOfUpload(upload: File, saved: Blob): Promise<NamedGrid | null> {
  try {
    const savedSize = await imageDimensions(saved);
    if (!savedSize) return null;
    return namedGridOf(upload.name, savedSize, await imageDimensions(upload));
  } catch (error) {
    console.warn('[Atlas] Could not read the size of an imported map for its named grid', error);
    return null;
  }
}
