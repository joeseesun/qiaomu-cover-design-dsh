/**
 * Getting the default font library onto a fresh install. Obsidian installs only main.js, manifest.json and styles.css, so the
 * fonts come from the font repository on first run: silently, most-needed first, each file checked against its SHA-256 and
 * written into the plugin folder. Mirrors are tried in order; a font that fails is retried on the next launch. Pure apart from
 * the injected I/O, so the plan and the retry logic run in tests.
 */
import type { BundledFont } from './fonts';

export function fontMirrors(repo: string, version: string): string[] {
  return [
    ...['cdn', 'fastly', 'gcore', 'testingcf'].map(h => `https://${h}.jsdelivr.net/gh/${repo}@${version}/`),
    `https://raw.githubusercontent.com/${repo}/${version}/`,
  ];
}
/** Files still to fetch: most-needed first (priority 1 = default templates), smaller first within a priority. */
export function syncPlan(fonts: BundledFont[], present: Set<string>): BundledFont[] {
  return fonts.filter(f => !present.has(f.id)).sort((a, b) => a.priority - b.priority || a.bytes - b.bytes);
}
export interface SyncIO {
  fetch(url: string): Promise<ArrayBuffer>;
  sha256(data: ArrayBuffer): Promise<string>;
  write(path: string, data: ArrayBuffer): Promise<void>;
}
/** Downloads one font (and its licence text) from the first mirror that serves bytes matching the manifest. */
export async function fetchFont(f: BundledFont, mirrors: string[], io: SyncIO): Promise<void> {
  let last: unknown = new Error('no-mirror');
  for (const base of mirrors) {
    try {
      const data = await io.fetch(`${base}fonts/${encodeURIComponent(f.file)}`);
      if (data.byteLength !== f.bytes || await io.sha256(data) !== f.sha256) throw new Error('checksum');
      await io.write(`fonts/${f.file}`, data);
      // OFL asks for the licence to travel with the font; it is small and its loss must never block the font itself.
      try { await io.write(`fonts/licenses/${f.id}.txt`, await io.fetch(`${base}licenses/${encodeURIComponent(f.id)}.txt`)); } catch { /* the repository keeps it */ }
      return;
    } catch (e) { last = e; }
  }
  throw last instanceof Error ? last : new Error(String(last));
}
/**
 * Fetches every missing font with a small worker pool. `onReady` fires per font; `onPriorityDone` once when the default
 * templates' fonts are all in (or failed), so open covers can re-pair early instead of waiting for the whole library.
 */
export async function syncFonts(o: { plan: BundledFont[]; mirrors: string[]; io: SyncIO; fetchOne?: (f: BundledFont) => Promise<void>; onReady(f: BundledFont): void; onPriorityDone?(): void; concurrency?: number }): Promise<{ failed: string[] }> {
  const queue = [...o.plan]; const failed: string[] = [];
  const firstBatch = new Set(o.plan.filter(f => f.priority === 1).map(f => f.id)); let announced = !firstBatch.size;
  // Callbacks redraw the UI; whatever they throw must never stop the downloads.
  const notify = (fn?: () => void): void => { try { fn?.(); } catch (e) { console.error('[qiaomu-cover] font sync callback failed', e); } };
  const settle = (f: BundledFont): void => { firstBatch.delete(f.id); if (!announced && !firstBatch.size) { announced = true; notify(o.onPriorityDone); } };
  const worker = async (): Promise<void> => {
    for (let f = queue.shift(); f; f = queue.shift()) {
      try { await (o.fetchOne ? o.fetchOne(f) : fetchFont(f, o.mirrors, o.io)); } catch { failed.push(f.id); settle(f); continue; }
      notify(() => o.onReady(f));
      settle(f);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, o.concurrency ?? 2) }, worker));
  if (!announced) notify(o.onPriorityDone);
  return { failed };
}
