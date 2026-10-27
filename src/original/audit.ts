/**
 * A rubric for a laid-out cover, after the visual review in hugohe3/ppt-master: hard rules are always defects (fix every hit),
 * soft rules are only flagged (fix when clearly bad). Pure geometry and colour over Fabric objects, so the same check runs in
 * the app, in tests and in the template audit script.
 */
import { Color, FabricImage, FabricObject, Gradient, Textbox } from 'fabric';
import { rectOf, Rect, textExtent } from './calm';
import { Background } from './model';
import { BadgeBox } from './badge';
import { contrast, thumbCheck } from './quality';
import { hasCjk } from './templates';

export type Rule =
  | 'H1-outside' | 'H2-overflow' | 'H3-overlap' | 'H4-contrast' | 'H5-ui-zone'
  | 'S1-edge' | 'S2-emphasis' | 'S3-cjk-tracking' | 'S4-title-lines' | 'S5-feed-size' | 'S6-low-contrast' | 'S7-ornament';
export interface Finding { rule: Rule; hard: boolean; role: string; detail: string }
export interface AuditInput { width: number; height: number; background: Background; objects: FabricObject[]; platformId?: string; avoid?: Rect[] }

type Q = FabricObject & { qcRole?: string };
const ROLES = ['title', 'subtitle', 'badge'];
const role = (o: FabricObject): string => (o as Q).qcRole ?? '';
/**
 * Words a reader has to read: the three roles plus small unlabelled text (meta lines, numbers on cards). Faint ornaments are
 * left out: a ghost numeral, an echo of the headline (misregistration, stacked repeats), rotated bands and side text.
 */
function readable(objects: FabricObject[], h: number): Textbox[] {
  const title = objects.find((o): o is Textbox => o instanceof Textbox && role(o) === 'title');
  return objects.filter((o): o is Textbox => o instanceof Textbox && o.visible !== false && !!o.text.trim() && (o.opacity ?? 1) >= 0.5
    && (ROLES.includes(role(o)) || (!role(o) && !o.angle && o.text !== title?.text && o.fontSize * (o.scaleY || 1) < h * 0.2)));
}
/** Hard rules guard the declared copy. The same defect on a template's own small print is reported, but as a soft hit. */
const declared = (t: Textbox): boolean => ROLES.includes(role(t));
const hit = (a: Rect, b: Rect, pad = 0): boolean => a.x < b.x + b.w - pad && a.x + a.w - pad > b.x && a.y < b.y + b.h - pad && a.y + a.h - pad > b.y;
const overlapArea = (a: Rect, b: Rect): number => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const contains = (r: Rect, x: number, y: number): boolean => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

type RGBA = [number, number, number, number];
const hex = ([r, g, b]: RGBA): string => '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
function paint(fill: unknown): RGBA | undefined {
  if (typeof fill === 'string') { if (!fill || fill === 'transparent') return undefined; const c = new Color(fill).getSource(); return [c[0], c[1], c[2], c[3]]; }
  if (fill instanceof Gradient) {
    const stops = fill.colorStops.map(s => { const c = new Color(s.color).getSource(); return [c[0], c[1], c[2], c[3]] as RGBA; });
    if (!stops.length) return undefined; return stops.reduce((a, s) => a.map((v, k) => v + s[k]! / stops.length) as RGBA, [0, 0, 0, 0] as RGBA);
  }
  return undefined;
}
const over = (top: RGBA, under: RGBA, alpha: number): RGBA => { const a = top[3] * alpha; return [top[0] * a + under[0] * (1 - a), top[1] * a + under[1] * (1 - a), top[2] * a + under[2] * (1 - a), 1]; };
/** The colour a reader sees behind point (x, y) under `text`: canvas background, then every shape below the text composited in order. */
function behind(input: AuditInput, text: FabricObject, x: number, y: number): RGBA | undefined {
  const bg = input.background; let c: RGBA | undefined = bg.kind === 'solid' ? paint(bg.color) : bg.kind === 'linear' ? paint(new Gradient({ type: 'linear', colorStops: [{ offset: 0, color: bg.from }, { offset: 1, color: bg.to }] })) : undefined;
  c ??= [255, 255, 255, 1];
  for (const o of input.objects) {
    if (o === text) break;
    if (o.visible === false || !contains(rectOf(o), x, y)) continue;
    if (o instanceof FabricImage || role(o) === 'image') return undefined; // a photo: the template draws its own scrim, nothing to measure
    if (o instanceof Textbox) continue;
    const p = paint(o.fill); if (p) c = over(p, c, o.opacity ?? 1);
  }
  return c;
}

/** Runs the rubric. Findings are ordered hard first. */
export function audit(input: AuditInput): Finding[] {
  const { width: w, height: h } = input; const out: Finding[] = [];
  const add = (rule: Rule, r: string, detail: string, t?: Textbox): void => {
    const hard = rule.startsWith('H') && (!t || declared(t)); out.push({ rule: hard || !rule.startsWith('H') ? rule : 'S7-ornament', hard, role: r, detail: hard || !rule.startsWith('H') ? detail : `${rule}: ${detail}` });
  };
  const texts = readable(input.objects, h); const name = (t: Textbox): string => role(t) || `text“${t.text.slice(0, 8)}”`;
  const boxes = new Map(texts.map(t => [t, textExtent(t)]));
  for (const t of texts) {
    const r = boxes.get(t)!;
    // H1: glyphs past the canvas edge are cut off in every feed.
    if (r.x < -1 || r.y < -1 || r.x + r.w > w + 1 || r.y + r.h > h + 1) add('H1-outside', name(t), `extent ${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.w)}×${Math.round(r.h)} leaves ${w}×${h}`, t);
    else { const m = Math.min(w, h) * 0.025; if (r.x < m || r.y < m || r.x + r.w > w - m || r.y + r.h > h - m) add('S1-edge', name(t), 'closer than 2.5% of the short side to the edge'); }
    // H2: text that starts inside a card must end inside it.
    const card = input.objects.slice(0, input.objects.indexOf(t)).reverse().find(o => !(o instanceof Textbox) && !role(o) && o.visible !== false && paint(o.fill) && (o.opacity ?? 1) > 0.5 && contains(rectOf(o), r.x + 2, r.y + r.h / 2) && rectOf(o).w * rectOf(o).h < w * h * 0.6
      // a card holds the whole text block; a highlight bar under one line is lower than the text and is not a container
      && rectOf(o).h >= r.h * 0.9 && !o.angle // a tilted card's box is not its edge
      // and it holds most of the text: a sticker the first glyph happens to sit on is not a container either
      && overlapArea(rectOf(o), r) >= r.w * r.h * 0.6);
    if (card) { const c = rectOf(card); if (r.x + r.w > c.x + c.w + 2 || r.y + r.h > c.y + c.h + 2) add('H2-overflow', name(t), `runs past its card by ${Math.round(Math.max(r.x + r.w - c.x - c.w, r.y + r.h - c.y - c.h))}px`, t); }
    // H4: contrast at three points along the middle of the glyphs; a stroke or a text background counts as the edge readers see.
    const big = t.fontSize * (t.scaleY || 1) >= Math.min(w, h) * 0.035; const min = big ? 3 : 4.5; let worst = 99;
    for (const fx of [0.15, 0.5, 0.85]) {
      const x = r.x + r.w * fx, y = r.y + r.h / 2; const pill = t instanceof BadgeBox ? paint(t.badgeBg) : undefined;
      const under = t.textBackgroundColor ? paint(t.textBackgroundColor) : pill && pill[3] > 0.5 ? pill : behind(input, t, x, y); if (!under) continue;
      const fg = paint(t.fill); if (!fg) continue; const ink = hex(over(fg, under, t.opacity ?? 1));
      let k = contrast(ink, hex(under)) ?? 21; if (t.stroke && (t.strokeWidth ?? 0) >= t.fontSize * 0.04) { const s = paint(t.stroke); if (s) k = Math.max(k, contrast(hex(s), hex(under)) ?? 0); }
      worst = Math.min(worst, k);
    }
    // Below 3 nobody reads it in a feed; between 3 and 4.5 small print is legible but weak.
    if (worst < 3) add('H4-contrast', name(t), `contrast ${worst.toFixed(2)} < 3`, t); else if (worst < min) add('S6-low-contrast', name(t), `contrast ${worst.toFixed(2)} < ${min}`);
    // H5: the platform's own UI (avatar, duration badge) sits on these pixels.
    for (const z of input.avoid ?? []) if (hit(r, z, 2)) add('H5-ui-zone', name(t), 'under the platform UI', t);
    // S3: CJK tracking above 5% of the size breaks a phrase apart (ppt-master S6). A spaced two-character label is a convention, not a defect.
    if ((t.charSpacing ?? 0) > 50 && [...t.text].filter(ch => hasCjk(ch)).length >= 4) add('S3-cjk-tracking', name(t), `tracking ${t.charSpacing}/1000 em`);
  }
  // H3: no two readable texts share pixels. Lines of one block are one object, so this is only ever two different things.
  for (let a = 0; a < texts.length; a++) for (let b = a + 1; b < texts.length; b++) {
    const ta = texts[a]!, tb = texts[b]!; if (!ROLES.includes(role(ta)) && !ROLES.includes(role(tb))) continue;
    // Two texts turned by the same angle are one tilted block; their axis-aligned boxes overlap even when the lines do not.
    if (ta.angle && ta.angle === tb.angle) continue;
    const pad = Math.min(ta.fontSize, tb.fontSize) * 0.08;
    if (hit(boxes.get(ta)!, boxes.get(tb)!, pad)) add('H3-overlap', `${name(ta)}+${name(tb)}`, 'texts overlap', declared(ta) && declared(tb) ? undefined : ta.text.length < tb.text.length ? (declared(ta) ? tb : ta) : (declared(tb) ? ta : tb));
  }
  const title = texts.find(t => role(t) === 'title');
  if (title) {
    const size = (t: Textbox): number => t.fontSize * (t.scaleY || 1);
    // S2: the headline is the one focal text (ppt-master S8); a bigger label or number elsewhere steals it.
    const rival = texts.find(t => t !== title && ROLES.includes(role(t)) && size(t) > size(title) * 1.02); if (rival) add('S2-emphasis', name(rival), 'bigger than the title');
    if (title.textLines.length > 4) add('S4-title-lines', 'title', `${title.textLines.length} lines`);
    const feed = thumbCheck(texts.filter(t => role(t) === 'title' || role(t) === 'subtitle').map(t => ({ role: role(t) as 'title' | 'subtitle', size: size(t), text: t.text })), w, input.platformId);
    for (const f of feed) if (f.kind === 'small') add('S5-feed-size', f.role, `${f.px}px at feed size < ${f.min}px`);
  }
  return out.sort((x, y) => Number(y.hard) - Number(x.hard));
}
