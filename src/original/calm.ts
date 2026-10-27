/**
 * "Calm" rules for a cover that has a picture subject. A cover reads when it has one hero, one headline and at most one
 * accent, so the template's own small ornaments step aside, the subject never sits on the words, and decoration never lands on text.
 */
import { FabricObject, Textbox } from 'fabric';
import { arrangeForSubject, rewrap } from './templates';

export interface Rect { x: number; y: number; w: number; h: number }
type Q = FabricObject & { qcRole?: string; qcWrapped?: boolean; qcKind?: string };

export function rectOf(o: FabricObject): Rect {
  const c = o.getCoords(); const xs = c.map(p => p.x), ys = c.map(p => p.y);
  const x = Math.min(...xs), y = Math.min(...ys); return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
/** Where the glyphs actually are: the box of a left-aligned title is wider than its longest line. */
export function textExtent(t: Textbox): Rect {
  const box = rectOf(t); let widest = 0; for (let i = 0; i < t.textLines.length; i++) widest = Math.max(widest, t.getLineWidth(i));
  const w = Math.min(box.w, widest * (t.scaleX || 1)); const off = t.textAlign === 'center' ? (box.w - w) / 2 : t.textAlign === 'right' ? box.w - w : 0;
  return { x: box.x + off, y: box.y, w, h: box.h };
}
const hit = (a: Rect, b: Rect, pad = 0): boolean => a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;
const area = (r: Rect): number => r.w * r.h;

/** Layouts whose small pieces ARE the content (labels, cells, numbers): never thinned. */
const CONTENT = new Set(['compare', 'number', 'bento', 'memo', 'checklist', 'split']);

/** Drops the template's small decorative pieces (meta lines, side text, barcodes, dots, rules) so the subject can breathe. */
export function declutterForSubject(objects: FabricObject[], w: number, h: number, templateId?: string): FabricObject[] {
  if (templateId && CONTENT.has(templateId)) return [];
  const small = w * h * 0.06; const words = objects.filter((o): o is Textbox => o instanceof Textbox && !!(o as Q).qcRole).map(rectOf);
  // A bar or card that carries the subtitle is structure, not ornament.
  const carries = (r: Rect): boolean => words.some(t => t.x + t.w / 2 > r.x && t.x + t.w / 2 < r.x + r.w && t.y + t.h / 2 > r.y && t.y + t.h / 2 < r.y + r.h);
  return objects.filter(o => { const q = o as Q; if (q.qcRole || q.qcKind) return false; const r = rectOf(o); return area(r) < small && !carries(r); });
}

/** The shape behind a text (card, bar), if any. */
export function backingOf(objects: FabricObject[], text: Textbox): Rect | undefined {
  const t = rectOf(text); const cx = t.x + t.w / 2, cy = t.y + t.h / 2;
  for (const o of objects) { if (o === text || o instanceof Textbox || (o as Q).qcRole) continue; const r = rectOf(o); if (cx > r.x && cx < r.x + r.w && cy > r.y && cy < r.y + r.h && area(r) < t.w * t.h * 40) return r; }
  return undefined;
}
/** True when a filled shape sits behind the text (a bar, a card), so the text must stay where the shape is. */
export function hasBacking(objects: FabricObject[], text: Textbox): boolean {
  const t = rectOf(text); const cx = t.x + t.w / 2, cy = t.y + t.h / 2;
  return objects.some(o => { if (o === text || o instanceof Textbox || (o as Q).qcRole) return false; const r = rectOf(o); return cx > r.x && cx < r.x + r.w && cy > r.y && cy < r.y + r.h && area(r) < t.w * t.h * 40; });
}
/** The whole subject pass: thin the ornaments, stack copy above a tall subject, then keep the two apart. */
export function calmLayout(get: () => FabricObject[], remove: (o: FabricObject) => void, w: number, h: number, templateId?: string): void {
  if (!get().some(o => (o as Q).qcRole === 'subject')) return;
  for (const o of declutterForSubject(get(), w, h, templateId)) remove(o);
  const objects = get(); const sub = objects.find((o): o is Textbox => o instanceof Textbox && (o as Q).qcRole === 'subtitle');
  if (h >= w * 1.1 && !(templateId && CONTENT.has(templateId)) && !(sub && hasBacking(objects, sub))) arrangeForSubject(objects, w, h);
  separateCopyFromSubject(get(), w, h);
}

/** Keeps the subject off the words: shrink the subject a little first, then narrow the words to the free side. */
export function separateCopyFromSubject(objects: FabricObject[], w: number, h: number): void {
  const subject = objects.find(o => (o as Q).qcRole === 'subject'); if (!subject) return;
  const texts = objects.filter((o): o is Textbox & Q => o instanceof Textbox && ((o as Q).qcRole === 'title' || (o as Q).qcRole === 'subtitle'));
  const title = texts.find(t => t.qcRole === 'title'); if (!title) return;
  const copy = (): Rect => { const rs = texts.map(textExtent); const x = Math.min(...rs.map(r => r.x)), y = Math.min(...rs.map(r => r.y)); return { x, y, w: Math.max(...rs.map(r => r.x + r.w)) - x, h: Math.max(...rs.map(r => r.y + r.h)) - y }; };
  const gap = Math.min(w, h) * 0.03; const wide = w >= h * 1.1;
  let s = rectOf(subject); if (!hit(s, copy(), gap * 0.5)) return;
  // 1. The subject yields up to a third of its size, staying anchored to the right edge (wide) or the bottom (tall).
  const c = copy(); const k = wide ? (s.x + s.w - (c.x + c.w + gap)) / s.w : (s.y + s.h - (c.y + c.h + gap)) / s.h;
  const scale = Math.max(wide ? 0.66 : 0.5, Math.min(1, k));
  if (scale < 1) {
    const right = s.x + s.w, bottom = s.y + s.h, cx = s.x + s.w / 2, cy = s.y + s.h / 2; subject.scale((subject.scaleX || 1) * scale);
    const n = rectOf(subject); subject.set(wide ? { left: subject.left + (right - (n.x + n.w)), top: subject.top + (cy - (n.y + n.h / 2)) } : { left: subject.left + (cx - (n.x + n.w / 2)), top: subject.top + (bottom - (n.y + n.h)) }); subject.setCoords();
    s = rectOf(subject);
  }
  if (!hit(s, copy(), gap * 0.5)) return;
  // 2. Still touching: the words take only the free side. Wide covers narrow the lines; tall covers cannot, so they stop here.
  if (!wide) return;
  const free = s.x - gap - title.left; if (free < w * 0.3) return;
  const sub = texts.find(t => t.qcRole === 'subtitle');
  // A subtitle that sits right under the headline travels with it; one inside a bar or a card keeps its place.
  const stacked = !!sub && !hasBacking(objects, sub) && sub.top >= title.top && sub.top - (title.top + title.getScaledHeight()) < title.fontSize * (title.scaleY || 1) * 0.9;
  const echoes = objects.filter((o): o is Textbox => o instanceof Textbox && !(o as Q).qcRole && o.text === title.text && o !== title);
  const offsets = echoes.map(e => ({ e, dx: e.left - title.left, dy: e.top - title.top }));
  for (const t of texts) {
    t.set({ width: Math.min(t.width, free / (t.scaleX || 1)) }); rewrap(t);
  }
  for (let guard = 0; guard < 12; guard++) {
    title.initDimensions(); const e = textExtent(title);
    const clear = stacked || !sub || title.top + title.getScaledHeight() <= sub.top - 4;
    if ((title.getScaledHeight() <= h * 0.46 && e.x + e.w <= s.x - gap * 0.5 && clear) || title.fontSize <= 36) break; title.set({ fontSize: Math.max(36, title.fontSize * 0.92) }); rewrap(title);
  }
  title.initDimensions(); title.setCoords();
  for (const { e, dx, dy } of offsets) { e.set({ text: title.text, width: title.width, fontSize: title.fontSize, left: title.left + dx, top: title.top + dy }); e.initDimensions(); e.setCoords(); }
  if (sub) { sub.initDimensions(); if (stacked) sub.set({ top: title.top + title.getScaledHeight() + title.fontSize * (title.scaleY || 1) * 0.22 }); sub.setCoords(); }
}

/** Marks and brush strokes never sit on the subtitle or the badge; a small mark mostly inside the headline goes too. */
export function decorOnText(objects: FabricObject[], w: number, h: number): FabricObject[] {
  const big = w * h * 0.12;
  const sub = objects.find((o): o is Textbox => o instanceof Textbox && (o as Q).qcRole === 'subtitle'); const badge = objects.find(o => (o as Q).qcRole === 'badge');
  const title = objects.find((o): o is Textbox => o instanceof Textbox && (o as Q).qcRole === 'title');
  const protectedRects = [sub && textExtent(sub), badge && rectOf(badge)].filter((r): r is Rect => !!r); const tr = title && textExtent(title);
  return objects.filter(o => {
    if ((o as Q).qcRole !== 'decor') return false; const r = rectOf(o); if (area(r) >= big) return false;
    if (protectedRects.some(p => hit(r, p, 2))) return true;
    if (!tr || !hit(r, tr)) return false; const ix = Math.max(0, Math.min(r.x + r.w, tr.x + tr.w) - Math.max(r.x, tr.x)), iy = Math.max(0, Math.min(r.y + r.h, tr.y + tr.h) - Math.max(r.y, tr.y));
    return ix * iy > area(r) * 0.3;
  });
}

/**
 * The last word on layout, run with real glyph metrics: no two text roles may overlap, nothing leaves the margin box.
 * Templates place text from measured estimates; a different face, a longer line or a shorter canvas can still collide, and this fixes it.
 */
export function layoutPass(objects: FabricObject[], w: number, h: number): number {
  const m = Math.min(w, h) * 0.04; let fixes = 0;
  const texts = objects.filter((o): o is Textbox & Q => o instanceof Textbox && ['title', 'subtitle', 'badge'].includes((o as Q).qcRole ?? ''));
  const title = texts.find(t => t.qcRole === 'title'), sub = texts.find(t => t.qcRole === 'subtitle'), badge = texts.find(t => t.qcRole === 'badge');
  if (!title) return 0;
  const gap = (): number => title.fontSize * (title.scaleY || 1) * 0.22;
  const rect = (t: Textbox): Rect => textExtent(t);
  const backed = (t: Textbox): boolean => hasBacking(objects, t);
  // 1. Inside the canvas: nothing may poke out of the margin box on any side. This runs first, so pulling a text back in
  // can never leave it on another one: the overlap rules below get the last word.
  for (const t of [badge, title, sub]) {
    if (!t) continue; const r = rect(t); let dx = 0, dy = 0;
    if (r.x < m * 0.5) dx = m * 0.5 - r.x; else if (r.x + r.w > w - m * 0.5) dx = w - m * 0.5 - (r.x + r.w);
    if (r.y < m * 0.5) dy = m * 0.5 - r.y; else if (r.y + r.h > h - m * 0.5) dy = h - m * 0.5 - (r.y + r.h);
    if (dx || dy) { t.set({ left: t.left + dx, top: t.top + dy }); t.setCoords(); fixes++; }
  }
  // 2. A subtitle never sits inside the headline: push it down (inside its card or bar if it has one), or shrink the headline until both fit.
  if (sub && !sub.angle && !title.angle) {
    const card = backingOf(objects, sub); const floor = card ? card.y + card.h - m * 0.6 : h - m;
    for (let guard = 0; guard < 12; guard++) {
      const a = rect(title), b = rect(sub); const overlap = hit(a, b) && b.y < a.y + a.h - 1;
      if (!overlap) break;
      const next = a.y + a.h + gap();
      if (next + b.h <= floor) { sub.set({ top: sub.top + (next - b.y) }); sub.setCoords(); fixes++; break; }
      title.set({ fontSize: Math.max(36, title.fontSize * 0.92) }); title.initDimensions(); title.setCoords(); fixes++;
    }
  }
  // 3. A badge never sits on the headline: lift it above, or drop the headline below it.
  if (badge) {
    const a = rect(title), b = rect(badge);
    if (hit(a, b)) {
      const up = a.y - b.h - gap();
      if (up >= m) { badge.set({ top: badge.top + (up - b.y) }); badge.setCoords(); fixes++; }
      else if (b.y + b.h + gap() + a.h <= h - m) { title.set({ top: title.top + (b.y + b.h + gap() - a.y) }); title.setCoords(); fixes++; if (sub && !backed(sub)) { sub.set({ top: sub.top + (b.y + b.h + gap() - a.y) }); sub.setCoords(); } }
    }
  }
  return fixes;
}

/**
 * Keeps the copy off a platform's UI (avatar, caption bar, buttons). The copy and everything that belongs to it (the bars and
 * pills it sits on, an echo of the headline) is one group, fitted into the largest box the zones leave free with a single
 * scale and move, so the template's own composition survives exactly: nothing is re-stacked, nothing lands on anything else.
 * Returns how many texts moved.
 */
export function clearCopyOfZones(objects: FabricObject[], zones: Rect[], w: number, h: number): number {
  // A centred badge is a sticker's label: it belongs to its disc, not to the copy block.
  const copy = objects.filter((o): o is Textbox => o instanceof Textbox && !o.lockMovementX && ['title', 'subtitle', 'badge'].includes((o as Q).qcRole ?? '') && !((o as Q).qcRole === 'badge' && o.originX === 'center'));
  if (!copy.length || !zones.length) return 0;
  const hits = (a: Rect, z: Rect): boolean => a.x < z.x + z.w && a.x + a.w > z.x && a.y < z.y + z.h && a.y + a.h > z.y;
  const ext = copy.map(textExtent); const ux = Math.min(...ext.map(r => r.x)), uy = Math.min(...ext.map(r => r.y));
  const u: Rect = { x: ux, y: uy, w: Math.max(...ext.map(r => r.x + r.w)) - ux, h: Math.max(...ext.map(r => r.y + r.h)) - uy };
  if (!zones.some(z => hits(u, z))) return 0;
  // What travels with the words: the bar or card a text sits on, and shapes or echo texts lying mostly inside the copy's box.
  const backs = copy.map(t => backingOf(objects, t)).filter((r): r is Rect => !!r);
  const group = objects.filter(o => {
    if (copy.includes(o as Textbox)) return true;
    if (!(o instanceof Textbox) && backs.some(b => { const r = rectOf(o); return Math.abs(r.x - b.x) < 1 && Math.abs(r.y - b.y) < 1 && Math.abs(r.w - b.w) < 1; })) return true;
    if (['image', 'subject', 'scrim', 'decor'].includes((o as Q).qcRole ?? '')) return false;
    const r = rectOf(o); if (!area(r) || area(r) > w * h * 0.6) return false;
    const ix = Math.max(0, Math.min(r.x + r.w, u.x + u.w) - Math.max(r.x, u.x)), iy = Math.max(0, Math.min(r.y + r.h, u.y + u.h) - Math.max(r.y, u.y));
    return ix * iy >= area(r) * 0.6;
  });
  const gr = group.map(o => copy.includes(o as Textbox) ? textExtent(o as Textbox) : rectOf(o)); const gx = Math.min(...gr.map(r => r.x)), gy = Math.min(...gr.map(r => r.y));
  const g: Rect = { x: gx, y: gy, w: Math.max(...gr.map(r => r.x + r.w)) - gx, h: Math.max(...gr.map(r => r.y + r.h)) - gy };
  // Where the group would land in a box, and how much of the template's artwork (a disc, an arch, a sticker) it would cover there.
  const scene = objects.filter(o => !group.includes(o) && o.visible !== false && (o.opacity ?? 1) > 0.3).map(rectOf).filter(r => area(r) > 0 && area(r) < w * h * 0.6);
  const place = (c: Rect): Rect & { k: number } => { const k = Math.min(1, c.w / g.w, c.h / g.h); return { k, w: g.w * k, h: g.h * k, x: Math.max(c.x, Math.min(g.x, c.x + c.w - g.w * k)), y: Math.max(c.y, Math.min(g.y, c.y + c.h - g.h * k)) }; };
  const score = (c: Rect): number => {
    const d = place(c); const covered = scene.reduce((sum, r) => sum + Math.max(0, Math.min(r.x + r.w, d.x + d.w) - Math.max(r.x, d.x)) * Math.max(0, Math.min(r.y + r.h, d.y + d.h) - Math.max(r.y, d.y)), 0);
    return d.k - Math.min(1, covered / area(d)) * 1.5 - (Math.abs(d.x - g.x) + Math.abs(d.y - g.y)) / (w + h) * 0.1;
  };
  // The free box: start from the canvas, and for each zone in the way cut off the side that scores best: big copy, clear of artwork, little travel.
  const pad = Math.min(w, h) * 0.025; let box: Rect = { x: pad, y: pad, w: w - pad * 2, h: h - pad * 2 };
  for (const z of zones) {
    if (!hits(box, z)) continue;
    const r = box.x + box.w, b = box.y + box.h;
    const cuts: Rect[] = [
      { ...box, h: Math.min(b, z.y - pad) - box.y }, { ...box, y: Math.max(box.y, z.y + z.h + pad), h: b - Math.max(box.y, z.y + z.h + pad) },
      { ...box, w: Math.min(r, z.x - pad) - box.x }, { ...box, x: Math.max(box.x, z.x + z.w + pad), w: r - Math.max(box.x, z.x + z.w + pad) },
    ].filter(c => c.w > g.w * 0.3 && c.h > g.h * 0.3);
    if (!cuts.length) return 0;
    box = cuts.reduce((best, c) => score(c) > score(best) ? c : best);
  }
  const d = place(box);
  for (const o of group) {
    o.set({ left: d.x + (o.left - g.x) * d.k, top: d.y + (o.top - g.y) * d.k, scaleX: (o.scaleX || 1) * d.k, scaleY: (o.scaleY || 1) * d.k }); o.setCoords();
  }
  return copy.length;
}
