function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** `objects` without its `viewports`, which older maps kept there. */
function withoutViewports(objects: unknown): unknown {
  if (!isRecord(objects) || !('viewports' in objects)) return objects;
  const { viewports: _moved, ...rest } = objects;
  return rest;
}

/**
 * Maps from before floors kept the TV viewports among the objects of the scene, and a map saved by an earlier
 * build of floors among the objects of the active floor. They belong to the table: every floor shows them at
 * the same place, so they are a property of the scene. Moves them there, and out of every floor's objects.
 */
export function hoistLegacyViewports(saved: Record<string, unknown>): Record<string, unknown> {
  const legacy = isRecord(saved.objects) ? saved.objects.viewports : undefined;
  const floorData = isRecord(saved.floorData)
    ? Object.fromEntries(Object.entries(saved.floorData).map(([id, floor]) =>
      [id, isRecord(floor) ? { ...floor, objects: withoutViewports(floor.objects) } : floor]))
    : undefined;
  return {
    ...saved,
    viewports: saved.viewports ?? legacy ?? {},
    ...(saved.objects !== undefined && { objects: withoutViewports(saved.objects) }),
    ...(floorData !== undefined && { floorData }),
  };
}
