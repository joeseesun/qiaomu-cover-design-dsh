import { getStroke } from 'perfect-freehand';
import { Canvas, Path, Point, util } from 'fabric';
export type InkPoint = [number, number, number];
export interface BrushStyle { color: string; width: number }
/** Mouse strokes have a constant width; only hardware pens use real pressure. */
export function inkPath(points: InkPoint[], width: number, pen = false, last = true): string {
  const outline = getStroke(points, { size: width, thinning: pen ? 0.45 : 0, simulatePressure: false, smoothing: 0.6, streamline: 0.35, last });
  if (!outline.length) return '';
  const n = (v: number): string => String(Math.round(v * 100) / 100);
  const first = outline[0]!;
  let d = `M${n(first[0]!)} ${n(first[1]!)} Q`;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i]!, b = outline[(i + 1) % outline.length]!;
    d += `${n(a[0]!)} ${n(a[1]!)} ${n((a[0]! + b[0]!) / 2)} ${n((a[1]! + b[1]!) / 2)} `;
  }
  return `${d}Z`;
}
export interface DrawingInput { setActive(active: boolean): void; finish(): void; dispose(): void }
/** Own the whole pointer gesture, including coalesced samples and releases outside the artboard. */
export function bindDrawing(stage: HTMLElement, canvas: Canvas, style: () => BrushStyle): DrawingInput {
  const win = stage.ownerDocument.defaultView!, controller = new AbortController(), signal = controller.signal;
  const surface = canvas.upperCanvasEl, preview = stage.ownerDocument.createElement('canvas');
  preview.className = 'qc-ink-preview'; canvas.wrapperEl.append(preview);
  let pointer: number | undefined, points: InkPoint[] = [], pen = false, brush: BrushStyle, frame: number | undefined;
  const clear = (): void => { if (frame !== undefined) win.cancelAnimationFrame(frame); frame = undefined; preview.getContext('2d')?.clearRect(0, 0, preview.width, preview.height); };
  const sample = (event: PointerEvent): void => {
    const r = surface.getBoundingClientRect(); if (!r.width || !r.height) return;
    const scene = util.transformPoint(new Point((event.clientX - r.left) * canvas.width / r.width, (event.clientY - r.top) * canvas.height / r.height), util.invertTransform(canvas.viewportTransform));
    const pressure = pen && event.pressure > 0 ? event.pressure : points.at(-1)?.[2] ?? 0.5;
    const prev = points.at(-1); if (!prev || Math.hypot(scene.x - prev[0], scene.y - prev[1]) >= 0.1) points.push([scene.x, scene.y, pressure]);
    // Keep very long strokes responsive without truncating their trajectory.
    if (points.length > 12000) points = points.filter((_p, i) => i === 0 || i % 2 === 1 || i === points.length - 1);
  };
  const render = (): void => {
    frame = undefined; const ratio = canvas.getRetinaScaling();
    preview.width = Math.round(canvas.width * ratio); preview.height = Math.round(canvas.height * ratio);
    const ctx = preview.getContext('2d'); if (!ctx || !points.length) return;
    ctx.scale(ratio, ratio); ctx.transform(...canvas.viewportTransform); ctx.fillStyle = brush.color;
    ctx.fill(new Path2D(inkPath(points, brush.width, pen, false)));
  };
  const finish = (): void => {
    if (pointer === undefined) return;
    const id = pointer; pointer = undefined; clear();
    try { if (surface.hasPointerCapture(id)) surface.releasePointerCapture(id); } catch { /* Surface may have detached. */ }
    const d = inkPath(points, brush.width, pen); points = [];
    if (d) { const path = new Path(d, { fill: brush.color, strokeWidth: 0, objectCaching: false }); canvas.add(path); canvas.fire('path:created', { path }); canvas.requestRenderAll(); }
  };
  const consume = (e: Event): void => { e.preventDefault(); e.stopImmediatePropagation(); };
  stage.addEventListener('pointerdown', event => {
    if (!canvas.isDrawingMode || event.button !== 0 || pointer !== undefined || !canvas.wrapperEl.contains(event.target as Node)) return;
    consume(event); pointer = event.pointerId; points = []; pen = event.pointerType === 'pen'; brush = { ...style() };
    canvas.fire('before:path:created', { path: new Path('') }); sample(event);
    try { surface.setPointerCapture(pointer); } catch { /* Synthetic fixtures have no active native pointer. */ }
    render();
  }, { capture: true, signal });
  win.addEventListener('pointermove', event => {
    if (pointer !== event.pointerId) return; consume(event);
    const samples = event.getCoalescedEvents?.(); for (const e of samples?.length ? samples : [event]) sample(e);
    if (frame === undefined) frame = win.requestAnimationFrame(render);
  }, { capture: true, signal, passive: false });
  win.addEventListener('pointerup', event => { if (pointer !== event.pointerId) return; consume(event); sample(event); finish(); }, { capture: true, signal });
  win.addEventListener('pointercancel', event => { if (pointer === event.pointerId) finish(); }, { capture: true, signal });
  surface.addEventListener('lostpointercapture', event => { if (pointer === event.pointerId) finish(); }, { signal });
  win.addEventListener('blur', finish, { signal });
  // Fabric uses compatibility mouse events by default; never start a second competing brush.
  stage.addEventListener('mousedown', event => { if (canvas.isDrawingMode && event.button === 0 && canvas.wrapperEl.contains(event.target as Node)) consume(event); }, { capture: true, signal });
  return { finish, setActive(active) { finish(); canvas.isDrawingMode = active; surface.style.cursor = active ? 'crosshair' : ''; }, dispose() { finish(); controller.abort(); clear(); preview.remove(); canvas.isDrawingMode = false; } };
}
