/**
 * Semantic asks → concrete library items. The model says what it wants ("吉他", ["guitar", "music"], a line icon); this
 * ranks both offline libraries with every phrasing at once, so the model never has to know the 3,000 asset ids.
 */
import type { AssetItem } from './assets';

export interface AssetWant { zh?: string; en?: string[] }
export type AssetStyle = 'line' | 'sticker' | 'auto';
const CJK = /[㐀-鿿]/;
const words = (id: string): string[] => id.split('-');

function termScore(a: AssetItem, raw: string): number {
  const t = raw.trim().toLowerCase(); if (!t) return 9;
  if (CJK.test(t)) {
    if (a.cat === 'sticker' && a.zh === raw.trim()) return 0;
    const tags = a.hay.split(/\s+/);
    if (tags.includes(t)) return 1;
    if (a.zh.includes(raw.trim())) return 1.5;
    return a.hay.includes(t) ? 3 : 9;
  }
  const slug = t.replace(/\s+/g, '-');
  if (a.id === slug) return 0;
  const w = words(a.id); const parts = slug.split('-');
  // Shorter names win among partial matches: "guitar" beats "guitar-amp-electric".
  if (parts.every(p => w.includes(p))) return 1 + (w.length - parts.length) * 0.15;
  if (a.id.startsWith(slug)) return 1.6;
  return a.hay.includes(t) ? 3 : 9;
}
/** Library items for a want, best first. A style preference pushes the other library down but never hides it. */
export function rankAssets(all: { stickers: AssetItem[]; lines: AssetItem[] }, want: AssetWant, style: AssetStyle = 'auto', limit = 12): AssetItem[] {
  const terms = [want.zh, ...(want.en ?? [])].filter((x): x is string => !!x && !!x.trim()).slice(0, 6);
  if (!terms.length) return [];
  const scored: [AssetItem, number][] = [];
  for (const a of [...all.lines, ...all.stickers]) {
    let best = 9; terms.forEach((t, i) => { best = Math.min(best, termScore(a, t) + i * 0.3); });
    if (best >= 9) continue;
    if (style !== 'auto' && (style === 'line') !== (a.cat === 'line')) best += 2.5;
    scored.push([a, best]);
  }
  return scored.sort((x, y) => x[1] - y[1]).slice(0, limit).map(([a]) => a);
}
/** A size word or a fraction of the short side → fraction of the short side. */
export function sizeFraction(size: unknown): number {
  if (typeof size === 'number' && Number.isFinite(size)) return Math.min(0.8, Math.max(0.03, size));
  return size === 'xs' ? 0.07 : size === 's' ? 0.11 : size === 'l' ? 0.26 : size === 'xl' ? 0.38 : 0.17;
}
