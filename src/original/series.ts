/**
 * Account consistency and A/B choices, as pure data: a "series" is a saved look (layout, colours, faces) the user keeps
 * reusing so their profile page reads as one account; `pickVariants` chooses layouts that are genuinely different from the
 * current one, steered by what the copy is (a number, a question, a list), so an A/B set is a real choice.
 */
import type { Palette } from './templates';

export interface Series { id: string; name: string; template: string; palette: Partial<Palette>; titleFont?: string; bodyFont?: string }
export const MAX_SERIES = 6;
const HEX = /^#[\da-f]{6}$/i;
const KEYS: (keyof Palette)[] = ['bg', 'bg2', 'ink', 'sub', 'accent', 'accentInk'];

/** Keeps only well-formed series from stored data. */
export function mergeSeries(raw: unknown): Series[] {
  if (!Array.isArray(raw)) return [];
  const out: Series[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue; const s = r as Record<string, unknown>;
    if (typeof s.id !== 'string' || typeof s.template !== 'string' || !s.template) continue;
    const palette: Partial<Palette> = {}; const p = (s.palette && typeof s.palette === 'object' ? s.palette : {}) as Record<string, unknown>;
    for (const k of KEYS) if (typeof p[k] === 'string' && HEX.test(p[k] as string)) palette[k] = (p[k] as string).toLowerCase();
    out.push({ id: s.id, name: typeof s.name === 'string' && s.name.trim() ? s.name.trim().slice(0, 24) : s.template, template: s.template, palette,
      ...(typeof s.titleFont === 'string' && s.titleFont ? { titleFont: s.titleFont } : {}), ...(typeof s.bodyFont === 'string' && s.bodyFont ? { bodyFont: s.bodyFont } : {}) });
  }
  return out.slice(0, MAX_SERIES);
}
/** Adds a series at the front; the same layout with the same colours replaces its older copy instead of piling up. */
export function addSeries(list: Series[], s: Series): Series[] {
  const same = (a: Series): boolean => a.template === s.template && KEYS.every(k => (a.palette[k] ?? '') === (s.palette[k] ?? ''));
  return [s, ...list.filter(a => !same(a))].slice(0, MAX_SERIES);
}
/** The assistant's briefing: the saved looks, first one is the default. */
export function seriesPrompt(list: Series[]): string {
  if (!list.length) return '';
  const rows = list.map((s, k) => `- ${k === 0 ? '【默认】' : ''}${s.name}：template=${s.template}，palette=${JSON.stringify(s.palette)}${s.titleFont ? `，titleFont=${s.titleFont}` : ''}${s.bodyFont ? `，bodyFont=${s.bodyFont}` : ''}`).join('\n');
  return `\n# 我的系列（账号统一风格）\n用户把下面的风格存成了固定系列，主页要看起来像同一个账号。做新封面（design）时默认沿用【默认】系列：照抄它的 template、palette 和字体，只换文案；内容明显是另一类（例如清单 / 问答 / 系列头图）时，选最贴近的另一个系列。只有用户明确说“换个风格 / 不要系列”时才自由选择。\n${rows}\n`;
}

/** Broad look of each layout. Variants come from different families, so an A/B set never shows three near-identical covers. */
export const FAMILY: Record<string, 'type' | 'paper' | 'object' | 'number' | 'gradient'> = {
  highlight: 'type', brush: 'type', frame: 'type', kicker: 'type', interview: 'type', mega: 'type', bold: 'type', poster: 'type', stack: 'type', folio: 'type', minimal: 'type', swiss: 'type', keyword: 'type', pop: 'type',
  sage: 'paper', calm: 'paper', mag: 'paper', newspaper: 'paper', memo: 'paper', seal: 'paper', print: 'paper', collage: 'paper', riso: 'paper',
  notes: 'object', chat: 'object', regeng: 'object', calendar: 'object', corner: 'object', window: 'object', ticket: 'object', polaroid: 'object', bili: 'object', split: 'object', bento: 'object', serial: 'object', neo: 'object',
  numeral: 'number', number: 'number',
  acid: 'gradient', glass: 'gradient', aurora: 'gradient', photo: 'gradient',
};
export interface Copy { title: string; subtitle?: string; points?: string[] }
/** Layouts the words themselves ask for: a number wants a numeral, a question wants a chat, a list wants a checklist. */
export function contentHints(c: Copy): string[] {
  const out: string[] = []; const title = c.title.replace(/\s+/g, '');
  if (/\d/.test(title)) out.push('numeral', 'number');
  if (/[?？]/.test(c.subtitle ?? '') || /[?？]$/.test(title)) out.push('chat');
  if ((c.points?.length ?? 0) >= 2 || /[、；;]/.test(c.subtitle ?? '')) out.push('notes', 'bento');
  if ([...title].length <= 6) out.push('stack', 'mega');
  return out;
}
/**
 * Up to `n` layouts for an A/B set: content-suggested ones first, one per family, never the current layout or its family
 * while another family is available, and no gradient-led looks unless the cover is already one.
 */
export function pickVariants(candidates: string[], current: string | undefined, copy: Copy, n = 3): string[] {
  const curFam = FAMILY[current ?? ''];
  // A big numeral with no number in the copy is a placeholder "01": only offer number layouts when the words have one.
  const hasNumber = /\d/.test(copy.title);
  const pool = candidates.filter(id => id !== current && (FAMILY[id] !== 'gradient' || curFam === 'gradient') && (FAMILY[id] !== 'number' || hasNumber));
  const hints = contentHints(copy).filter(id => pool.includes(id));
  const ordered = [...new Set([...hints, ...pool])];
  const out: string[] = []; const used = new Set<string>(curFam ? [curFam] : []);
  for (const id of ordered) { const f = FAMILY[id] ?? id; if (out.length < n && !used.has(f)) { out.push(id); used.add(f); } }
  for (const id of ordered) if (out.length < n && !out.includes(id)) out.push(id);
  return out;
}
