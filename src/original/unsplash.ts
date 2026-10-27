/** Unsplash search for background photos. Needs the user's own free Access Key (https://unsplash.com/developers). */
import { requestUrl, type App } from '../harness-ui';

export interface Photo { id: string; thumb: string; regular: string; author: string; authorUrl: string; page: string; download: string; color: string }
/** Reads the key from Obsidian's secret storage. `secretId` is the name the user picked in settings. */
export function unsplashKey(app: App, secretId: string): string {
  if (!secretId) return '';
  try { return app.secretStorage.getSecret(secretId) ?? ''; } catch { return ''; }
}
const UTM = 'utm_source=qiaomu_cover_design&utm_medium=referral';
/** Where requests go: the user's own key talks to Unsplash directly; a proxy (see server/unsplash-proxy.js) holds the key itself. */
export interface Source { key: string; proxy: string }
const base = (src: Source): string => (src.proxy.trim().replace(/\/+$/, '') || 'https://api.unsplash.com');
const auth = (src: Source): Record<string, string> => src.proxy.trim() ? {} : { Authorization: `Client-ID ${src.key}`, 'Accept-Version': 'v1' };
export const hasSource = (src: Source): boolean => !!src.key || !!src.proxy.trim();
export async function searchPhotos(src: Source, query: string, page = 1): Promise<Photo[]> {
  const q = query.trim();
  const url = q ? `${base(src)}/search/photos?query=${encodeURIComponent(q)}&per_page=24&page=${page}&orientation=landscape` : `${base(src)}/photos?per_page=24&page=${page}&order_by=popular`;
  const res = await requestUrl({ url, headers: auth(src), throw: false });
  if (res.status === 401) throw new Error('key');
  if (res.status === 403) throw new Error('limit');
  if (res.status >= 400) throw new Error(`HTTP ${res.status}`);
  const rows = (q ? (res.json as { results: unknown[] }).results : res.json as unknown[]) as { id: string; color?: string; urls: { small: string; regular: string }; user: { name: string; links: { html: string } }; links: { html: string; download_location: string } }[];
  return rows.map(r => ({ id: r.id, thumb: r.urls.small, regular: r.urls.regular, author: r.user.name, authorUrl: `${r.user.links.html}?${UTM}`, page: `${r.links.html}?${UTM}`, download: r.links.download_location, color: r.color ?? '#e5e5e5' }));
}
/** Downloads the 1080px version and pings Unsplash's download endpoint, as their API terms ask. */
export async function downloadPhoto(src: Source, p: Photo): Promise<Blob> {
  const res = await requestUrl({ url: p.regular, throw: false }); if (res.status >= 400) throw new Error(`HTTP ${res.status}`);
  const ping = src.proxy.trim() ? p.download.replace('https://api.unsplash.com', base(src)) : p.download;
  void requestUrl({ url: ping, headers: auth(src), throw: false }).catch(() => undefined);
  return new Blob([res.arrayBuffer], { type: 'image/jpeg' });
}
