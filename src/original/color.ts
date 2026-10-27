/**
 * Palettes as design tokens. A cover's colours come from six tokens (bg, bg2, ink, sub, accent, accentInk); layers remember the
 * token they follow, so changing the palette recolours every layer consistently. Relative asks ("warmer", "darker") are computed
 * here from the current tokens, and every result is checked for readable contrast before it reaches the canvas.
 */
import { contrast, readableOn, toContrast } from './quality';
import type { Palette } from './templates';

export const TONES = ['bg', 'bg2', 'ink', 'sub', 'accent', 'accentInk'] as const;
export type Tone = typeof TONES[number];
export type Adjust = 'warmer' | 'cooler' | 'darker' | 'lighter' | 'muted' | 'vivid' | 'contrast' | 'softer';
export const ADJUSTS: Adjust[] = ['warmer', 'cooler', 'darker', 'lighter', 'muted', 'vivid', 'contrast', 'softer'];
export const ADJUST_ZH: Record<Adjust, string> = { warmer: '更暖', cooler: '更冷', darker: '更暗', lighter: '更亮', muted: '更素', vivid: '更鲜艳', contrast: '反差更大', softer: '更柔和' };
const HEX = /^#[\da-f]{6}$/i;

export function hexToHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16); const r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b); const l = (max + min) / 2; if (max === min) return [0, 0, l];
  const d = max - min; const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
export function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360; s = Math.min(1, Math.max(0, s)); l = Math.min(1, Math.max(0, l));
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return '#' + [r, g, b].map(v => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
}
/** Tints a colour toward warm amber or cool blue and keeps its lightness, so beige warms to cream and cools to grey-blue (never green). */
function temperature(hex: string, warm: boolean, amount: number): string {
  const [, , l] = hexToHsl(hex); const n = parseInt(hex.slice(1), 16); const t = warm ? [255, 150, 60] : [60, 125, 255];
  const mixed = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v, i) => Math.round(v + (t[i]! - v) * amount));
  const [h, s] = hexToHsl('#' + mixed.map(v => v.toString(16).padStart(2, '0')).join('')); return hslToHex(h, s, l);
}
function shift(hex: string, how: Adjust, role: Tone): string {
  const [h, s0, l0] = hexToHsl(hex); let s = s0, l = l0; const grey = s < 0.08;
  switch (how) {
    case 'warmer': case 'cooler': return temperature(hex, how === 'warmer', role === 'bg' || role === 'bg2' ? 0.16 : grey ? 0.08 : 0.2);
    case 'darker': l = role === 'bg' || role === 'bg2' ? l * 0.55 : l * 0.85; break;
    case 'lighter': l = role === 'bg' || role === 'bg2' ? l + (1 - l) * 0.6 : l + (1 - l) * 0.2; break;
    case 'muted': s *= 0.55; break;
    case 'vivid': s = Math.min(1, s * 1.35 + 0.08); break;
    case 'softer': s *= 0.75; l = l + (0.62 - l) * 0.2; break;
    case 'contrast': break;
  }
  return hslToHex(h, s, l);
}

/** Readable text on its ground: ink ≥ 4.5, sub ≥ 3, the accent's own text ≥ 3. Hues stay recognisable where possible. */
export function fixPalette(p: Palette): Palette {
  const out = { ...p };
  if ((contrast(out.ink, out.bg) ?? 21) < 4.5) out.ink = toContrast(out.ink, out.bg, 4.5);
  if ((contrast(out.ink, out.bg) ?? 21) < 4.5) out.ink = readableOn(out.bg);
  if ((contrast(out.sub, out.bg) ?? 21) < 3) out.sub = toContrast(out.sub, out.bg, 3);
  if ((contrast(out.accentInk, out.accent) ?? 21) < 3) out.accentInk = readableOn(out.accent);
  if ((contrast(out.accent, out.bg) ?? 21) < 1.6) out.accent = toContrast(out.accent, out.bg, 2.2);
  return out;
}
/** A relative change applied to every token, then made readable. `contrast` pushes ink and ground apart. */
export function adjustPalette(p: Palette, how: Adjust): Palette {
  const out = { ...p };
  for (const k of TONES) out[k] = shift(p[k], how, k);
  if (how === 'contrast') {
    const dark = hexToHsl(p.bg)[2] < 0.5; const [bh, bs] = hexToHsl(p.bg); const [ih, is] = hexToHsl(p.ink);
    out.bg = hslToHex(bh, bs, dark ? 0.08 : 0.97); out.bg2 = p.bg2 === p.bg ? out.bg : hslToHex(...(hexToHsl(p.bg2).slice(0, 2) as [number, number]), dark ? 0.14 : 0.92);
    out.ink = hslToHex(ih, is, dark ? 0.97 : 0.08);
  }
  return fixPalette(out);
}
/** Fills a partial palette from the current one; bg2 follows bg when only bg changed (a flat ground, not a gradient). */
export function mergePalette(base: Palette, over: Partial<Palette>): Palette {
  const out = { ...base }; for (const k of TONES) { const v = over[k]; if (typeof v === 'string' && HEX.test(v)) out[k] = v.toLowerCase(); }
  if (over.bg && !over.bg2) out.bg2 = out.bg; return fixPalette(out);
}
/** Old colour → new colour for each token that changed, lower-case hex keys. */
export function colorMap(from: Palette, to: Palette): Map<string, string> {
  const m = new Map<string, string>();
  // Ink-like tokens win ties: when two tokens share a colour, text keeps following text.
  for (const k of ['bg2', 'bg', 'accentInk', 'accent', 'sub', 'ink'] as const) { const a = from[k]?.toLowerCase(), b = to[k]?.toLowerCase(); if (a && b && HEX.test(a)) m.set(a, b); }
  for (const [a, b] of [...m]) if (a === b) m.delete(a);
  return m;
}
/** Which token a colour is, if any. */
export function toneOf(color: string | undefined, p: Palette | undefined): Tone | undefined {
  if (!color || !p) return undefined; const c = color.toLowerCase();
  for (const k of ['ink', 'accent', 'sub', 'accentInk', 'bg', 'bg2'] as const) if (p[k]?.toLowerCase() === c) return k;
  return undefined;
}

/** Hand-picked palettes for "换个配色" without a model, and as a vocabulary the model can name. */
export const MOOD_PALETTES: { id: string; zh: string; p: Palette }[] = [
  { id: 'cream', zh: '奶油暖调', p: { bg: '#f6efe3', bg2: '#f6efe3', ink: '#1f1a14', sub: '#6b5d4b', accent: '#e4572e', accentInk: '#ffffff' } },
  { id: 'ink-blue', zh: '墨蓝冷静', p: { bg: '#0f1b2d', bg2: '#0f1b2d', ink: '#f2f5f9', sub: '#9fb0c6', accent: '#4cc9f0', accentInk: '#0f1b2d' } },
  { id: 'mint', zh: '薄荷清新', p: { bg: '#e8f5ef', bg2: '#e8f5ef', ink: '#10261c', sub: '#4a6b5c', accent: '#0f9d68', accentInk: '#ffffff' } },
  { id: 'graphite', zh: '石墨高级', p: { bg: '#18181b', bg2: '#18181b', ink: '#fafafa', sub: '#a1a1aa', accent: '#facc15', accentInk: '#18181b' } },
  { id: 'paper', zh: '纸感极简', p: { bg: '#fafaf7', bg2: '#fafaf7', ink: '#111111', sub: '#666666', accent: '#111111', accentInk: '#ffffff' } },
  { id: 'retro', zh: '复古报刊', p: { bg: '#efe6d2', bg2: '#efe6d2', ink: '#2b2118', sub: '#7a6650', accent: '#c0392b', accentInk: '#fff8ec' } },
  { id: 'sakura', zh: '樱花柔粉', p: { bg: '#fff1f3', bg2: '#fff1f3', ink: '#3a1d24', sub: '#8a5a66', accent: '#e8537a', accentInk: '#ffffff' } },
  { id: 'lemon', zh: '柠檬活力', p: { bg: '#fff6c9', bg2: '#fff6c9', ink: '#1a1a1a', sub: '#5c5a3f', accent: '#2f6bff', accentInk: '#ffffff' } },
];
