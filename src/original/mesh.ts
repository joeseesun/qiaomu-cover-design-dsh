/**
 * Hand-tuned mesh backgrounds: a base colour with soft light blobs, the look behind most good app and poster art.
 * Plain two-colour linear gradients are what made backgrounds look cheap, so these are the defaults offered in the editor.
 */
export interface MeshGlow { x: number; y: number; r: number; color: string; a: number }
export interface MeshPreset { id: string; zh: string; en: string; base: string; dark: boolean; glows: MeshGlow[] }

/** Light palettes first; keep two dark choices at the end. */
export const MESH_PRESETS: MeshPreset[] = [
  { id: 'peach', zh: '蜜桃', en: 'Peach', base: '#fff1e6', dark: false, glows: [{ x: 0.15, y: 0.2, r: 0.62, color: '#ffb199', a: 0.65 }, { x: 0.85, y: 0.3, r: 0.5, color: '#ffd6a5', a: 0.65 }, { x: 0.5, y: 0.92, r: 0.6, color: '#fbc2eb', a: 0.5 }] },
  { id: 'mint', zh: '薄荷', en: 'Mint', base: '#eefcf5', dark: false, glows: [{ x: 0.1, y: 0.15, r: 0.55, color: '#86efac', a: 0.55 }, { x: 0.9, y: 0.8, r: 0.6, color: '#67e8f9', a: 0.5 }, { x: 0.8, y: 0.1, r: 0.4, color: '#fde68a', a: 0.45 }] },
  { id: 'ocean', zh: '海盐', en: 'Sea salt', base: '#e8f4ff', dark: false, glows: [{ x: 0.2, y: 0.2, r: 0.6, color: '#7dd3fc', a: 0.65 }, { x: 0.85, y: 0.85, r: 0.6, color: '#a5b4fc', a: 0.55 }] },
  { id: 'candy', zh: '糖果', en: 'Candy', base: '#ffe9f4', dark: false, glows: [{ x: 0.2, y: 0.25, r: 0.6, color: '#f5a9d3', a: 0.6 }, { x: 0.85, y: 0.2, r: 0.55, color: '#b6d5fa', a: 0.6 }, { x: 0.6, y: 0.9, r: 0.55, color: '#ffe2ac', a: 0.55 }] },
  { id: 'sand', zh: '暖沙', en: 'Sand', base: '#f3ebe0', dark: false, glows: [{ x: 0.9, y: 0.1, r: 0.62, color: '#e8b88a', a: 0.5 }, { x: 0.1, y: 0.9, r: 0.6, color: '#d9c3a5', a: 0.55 }] },
  { id: 'lavender', zh: '薰衣草', en: 'Lavender', base: '#f6f0ff', dark: false, glows: [{ x: 0.15, y: 0.2, r: 0.65, color: '#c9b9ed', a: 0.62 }, { x: 0.85, y: 0.75, r: 0.6, color: '#f5cadc', a: 0.6 }] },
  { id: 'lemon', zh: '奶油柠檬', en: 'Lemon cream', base: '#fffbed', dark: false, glows: [{ x: 0.2, y: 0.25, r: 0.65, color: '#f9e7a2', a: 0.65 }, { x: 0.8, y: 0.8, r: 0.6, color: '#d3ebc7', a: 0.6 }] },
  { id: 'sky', zh: '云朵蓝', en: 'Cloud blue', base: '#f2f8ff', dark: false, glows: [{ x: 0.2, y: 0.2, r: 0.7, color: '#bedaf5', a: 0.65 }, { x: 0.8, y: 0.8, r: 0.6, color: '#ded4f3', a: 0.55 }] },
  { id: 'rose', zh: '玫瑰奶昔', en: 'Rose milk', base: '#fff4f2', dark: false, glows: [{ x: 0.15, y: 0.25, r: 0.6, color: '#f4bfc8', a: 0.62 }, { x: 0.85, y: 0.8, r: 0.65, color: '#f6dec2', a: 0.6 }] },
  { id: 'pistachio', zh: '开心果', en: 'Pistachio', base: '#f5f9ed', dark: false, glows: [{ x: 0.2, y: 0.2, r: 0.65, color: '#c6dfa8', a: 0.6 }, { x: 0.85, y: 0.85, r: 0.6, color: '#f5e3b7', a: 0.6 }] },
  { id: 'midnight', zh: '午夜蓝', en: 'Midnight', base: '#050816', dark: true, glows: [{ x: 0.25, y: 0.2, r: 0.6, color: '#3b82f6', a: 0.45 }, { x: 0.85, y: 0.78, r: 0.6, color: '#6366f1', a: 0.45 }] },
  { id: 'graphite', zh: '石墨', en: 'Graphite', base: '#0d0d0f', dark: true, glows: [{ x: 0.2, y: 0.2, r: 0.6, color: '#6b7280', a: 0.35 }, { x: 0.9, y: 0.85, r: 0.55, color: '#374151', a: 0.5 }] },
];
/** Older designs keep their original preset when resized or edited. */
export const MESH_LIBRARY: MeshPreset[] = [...MESH_PRESETS,
  { id: 'aurora', zh: '极光', en: 'Aurora', base: '#0a0f1f', dark: true, glows: [{ x: 0.2, y: 0.25, r: 0.62, color: '#2dd4bf', a: 0.55 }, { x: 0.85, y: 0.2, r: 0.55, color: '#8b5cf6', a: 0.5 }, { x: 0.6, y: 0.88, r: 0.6, color: '#38bdf8', a: 0.42 }] },
  { id: 'sunset', zh: '日落', en: 'Sunset', base: '#2a1245', dark: true, glows: [{ x: 0.2, y: 0.82, r: 0.7, color: '#ff6b6b', a: 0.62 }, { x: 0.85, y: 0.9, r: 0.55, color: '#feca57', a: 0.5 }, { x: 0.8, y: 0.15, r: 0.5, color: '#c471ed', a: 0.55 }] },
  { id: 'violet', zh: '紫夜', en: 'Violet', base: '#12062b', dark: true, glows: [{ x: 0.2, y: 0.3, r: 0.62, color: '#a855f7', a: 0.6 }, { x: 0.85, y: 0.72, r: 0.55, color: '#ec4899', a: 0.5 }] },
];
/** The preset as layered CSS gradients, for swatches in the UI. */
export function meshCss(p: MeshPreset): string {
  const hex = (a: number): string => Math.round(Math.min(1, a) * 255).toString(16).padStart(2, '0');
  return [...p.glows.map(g => `radial-gradient(circle at ${g.x * 100}% ${g.y * 100}%, ${g.color}${hex(g.a)} 0%, ${g.color}00 ${Math.round(g.r * 120)}%)`), p.base].join(', ');
}
