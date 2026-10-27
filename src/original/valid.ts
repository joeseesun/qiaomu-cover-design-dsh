/**
 * Validation for whatever a model returns: every value is type-checked and clamped before it can reach the canvas.
 * Pure, so it runs in plain Node tests.
 */
import { DECOR_IDS, TONES } from './decor';
import { PATTERN_IDS } from './playbook';
import { pairingById } from './pairings';
import type { DecorSpec, DesignSpec } from './ops';

export interface Catalog { platforms: string[]; templates: string[] }
export const HEX = /^#(?:[\da-f]{3}|[\da-f]{6})$/i;
export const str = (v: unknown, max: number): string | undefined => typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined;
export const num = (v: unknown, lo: number, hi: number): number | undefined => typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : undefined;
/** A #rgb or #rrggbb colour, always returned as lower-case #rrggbb. */
export const hex = (v: unknown): string | undefined => { if (typeof v !== 'string' || !HEX.test(v.trim())) return undefined; const h = v.trim().toLowerCase(); return h.length === 4 ? '#' + [...h.slice(1)].map(c => c + c).join('') : h; };
export const align = (v: unknown): 'left' | 'center' | 'right' | undefined => v === 'left' || v === 'center' || v === 'right' ? v : undefined;
export const bool = (v: unknown): boolean | undefined => typeof v === 'boolean' ? v : undefined;

export function sanitizeDesign(o: Record<string, unknown>, c: Catalog): DesignSpec {
  const spec: DesignSpec = {};
  const platform = str(o.platform, 32); if (platform && c.platforms.includes(platform)) spec.platform = platform;
  const template = str(o.template, 32); if (template && c.templates.includes(template)) spec.template = template;
  const title = str(o.title, 80); if (title) spec.title = title;
  const subtitle = str(o.subtitle, 120); if (subtitle) spec.subtitle = subtitle;
  const badge = str(o.badge, 12); if (badge) spec.badge = badge;
  if (Array.isArray(o.points)) { const points = o.points.map(p => str(p, 24)).filter((p): p is string => !!p).slice(0, 4); if (points.length) spec.points = points; }
  if (o.palette && typeof o.palette === 'object') {
    const p = o.palette as Record<string, unknown>; const palette: NonNullable<DesignSpec['palette']> = {};
    for (const k of ['bg', 'bg2', 'ink', 'sub', 'accent', 'accentInk'] as const) { const v = hex(p[k]); if (v) palette[k] = v; }
    if (Object.keys(palette).length) spec.palette = palette;
  }
  const imagePrompt = str(o.imagePrompt, 900); if (imagePrompt) spec.imagePrompt = imagePrompt;
  if (o.imageRole === 'background' || o.imageRole === 'side') spec.imageRole = o.imageRole;
  const subjectPrompt = str(o.subjectPrompt, 700); if (subjectPrompt) spec.subjectPrompt = subjectPrompt;
  if (o.subjectAt === 'left' || o.subjectAt === 'right' || o.subjectAt === 'center') spec.subjectAt = o.subjectAt;
  const pattern = str(o.pattern, 32); if (pattern && PATTERN_IDS.includes(pattern)) spec.pattern = pattern;
  const titleFont = str(o.titleFont, 60); if (titleFont) spec.titleFont = titleFont;
  const bodyFont = str(o.bodyFont, 60); if (bodyFont) spec.bodyFont = bodyFont;
  const typeset = str(o.typeset, 24); if (typeset && pairingById(typeset)) spec.typeset = typeset;
  const decor = sanitizeDecor(o.decor); if (decor) spec.decor = decor;
  return spec;
}

export function sanitizeDecor(raw: unknown): DecorSpec[] | undefined {
  if (!Array.isArray(raw)) return undefined; const out: DecorSpec[] = [];
  for (const item of raw.slice(0, 6)) {
    if (!item || typeof item !== 'object') continue; const o = item as Record<string, unknown>;
    const kind = str(o.kind, 24); const at = o.at === 'subject' || o.at === 'title' || o.at === 'canvas' ? o.at : undefined;
    const x = num(o.x, -2, 2) ?? (at && at !== 'canvas' ? 0 : undefined), y = num(o.y, -2, 2) ?? (at && at !== 'canvas' ? 0 : undefined), w = num(o.w, 0.03, at === 'subject' ? 3 : 1.6);
    if (!kind || !DECOR_IDS.includes(kind) || x === undefined || y === undefined || w === undefined) continue;
    const rotate = num(o.rotate, -180, 180); const opacity = num(o.opacity, 0.05, 1);
    const tone = TONES.find(t => t === o.tone);
    out.push({ kind, x, y, w, ...(at ? { at } : {}), ...(rotate !== undefined ? { rotate } : {}), ...(tone ? { tone } : {}), ...(opacity !== undefined ? { opacity } : {}) });
  }
  return out.length ? out : undefined;
}
