/**
 * The scene graph the assistant reasons over: every layer with a stable short id, its kind, role, colours and box in canvas
 * percentages, so "the icon in the top right" or "the second tag" has an exact referent. Pure data and geometry, no canvas:
 * the view builds `SceneNode`s from Fabric objects, and the same functions run in tests and the intent eval.
 */
export type NodeKind = 'text' | 'image' | 'subject' | 'icon' | 'sticker' | 'shape' | 'decor' | 'effect';
export interface Box { x: number; y: number; w: number; h: number }
export interface SceneNode {
  id: string; kind: NodeKind; role?: string; /** Library name for icons, stickers, shapes and decor (e.g. lucide:guitar). */ name?: string;
  text?: string; font?: string; size?: number; color?: string; /** Palette token the colour follows (bg, ink, sub, accent, accentInk, bg2). */ tone?: string;
  box: Box; z: number; locked?: boolean; opacity?: number; angle?: number;
}
export interface SceneMeta {
  width: number; height: number; platform?: string; platformName?: string;
  /** Parts of the cover a platform's own UI hides, as canvas fractions. */ avoid?: { zh: string; en: string; x: number; y: number; w: number; h: number }[];
  palette?: Record<string, string>; selection: string[]; template?: string; background?: string;
}

const PREFIX: Record<NodeKind, string> = { text: 't', image: 'p', subject: 'p', icon: 'i', sticker: 'i', shape: 's', decor: 'd', effect: 'e' };
/**
 * Ids for every layer: existing unique ids are kept, duplicates (from copy/paste or clone) and missing ones get the next free
 * number for their kind's prefix. Ids never get reused within a cover, so a model can keep referring to `#i3` across turns.
 */
export function assignIds(items: { id?: string; kind: NodeKind }[]): string[] {
  const seen = new Set<string>(); const max: Record<string, number> = {};
  for (const it of items) { const m = /^([a-z])(\d+)$/.exec(it.id ?? ''); if (m) max[m[1]!] = Math.max(max[m[1]!] ?? 0, Number(m[2])); }
  return items.map(it => {
    const prefix = PREFIX[it.kind];
    if (it.id && /^[a-z]\d+$/.test(it.id) && it.id[0] === prefix && !seen.has(it.id)) { seen.add(it.id); return it.id; }
    const n = (max[prefix] ?? 0) + 1; max[prefix] = n; const id = `${prefix}${n}`; seen.add(id); return id;
  });
}

const pct = (v: number, total: number): number => Math.round((v / total) * 100);
const KIND_ZH: Record<NodeKind, string> = { text: '文字', image: '图片', subject: '主体图', icon: '线性图标', sticker: '贴纸', shape: '形状', decor: '装饰', effect: '背景效果' };
/** The scene as compact lines a model reads well: one layer per line, top layer last, boxes in canvas percent. */
export function describeScene(nodes: SceneNode[], meta: SceneMeta): string {
  const head = [`画布 ${meta.width}×${meta.height}${meta.platformName ? `（${meta.platformName}）` : ''}${meta.template ? `，模板 ${meta.template}` : ''}`];
  if (meta.background) head.push(`背景 ${meta.background}`);
  if (meta.palette) head.push(`配色 token：${Object.entries(meta.palette).map(([k, v]) => `${k} ${v}`).join(' / ')}`);
  if (meta.avoid?.length) head.push(`平台遮挡区：${meta.avoid.map(a => `${a.zh}(x${pct(a.x, 1)}-${pct(a.x + a.w, 1)}% y${pct(a.y, 1)}-${pct(a.y + a.h, 1)}%)`).join('、')}`);
  const effects = nodes.filter(n => n.kind === 'effect').length;
  const rows = nodes.filter(n => n.kind !== 'effect').sort((a, b) => a.z - b.z).map(n => {
    const b = n.box; const parts = [`#${n.id}`, KIND_ZH[n.kind]];
    if (n.role && !['decor', 'subject', 'image', 'asset'].includes(n.role)) parts.push(`[${n.role}]`);
    if (n.name) parts.push(n.name);
    if (n.text !== undefined) parts.push(`「${n.text.replace(/\s+/g, ' ').slice(0, 40)}」`);
    if (n.font) parts.push(n.font); if (n.size) parts.push(`${n.size}px`);
    if (n.color) parts.push(n.tone ? `${n.tone}(${n.color})` : n.color); else if (n.tone) parts.push(n.tone);
    parts.push(`x${pct(b.x, meta.width)}-${pct(b.x + b.w, meta.width)}% y${pct(b.y, meta.height)}-${pct(b.y + b.h, meta.height)}%`);
    if (n.opacity !== undefined && n.opacity < 0.99) parts.push(`透明度${Math.round(n.opacity * 100)}%`);
    if (n.angle) parts.push(`旋转${Math.round(n.angle)}°`);
    if (n.locked) parts.push('锁定');
    if (meta.selection.includes(n.id)) parts.push('← 选中');
    return parts.join(' ');
  });
  return [...head, `图层（从底到顶，共 ${rows.length} 个${effects ? `，另有 ${effects} 层背景光效` : ''}）：`, ...(rows.length ? rows : ['（空白）'])].join('\n');
}

/* ---------- targets ---------- */
export type Where = 'top-left' | 'top' | 'top-right' | 'left' | 'center' | 'right' | 'bottom-left' | 'bottom' | 'bottom-right';
export const WHERES: Where[] = ['top-left', 'top', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom', 'bottom-right'];
export const WHERE_ZH: Record<Where, string> = { 'top-left': '左上', top: '上方', 'top-right': '右上', left: '左侧', center: '中间', right: '右侧', 'bottom-left': '左下', bottom: '下方', 'bottom-right': '右下' };
export interface TargetQuery { id?: string; role?: string; kind?: NodeKind | 'any'; text?: string; where?: Where; nth?: number }
export type Target = string | string[] | TargetQuery;
const KIND_ALIASES: Record<string, NodeKind[]> = { texts: ['text'], icons: ['icon', 'sticker'], stickers: ['sticker'], shapes: ['shape'], decor: ['decor'], images: ['image', 'subject'] };
/** Which ninth of the canvas a box's centre falls in. */
export function regionOf(b: Box, width: number, height: number): Where {
  const cx = (b.x + b.w / 2) / width, cy = (b.y + b.h / 2) / height;
  const col = cx < 1 / 3 ? 0 : cx < 2 / 3 ? 1 : 2, row = cy < 1 / 3 ? 0 : cy < 2 / 3 ? 1 : 2;
  return WHERES[row * 3 + col]!;
}
/** True when `region` is the named area or contains it ("top" covers the whole top row). */
function inWhere(r: Where, want: Where): boolean {
  if (r === want) return true;
  if (want === 'top' || want === 'bottom') return r.startsWith(want);
  if (want === 'left' || want === 'right') return r.endsWith(want);
  return false;
}
/**
 * Ids a target names. Strings: `#t1` / `t1`, `selection`, `title` / `subtitle` / `badge` (roles), `all`, `last`, or a plural kind
 * (`texts`, `icons`, `shapes`, `decor`, `images`). Objects filter by role, kind, text and region; `nth` (1-based, top first) picks one.
 * Background effects are never targets. An empty result means the target could not be found.
 */
export function resolveTarget(target: Target | undefined, nodes: SceneNode[], o: { selection: string[]; width: number; height: number; last?: string[] }): string[] {
  const live = nodes.filter(n => n.kind !== 'effect');
  if (target === undefined) return o.selection.length ? o.selection : [];
  if (Array.isArray(target)) return [...new Set(target.flatMap(t => resolveTarget(t, nodes, o)))];
  if (typeof target === 'string') {
    const t = target.trim().replace(/^#/, '');
    if (live.some(n => n.id === t)) return [t];
    if (t === 'selection') return o.selection;
    if (t === 'all') return live.filter(n => !n.locked).map(n => n.id);
    if (t === 'last') return o.last ?? [];
    if (KIND_ALIASES[t]) return live.filter(n => KIND_ALIASES[t]!.includes(n.kind)).map(n => n.id);
    const byRole = live.filter(n => n.role === t); if (byRole.length) return byRole.map(n => n.id);
    return [];
  }
  let pool = live;
  if (target.id) return resolveTarget(target.id, nodes, o);
  if (target.role) pool = pool.filter(n => n.role === target.role);
  if (target.kind && target.kind !== 'any') pool = pool.filter(n => n.kind === target.kind || (target.kind === 'icon' && n.kind === 'sticker') || (target.kind === 'image' && n.kind === 'subject'));
  if (target.text) { const q = target.text.trim(); pool = pool.filter(n => n.text?.includes(q) || n.name?.includes(q)); }
  if (target.where) pool = pool.filter(n => inWhere(regionOf(n.box, o.width, o.height), target.where!));
  pool = [...pool].sort((a, b) => b.z - a.z);
  if (target.nth) { const hit = pool[target.nth - 1]; return hit ? [hit.id] : []; }
  return pool.map(n => n.id);
}

/* ---------- placement ---------- */
export interface PlaceSpec { anchor?: Where; /** Next to this box on `side`. */ near?: Box; side?: 'left' | 'right' | 'above' | 'below'; /** Centre as canvas fractions. */ x?: number; y?: number; /** Nudge as canvas fractions. */ dx?: number; dy?: number }
const overlap = (a: Box, b: Box): number => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
/** Share of the smaller box that the two boxes have in common (0–1). */
export function overlapRatio(a: Box, b: Box): number { const s = Math.min(a.w * a.h, b.w * b.h); return s > 0 ? overlap(a, b) / s : 0; }
function anchorAt(a: Where, w: number, h: number, W: number, H: number, m: number): { x: number; y: number } {
  const i = WHERES.indexOf(a); const col = i % 3, row = Math.floor(i / 3);
  return { x: col === 0 ? m : col === 1 ? (W - w) / 2 : W - m - w, y: row === 0 ? m : row === 1 ? (H - h) / 2 : H - m - h };
}
function besideAt(side: NonNullable<PlaceSpec['side']>, near: Box, w: number, h: number, gap: number): { x: number; y: number } {
  if (side === 'left') return { x: near.x - gap - w, y: near.y + (near.h - h) / 2 };
  if (side === 'right') return { x: near.x + near.w + gap, y: near.y + (near.h - h) / 2 };
  if (side === 'above') return { x: near.x + (near.w - w) / 2, y: near.y - gap - h };
  return { x: near.x + (near.w - w) / 2, y: near.y + near.h + gap };
}
/**
 * Top-left corner for a box of `size`: at a named anchor (with a margin of 6% of the short side), beside another box, or at
 * an explicit centre. Anchored and beside placements step to the nearest free alternative when the first choice would cover
 * `obstacles` (usually the words) or a platform's hidden zones; explicit coordinates are taken as given.
 */
export function placeBox(size: { w: number; h: number }, spec: PlaceSpec, canvas: { width: number; height: number }, obstacles: Box[] = [], avoid: Box[] = []): { x: number; y: number } {
  const W = canvas.width, H = canvas.height, m = Math.min(W, H) * 0.06, gap = Math.min(W, H) * 0.025; const { w, h } = size;
  const clamp = (p: { x: number; y: number }): { x: number; y: number } => ({ x: Math.round(Math.min(Math.max(p.x, m / 2), W - w - m / 2)), y: Math.round(Math.min(Math.max(p.y, m / 2), H - h - m / 2)) });
  const nudge = (p: { x: number; y: number }): { x: number; y: number } => ({ x: p.x + (spec.dx ?? 0) * W, y: p.y + (spec.dy ?? 0) * H });
  if (spec.x !== undefined || spec.y !== undefined) return nudge({ x: Math.round((spec.x ?? 0.5) * W - w / 2), y: Math.round((spec.y ?? 0.5) * H - h / 2) });
  const blocked = (p: { x: number; y: number }): boolean => { const b = { x: p.x, y: p.y, w, h }; return [...obstacles, ...avoid].some(o => overlapRatio(b, o) > 0.08); };
  const tries: { x: number; y: number }[] = [];
  if (spec.near) {
    const sides: NonNullable<PlaceSpec['side']>[] = [spec.side ?? 'right', 'right', 'left', 'below', 'above'];
    for (const s of [...new Set(sides)]) tries.push(clamp(besideAt(s, spec.near, w, h, gap)));
  } else {
    const first = spec.anchor ?? 'center'; const fi = WHERES.indexOf(first); const [fc, fr] = [fi % 3, Math.floor(fi / 3)];
    const order = [...WHERES].sort((a, b) => { const ia = WHERES.indexOf(a), ib = WHERES.indexOf(b); return (Math.abs(ia % 3 - fc) + Math.abs(Math.floor(ia / 3) - fr)) - (Math.abs(ib % 3 - fc) + Math.abs(Math.floor(ib / 3) - fr)); });
    for (const a of order) tries.push(clamp(anchorAt(a, w, h, W, H, m)));
  }
  const pick = tries.find(p => !blocked(p)) ?? tries[0]!;
  return nudge(pick);
}

/* ---------- self-check ---------- */
export interface LayoutIssue { id: string; kind: 'covers-text' | 'text-overlap' | 'off-canvas'; other?: string }
/**
 * Geometry problems after a turn, limited to the layers it touched: a non-text layer sitting over words, two text layers
 * colliding, or a layer mostly outside the canvas. Decoration, effects and full pictures may bleed and sit behind text by design.
 */
export function layoutIssues(nodes: SceneNode[], meta: { width: number; height: number }, touched: string[]): LayoutIssue[] {
  const out: LayoutIssue[] = []; const texts = nodes.filter(n => n.kind === 'text');
  const canvas = { x: 0, y: 0, w: meta.width, h: meta.height };
  for (const id of touched) {
    const n = nodes.find(x => x.id === id); if (!n || n.kind === 'effect') continue;
    if (n.kind === 'text') {
      const other = texts.find(t => t.id !== n.id && overlapRatio(t.box, n.box) > 0.12); if (other) out.push({ id, kind: 'text-overlap', other: other.id });
    } else if (n.kind !== 'decor' && n.kind !== 'image' && (n.opacity ?? 1) > 0.4) {
      const over = texts.find(t => t.z < n.z && overlapRatio(t.box, n.box) > 0.15); if (over) out.push({ id, kind: 'covers-text', other: over.id });
    }
    if (n.kind !== 'decor' && n.kind !== 'image' && n.box.w * n.box.h > 0 && overlap(n.box, canvas) / (n.box.w * n.box.h) < 0.6) out.push({ id, kind: 'off-canvas' });
  }
  return out;
}
