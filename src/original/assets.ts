/**
 * Offline sticker and icon library. `assets/pack.json.gz` (built by scripts/build-asset-pack.py) holds about 1,200 Fluent Emoji
 * Flat stickers (MIT, Microsoft) with Chinese names and tags, and about 1,900 Lucide line icons (ISC). It ships beside main.js and
 * is embedded in main.js for official installs and also shipped on disk in the ZIP. Insertion never needs a network;
 * copyright and full permission notices are included in the bundle and assets/licenses.
 */
import { normalizePath, type App } from '../harness-ui';
import { lucideZh } from './lucidezh';
import bundledPack from '../assets/pack.json.gz';

export type AssetCat = 'sticker' | 'line';
export interface AssetItem { id: string; cat: AssetCat; zh: string; /** Lower-cased searchable text, Chinese and English. */ hay: string; body: string }
interface Pack { emoji: [string, string, string, string, string][]; line: [string, string][] }

export const ASSET_CATS: { id: AssetCat; zh: string; en: string; license: string }[] = [
  { id: 'sticker', zh: '贴纸表情', en: 'Stickers', license: 'Fluent Emoji · MIT' }, { id: 'line', zh: '线性图标', en: 'Line icons', license: 'Lucide · ISC' },
];
/** Chinese quick tags for line icons, whose names are English only. Stickers search Chinese directly. */
const LINE_ZH: Record<string, string> = {
  箭头: 'arrow', 对勾: 'check', 星星: 'star', 爱心: 'heart', 火: 'flame', 灯泡: 'lightbulb', 皇冠: 'crown', 奖杯: 'trophy', 书: 'book', 电脑: 'laptop', 手机: 'smartphone', 相机: 'camera',
  时间: 'clock', 搜索: 'search', 设置: 'settings', 用户: 'user', 邮件: 'mail', 位置: 'map-pin', 日历: 'calendar', 文件: 'file', 链接: 'link', 下载: 'download', 上传: 'upload',
  播放: 'play', 音乐: 'music', 图片: 'image', 锁: 'lock', 钱: 'wallet', 购物: 'shopping', 礼物: 'gift', 云: 'cloud', 太阳: 'sun', 月亮: 'moon', 闪电: 'zap', 盾牌: 'shield',
  点赞: 'thumbs-up', 评论: 'message', 分享: 'share', 书签: 'bookmark', 标签: 'tag', 旗帜: 'flag', 警告: 'alert', 提示: 'info', 问号: 'help', 加号: 'plus', 关闭: 'x', 圆: 'circle',
};
const clean = (s: string): string => s.toLowerCase().trim();

let cache: Promise<{ stickers: AssetItem[]; lines: AssetItem[] }> | undefined;
/** Loads and unpacks the library once. Resolves empty when the file is missing, so the panel can say so instead of failing. */
export function loadAssets(app: App, dir: string): Promise<{ stickers: AssetItem[]; lines: AssetItem[] }> {
  cache ??= (async () => {
    try {
      // The official installer only downloads main.js, manifest.json and styles.css.
      // Full ZIP installs can keep their disk copy; store installs use the identical bundled bytes.
      const buf = await app.vault.adapter.readBinary(normalizePath(`${dir}/assets-pack.json.gz`)).catch(() => bundledPack.slice().buffer as ArrayBuffer);
      const text = await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
      const pack = JSON.parse(text) as Pack;
      return {
        stickers: pack.emoji.map(([id, zh, zhTags, en, body]): AssetItem => ({ id, cat: 'sticker', zh, hay: clean(`${zh} ${zhTags} ${en} ${id.replace(/-/g, ' ')}`), body })),
        lines: pack.line.map(([id, body]): AssetItem => ({ id, cat: 'line', zh: id.replace(/-/g, ' '), hay: clean(`${id.replace(/-/g, ' ')} ${lucideZh(id)}`), body })),
      };
    } catch { cache = undefined; return { stickers: [], lines: [] }; }
  })();
  return cache;
}

/** Stickers people reach for most on covers; shown first when nothing has been typed. */
const PINNED = ['fire', 'red-heart', 'rocket', 'light-bulb', 'sparkles', 'star', 'crown', 'trophy', 'party-popper', 'gift', 'check-mark-button', 'cross-mark', 'warning', 'thumbs-up', 'eyes', 'brain', 'money-bag', 'gem-stone', 'hundred-points', 'collision', 'high-voltage', 'bullseye', 'megaphone', 'bell', 'books', 'laptop', 'memo', 'magnifying-glass-tilted-left', 'camera', 'musical-note', 'rainbow', 'sun', 'cloud', 'seedling', 'coffee', 'pizza', 'cat-face', 'robot', 'alarm-clock', 'locked'];
export function searchAssets(all: { stickers: AssetItem[]; lines: AssetItem[] }, cat: AssetCat, query: string): AssetItem[] {
  const pool = cat === 'sticker' ? all.stickers : all.lines;
  let q = clean(query);
  if (!q) {
    if (cat !== 'sticker') return pool.slice(0, 400);
    const rank = new Map(PINNED.map((id, i) => [id, i])); const first = PINNED.map(id => pool.find(p => p.id === id)).filter((p): p is AssetItem => !!p);
    return [...first, ...pool.filter(p => !rank.has(p.id))];
  }
  // Line icons carry Chinese tags from their name's words; the short list still maps the most common asks to the best icon.
  if (cat === 'line' && /[㐀-鿿]/.test(q)) q = LINE_ZH[query.trim()] ?? (pool.some(p => p.hay.includes(q)) ? q : Object.entries(LINE_ZH).find(([k]) => query.includes(k))?.[1] ?? q);
  const score = (p: AssetItem): number => p.zh === query.trim() || p.id === q ? 0 : p.zh.includes(query.trim()) ? 1 : p.id.includes(q.replace(/\s+/g, '-')) ? 2 : p.hay.includes(q) ? 3 : 9;
  return pool.map(p => [p, score(p)] as const).filter(([, s]) => s < 9).sort((a, b) => a[1] - b[1]).map(([p]) => p);
}

/** Standalone SVG text for an item. Line icons take the colour you pass. */
export function assetSvg(a: AssetItem, color = '#171717'): string {
  return a.cat === 'sticker'
    ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${a.body}</svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${a.body.replace(/currentColor/g, color)}</svg>`;
}
export const assetThumb = (a: AssetItem): string => `data:image/svg+xml;utf8,${encodeURIComponent(assetSvg(a))}`;
