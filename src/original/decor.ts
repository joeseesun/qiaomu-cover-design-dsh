/**
 * Hand-built decoration library. The model never draws vectors itself (it cannot see what it draws, and the result looks
 * like clip art); it only chooses a piece, a place, a size and a colour *role*. Every piece is drawn here, once, with care,
 * so any combination stays on-brand. Output is plain SVG that fabric imports as an editable vector group.
 */
export type Tone = 'accent' | 'ink' | 'sub' | 'bg2' | 'accentInk';
export interface DecorColors { ink: string; accent: string; sub: string; bg2: string; accentInk: string }
export interface DecorKind { id: string; zh: string; use: string; /** width / height */ ratio: number; draw(c: string, alt: string): string }

const svg = (w: number, h: number, body: string): string => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${body}</svg>`;
const f = (n: number): string => (Math.round(n * 100) / 100).toString();

function sunburst(c: string): string {
  const cx = 100, cy = 100, n = 28; let out = '';
  for (let i = 0; i < n; i += 2) { const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2; out += `<path d="M${cx} ${cy}L${f(cx + Math.cos(a0) * 150)} ${f(cy + Math.sin(a0) * 150)}L${f(cx + Math.cos(a1) * 150)} ${f(cy + Math.sin(a1) * 150)}Z" fill="${c}"/>`; }
  return svg(200, 200, out);
}
function halftone(c: string): string {
  let out = '';
  for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) { const r = 1.2 + 6.4 * Math.max(0, 1 - Math.hypot(x - 8, y) / 11.5); if (r > 1.3) out += `<circle cx="${10 + x * 17.5}" cy="${10 + y * 17.5}" r="${f(r)}" fill="${c}"/>`; }
  return svg(160, 160, out);
}
function grid(c: string): string {
  let out = ''; for (let i = 0; i <= 8; i++) { const p = 4 + i * 24; out += `<path d="M${p} 4V196M4 ${p}H196" stroke="${c}" stroke-width="1.6" fill="none"/>`; }
  return svg(200, 200, out);
}
const ring = (c: string, alt: string): string => svg(200, 200, `<circle cx="100" cy="100" r="86" fill="none" stroke="${c}" stroke-width="14"/><circle cx="100" cy="100" r="54" fill="none" stroke="${alt}" stroke-width="5" stroke-dasharray="2 12" stroke-linecap="round"/><circle cx="100" cy="100" r="20" fill="${c}"/>`);
const blob = (c: string): string => svg(200, 200, `<path d="M155 38c24 22 38 56 24 86s-52 56-88 50-62-38-60-72 22-58 56-70 44-14 68 6z" fill="${c}"/>`);
const squiggle = (c: string): string => svg(240, 48, `<path d="M8 26c14-20 28-20 42 0s28 20 42 0 28-20 42 0 28 20 42 0 28-20 36-6" fill="none" stroke="${c}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`);
const underline = (c: string): string => svg(260, 40, `<path d="M4 26C50 12 150 6 256 12c2 3 1 6-2 8-60 2-140 8-214 18-14 2-38 0-36-12z" fill="${c}"/>`);
const arrow = (c: string): string => svg(180, 140, `<path d="M14 118C40 40 100 22 150 40" fill="none" stroke="${c}" stroke-width="9" stroke-linecap="round"/><path d="M118 14l38 28-34 32" fill="none" stroke="${c}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`);
const sparkle = (c: string): string => svg(120, 120, `<path d="M60 4C64 40 80 56 116 60 80 64 64 80 60 116 56 80 40 64 4 60 40 56 56 40 60 4z" fill="${c}"/>`);
function burst(c: string, alt: string): string {
  const n = 14; let d = '';
  for (let i = 0; i < n * 2; i++) { const r = i % 2 ? 62 : 96; const a = (i / (n * 2)) * Math.PI * 2; d += `${i ? 'L' : 'M'}${f(100 + Math.cos(a) * r)} ${f(100 + Math.sin(a) * r)}`; }
  return svg(200, 200, `<path d="${d}Z" fill="${c}"/><path d="${d}Z" fill="none" stroke="${alt}" stroke-width="3" transform="translate(100 100) scale(.86) translate(-100 -100)" stroke-dasharray="4 6"/>`);
}
const tape = (c: string): string => svg(200, 56, `<path d="M0 4l6 6-6 6 6 6-6 6 6 6-6 6 6 6-6 6V4zM200 4l-6 6 6 6-6 6 6 6-6 6 6 6-6 6 6 6V4z" fill="${c}"/><rect x="4" y="4" width="192" height="48" fill="${c}"/>`);
function stripes(c: string): string { let out = ''; for (let i = -2; i < 10; i++) out += `<path d="M${i * 24} 200L${i * 24 + 200} 0" stroke="${c}" stroke-width="9" fill="none"/>`; return svg(200, 200, `<clipPath id="k"><rect width="200" height="200" rx="14"/></clipPath><g clip-path="url(#k)">${out}</g>`); }
function plus(c: string): string { let out = ''; for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) { const cx = 22 + x * 48, cy = 22 + y * 48; out += `<path d="M${cx - 9} ${cy}H${cx + 9}M${cx} ${cy - 9}V${cy + 9}" stroke="${c}" stroke-width="5" stroke-linecap="round"/>`; } return svg(140, 140, out); }
const corners = (c: string): string => svg(200, 200, `<path d="M6 54V6H54M146 6H194V54M194 146V194H146M54 194H6V146" fill="none" stroke="${c}" stroke-width="9" stroke-linecap="square"/>`);
const disc = (c: string): string => svg(200, 200, `<circle cx="100" cy="100" r="100" fill="${c}"/>`);
const halfDisc = (c: string): string => svg(200, 100, `<path d="M0 100a100 100 0 0 1 200 0z" fill="${c}"/>`);
const dots = (c: string): string => svg(120, 28, `<circle cx="14" cy="14" r="10" fill="${c}"/><circle cx="60" cy="14" r="10" fill="${c}" opacity=".6"/><circle cx="106" cy="14" r="10" fill="${c}" opacity=".3"/>`);
const beam = (c: string): string => svg(300, 300, `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity=".9"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient></defs><path d="M130 0H170L300 300H0z" fill="url(#g)"/>`);
const bracket = (c: string): string => svg(80, 200, `<path d="M70 6H22Q10 6 10 18V182Q10 194 22 194H70" fill="none" stroke="${c}" stroke-width="10" stroke-linecap="round"/>`);
const wave = (c: string): string => svg(400, 90, `<path d="M0 50C50 10 100 10 150 50S250 90 300 50 380 20 400 40V90H0z" fill="${c}"/>`);

const glow = (c: string): string => svg(200, 200, `<defs><radialGradient id="r"><stop offset="0" stop-color="${c}" stop-opacity=".85"/><stop offset=".55" stop-color="${c}" stop-opacity=".25"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient></defs><circle cx="100" cy="100" r="100" fill="url(#r)"/>`);

export const DECOR: DecorKind[] = [
  { id: 'glow', zh: '柔光晕', use: '放在主体正后方的发光光晕（at:subject, w 1.6~2.4, opacity 0.5~0.9），深色背景最出效果，立刻有层次和氛围', ratio: 1, draw: glow },
  { id: 'sunburst', zh: '放射光芒', use: '背景大面积、低透明度，给主体加聚焦感；适合冲击感/促销', ratio: 1, draw: sunburst },
  { id: 'halftone', zh: '半调圆点', use: '角落渐变圆点，杂志/潮流质感；放在边角、出血', ratio: 1, draw: halftone },
  { id: 'grid', zh: '细网格', use: '科技、工具、效率类的底纹；大尺寸、很淡', ratio: 1, draw: grid },
  { id: 'ring', zh: '同心圆环', use: '给主体当“靶心/光环”，科技感', ratio: 1, draw: ring },
  { id: 'blob', zh: '有机色块', use: '主体背后的大色块，柔和、生活感、种草', ratio: 1, draw: blob },
  { id: 'squiggle', zh: '手绘波浪线', use: '放在标题下方强调；短小、同色', ratio: 5, draw: squiggle },
  { id: 'underline', zh: '笔刷下划线', use: '压在标题关键词下面，像荧光笔；accent 色', ratio: 6.5, draw: underline },
  { id: 'arrow', zh: '手绘箭头', use: '指向主体或关键数字，教程/对比', ratio: 1.3, draw: arrow },
  { id: 'sparkle', zh: '四角星', use: '点缀，1~3 颗大小错落；强调“新/亮点”', ratio: 1, draw: sparkle },
  { id: 'burst', zh: '爆炸标签底', use: '放在 badge/数字后面做价签/爆点', ratio: 1, draw: burst },
  { id: 'tape', zh: '胶带', use: '手账/便签感，斜放在卡片或图片角上', ratio: 3.6, draw: tape },
  { id: 'stripes', zh: '斜纹块', use: '边角的斜纹，复古/新粗野', ratio: 1, draw: stripes },
  { id: 'plus', zh: '加号阵列', use: '边角小点缀，科技/极简', ratio: 1, draw: plus },
  { id: 'corners', zh: '取景框', use: '四角框住主体或整页，摄影/视频感', ratio: 1, draw: corners },
  { id: 'disc', zh: '实心圆', use: '主体背后的大圆，最稳的聚焦手法', ratio: 1, draw: disc },
  { id: 'halfDisc', zh: '半圆', use: '贴着画布底边或顶边的半圆，几何海报感', ratio: 2, draw: halfDisc },
  { id: 'dots', zh: '渐隐三点', use: '翻页/系列感小标记', ratio: 4.3, draw: dots },
  { id: 'beam', zh: '光束', use: '从上方打下的光，深色科技背景用', ratio: 1, draw: beam },
  { id: 'bracket', zh: '括号', use: '括住一行字或一个数字，编辑感', ratio: 0.4, draw: bracket },
  { id: 'wave', zh: '波浪底边', use: '贴底边的波浪色带，轻松/生活感', ratio: 4.4, draw: wave },
];
export const DECOR_IDS = DECOR.map(d => d.id);
export const decorById = (id: string): DecorKind | undefined => DECOR.find(d => d.id === id);
export const TONES: Tone[] = ['accent', 'ink', 'sub', 'bg2', 'accentInk'];

/** SVG for one piece in the palette's colours. `tone` picks the main colour; the secondary one is chosen to contrast with it. */
export function drawDecor(id: string, colors: DecorColors, tone: Tone = 'accent'): { svg: string; ratio: number } | undefined {
  const kind = decorById(id); if (!kind) return undefined;
  const main = colors[tone] ?? colors.accent; const alt = tone === 'ink' ? colors.accent : colors.ink;
  return { svg: kind.draw(main, alt), ratio: kind.ratio };
}
/** The catalogue as the assistant sees it. */
export function decorCatalog(): string { return DECOR.map(d => `${d.id}（${d.zh}）：${d.use}`).join('\n'); }

/** Small marks that belong in front of the subject; everything else is background structure drawn behind it. */
const FRONT = new Set(['squiggle', 'underline', 'arrow', 'sparkle', 'burst', 'tape', 'plus', 'dots', 'bracket', 'corners']);
export const decorInFront = (id: string): boolean => FRONT.has(id);
