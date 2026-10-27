/**
 * Assistant protocol. A model (or any other plugin) turns natural language into a list of `Op`s;
 * `runOps` applies them to the open cover through `CoverApi`. The built-in offline interpreter
 * understands a small set of Chinese and English commands so the panel is useful before a model is connected.
 */
import { PLATFORMS, platformName } from './platforms';
import { TEMPLATES } from './templates';
import type { Palette } from './templates';
import { MOOD_PALETTES, type Adjust, type Tone } from './color';
import type { AssetStyle, AssetWant } from './resolve';
import type { SceneMeta, SceneNode, Target, Where } from './scene';

export type Align = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';
/** One-shot layout: everything a lazy user needs decided for them. Missing fields keep the current value. */
/** One piece from the decoration library. x/y/w are fractions of the canvas (top-left corner, width; may bleed past the edge); height follows the piece's own ratio. */
export interface DecorSpec { kind: string; /** canvas (default): x/y top-left, w of canvas width. subject: centred on the subject, w in subject widths, x/y offsets in subject sizes. title: under the title's last line, x in line widths, w in line widths, y a canvas-height offset. */ at?: 'canvas' | 'subject' | 'title'; x: number; y: number; w: number; rotate?: number; tone?: 'accent' | 'ink' | 'sub' | 'bg2' | 'accentInk'; opacity?: number }
export interface DesignSpec {
  platform?: string; template?: string; title?: string; subtitle?: string; badge?: string; points?: string[]; palette?: Partial<Palette>;
  /** English picture prompt. Ignored unless an image model is configured. */
  imagePrompt?: string; imageRole?: 'background' | 'side';
  /** English prompt for a single subject that becomes its own transparent layer (generated on a flat key colour, then cut out locally). */
  subjectPrompt?: string; subjectAt?: 'left' | 'right' | 'center';
  /** Family name of an installed font for the headline (must be one the assistant was told about). */
  titleFont?: string;
  bodyFont?: string;
  /** Id of a type pairing (pairings.ts): headline, body and Latin faces chosen together. Explicit titleFont/bodyFont win. */
  typeset?: string;
  /** Id of a cover pattern from the platform playbook; fills any gaps with its template, palette and decoration. */
  pattern?: string;
  /** Pieces from the built-in decoration library, drawn in the palette's colours. Needs no image model. */
  decor?: DecorSpec[];
}
export type ShadowName = 'none' | 'soft' | 'hard' | 'glow';
export type Side = 'left' | 'right' | 'above' | 'below';
export type TextChange = { text?: string; size?: number; scale?: number; color?: string; tone?: Tone; font?: string; bold?: boolean; italic?: boolean; align?: 'left' | 'center' | 'right'; shadow?: ShadowName; lineHeight?: number; letterSpacing?: number; highlight?: string; stroke?: string; strokeWidth?: number };
/** Where a layer goes: a named area of the canvas, beside another layer, an explicit centre (canvas fractions), plus a nudge. */
export interface Placement { to?: Where; near?: Target; side?: Side; x?: number; y?: number; dx?: number; dy?: number }
export type Op =
  | ({ op: 'design' } & DesignSpec)
  | { op: 'image'; prompt: string; role?: 'background' | 'side' }
  | { op: 'platform'; id: string }
  | { op: 'template'; id: string }
  | { op: 'background'; color?: string; from?: string; to?: string; angle?: number; /** A hand-tuned mesh-light background by preset id. */ mesh?: string }
  | { op: 'addText'; text: string; size?: number; color?: string; font?: string; bold?: boolean; align?: 'left' | 'center' | 'right' }
  | ({ op: 'style'; target?: Target } & TextChange)
  | { op: 'textPreset'; id: string; text?: string }
  | { op: 'shape'; kind: string; color?: string; tone?: Tone; size?: number } & Placement
  | { op: 'sticker'; query: string }
  | { op: 'icon'; want: AssetWant; style?: AssetStyle; size?: number; tone?: Tone; color?: string; /** Swap this layer for the new icon, keeping its place and size. */ replace?: Target } & Placement
  | { op: 'decor'; items: DecorSpec[] }
  | { op: 'photo'; query: string }
  | { op: 'align'; to: Align; target?: Target }
  | ({ op: 'move'; target?: Target } & Placement)
  | { op: 'resize'; target?: Target; scale?: number; /** Width as a fraction of the canvas width. */ w?: number }
  | { op: 'layer'; target?: Target; to: 'front' | 'forward' | 'backward' | 'back' }
  | { op: 'remove'; target: Target }
  | { op: 'duplicate'; target?: Target; count?: number }
  | { op: 'set'; target?: Target; opacity?: number; rotate?: number; flipX?: boolean; flipY?: boolean; lock?: boolean; radius?: number; fit?: 'cover' | 'contain' }
  | { op: 'recolor'; target?: Target; color?: string; tone?: Tone; stroke?: string; strokeWidth?: number }
  | { op: 'distribute'; target: Target; axis: 'horizontal' | 'vertical' }
  | { op: 'palette'; palette?: Partial<Palette>; adjust?: Adjust; mood?: string }
  | { op: 'select'; target: Target }
  | { op: 'export'; format?: 'png' | 'jpeg' | 'webp'; scale?: number }
  | { op: 'undo' } | { op: 'redo' };
export type OpName = Op['op'];
export type OpOf<K extends OpName> = Extract<Op, { op: K }>;

/** A command that could not be carried out as asked (target missing, no library match): fed back to the model once. */
export class OpProblem extends Error {}

/** What the view offers to the assistant. Methods that act on layers take a target and throw `OpProblem` when it names nothing. */
export interface CoverApi {
  applyDesign(spec: DesignSpec): Promise<string[]>;
  generateImage(prompt: string, role: 'background' | 'side'): Promise<string>;
  setPlatform(id: string): boolean;
  applyTemplate(id: string): boolean;
  setBackground(spec: { color?: string; from?: string; to?: string; angle?: number; mesh?: string }): boolean;
  addText(text: string, o: { size?: number; color?: string; font?: string; bold?: boolean; align?: 'left' | 'center' | 'right' }): void;
  styleText(target: Target, change: TextChange): boolean;
  /** Why a font cannot set this text (unknown, or Latin-only on Chinese); undefined when it can. */
  fontIssue(family: string, text: string): string | undefined;
  /** A ready-made text look (caption, display type, pill label, highlighter) with the model's own words. */
  addTextPreset(id: string, text?: string): boolean;
  /** A basic or named vector shape, optionally recoloured and placed. */
  addSemanticShape(kind: string, color?: string, place?: Placement & { size?: number; tone?: Tone }): boolean;
  /** Best-matching sticker or line icon from the offline library; resolves to a human-readable note. */
  addSticker(query: string): Promise<string>;
  /** Ranked library pick for a semantic ask, placed and coloured; the runners-up are offered to the user. */
  addIcon(op: OpOf<'icon'>): Promise<string>;
  addDecor(list: DecorSpec[]): Promise<string>;
  /** An Unsplash photo as the full-bleed background; resolves to a credit note. */
  addPhotoBackground(query: string): Promise<string>;
  align(to: Align, target?: Target): boolean;
  moveLayers(target: Target | undefined, place: Placement): string;
  resizeLayers(target: Target | undefined, o: { scale?: number; w?: number }): string;
  orderLayers(target: Target | undefined, to: OpOf<'layer'>['to']): string;
  removeLayers(target: Target): string;
  duplicateLayers(target: Target | undefined, count: number): Promise<string>;
  setLayers(target: Target | undefined, o: Omit<OpOf<'set'>, 'op' | 'target'>): string;
  recolorLayers(target: Target | undefined, o: Omit<OpOf<'recolor'>, 'op' | 'target'>): string;
  distributeLayers(target: Target, axis: 'horizontal' | 'vertical'): string;
  setPalette(o: Omit<OpOf<'palette'>, 'op'>): string;
  selectLayers(target: Target): string;
  exportNow(o: { format?: 'png' | 'jpeg' | 'webp'; scale?: number }): Promise<string>;
  undo(): Promise<void>; redo(): Promise<void>;
}
export interface CanvasItem { role?: string; text?: string; size?: number; color?: string; kind: string }
export interface AssistantInput {
  /** Source material, independent of abbreviated chat history. */
  source?: import('./notecontext').NoteContext;
  prompt: string; zh: boolean; fonts: string[]; platform?: string; size: { width: number; height: number }; selected?: string;
  /** Frozen when the user sends the request; the model cannot expand this edit boundary. */
  editScope?: { kind: 'canvas' } | { kind: 'selection'; ids: string[] };
  /** What is on the canvas now, so "make the title bigger" has something to refer to. */
  canvas?: CanvasItem[]; history?: { role: 'user' | 'assistant'; text: string }[]; imageStyle?: string;
  /** Every layer with a stable id, box and colours; preferred over `canvas` when present. */
  scene?: { nodes: SceneNode[]; meta: SceneMeta };
  /** The current look (template, palette, fonts), so "darker" or "a livelier font" has a known starting point. */
  state?: { template?: string; palette?: Partial<Palette>; titleFont?: string; bodyFont?: string };
  /** Every installed font with its flavour, so the model picks faces itself instead of from a fixed shortlist. */
  fontBook?: { family: string; source: string; zh?: string; mood?: string; hint?: string; cjk?: boolean }[];
  /** Unsplash photo backgrounds are only possible when a key (or proxy) is configured. */
  photoSearch?: boolean;
  /** The cover pattern currently in use; the assistant keeps it unless asked to change style. */
  pattern?: string; /** The user chose "no picture": layout only. */ noPicture?: boolean; /** Offer complete copy/layout choices before changing the canvas. */ chooseDesigns?: boolean;
  /** Saved looks; the first is the default the assistant follows. */ series?: import('./series').Series[];
  /** Problems from the previous attempt in this turn, so the model can correct itself. */ feedback?: string[];
}
export interface AssistantResult { reply: string; ops: Op[]; designs?: DesignSpec[]; /** Quick answers the model offers when a request is genuinely ambiguous; the user picks one instead of retyping. */ options?: string[]; /** The model's one-line reading of the request, kept for the log. */ intent?: string }
export interface AssistantProvider { id: string; name: string; run(input: AssistantInput): Promise<AssistantResult> }

const COLORS: [RegExp, string][] = [
  [/深蓝|藏青|navy/i, '#1e3a8a'], [/天蓝|浅蓝|sky/i, '#38bdf8'], [/蓝|blue/i, '#2563eb'], [/红|red/i, '#e11d2e'], [/橙|orange/i, '#f97316'], [/黄|yellow/i, '#ffe04b'],
  [/青|绿松|teal|cyan/i, '#14b8a6'], [/绿|green/i, '#16a34a'], [/紫|purple|violet/i, '#7c3aed'], [/粉|pink/i, '#fb7185'], [/黑|black/i, '#111111'], [/灰|gr[ae]y/i, '#737373'],
  [/米|奶油|cream|beige/i, '#f4efe4'], [/白|white/i, '#ffffff'],
];
function colorIn(text: string): string | undefined {
  const hex = /#[\da-f]{6}\b/i.exec(text); if (hex) return hex[0].toLowerCase();
  return COLORS.find(([re]) => re.test(text))?.[1];
}
const PLATFORM_WORDS: [RegExp, string][] = [
  [/小红书.*(方|1:1|正方)/, 'xhs-square'], [/小红书|xhs|红书/i, 'xhs'], [/youtube|油管|yt/i, 'youtube'], [/b站高清|b站.*(16:9|1080)/i, 'bilibili-hd'], [/b站|哔哩|bilibili/i, 'bilibili'],
  [/抖音|视频号|竖屏|短视频|shorts|tiktok/i, 'vertical'], [/公众号|微信/, 'wechat'], [/推特|twitter|\bx\b/i, 'x'],
];
const FONT_SIZE = /字(号|体大小)|大一点|小一点|放大|缩小|bigger|smaller|larger/i;
const WHERE_WORDS: [RegExp, Where][] = [[/左上/, 'top-left'], [/右上/, 'top-right'], [/左下/, 'bottom-left'], [/右下/, 'bottom-right'], [/正中|中间|中央/, 'center'], [/顶部|最上/, 'top'], [/底部|最下/, 'bottom'], [/左边|左侧/, 'left'], [/右边|右侧/, 'right']];
const whereIn = (text: string): Where | undefined => WHERE_WORDS.find(([re]) => re.test(text))?.[1];

/** Small offline command parser. Returns an empty op list when nothing is recognised. */
export function interpret(input: AssistantInput): AssistantResult {
  const text = input.prompt.trim(); const zh = input.zh; const ops: Op[] = [];
  const say = (a: string, b: string): string => zh ? a : b;
  if (!text) return { reply: '', ops };
  if (/^(撤销|undo)/i.test(text)) return { reply: say('好的，撤销上一步。', 'Undoing.'), ops: [{ op: 'undo' }] };
  if (/^(重做|redo)/i.test(text)) return { reply: say('好的，重做。', 'Redoing.'), ops: [{ op: 'redo' }] };

  const quoted = /[“"「『'](.+?)[”"」』']/s.exec(text)?.[1];
  const platformIntent = /(切换|改成|换成|做成|适配|尺寸|平台|封面|switch|resize|for)/i.test(text) || PLATFORM_WORDS.some(([re]) => re.test(text)) && text.length < 24;
  if (platformIntent) {
    const hit = PLATFORM_WORDS.find(([re]) => re.test(text));
    if (hit && !/背景|字体|标题/.test(text)) ops.push({ op: 'platform', id: hit[1] });
  }
  const template = TEMPLATES.find(t => text.includes(t.zh) || text.toLowerCase().includes(t.en.toLowerCase()) || text.toLowerCase().includes(t.id) && /template|模板|风格/i.test(text));
  if (template && /模板|风格|套用|换成|template|style/i.test(text)) ops.push({ op: 'template', id: template.id });

  if (/背景|background/i.test(text)) {
    const colors = [...text.matchAll(/#[\da-f]{6}\b|深蓝|藏青|天蓝|浅蓝|蓝|红|橙|黄|绿松|青|绿|紫|粉|黑|灰|米|奶油|白|navy|blue|red|orange|yellow|teal|cyan|green|purple|pink|black|gr[ae]y|beige|cream|white/gi)].map(m => colorIn(m[0])).filter((c): c is string => !!c);
    if (/渐变|gradient/i.test(text) && colors.length >= 2) ops.push({ op: 'background', from: colors[0], to: colors[1], angle: 135 });
    else if (/渐变|gradient/i.test(text) && colors.length === 1) ops.push({ op: 'background', from: colors[0], to: '#111111', angle: 160 });
    else if (colors[0]) ops.push({ op: 'background', color: colors[0] });
  }

  if (quoted && /(添加|加上|加一个|加个|写|增加|add)/i.test(text) && !/标题(改|换)/.test(text)) ops.push({ op: 'addText', text: quoted });
  else if (quoted && /(副标题|subtitle)/i.test(text)) ops.push({ op: 'style', target: 'subtitle', text: quoted });
  else if (quoted && /(标题|title|headline)/i.test(text)) ops.push({ op: 'style', target: 'title', text: quoted });

  const target = /副标题|subtitle/i.test(text) ? 'subtitle' : /标题|title|headline/i.test(text) ? 'title' : 'selection';
  if (FONT_SIZE.test(text) && !quoted) {
    const bigger = /大|放大|bigger|larger/i.test(text) && !/小一点|缩小|smaller/i.test(text);
    const n = /(\d{2,3})\s*(px|号)?/.exec(text);
    ops.push({ op: 'style', target, ...(n && /字号|size/i.test(text) ? { size: Number(n[1]) } : { scale: bigger ? 1.18 : 0.85 }) });
  }
  if (/字体|font/i.test(text) && !quoted) {
    const lowered = text.toLowerCase();
    const named = input.fonts.filter(f => lowered.includes(f.toLowerCase())).sort((a, b) => b.length - a.length)[0];
    if (named) ops.push({ op: 'style', target, font: named });
  }
  if (/加粗|粗体|bold/i.test(text)) ops.push({ op: 'style', target, bold: !/取消|不要|去掉|un/i.test(text) });
  if (/斜体|italic/i.test(text)) ops.push({ op: 'style', target, italic: !/取消|不要|去掉/i.test(text) });
  if (/(文字|字|标题|副标题|text).*(颜色|改成|变成|用).*|颜色/i.test(text) && !/背景|background/i.test(text)) {
    const c = colorIn(text); if (c) ops.push({ op: 'style', target, color: c });
  }

  // Layers, colours and the icon library: the same commands the model uses, for the most common short asks.
  const icon = /(?:加|添加|插入|放|来)(?:一个|个|一张|张|上)?(.{1,8}?)(?:的)?(图标|icon|贴纸|表情|emoji)/i.exec(text);
  if (icon?.[1]) ops.push({ op: 'icon', want: { zh: icon[1].trim(), ...(/[a-z]/i.test(icon[1]) ? { en: [icon[1].trim()] } : {}) }, style: /贴纸|表情|emoji/i.test(icon[2]!) ? 'sticker' : 'line', ...(whereIn(text) ? { to: whereIn(text) } : {}) });
  else if (/^(删除|删掉|去掉|移除|delete|remove)/i.test(text) && !quoted) ops.push({ op: 'remove', target: /标题/.test(text) ? (/副标题/.test(text) ? 'subtitle' : 'title') : 'selection' });
  else if (/(挪|移|放)到?|move to/i.test(text) && whereIn(text)) ops.push({ op: 'move', target: target === 'selection' ? 'selection' : target, to: whereIn(text)! });
  if (/(换|改|来)(一?下|个|套)?(配色|颜色|色调)|配色/.test(text) && !/背景|文字|标题/.test(text)) {
    const adjust = /暖/.test(text) ? 'warmer' as const : /冷/.test(text) ? 'cooler' as const : /暗|深/.test(text) ? 'darker' as const : /亮|浅/.test(text) ? 'lighter' as const : /素|淡|低饱和/.test(text) ? 'muted' as const : /鲜艳|饱和/.test(text) ? 'vivid' as const : undefined;
    ops.push(adjust ? { op: 'palette', adjust } : { op: 'palette', mood: MOOD_PALETTES[Math.floor(Math.random() * MOOD_PALETTES.length)]!.id });
  } else if (/^(再|更)?(暖|冷|暗|亮)一?点/.test(text)) ops.push({ op: 'palette', adjust: /暖/.test(text) ? 'warmer' : /冷/.test(text) ? 'cooler' : /暗/.test(text) ? 'darker' : 'lighter' });

  const alignment: [RegExp, Align][] = [[/水平居中|左右居中|居中对齐|横向居中|center horizontally/i, 'center'], [/垂直居中|上下居中|纵向居中|center vertically/i, 'middle'], [/靠左|左对齐|align left/i, 'left'], [/靠右|右对齐|align right/i, 'right'], [/靠上|顶部对齐|align top/i, 'top'], [/靠下|底部对齐|align bottom/i, 'bottom']];
  for (const [re, to] of alignment) if (re.test(text)) ops.push({ op: 'align', to });
  if (!ops.some(o => o.op === 'align') && /^居中|文字居中|居中$/.test(text)) ops.push({ op: 'align', to: 'center' });

  if (/导出|保存成?图片|export/i.test(text)) {
    const format = /jpe?g/i.test(text) ? 'jpeg' as const : /webp/i.test(text) ? 'webp' as const : undefined;
    ops.push({ op: 'export', ...(format ? { format } : {}), ...(/2\s*倍|@2x|2x/i.test(text) ? { scale: 2 } : {}) });
  }

  if (!ops.length) {
    return { reply: say('离线指令暂时没听懂。可以试试：「切换到 YouTube」「背景改成深蓝渐变」「添加文字“新标题”」「加一个吉他图标」「换下配色」「挪到右下角」「标题放大」「导出」。接入模型后就能用自然语言设计。', 'The offline commands did not recognise that. Try: "switch to YouTube", "dark blue gradient background", "add text “New title”", "make the title bigger", "center", "export". Connect a model to design in plain language.'), ops };
  }
  const names = ops.filter((o): o is Extract<Op, { op: 'platform' }> => o.op === 'platform').map(o => PLATFORMS.find(p => p.id === o.id)).filter(Boolean).map(p => platformName(p!, zh));
  return { reply: names.length ? say(`好的，我来处理，已按 ${names.join('、')} 适配。`, `On it — adapted for ${names.join(', ')}.`) : say('好的，已处理。', 'Done.'), ops };
}
