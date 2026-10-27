/** Google Fonts through the Fontsource mirror: search about 2,000 families online, preview one, install it with a click (needs a network). */
import { requestUrl } from '../harness-ui';

export interface GFont { id: string; family: string; category: string; weights: number[]; variable: boolean; /** Has Chinese, Japanese or Korean glyphs. */ cjk: boolean }
let index: Promise<GFont[]> | undefined;
const MIRRORS = ['https://cdn.jsdelivr.net', 'https://fastly.jsdelivr.net', 'https://gcore.jsdelivr.net'];
const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> => Promise.race([p, new Promise<never>((_, rej) => window.setTimeout(() => rej(new Error('timeout')), ms))]);

/** The catalogue, fetched once per session. Resolves empty when offline so the picker simply shows no online section. */
export function loadGoogleIndex(): Promise<GFont[]> {
  index ??= (async () => {
    try {
      const res = await withTimeout(requestUrl({ url: 'https://api.fontsource.org/v1/fonts', throw: false }), 20_000); if (res.status >= 400) throw new Error(`HTTP ${res.status}`);
      const raw = res.json as { id: string; family: string; subsets: string[]; weights: number[]; category: string; type: string; variable?: boolean }[];
      return raw.filter(f => f.type === 'google' && f.subsets.includes('latin')).map(f => ({ id: f.id, family: f.family, category: f.category, weights: f.weights, variable: !!f.variable, cjk: f.subsets.some(s => s.startsWith('chinese') || s === 'japanese' || s === 'korean') }));
    } catch { index = undefined; return []; }
  })();
  return index;
}
/** The regular weight if there is one, otherwise the nearest. Titles want bold, but a family's own bold file is a separate font. */
export const pickWeight = (f: GFont): number => f.weights.includes(400) ? 400 : [...f.weights].sort((a, b) => Math.abs(a - 400) - Math.abs(b - 400))[0] ?? 400;
export const gfUrls = (f: GFont): string[] => MIRRORS.map(m => `${m}/fontsource/fonts/${f.id}@latest/latin-${pickWeight(f)}-normal.woff2`);
export async function fetchGoogleFont(f: GFont): Promise<ArrayBuffer> {
  let last: unknown;
  for (const url of gfUrls(f)) { try { const res = await withTimeout(requestUrl({ url, throw: false }), 25_000); if (res.status >= 400) throw new Error(`HTTP ${res.status}`); return res.arrayBuffer; } catch (e) { last = e; } }
  throw last instanceof Error ? last : new Error('download-failed');
}
/**
 * What to install. Latin families come as one small woff2. Fontsource cuts CJK families into about a hundred slices, so one
 * file would hold no Chinese at all: those come as the complete font file from the google/fonts repository instead.
 */
export async function fetchGoogleInstall(f: GFont): Promise<{ buf: ArrayBuffer; ext: 'woff2' | 'ttf' | 'otf' }> {
  if (!f.cjk) return { buf: await fetchGoogleFont(f), ext: 'woff2' };
  const dir = f.id.replace(/-/g, ''); let last: unknown = new Error('font-file-not-found');
  for (const licence of ['ofl', 'apache', 'ufl']) {
    const res = await withTimeout(requestUrl({ url: `https://api.github.com/repos/google/fonts/contents/${licence}/${dir}`, throw: false }), 20_000).catch(() => undefined);
    if (!res || res.status >= 400 || !Array.isArray(res.json)) continue;
    const files = (res.json as { name: string; path: string }[]).filter(x => /\.(ttf|otf)$/i.test(x.name) && !/italic/i.test(x.name));
    const pick = files.find(x => /\[wght\]/.test(x.name)) ?? files.find(x => /-Regular\./.test(x.name)) ?? files[0]; if (!pick) continue;
    const path = pick.path.split('/').map(encodeURIComponent).join('/');
    // jsDelivr is fast and reachable in China but refuses GitHub files over 20 MB; GitHub itself always has it.
    for (const url of [...MIRRORS.map(m => `${m}/gh/google/fonts@main/${path}`), `https://github.com/google/fonts/raw/main/${path}`]) {
      try { const r = await withTimeout(requestUrl({ url, throw: false }), 120_000); if (r.status >= 400) throw new Error(`HTTP ${r.status}`); return { buf: r.arrayBuffer, ext: /\.otf$/i.test(pick.name) ? 'otf' : 'ttf' }; } catch (e) { last = e; }
    }
  }
  throw last instanceof Error ? last : new Error('download-failed');
}
export const lookOfCategory = (c: string): 'sans' | 'serif' | 'brush' | 'display' => c === 'serif' ? 'serif' : c === 'handwriting' ? 'brush' : c === 'display' ? 'display' : 'sans';
