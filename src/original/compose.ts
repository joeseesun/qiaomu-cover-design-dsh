/**
 * Where a decoration piece goes, resolved from what it is attached to. Pure geometry shared by the live canvas and the
 * offline preview renderer, so a thumbnail and the real cover place decoration identically.
 */
export type Anchor = { at: 'canvas' | 'subject' | 'title'; x: number; y: number; w: number };
export interface SubjectBox { cx: number; cy: number; w: number; h: number }
export interface TitleBox { left: number; top: number; height: number; fontSize: number; lastLineWidth: number }
export interface PlaceCtx { width: number; height: number; subject: SubjectBox; title?: TitleBox }

/** The region the placement rules reserve for a subject: right side on wide canvases, lower half on tall ones. */
export function defaultSubjectBox(width: number, height: number): SubjectBox {
  const portrait = height > width * 1.1; const w = portrait ? width * 0.86 : width * 0.46, h = portrait ? height * 0.5 : height * 0.9;
  return { cx: portrait ? width / 2 : width - width * 0.04 - w / 2, cy: portrait ? height - height * 0.03 - h / 2 : height / 2, w, h };
}
export function decorPlacement(a: Anchor, ratio: number, kind: string, ctx: PlaceCtx): { cx: number; cy: number; width: number } {
  if (a.at === 'subject') { const b = ctx.subject; return { cx: b.cx + a.x * b.w, cy: b.cy + a.y * b.h, width: a.w * b.w }; }
  if (a.at === 'title' && ctx.title) {
    const t = ctx.title; const line = Math.max(40, t.lastLineWidth); let width = a.w * line;
    if (kind !== 'underline') width = Math.min(width, t.fontSize * 0.34 * ratio);
    return { cx: t.left + a.x * line + width / 2, cy: t.top + t.height - t.fontSize * (kind === 'underline' ? 0.2 : -0.06) + a.y * ctx.height + width / ratio / 2, width };
  }
  const width = a.w * ctx.width; return { cx: a.x * ctx.width + width / 2, cy: a.y * ctx.height + width / ratio / 2, width };
}
