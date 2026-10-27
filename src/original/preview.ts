/**
 * Renders a pattern's thumbnail offline from the same template, palette and decoration the real cover uses, so the gallery
 * shows what a click will actually produce. No model, no network.
 */
import { Circle, FabricObject, Gradient, Rect, StaticCanvas, Textbox, loadSVGFromString, util } from 'fabric';
import { decorPlacement, defaultSubjectBox, PlaceCtx } from './compose';
import { decorInFront, drawDecor } from './decor';
import { expandPattern, Pattern } from './playbook';
import { arrangeForSubject, builtPalette, gradient, reserveBelowTitle, templateById, tightenCopy } from './templates';

type RoleBox = FabricObject & { qcRole?: string };
export async function renderPattern(p: Pattern, size: { width: number; height: number }, doc: Document, zh: boolean, hasFont: (family: string) => boolean): Promise<string> {
  const { width: W, height: H } = size; const spec = expandPattern({ pattern: p.id }, hasFont); const t = templateById(spec.template ?? p.template); if (!t) throw new Error('no-template');
  const sc = new StaticCanvas(doc.createElement('canvas'), { width: W, height: H, enableRetinaScaling: false });
  try {
    const r = t.build({ width: W, height: H, title: p.sample.title, subtitle: p.sample.subtitle ?? '', badge: p.sample.badge, points: p.sample.points, palette: spec.palette, zh });
    const pal = builtPalette()!; for (const o of r.objects) sc.add(o);
    sc.backgroundColor = r.background.kind === 'solid' ? r.background.color : gradient(W, H, r.background.from, r.background.to, r.background.angle);
    if (p.picture?.kind === 'background') { // stand-in photo so a photo pattern does not preview as a black box
      const stand = new Rect({ left: 0, top: 0, width: W, height: H, originX: 'left', originY: 'top', fill: new Gradient({ type: 'linear', coords: { x1: 0, y1: 0, x2: W, y2: H }, colorStops: [{ offset: 0, color: '#8fa6bd' }, { offset: 1, color: '#e0bf9f' }] }) });
      sc.insertAt(0, stand);
    }
    const title = sc.getObjects().find((o): o is Textbox & RoleBox => o instanceof Textbox && (o as RoleBox).qcRole === 'title');
    if (title && spec.titleFont) title.set({ fontFamily: spec.titleFont });
    const hasSubject = p.picture?.kind === 'subject';
    if (hasSubject) arrangeForSubject(sc.getObjects(), W, H); else tightenCopy(sc.getObjects(), W, H);
    const box = defaultSubjectBox(W, H);
    const ctx = (): PlaceCtx => ({ width: W, height: H, subject: box, title: title ? { left: title.left, top: title.top, height: title.getScaledHeight(), fontSize: title.fontSize * title.scaleY, lastLineWidth: title.getLineWidth(Math.max(0, title.textLines.length - 1)) * title.scaleX } : undefined });
    const firstText = (): number => { const i = sc.getObjects().findIndex(o => o instanceof Textbox); return i < 0 ? sc.getObjects().length : i; };
    const behind: FabricObject[] = [], front: FabricObject[] = [];
    for (const d of spec.decor ?? []) {
      const art = drawDecor(d.kind, pal, d.tone); if (!art) continue;
      const parsed = await loadSVGFromString(art.svg); const g = util.groupSVGElements(parsed.objects.filter((o): o is FabricObject => !!o), parsed.options) as FabricObject;
      const at = d.at ?? 'canvas'; const pos = decorPlacement({ at, x: d.x, y: d.y, w: d.w }, art.ratio, d.kind, ctx());
      if (at === 'title') reserveBelowTitle(sc.getObjects(), pos.cy + pos.width / art.ratio / 2);
      const k = pos.width / Math.max(1, g.width);
      g.set({ scaleX: k, scaleY: k, left: pos.cx, top: pos.cy, originX: 'center', originY: 'center', angle: d.rotate ?? 0, opacity: d.opacity ?? 1 });
      (decorInFront(d.kind) ? front : behind).push(g);
    }
    for (const g of behind) sc.insertAt(firstText(), g);
    if (hasSubject) { // a soft stand-in so the gallery shows where the picture will go
      const r0 = Math.min(box.w, box.h) * 0.36; const dot = new Circle({ left: box.cx, top: box.cy + box.h * 0.04, radius: r0, originX: 'center', originY: 'center', fill: pal.ink, opacity: 0.16 }); sc.insertAt(firstText(), dot);
    }
    for (const g of front) sc.insertAt(firstText(), g);
    sc.renderAll(); return sc.toDataURL({ format: 'jpeg', quality: 0.78, multiplier: Math.min(1, 320 / Math.max(W, H) * (W >= H ? 1 : 1.2)) });
  } finally { void sc.dispose(); }
}
