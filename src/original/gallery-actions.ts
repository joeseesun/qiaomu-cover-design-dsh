import type { ImageJob } from './imagejobs';
/** Resolve stable binary IDs at action time; deleting a sibling changes array indices. */
export function pictureIndex(job: ImageJob, storageIndex: number): number {
  const index = job.pictures?.findIndex((pic, i) => (pic.storageIndex ?? i) === storageIndex) ?? -1;
  if (index < 0) throw Error('Image unavailable');
  return index;
}
export interface RemovableEntry { id: string; remove?: () => Promise<void> }
/** Sequential writes protect shared task manifests. Failed items remain selected for retry. */
export async function removeGalleryEntries(entries: RemovableEntry[], onRemoved: (id: string) => void): Promise<{ removed: number; failed: number }> {
  let removed = 0, failed = 0;
  for (const entry of entries) {
    if (!entry.remove) continue;
    try { await entry.remove(); onRemoved(entry.id); removed++; } catch { failed++; }
  }
  return { removed, failed };
}
