/**
 * Turns "subject on a flat key colour" into a transparent cut-out, locally and with no model call.
 * Pure pixel code (RGBA bytes in, RGBA bytes out) so it runs in plain Node tests.
 */
export const KEY_COLOR = '#ff00ff';

/** Most common colour along the border, which is what the picture's flat background should be. */
function borderColor(d: Uint8ClampedArray, w: number, h: number): [number, number, number] | undefined {
  const bins = new Map<number, number>(); let total = 0;
  const add = (x: number, y: number): void => { const i = (y * w + x) * 4; const k = (d[i]! >> 4) << 8 | (d[i + 1]! >> 4) << 4 | d[i + 2]! >> 4; bins.set(k, (bins.get(k) ?? 0) + 1); total++; };
  for (let x = 0; x < w; x++) { add(x, 0); add(x, h - 1); }
  for (let y = 1; y < h - 1; y++) { add(0, y); add(w - 1, y); }
  let best = 0, bestN = 0; for (const [k, n] of bins) if (n > bestN) { best = k; bestN = n; }
  if (bestN / total < 0.7) return undefined; // border is not a flat colour: the model ignored the instruction
  return [((best >> 8) & 15) * 17, ((best >> 4) & 15) * 17, (best & 15) * 17];
}

export interface CutoutResult { data: Uint8ClampedArray; removed: number }
/**
 * Flood-fills the key colour inward from the edges (so same-coloured pixels inside the subject survive), then softens the
 * edge and pulls key-colour spill out of the boundary. Returns undefined when the picture is not cleanly separable.
 */
export function cutout(src: Uint8ClampedArray, w: number, h: number, tolerance = 60): CutoutResult | undefined {
  const key = borderColor(src, w, h); if (!key) return undefined;
  const d = new Uint8ClampedArray(src); const n = w * h; const gone = new Uint8Array(n);
  const near = (p: number): boolean => { const i = p * 4; return Math.hypot(d[i]! - key[0], d[i + 1]! - key[1], d[i + 2]! - key[2]) <= tolerance; };
  const stack: number[] = [];
  const seed = (p: number): void => { if (!gone[p] && near(p)) { gone[p] = 1; stack.push(p); } };
  for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
  while (stack.length) {
    const p = stack.pop()!; const x = p % w, y = (p / w) | 0;
    if (x > 0) seed(p - 1); if (x < w - 1) seed(p + 1); if (y > 0) seed(p - w); if (y < h - 1) seed(p + w);
  }
  // Pockets of key colour the flood could not reach (the gap between a ring and a ball, a handle's loop) are background too.
  for (let p = 0; p < n; p++) if (!gone[p]) { const i = p * 4; if (Math.hypot(d[i]! - key[0], d[i + 1]! - key[1], d[i + 2]! - key[2]) <= tolerance * 0.9) gone[p] = 1; }
  let removed = 0; for (let p = 0; p < n; p++) if (gone[p]) removed++;
  // Peel: anti-aliased rim pixels are a blend of subject and key colour. Drop the pink-tinted ones touching removed pixels, twice.
  const tinted = (p: number): boolean => { const i = p * 4; return d[i]! - d[i + 1]! > 36 && d[i + 2]! - d[i + 1]! > 36; };
  for (let round = 0; round < 2; round++) {
    const peel: number[] = [];
    for (let p = 0; p < n; p++) {
      if (gone[p] || !tinted(p)) continue; const x = p % w, y = (p / w) | 0;
      if ((x > 0 && gone[p - 1]) || (x < w - 1 && gone[p + 1]) || (y > 0 && gone[p - w]) || (y < h - 1 && gone[p + w])) peel.push(p);
    }
    for (const p of peel) { gone[p] = 1; removed++; }
  }
  // One more plain pixel off the rim: what is left there is a blend of subject and key colour that no tint test catches.
  for (let round = 0; round < 3; round++) {
    const rim: number[] = [];
    for (let p = 0; p < n; p++) { if (gone[p]) continue; const x = p % w, y = (p / w) | 0; if ((x > 0 && gone[p - 1]) || (x < w - 1 && gone[p + 1]) || (y > 0 && gone[p - w]) || (y < h - 1 && gone[p + w])) rim.push(p); }
    for (const p of rim) { gone[p] = 1; removed++; }
  }
  // Opening (erode then grow back inside the original shape) deletes anything thinner than 3 px, which is how the model's faint outline halo looks.
  { const keep = new Uint8Array(n); for (let p = 0; p < n; p++) keep[p] = gone[p] ? 0 : 1; const core = new Uint8Array(n);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const p = y * w + x; if (keep[p] && keep[p - 1] && keep[p + 1] && keep[p - w] && keep[p + w] && keep[p - w - 1] && keep[p - w + 1] && keep[p + w - 1] && keep[p + w + 1]) core[p] = 1; }
    for (let p = 0; p < n; p++) { if (!keep[p]) continue; const x = p % w, y = (p / w) | 0; let ok = core[p] === 1;
      for (let dy = -1; dy <= 1 && !ok; dy++) for (let dx = -1; dx <= 1 && !ok; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && xx < w && yy >= 0 && yy < h && core[yy * w + xx]) ok = true; }
      if (!ok) { gone[p] = 1; removed++; } } }
  // Specks: tiny islands of kept pixels left by the model's noise are not part of the subject.
  const seen = new Uint8Array(n); const minArea = Math.max(24, Math.round(n * 0.0015)); const comp: number[] = [];
  for (let start = 0; start < n; start++) {
    if (gone[start] || seen[start]) continue;
    comp.length = 0; stack.length = 0; stack.push(start); seen[start] = 1;
    while (stack.length) {
      const p = stack.pop()!; comp.push(p); const x = p % w, y = (p / w) | 0;
      if (x > 0 && !gone[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack.push(p - 1); } if (x < w - 1 && !gone[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack.push(p + 1); }
      if (y > 0 && !gone[p - w] && !seen[p - w]) { seen[p - w] = 1; stack.push(p - w); } if (y < h - 1 && !gone[p + w] && !seen[p + w]) { seen[p + w] = 1; stack.push(p + w); }
    }
    if (comp.length < minArea) for (const p of comp) { gone[p] = 1; removed++; }
  }
  const ratio = removed / n; if (ratio < 0.08 || ratio > 0.95) return undefined;
  // Edge pass: kept pixels touching removed ones get partial alpha by distance to the key and lose key-colour tint.
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    if (gone[p]) { d[i + 3] = 0; continue; }
    const x = p % w, y = (p / w) | 0;
    const edge = (x > 0 && gone[p - 1]) || (x < w - 1 && gone[p + 1]) || (y > 0 && gone[p - w]) || (y < h - 1 && gone[p + w]);
    if (!edge) continue;
    const dist = Math.hypot(d[i]! - key[0], d[i + 1]! - key[1], d[i + 2]! - key[2]);
    d[i + 3] = Math.round(255 * Math.min(1, Math.max(0.15, (dist - tolerance) / (tolerance * 1.5))));
    // despill: magenta key leaves red+blue above green; clamp them toward green
    const g = d[i + 1]!; d[i] = Math.min(d[i]!, Math.max(g, 0) + 14); d[i + 2] = Math.min(d[i + 2]!, g + 14);
  }
  return { data: d, removed: ratio };
}

/** Crops transparent margins so the layer's box hugs the subject. */
export function opaqueBounds(d: Uint8ClampedArray, w: number, h: number): { x: number; y: number; w: number; h: number } | undefined {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3]! > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? undefined : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
