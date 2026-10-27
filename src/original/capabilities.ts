/**
 * The capability registry: one entry per thing the assistant can do to a cover. Each entry owns its validation, its runner and
 * its prompt card, so the model is told exactly what exists, every reply is checked against the same list, and a new UI
 * feature becomes available to the assistant by registering it here (tests/capabilities.test.ts fails when one is missing).
 */
import { DESIGN_PREVIEW_LIMIT } from './designflow';
import { ADJUSTS, MOOD_PALETTES, TONES, type Tone } from './color';
import { MESH_LIBRARY, MESH_PRESETS } from './mesh';
import { PATH_SHAPES, SHAPE_IDS, BASIC_SHAPES } from './shapes';
import { TEXT_GROUPS, TEXT_PRESETS } from './textstyles';
import { DECOR_IDS } from './decor';
import { WHERES, type Target, type Where } from './scene';
import type { AssetStyle } from './resolve';
import { align as alignOf, bool, hex, num, sanitizeDecor, sanitizeDesign, str, type Catalog } from './valid';
import { OpProblem, type CoverApi, type DesignSpec, type Op, type OpName, type OpOf, type Placement, type ShadowName, type TextChange } from './ops';

export type Domain = 'design' | 'layout' | 'text' | 'color' | 'asset' | 'canvas' | 'history';
export const DOMAINS: { id: Domain; zh: string }[] = [
  { id: 'design', zh: '整页设计 / 重排 / 改文案' }, { id: 'layout', zh: '移动、缩放、层级、删除、复制、对齐、分布、透明度、旋转、锁定' },
  { id: 'text', zh: '文字内容与样式' }, { id: 'color', zh: '配色与单个元素颜色' }, { id: 'asset', zh: '图标、贴纸、形状、装饰、照片' },
  { id: 'canvas', zh: '平台尺寸、背景、模板、配图' }, { id: 'history', zh: '撤销 / 重做' },
];
export interface Capability<K extends OpName = OpName> {
  op: K; domain: Domain; zh: string;
  /** One or more prompt lines: syntax and the rules that matter. */ card: string;
  /** [what a user says, the JSON op] — few-shot examples shown with the card. */ examples?: [string, string][];
  sanitize(o: Record<string, unknown>, c: Catalog): OpOf<K> | undefined;
  run(api: CoverApi, op: OpOf<K>, zh: boolean): Promise<string | undefined>;
  /** CoverView methods and inspector properties this covers, for the UI coverage test. */ ui?: string[];
}
export type AnyCapability = { [K in OpName]: Capability<K> }[OpName];
const cap = <K extends OpName>(c: Capability<K>): Capability<K> => c;

/* ---------- shared validators ---------- */
const TARGET_WORD = /^(#?[a-z]\d{1,4}|selection|title|subtitle|badge|all|last|texts|icons|stickers|shapes|decor|images|[a-z][a-z-]{1,20})$/i;
const KINDS = ['text', 'image', 'subject', 'icon', 'sticker', 'shape', 'decor', 'any'] as const;
export function target(v: unknown): Target | undefined {
  if (typeof v === 'string') { const t = v.trim(); return TARGET_WORD.test(t) ? t : undefined; }
  if (Array.isArray(v)) { const list = v.map(target).filter((x): x is string => typeof x === 'string').slice(0, 16); return list.length ? list : undefined; }
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>; const out: Exclude<Target, string | string[]> = {};
    const id = str(o.id, 12); if (id && TARGET_WORD.test(id)) out.id = id;
    const role = str(o.role, 20); if (role) out.role = role;
    if (KINDS.includes(o.kind as never)) out.kind = o.kind as typeof KINDS[number];
    const text = str(o.text, 40); if (text) out.text = text;
    if (WHERES.includes(o.where as Where)) out.where = o.where as Where;
    const nth = num(o.nth, 1, 20); if (nth) out.nth = Math.round(nth);
    return Object.keys(out).length ? out : undefined;
  }
  return undefined;
}
const where = (v: unknown): Where | undefined => WHERES.includes(v as Where) ? v as Where : undefined;
const tone = (v: unknown): Tone | undefined => TONES.includes(v as Tone) ? v as Tone : undefined;
const side = (v: unknown): Placement['side'] => v === 'left' || v === 'right' || v === 'above' || v === 'below' ? v : undefined;
function placement(o: Record<string, unknown>): Placement {
  const out: Placement = {}; const to = where(o.to ?? o.anchor); if (to) out.to = to;
  const near = target(o.near); if (near) { out.near = near; const s = side(o.side); if (s) out.side = s; }
  for (const k of ['x', 'y'] as const) { const v = num(o[k], -0.2, 1.2); if (v !== undefined) out[k] = v; }
  for (const k of ['dx', 'dy'] as const) { const v = num(o[k], -1, 1); if (v !== undefined) out[k] = v; }
  return out;
}
const defined = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
const say = (zh: boolean, a: string, b: string): string => zh ? a : b;
const problem = (zh: boolean, a: string, b: string): never => { throw new OpProblem(zh ? a : b); };

/* ---------- the registry ---------- */
export const CAPABILITIES: AnyCapability[] = [
  cap({
    op: 'design', domain: 'design', zh: '整页自动排版（模板 + 文案 + 配色 + 字体 + 装饰）',
    card: '{"op":"design",…DesignSpec}  整页排版：只在新做封面、用户要求“重新排版 / 换个风格 / 再来一版 / 改文案”时用。局部修改绝不用它。',
    sanitize: (o, c) => { const spec = sanitizeDesign(o, c); return Object.keys(spec).length ? { op: 'design', ...spec } : undefined; },
    run: async (api, op) => (await api.applyDesign(op)).join('\n') || undefined,
    ui: ['applyDesign', 'applySeries', 'chooseVariant', 'applyPatternNow', 'coverFromSourceNote', 'retry'],
  }),
  cap({
    op: 'image', domain: 'canvas', zh: '只换 / 补一张生成图',
    card: '{"op":"image","prompt":"英文画面描述","role":"background|side"}  只重画或补一张图，其余不动（仅在本次允许配图时）。',
    sanitize: o => { const prompt = str(o.prompt, 900); return prompt ? { op: 'image', prompt, ...(o.role === 'side' ? { role: 'side' as const } : {}) } : undefined; },
    run: (api, op) => api.generateImage(op.prompt, op.role ?? 'background'),
    ui: ['generateImage', 'regenerate'],
  }),
  cap({
    op: 'platform', domain: 'canvas', zh: '切换平台尺寸',
    card: '{"op":"platform","id":"xhs"}  切换平台尺寸，插件会按新比例重排。',
    sanitize: (o, c) => { const id = str(o.id, 32); return id && c.platforms.includes(id) ? { op: 'platform', id } : undefined; },
    run: async (api, op, zh) => api.setPlatform(op.id) ? say(zh, `已切换平台：${op.id}`, `Platform: ${op.id}`) : undefined,
    ui: ['setPlatform', 'resizeTo'],
  }),
  cap({
    op: 'template', domain: 'canvas', zh: '只换模板，保留文案',
    card: '{"op":"template","id":"…"}  只换版式模板，文案保留。',
    sanitize: (o, c) => { const id = str(o.id, 32); return id && c.templates.includes(id) ? { op: 'template', id } : undefined; },
    run: async (api, op, zh) => api.applyTemplate(op.id) ? say(zh, `已套用模板：${op.id}`, `Template: ${op.id}`) : undefined,
    ui: ['applyTemplate'],
  }),
  cap({
    op: 'background', domain: 'canvas', zh: '背景：纯色 / 渐变 / 弥散光',
    card: `{"op":"background","color":"#rrggbb"} 纯色；{"from","to","angle"} 渐变（仅用户点名要渐变时）；{"mesh":"id"} 弥散光：${MESH_PRESETS.map(m => `${m.id} ${m.zh}${m.dark ? '(深)' : '(浅)'}`).join(' / ')}。只换底色；要整套配色一起换用 palette。`,
    examples: [['背景换成深一点的', '{"op":"background","mesh":"graphite"}']],
    sanitize: o => {
      const mesh = str(o.mesh, 24); if (mesh && MESH_LIBRARY.some(m => m.id === mesh)) return { op: 'background', mesh };
      const color = hex(o.color), from = hex(o.from), to = hex(o.to); const angle = num(o.angle, 0, 360);
      if (color) return { op: 'background', color }; if (from && to) return { op: 'background', from, to, ...(angle !== undefined ? { angle } : {}) }; return undefined;
    },
    run: async (api, op, zh) => api.setBackground(op) ? say(zh, '已更新背景', 'Background updated') : undefined,
    ui: ['applyBackground', 'applyMesh', 'setBackground'],
  }),
  cap({
    op: 'palette', domain: 'color', zh: '整套配色（所有元素按 token 一起变）',
    card: `{"op":"palette","palette":{"bg":"#…","ink":"#…","sub":"#…","accent":"#…","accentInk":"#…"}}  换整套配色：背景、文字、图标、形状、装饰按各自 token 一起换，位置和文案不动。只写要变的 token；bg2 默认跟 bg 相同（纯色底）。
{"op":"palette","adjust":"${ADJUSTS.join('|')}"}  相对调整（更暖 / 更冷 / 更暗 / 更亮 / 更素 / 更鲜艳 / 反差更大 / 更柔和），以当前配色为基准计算。
{"op":"palette","mood":"${MOOD_PALETTES.map(m => m.id).join('|')}"}  预设：${MOOD_PALETTES.map(m => `${m.id} ${m.zh}`).join(' / ')}。
插件会自动保证文字反差。“换个配色 / 换套颜色”用 palette（自己挑一套与当前明显不同、适合主题的），不要用 design。`,
    examples: [['换下配色', '{"op":"palette","palette":{"bg":"#0f1b2d","ink":"#f2f5f9","sub":"#9fb0c6","accent":"#4cc9f0","accentInk":"#0f1b2d"}}'], ['再暖一点', '{"op":"palette","adjust":"warmer"}'], ['强调色换成橙色', '{"op":"palette","palette":{"accent":"#f97316"}}']],
    sanitize: o => {
      const out: OpOf<'palette'> = { op: 'palette' };
      if (o.palette && typeof o.palette === 'object') { const p = o.palette as Record<string, unknown>; const pal: Record<string, string> = {}; for (const k of TONES) { const v = hex(p[k]); if (v) pal[k] = v; } if (Object.keys(pal).length) out.palette = pal; }
      if (ADJUSTS.includes(o.adjust as never)) out.adjust = o.adjust as OpOf<'palette'>['adjust'];
      const mood = str(o.mood, 20); if (mood && MOOD_PALETTES.some(m => m.id === mood)) out.mood = mood;
      return out.palette || out.adjust || out.mood ? out : undefined;
    },
    run: async (api, op) => api.setPalette(op),
    ui: ['setPalette'],
  }),
  cap({
    op: 'recolor', domain: 'color', zh: '给指定元素换颜色',
    card: '{"op":"recolor","target":"#i3","tone":"accent"} 或 {"color":"#rrggbb"}；描边 {"stroke":"#…","strokeWidth":6}。线性图标、形状、装饰、文字都能换；优先用 tone 让它跟随配色。',
    examples: [['把这个图标改成红色', '{"op":"recolor","target":"selection","color":"#e11d2e"}']],
    sanitize: o => { const t = target(o.target); const out = defined({ op: 'recolor' as const, target: t, color: hex(o.color), tone: tone(o.tone), stroke: hex(o.stroke), strokeWidth: num(o.strokeWidth, 0, 80) }); return out.color || out.tone || out.stroke || out.strokeWidth !== undefined ? out : undefined; },
    run: async (api, op) => api.recolorLayers(op.target, op),
    ui: ['update:fill', 'update:stroke', 'update:strokeWidth'],
  }),
  cap({
    op: 'addText', domain: 'text', zh: '添加一段文字',
    card: '{"op":"addText","text":"…","size":60,"color":"#…","bold":true,"align":"left"}  新增普通文字；需要放到某处再接一个 move（target 用 "last"）。',
    sanitize: o => { const text = str(o.text, 200); return text ? defined({ op: 'addText' as const, text, size: num(o.size, 8, 600), color: hex(o.color), font: str(o.font, 60), bold: bool(o.bold), align: alignOf(o.align) }) : undefined; },
    run: async (api, op, zh) => { const issue = op.font ? api.fontIssue(op.font, op.text) : undefined; if (issue) throw new OpProblem(issue); api.addText(op.text, op); return say(zh, `已添加文字：${op.text.slice(0, 18)}`, `Added text: ${op.text.slice(0, 18)}`); },
    ui: ['addText', 'addPreset'],
  }),
  cap({
    op: 'style', domain: 'text', zh: '改文字内容或样式',
    card: '{"op":"style","target":"title|subtitle|#t2|selection","text":"新文案","size":120,"scale":1.2,"color":"#…","tone":"ink","font":"字体名","bold":true,"italic":false,"align":"left|center|right","shadow":"none|soft|hard|glow","lineHeight":1.1,"letterSpacing":50,"highlight":"#ffe04b","stroke":"#111111","strokeWidth":6}\n  只写要改的字段。scale 是相对倍数（“大一点”≈1.15，“大很多”≈1.4）。letterSpacing 单位千分之一 em。highlight 是文字底色（荧光笔），"" 去掉。',
    examples: [['标题大一点', '{"op":"style","target":"title","scale":1.15}'], ['副标题改成“三步上手”', '{"op":"style","target":"subtitle","text":"三步上手"}'], ['字间距拉开一点', '{"op":"style","target":"title","letterSpacing":80}']],
    sanitize: o => {
      const shadow = ['none', 'soft', 'hard', 'glow'].includes(o.shadow as string) ? o.shadow as ShadowName : undefined;
      const change: TextChange = defined({ text: str(o.text, 200), size: num(o.size, 8, 600), scale: num(o.scale, 0.3, 3), color: hex(o.color), tone: tone(o.tone), font: str(o.font, 60), bold: bool(o.bold), italic: bool(o.italic), align: alignOf(o.align), shadow, lineHeight: num(o.lineHeight, 0.7, 3), letterSpacing: num(o.letterSpacing, -200, 1000), highlight: o.highlight === '' ? '' : hex(o.highlight), stroke: o.stroke === '' ? '' : hex(o.stroke), strokeWidth: num(o.strokeWidth, 0, 40) });
      if (!Object.keys(change).length) return undefined;
      const t = target(o.target); return { op: 'style', ...(t ? { target: t } : {}), ...change };
    },
    run: async (api, op, zh) => { const { op: _, target: t, ...change } = op; void _; return api.styleText(t ?? 'selection', change) ? say(zh, '已调整文字', 'Text updated') : problem(zh, '没有找到要改的文字', 'No matching text'); },
    ui: ['styleText', 'setFont', 'setShadow', 'update:text', 'update:fontSize', 'update:lineHeight', 'update:charSpacing', 'update:textBackgroundColor', 'update:textAlign', 'update:fontWeight', 'update:fontStyle'],
  }),
  cap({
    op: 'textPreset', domain: 'text', zh: '预设样式文字（标签、荧光笔、艺术字…）',
    card: `{"op":"textPreset","id":"note-marker","text":"划重点"}  加一款预设样式文字，text 写真正内容：\n${TEXT_GROUPS.map(g => `   · ${g.zh}：${TEXT_PRESETS.filter(p => p.group === g.id).map(p => `${p.id} ${p.zh}`).join(' / ')}`).join('\n')}`,
    sanitize: o => { const id = str(o.id, 32); return id && TEXT_PRESETS.some(p => p.id === id) ? { op: 'textPreset', id, ...(str(o.text, 120) ? { text: str(o.text, 120) } : {}) } : undefined; },
    run: async (api, op, zh) => { if (!api.addTextPreset(op.id, op.text)) return undefined; const p = TEXT_PRESETS.find(x => x.id === op.id); return say(zh, `已添加样式文字：${p?.zh ?? op.id}`, `Added styled text: ${p?.en ?? op.id}`); },
    ui: ['addTextStyle'],
  }),
  cap({
    op: 'icon', domain: 'asset', zh: '从离线素材库插入图标 / 贴纸',
    card: '{"op":"icon","want":{"zh":"吉他","en":["guitar","music","instrument"]},"style":"line|sticker|auto","to":"top-right","near":"title","side":"right","size":"s|m|l","tone":"accent"}\n  从离线库（约 1900 个 Lucide 线性图标 + 1200 个彩色贴纸）挑最匹配的。want.en 给 2~4 个英文同义词（库名是英文）。用户说“图标 / icon / 线条”→ line；说“贴纸 / 表情 / emoji / 彩色”→ sticker；没说→ auto。\n  位置：to 是九宫格（top-left/top/top-right/left/center/right/bottom-left/bottom/bottom-right），或 near+side 挨着某个元素；都不写时放在不挡字的空位。指定的位置被文字占用时，插件会挪到最近的空位，所以没指定位置时 reply 不要写具体在哪。tone/color 只对线性图标有效。replace:"#i3" 表示把已有图标换成新的（保留位置大小）。',
    examples: [['加一个吉他 icon', '{"op":"icon","want":{"zh":"吉他","en":["guitar","music"]},"style":"line","near":"title","side":"right","size":"m","tone":"accent"}'], ['右下角放个火箭贴纸', '{"op":"icon","want":{"zh":"火箭","en":["rocket"]},"style":"sticker","to":"bottom-right","size":"m"}'], ['把这个图标换成咖啡杯', '{"op":"icon","want":{"zh":"咖啡","en":["coffee","cup"]},"replace":"selection"}']],
    sanitize: o => {
      const w = (o.want && typeof o.want === 'object' ? o.want : {}) as Record<string, unknown>;
      const zh = str(w.zh ?? o.query ?? o.zh, 30); const en = (Array.isArray(w.en) ? w.en : typeof w.en === 'string' ? [w.en] : []).map(x => str(x, 30)).filter((x): x is string => !!x).slice(0, 5);
      if (!zh && !en.length) return undefined;
      const style: AssetStyle = o.style === 'line' || o.style === 'sticker' ? o.style : 'auto';
      const size = typeof o.size === 'number' ? num(o.size, 0.03, 0.8) : ({ xs: 0.07, s: 0.11, m: 0.17, l: 0.26, xl: 0.38 } as Record<string, number>)[String(o.size)];
      return defined({ op: 'icon' as const, want: defined({ zh, en: en.length ? en : undefined }), style, size, tone: tone(o.tone), color: hex(o.color), replace: target(o.replace), ...placement(o) });
    },
    run: (api, op) => api.addIcon(op),
    ui: ['addAssetSvg', 'addSticker'],
  }),
  cap({
    op: 'sticker', domain: 'asset', zh: '旧版贴纸指令（等同 icon）', card: '',
    sanitize: o => { const query = str(o.query, 40); return query ? { op: 'sticker', query } : undefined; },
    run: (api, op) => api.addIcon({ op: 'icon', want: { zh: op.query, en: /[a-z]/i.test(op.query) ? [op.query] : undefined }, style: 'auto' }),
  }),
  cap({
    op: 'shape', domain: 'asset', zh: '矢量形状',
    card: `{"op":"shape","kind":"heart","tone":"accent","size":0.2,"to":"top-left"}  加矢量形状（color 或 tone，size 为短边比例，位置同 icon）。基础：${BASIC_SHAPES.join(' / ')}；图形：${PATH_SHAPES.map(([id, zh]) => `${id} ${zh}`).join(' / ')}`,
    sanitize: o => { const kind = str(o.kind, 24); return kind && SHAPE_IDS.includes(kind) ? defined({ op: 'shape' as const, kind, color: hex(o.color), tone: tone(o.tone), size: num(o.size, 0.03, 1), ...placement(o) }) : undefined; },
    run: async (api, op, zh) => { const { op: _, kind, color, ...place } = op; void _; if (!api.addSemanticShape(kind, color, place)) return undefined; const name = PATH_SHAPES.find(([id]) => id === kind)?.[1] ?? kind; return say(zh, `已添加形状：${name}`, `Added shape: ${kind}`); },
    ui: ['addShape', 'addPathShape', 'addSemanticShape', 'update:rx', 'update:ry'],
  }),
  cap({
    op: 'decor', domain: 'asset', zh: '装饰库元素（下划线、光晕、波浪线…）',
    card: '{"op":"decor","items":[{"kind":"underline","at":"title","x":0,"w":0.6,"tone":"accent"}]}  从装饰库加 1~3 件，规则同 design 里的 decor（at: canvas|subject|title）。可用：' + DECOR_IDS.join(' / '),
    sanitize: o => { const items = sanitizeDecor(o.items ?? o.decor); return items ? { op: 'decor', items: items.slice(0, 4) } : undefined; },
    run: (api, op) => api.addDecor(op.items),
    ui: ['addDecor'],
  }),
  cap({
    op: 'photo', domain: 'asset', zh: 'Unsplash 照片做背景',
    card: '{"op":"photo","query":"mountain"}  用 Unsplash 摄影做整幅背景（英文词更准）。',
    sanitize: o => { const query = str(o.query, 60); return query ? { op: 'photo', query } : undefined; },
    run: (api, op) => api.addPhotoBackground(op.query),
    ui: ['addBackgroundPhoto'],
  }),
  cap({
    op: 'move', domain: 'layout', zh: '移动元素',
    card: '{"op":"move","target":"#i3","to":"bottom-right"}  挪到九宫格位置（自动留边距、避开文字）；{"near":"title","side":"left|right|above|below"} 挨着另一个元素；{"x":0.5,"y":0.3} 中心点精确到画布比例；{"dx":0.05,"dy":0} 微调（画布比例，正数向右 / 下）。',
    examples: [['把图标挪到左下角', '{"op":"move","target":"#i3","to":"bottom-left"}'], ['标题往上一点', '{"op":"move","target":"title","dy":-0.04}']],
    sanitize: o => { const p = placement(o); return Object.keys(p).length ? { op: 'move', ...(target(o.target) ? { target: target(o.target) } : {}), ...p } : undefined; },
    run: async (api, op) => { const { op: _, target: t, ...place } = op; void _; return api.moveLayers(t, place); },
    ui: ['move', 'update:left', 'update:top'],
  }),
  cap({
    op: 'resize', domain: 'layout', zh: '缩放元素',
    card: '{"op":"resize","target":"#i3","scale":1.5}  按倍数缩放（文字会改字号）；{"w":0.3} 宽度设为画布宽的 30%。',
    sanitize: o => { const scale = num(o.scale, 0.1, 6), w = num(o.w, 0.02, 1.5); return scale || w ? defined({ op: 'resize' as const, target: target(o.target), scale, w }) : undefined; },
    run: async (api, op) => api.resizeLayers(op.target, op),
    ui: ['update:width', 'update:scaleX', 'update:scaleY'],
  }),
  cap({
    op: 'align', domain: 'layout', zh: '对齐到画布',
    card: '{"op":"align","target":"#t2","to":"left|center|right|top|middle|bottom"}  贴齐画布边缘或居中（左右对齐会保留边距）。',
    sanitize: o => { const to = o.to; return to === 'left' || to === 'center' || to === 'right' || to === 'top' || to === 'middle' || to === 'bottom' ? { op: 'align', to, ...(target(o.target) ? { target: target(o.target) } : {}) } : undefined; },
    run: async (api, op, zh) => api.align(op.to, op.target) ? say(zh, '已对齐', 'Aligned') : problem(zh, '没有可对齐的元素', 'Nothing to align'),
    ui: ['align'],
  }),
  cap({
    op: 'distribute', domain: 'layout', zh: '等距分布',
    card: '{"op":"distribute","target":["#i3","#i4","#i5"],"axis":"horizontal|vertical"}  三个以上元素等间距排开。',
    sanitize: o => { const t = target(o.target); return t && (o.axis === 'horizontal' || o.axis === 'vertical') ? { op: 'distribute', target: t, axis: o.axis } : undefined; },
    run: async (api, op) => api.distributeLayers(op.target, op.axis),
  }),
  cap({
    op: 'layer', domain: 'layout', zh: '调整图层顺序',
    card: '{"op":"layer","target":"#s2","to":"front|forward|backward|back"}  置顶 / 上移 / 下移 / 置底。',
    sanitize: o => { const to = o.to; return to === 'front' || to === 'forward' || to === 'backward' || to === 'back' ? { op: 'layer', to, ...(target(o.target) ? { target: target(o.target) } : {}) } : undefined; },
    run: async (api, op) => api.orderLayers(op.target, op.to),
    ui: ['order'],
  }),
  cap({
    op: 'remove', domain: 'layout', zh: '删除元素',
    card: '{"op":"remove","target":"#i3"}  删除；target 可以是数组或 {"kind":"icon"} 这类筛选。',
    examples: [['去掉那个星星', '{"op":"remove","target":"#i4"}']],
    sanitize: o => { const t = target(o.target); return t ? { op: 'remove', target: t } : undefined; },
    run: async (api, op) => api.removeLayers(op.target),
    ui: ['removeSelection'],
  }),
  cap({
    op: 'duplicate', domain: 'layout', zh: '复制元素',
    card: '{"op":"duplicate","target":"#i3","count":2}  复制（之后可用 target:"last" 继续移动这些副本）。',
    sanitize: o => defined({ op: 'duplicate' as const, target: target(o.target), count: num(o.count, 1, 6) }),
    run: (api, op) => api.duplicateLayers(op.target, Math.round(op.count ?? 1)),
    ui: ['cloneSelection', 'copyObjects', 'pasteObjects'],
  }),
  cap({
    op: 'set', domain: 'layout', zh: '透明度、旋转、翻转、锁定、圆角、图片填充',
    card: '{"op":"set","target":"#p1","opacity":0.6,"rotate":-8,"flipX":true,"flipY":false,"lock":true,"radius":24,"fit":"cover|contain"}  只写要改的字段；radius 是圆角像素，fit 只对图片有效。',
    sanitize: o => { const out = defined({ op: 'set' as const, target: target(o.target), opacity: num(o.opacity, 0, 1), rotate: num(o.rotate, -360, 360), flipX: bool(o.flipX), flipY: bool(o.flipY), lock: bool(o.lock), radius: num(o.radius, 0, 2000), fit: o.fit === 'cover' || o.fit === 'contain' ? o.fit as 'cover' | 'contain' : undefined }); return Object.keys(out).length > (out.target ? 2 : 1) ? out : undefined; },
    run: async (api, op) => { const { op: _, target: t, ...rest } = op; void _; return api.setLayers(t, rest); },
    ui: ['toggleLock', 'setCorner', 'fitImage', 'update:opacity', 'update:angle', 'update:flipX', 'update:flipY'],
  }),
  cap({
    op: 'select', domain: 'layout', zh: '选中元素（方便用户接着手动改）',
    card: '{"op":"select","target":"#t2"}  选中它，让用户在右侧面板继续调。',
    sanitize: o => { const t = target(o.target); return t ? { op: 'select', target: t } : undefined; },
    run: async (api, op) => api.selectLayers(op.target),
  }),
  cap({
    op: 'export', domain: 'canvas', zh: '导出（只允许用户手动触发）', card: '',
    sanitize: () => undefined, // exporting writes files; a model reply never triggers it
    run: async (api, op, zh) => say(zh, `已导出：${await api.exportNow(op)}`, `Exported: ${await api.exportNow(op)}`),
    ui: ['exportNow', 'exportWith', 'openExport', 'copyToClipboard', 'copyPng', 'quickExport'],
  }),
  cap({ op: 'undo', domain: 'history', zh: '撤销', card: '{"op":"undo"} / {"op":"redo"}  撤销 / 重做。', sanitize: () => ({ op: 'undo' }), run: async (api, _op, zh) => { await api.undo(); return say(zh, '已撤销', 'Undone'); }, ui: ['undo', 'travel'] }),
  cap({ op: 'redo', domain: 'history', zh: '重做', card: '', sanitize: () => ({ op: 'redo' }), run: async (api, _op, zh) => { await api.redo(); return say(zh, '已重做', 'Redone'); }, ui: ['redo'] }),
];
/**
 * UI calls that are deliberately not assistant commands, with the reason. Everything else the panels, the insert popover and
 * the canvas menus call must be covered by a capability's `ui` list (tests/capabilities.test.ts).
 */
export const UI_ONLY: Record<string, string> = {
  newChat: 'Only the user starts a clean conversation; a model cannot reset its context.',
  switchConversation: 'Conversation history is selected explicitly by the user.',
  renameConversation: 'Conversation management is not a canvas operation.',
  deleteConversation: 'Deleting history requires the user confirmation dialog.',
  deleteTurn: 'Pruning the thread edits the conversation, not the canvas; the model never deletes its own context.',
  retryTurn: 'Retrying a failed exchange is an explicit user action scoped to its conversation.',
  branchConversation: 'Creating an independent canvas direction is an explicit user action.',
  blankConversation: 'Starting an empty artwork must never happen from model output.',
  setDrawing: 'Pointer brush mode is controlled by the user, not an assistant operation.',
  beginColorEdit: 'Coalesce a live color picker session into one undo step.',
  endColorEdit: 'Finish the live color picker undo transaction.',
  groupLayers: 'Explicit multi-selection grouping keeps editable children; not an assistant scene operation.',
  ungroupLayers: 'Explicit group selection restores child transforms and stacking order.',
  renameLayers: 'User-managed layer names support organization and search without changing assistant ids.',
  imageGuard: 'Internal canvas identity guard used by asynchronous dialogs.',
  openImageGenerator: 'Explicit image generation/edit modal; references are sent only after user submission.',
  downloadSelection: 'Explicit local PNG download of the selected elements, without modifying the canvas or invoking AI.',
  openSelectionImageGenerator: 'Explicit selected-element image editing; rasterizes only the selected elements after the user opens the dialog.',
  action: 'wrapper', ask: 'the assistant itself', changed: 'housekeeping', persistChat: 'housekeeping', flush: 'housekeeping', refreshDrawer: 'view', refreshInspector: 'view', renderGuides: 'view',
  applyZoom: 'view zoom', setZoom: 'view zoom', zoomBy: 'view zoom', toggleDrawer: 'panel layout', t: 'i18n',
  selection: 'read-only', selectionLabel: 'read-only', texts: 'read-only', copyText: 'read-only', fontsInUse: 'read-only', hasMesh: 'read-only', pairing: 'read-only', platform: 'read-only', thumbIssues: 'read-only', exportPrefs: 'read-only', encode: 'export internals',
  pickImage: 'needs a file the user picks', pickVaultImage: 'needs a file the user picks', replaceImage: 'needs a file the user picks', sourceNote: 'reads the linked note',
  saveSeries: 'manages saved looks in settings', removeSeries: 'manages saved looks in settings', repairFonts: 'installs fonts',
  restoreSnapshot: 'chat history', runThumbSuggestion: 'one-tap chat fix (runs style ops)', swapAsset: 'chat runner-up strip',
  'update:paintFirst': 'set together with stroke', update: 'generic setter; each property it sets is checked on its own', render: 'export internals',
};
const BY_OP = new Map<string, AnyCapability>(CAPABILITIES.map(c => [c.op, c]));
export const capability = (op: string): AnyCapability | undefined => BY_OP.get(op);

/** Prompt section for the chosen domains: each capability's card, then its examples. */
export function capabilityCards(domains: Domain[]): string {
  const out: string[] = [];
  for (const d of DOMAINS.filter(x => domains.includes(x.id))) {
    const caps = CAPABILITIES.filter(c => c.domain === d.id && c.card); if (!caps.length) continue;
    out.push(`## ${d.id}（${d.zh}）`);
    for (const c of caps) out.push(`- ${c.card}`);
    const ex = caps.flatMap(c => c.examples ?? []); if (ex.length) out.push('示例：' + ex.map(([u, j]) => `「${u}」→ ${j}`).join('；'));
  }
  return out.join('\n');
}

export interface Sanitized { reply: string; ops: Op[]; designs?: DesignSpec[]; options?: string[]; intent?: string; /** Why commands were dropped, in words a model can act on. */ rejected: string[] }
/** Keeps only commands the canvas understands, with every value clamped. A model can never reach anything else. */
export function sanitizeOps(raw: unknown, c: Catalog): Sanitized {
  const root = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const list = Array.isArray(root.ops) ? root.ops : root.op ? [root] : [];
  const ops: Op[] = []; const rejected: string[] = [];
  for (const item of list.slice(0, 20)) {
    if (!item || typeof item !== 'object') continue; const o = item as Record<string, unknown>;
    const k = typeof o.op === 'string' ? o.op : ''; const entry = capability(k);
    if (!entry) { rejected.push(`未知指令 ${JSON.stringify(k).slice(0, 30)}`); continue; }
    const clean = (entry.sanitize as (o: Record<string, unknown>, c: Catalog) => Op | undefined)(o, c);
    if (clean) ops.push(clean); else if (k !== 'export') rejected.push(`${k} 参数无效：${JSON.stringify(o).slice(0, 160)}`);
  }
  const designs = Array.isArray(root.designs) ? root.designs.slice(0, DESIGN_PREVIEW_LIMIT).filter((x): x is Record<string, unknown> => !!x && typeof x === 'object').map(x => sanitizeDesign(x, c)).filter(x => !!x.title && !!x.template) : [];
  // Clarifying quick answers only count when the model changed nothing; 2–4 short tappable replies.
  const options = !ops.length && !designs.length && Array.isArray(root.options) ? root.options.map(x => str(x, 40)).filter((x): x is string => !!x).slice(0, 4) : [];
  const intent = str(root.intent, 160);
  return { reply: str(root.reply, 200) ?? '', ops, ...(designs.length ? { designs } : {}), ...(options.length >= 2 ? { options } : {}), ...(intent ? { intent } : {}), rejected };
}

export interface RunResult { done: string[]; problems: string[] }
/** Applies commands in order. A command that cannot be carried out records a problem and the rest still run. */
export async function runOps(api: CoverApi, ops: Op[], zh: boolean): Promise<RunResult> {
  const done: string[] = [], problems: string[] = [];
  for (const op of ops.slice(0, 20)) {
    const entry = capability(op.op); if (!entry) continue;
    try { const note = await (entry.run as (a: CoverApi, o: Op, z: boolean) => Promise<string | undefined>)(api, op, zh); if (note) done.push(...note.split('\n').filter(Boolean)); }
    catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (e instanceof OpProblem) problems.push(`${op.op}：${message}`); else done.push(zh ? `${entry.zh}失败：${message}` : `${op.op} failed: ${message}`);
    }
  }
  return { done, problems };
}
