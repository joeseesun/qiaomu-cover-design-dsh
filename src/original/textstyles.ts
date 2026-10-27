/**
 * Ready-made text styles for the Insert menu: the looks that short-video captions, Canva and Gaoding actually use. Each style is plain
 * data, so the same definition builds the thing you add to the cover and the preview in the menu.
 */
import { Gradient, Shadow, Textbox } from 'fabric';
import { BUNDLED_FONTS } from './fontmanifest';
import { BadgeBox } from './badge';
import { MOODS } from './typeset';

export type TextGroup = 'basic' | 'caption' | 'art' | 'label' | 'note';
export interface TextPreset {
  id: string; zh: string; en: string; group: TextGroup; sample: string; sampleEn: string;
  /** Font size on a 1000 px canvas. */
  size: number; color?: string; weight?: 'bold' | 'normal'; italic?: boolean; underline?: boolean; spacing?: number; angle?: number;
  gradient?: { from: string; to: string; angle?: number }; stroke?: { color: string; w: number }; shadow?: { color: string; blur: number; x: number; y: number };
  /** Highlighter behind the glyphs. */ mark?: string;
  /** A real pill: the word is centred in a rounded shape, so padding stays even. */ pill?: { bg: string; ink: string; radius: number; padX: number; padY?: number };
  font?: 'display' | 'serif' | 'brush'; dark?: boolean;
}
export const TEXT_GROUPS: { id: TextGroup; zh: string; en: string }[] = [
  { id: 'basic', zh: '基础', en: 'Basic' }, { id: 'caption', zh: '短视频字幕', en: 'Video captions' }, { id: 'art', zh: '艺术字', en: 'Display type' }, { id: 'label', zh: '标签与角标', en: 'Labels & badges' }, { id: 'note', zh: '手账与重点', en: 'Notes & emphasis' },
];
const T = (id: string, zh: string, en: string, group: TextGroup, sample: string, sampleEn: string, size: number, o: Partial<TextPreset> = {}): TextPreset => ({ id, zh, en, group, sample, sampleEn, size, ...o });
export const TEXT_PRESETS: TextPreset[] = [
  T('title', '大标题', 'Headline', 'basic', '大标题', 'Headline', 110, { color: '#171717', font: 'display' }),
  T('subtitle', '副标题', 'Subtitle', 'basic', '副标题', 'Subtitle', 52, { color: '#525252', weight: 'normal' }),
  T('body', '正文', 'Body', 'basic', '正文', 'Body text', 36, { color: '#404040', weight: 'normal' }),
  T('caption', '注释小字', 'Caption', 'basic', '注释 · NOTE', 'NOTE · caption', 26, { color: '#737373', weight: 'normal', spacing: 120 }),
  T('quote', '引言', 'Quote', 'basic', '“一句引言”', '“A quote”', 60, { color: '#171717', italic: true, font: 'serif' }),

  T('cap-classic', '经典字幕', 'Classic caption', 'caption', '白字黑边', 'White on black', 84, { color: '#ffffff', stroke: { color: '#000000', w: 0.13 }, dark: true }),
  T('cap-yellow', '黄色字幕', 'Yellow caption', 'caption', '黄字黑边', 'Yellow caption', 84, { color: '#ffe14a', stroke: { color: '#000000', w: 0.13 } }),
  T('cap-box', '黑底字幕', 'Boxed caption', 'caption', '黑底白字', 'Boxed caption', 66, { color: '#ffffff', mark: 'rgba(0,0,0,0.82)', weight: 'normal' }),
  T('cap-green', '荧光绿字幕', 'Neon green', 'caption', '荧光绿', 'Neon green', 84, { color: '#8bff3d', stroke: { color: '#0b2a00', w: 0.13 } }),
  T('cap-red', '红字白边', 'Red, white edge', 'caption', '红字白边', 'Red caption', 84, { color: '#ff2d55', stroke: { color: '#ffffff', w: 0.14 } }),
  T('cap-pink', '粉字黑边', 'Pink caption', 'caption', '粉字黑边', 'Pink caption', 84, { color: '#ff5fa2', stroke: { color: '#1a1a1a', w: 0.13 } }),

  T('art-outline', '描边大字', 'Outlined', 'art', '描边大字', 'OUTLINE', 130, { color: '#ffffff', stroke: { color: '#111111', w: 0.08 } }),
  T('art-hollow', '镂空字', 'Hollow', 'art', '镂空字', 'HOLLOW', 130, { color: 'rgba(0,0,0,0)', stroke: { color: '#171717', w: 0.035 } }),
  T('art-shadow', '投影字', 'Hard shadow', 'art', '投影字', 'SHADOW', 110, { color: '#ffe04b', shadow: { color: '#111111', blur: 0, x: 0.07, y: 0.07 } }),
  T('art-3d-yellow', '立体黄', '3D yellow', 'art', '立体字', '3D TEXT', 120, { color: '#ffe14a', stroke: { color: '#111111', w: 0.06 }, shadow: { color: '#111111', blur: 0, x: 0.09, y: 0.09 } }),
  T('art-3d-pink', '立体粉', '3D pink', 'art', '立体粉', '3D PINK', 120, { color: '#ff5fa2', stroke: { color: '#ffffff', w: 0.06 }, shadow: { color: '#5b21b6', blur: 0, x: 0.09, y: 0.09 } }),
  T('art-neon-cyan', '霓虹青', 'Neon cyan', 'art', '霓虹灯', 'NEON', 120, { color: '#e6ffff', shadow: { color: '#22d3ee', blur: 0.4, x: 0, y: 0 }, dark: true }),
  T('art-neon-pink', '霓虹粉', 'Neon pink', 'art', '霓虹灯', 'NEON', 120, { color: '#ffe3f1', shadow: { color: '#ff3d8b', blur: 0.4, x: 0, y: 0 }, dark: true }),
  T('art-grad-purple', '渐变紫粉', 'Purple pink', 'art', '渐变字', 'GRADIENT', 120, { gradient: { from: '#7c3aed', to: '#ec4899' } }),
  T('art-grad-sunset', '渐变日落', 'Sunset', 'art', '日落橙', 'SUNSET', 120, { gradient: { from: '#ff512f', to: '#f9b61a' } }),
  T('art-grad-aqua', '渐变海岸', 'Aqua', 'art', '海岸蓝', 'AQUA', 120, { gradient: { from: '#06b6d4', to: '#6366f1' } }),
  T('art-gold', '烫金', 'Gold foil', 'art', '烫金字', 'GOLD', 120, { gradient: { from: '#fff1a8', to: '#c99200', angle: 90 }, stroke: { color: '#4a3200', w: 0.02 }, dark: true }),
  T('art-retro', '复古红', 'Retro red', 'art', '复古红', 'RETRO', 120, { color: '#d9381e', stroke: { color: '#f6e8c8', w: 0.05 }, shadow: { color: '#2b1b12', blur: 0, x: 0.06, y: 0.06 }, font: 'serif' }),
  T('art-glitch', '故障风', 'Glitch', 'art', '故障风', 'GLITCH', 120, { color: '#ffffff', shadow: { color: '#ff2d55', blur: 0, x: 0.05, y: 0 }, dark: true }),
  T('art-brush', '毛笔字', 'Brush', 'art', '国风', 'BRUSH', 140, { color: '#1a1a1a', font: 'brush' }),

  T('tag-red', '红色胶囊', 'Red pill', 'label', '标签', 'LABEL', 40, { pill: { bg: '#e11d2e', ink: '#ffffff', radius: 0.5, padX: 0.7 } }),
  T('tag-yellow', '黄色标签', 'Yellow tag', 'label', '标签', 'LABEL', 44, { pill: { bg: '#ffe04b', ink: '#171717', radius: 0.14, padX: 0.5 } }),
  T('tag-black', '黑色胶囊', 'Black pill', 'label', '标签', 'LABEL', 40, { pill: { bg: '#111111', ink: '#ffffff', radius: 0.5, padX: 0.7 } }),
  T('tag-purple', '紫色胶囊', 'Purple pill', 'label', '标签', 'LABEL', 40, { pill: { bg: '#7c3aed', ink: '#ffffff', radius: 0.5, padX: 0.7 } }),
  T('tag-new', 'NEW', 'NEW', 'label', 'NEW', 'NEW', 38, { pill: { bg: '#ff3b30', ink: '#ffffff', radius: 0.2, padX: 0.55 }, spacing: 120 }),
  T('tag-hot', 'HOT', 'HOT', 'label', 'HOT', 'HOT', 38, { pill: { bg: '#ff7a00', ink: '#ffffff', radius: 0.2, padX: 0.55 }, spacing: 120 }),
  T('tag-hit', '爆款', 'Best seller', 'label', '爆款', 'HIT', 50, { pill: { bg: '#ffd23f', ink: '#111111', radius: 0.12, padX: 0.5 }, angle: -4 }),
  T('tag-square', '方形角标', 'Square badge', 'label', '角标', 'BADGE', 38, { pill: { bg: '#111111', ink: '#ffffff', radius: 0.05, padX: 0.6 } }),
  T('tag-price', '价格', 'Price', 'label', '¥99', '$99', 72, { pill: { bg: '#ff2d2d', ink: '#ffffff', radius: 0.18, padX: 0.5 } }),
  T('tag-circle', '序号圆', 'Number dot', 'label', '1', '1', 80, { pill: { bg: '#171717', ink: '#ffffff', radius: 0.5, padX: 0.42, padY: 0.3 } }),

  T('note-marker', '荧光笔', 'Highlighter', 'note', '划重点', 'Highlight', 90, { color: '#171717', mark: '#ffe04b' }),
  T('note-marker-pink', '粉荧光笔', 'Pink marker', 'note', '划重点', 'Highlight', 90, { color: '#171717', mark: '#ffb8da' }),
  T('note-underline', '下划线', 'Underline', 'note', '重点内容', 'Key point', 90, { color: '#171717', underline: true }),
  T('note-tape', '胶带标题', 'Tape label', 'note', '手账标题', 'Journal', 56, { pill: { bg: '#efe3c2', ink: '#4a3b22', radius: 0.08, padX: 0.7 }, angle: -3 }),
  T('note-sticky', '便签字', 'Sticky note', 'note', '便签', 'NOTE', 56, { pill: { bg: '#fff176', ink: '#333333', radius: 0.06, padX: 0.7, padY: 0.55 }, angle: 2 }),
  T('note-number', '大数字', 'Big number', 'note', '01', '01', 220, { color: '#e11d2e' }),
  T('note-number-outline', '描边数字', 'Outline number', 'note', '02', '02', 220, { color: 'rgba(0,0,0,0)', stroke: { color: '#171717', w: 0.03 } }),
];
export const textPresetById = (id: string): TextPreset | undefined => TEXT_PRESETS.find(p => p.id === id);

/** The face a style asks for, from what is installed: display = heavy title face, serif, or a brush face. */
export function faceFor(kind: TextPreset['font'], have: (family: string) => boolean): string | undefined {
  if (!kind) return undefined;
  const list = kind === 'display' ? MOODS.punch.title : kind === 'serif' ? MOODS.serif.title : MOODS.brush.title;
  return list.find(have);
}
/** Heavy single-weight faces must not be faux-bolded. */
/** Faces with one weight only: faux-bolding them smears the strokes. Every default-library family is one weight (Bold and Heavy are their own families). */
const LIBRARY_FAMILIES = new Set(BUNDLED_FONTS.map(f => f.family));
export const isSingleWeight = (family: string | undefined): boolean => !!family && (LIBRARY_FAMILIES.has(family) || /Heavy|Black|标题黑|数黑|美好体|黄油|庞门|刀隶|马善政|志莽|龙藏|得意黑/.test(family));

/** Applies a style's look to a text box of font size `size` px. Pills are built by the caller (they are a different object). */
export function styleText(box: Textbox, p: TextPreset, size: number): void {
  const props: Record<string, unknown> = {};
  if (p.stroke) { props.stroke = p.stroke.color; props.strokeWidth = Math.max(2, Math.round(size * p.stroke.w)); props.paintFirst = 'stroke'; props.strokeLineJoin = 'round'; }
  if (p.shadow) props.shadow = new Shadow({ color: p.shadow.color, blur: p.shadow.blur * size, offsetX: p.shadow.x * size, offsetY: p.shadow.y * size });
  if (p.mark) props.textBackgroundColor = p.mark;
  if (p.italic) props.fontStyle = 'italic';
  if (p.underline) props.underline = true;
  if (p.spacing) props.charSpacing = p.spacing;
  if (p.angle) props.angle = p.angle;
  box.set(props); box.initDimensions();
  if (p.gradient) { const a = ((p.gradient.angle ?? 0) * Math.PI) / 180; const w = box.width, h = box.height; box.set({ fill: new Gradient({ type: 'linear', gradientUnits: 'pixels', coords: { x1: w / 2 - (Math.cos(a) * w) / 2, y1: h / 2 - (Math.sin(a) * h) / 2, x2: w / 2 + (Math.cos(a) * w) / 2, y2: h / 2 + (Math.sin(a) * h) / 2 }, colorStops: [{ offset: 0, color: p.gradient.from }, { offset: 1, color: p.gradient.to }] }) }); }
}
/** A pill-style preset as the object it adds. */
export function pillFor(p: TextPreset, text: string, size: number, family: string): BadgeBox {
  const k = p.pill!;
  return new BadgeBox(text, { fontSize: size, fontWeight: 'bold', fill: k.ink, badgeBg: k.bg, radius: k.radius, padX: k.padX, ...(k.padY !== undefined ? { padY: k.padY } : {}), fontFamily: family, ...(p.spacing ? { charSpacing: p.spacing } : {}), ...(p.angle ? { angle: p.angle } : {}) } as ConstructorParameters<typeof BadgeBox>[1]);
}
