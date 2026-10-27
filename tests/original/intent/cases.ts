/**
 * Intent eval: real spoken requests against the fixture cover, each with a check on the commands the model returned.
 * Checks look at results (which layer, which direction, which colour), not at exact JSON, so a different but correct
 * phrasing still passes. Run with `npm run eval` against the configured model.
 */
import type { DesignSpec, Op } from '../../src/ops';
import { fontProblem, type BookFont } from '../../src/fontcheck';
import { pairingById } from '../../src/pairings';
import { resolveTarget, type Target } from '../../src/scene';
import { META, NODES } from '../fixtures/scene';

export interface Ctx { ops: Op[]; selection: string[]; designs: number; specs: DesignSpec[]; options: number; fontBook: BookFont[] }
export interface Case { id: string; domain: string; prompt: string; selection?: string[]; check: (c: Ctx) => true | string }

const ids = (t: Target | undefined, sel: string[]): string[] => resolveTarget(t, NODES, { selection: sel, width: META.width, height: META.height });
const find = <K extends Op['op']>(c: Ctx, k: K): Extract<Op, { op: K }>[] => c.ops.filter((o): o is Extract<Op, { op: K }> => o.op === k);
/** All of these must hold; the first failing message is the verdict. */
const all = (...rules: ((c: Ctx) => true | string)[]) => (c: Ctx): true | string => { for (const r of rules) { const v = r(c); if (v !== true) return v; } return true; };
const noDesign = (c: Ctx): true | string => c.ops.some(o => o.op === 'design') || c.designs ? '局部修改却重做了整页' : true;
const some = <K extends Op['op']>(k: K, ok: (o: Extract<Op, { op: K }>, c: Ctx) => boolean, why: string) => (c: Ctx): true | string => find(c, k).some(o => ok(o, c)) ? true : `${why}（得到 ${JSON.stringify(c.ops).slice(0, 200)}）`;
const hits = (t: Target | undefined, c: Ctx, id: string): boolean => ids(t, c.selection).includes(id);
const textScale = (id: string, up: boolean) => (c: Ctx): true | string => {
  const ok = find(c, 'style').some(o => hits(o.target ?? 'selection', c, id) && ((o.scale ?? 1) !== 1 || !!o.size) && (up ? (o.scale ?? 0) > 1 || (o.size ?? 0) > (NODES.find(n => n.id === id)!.size ?? 0) : (o.scale ?? 9) < 1 || (o.size ?? 999) < (NODES.find(n => n.id === id)!.size ?? 0)))
    || find(c, 'resize').some(o => hits(o.target, c, id) && (up ? (o.scale ?? 0) > 1 : (o.scale ?? 9) < 1));
  return ok ? true : `没有${up ? '放大' : '缩小'} #${id}（得到 ${JSON.stringify(c.ops).slice(0, 200)}）`;
};
const isBlue = (h?: string): boolean => !!h && /^#/.test(h) && (() => { const n = parseInt(h.slice(1), 16); const r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255; return b > r + 30 && b >= g - 10; })();
const isRed = (h?: string): boolean => !!h && (() => { const n = parseInt(h.slice(1), 16); const r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255; return r > 150 && g < 110 && b < 110; })();
const lum = (h: string): number => { const n = parseInt(h.slice(1), 16); return ((n >> 16 & 255) * 0.3 + (n >> 8 & 255) * 0.59 + (n & 255) * 0.11) / 255; };

export const CASES: Case[] = [
  // colour
  { id: 'palette-change', domain: 'color', prompt: '换下配色', check: all(noDesign, some('palette', o => !!(o.palette || o.mood || o.adjust), '没有换配色')) },
  { id: 'palette-warmer', domain: 'color', prompt: '再暖一点', check: all(noDesign, c => find(c, 'palette').some(o => o.adjust === 'warmer' || !!o.palette) ? true : '没有往暖调') },
  { id: 'palette-dark', domain: 'color', prompt: '整体做成深色的', check: all(noDesign, c => find(c, 'palette').some(o => o.adjust === 'darker' || (o.palette?.bg && lum(o.palette.bg) < 0.35) || ['ink-blue', 'graphite'].includes(o.mood ?? '')) || find(c, 'background').some(o => (o.color && lum(o.color) < 0.35) || ['graphite', 'aurora', 'midnight'].includes(o.mesh ?? '')) ? true : '没有变成深色') },
  { id: 'palette-vivid', domain: 'color', prompt: '颜色太素了，鲜艳点', check: all(noDesign, some('palette', o => o.adjust === 'vivid' || !!o.palette || !!o.mood, '没有提高鲜艳度')) },
  { id: 'accent-blue', domain: 'color', prompt: '强调色换成蓝色', check: all(noDesign, c => find(c, 'palette').some(o => isBlue(o.palette?.accent)) || find(c, 'recolor').some(o => isBlue(o.color) && ['s1', 'd1', 'i1'].some(id => hits(o.target, c, id))) ? true : '强调色没换成蓝色') },
  { id: 'recolor-star', domain: 'color', prompt: '把那个星星图标改成红色', check: all(noDesign, some('recolor', (o, c) => hits(o.target, c, 'i1') && (isRed(o.color) || o.tone === 'accent'), '星星没改成红色')) },
  { id: 'bg-cream', domain: 'color', prompt: '背景换成米白色', check: all(noDesign, c => find(c, 'background').some(o => !!o.color && lum(o.color) > 0.85) || find(c, 'palette').some(o => !!o.palette?.bg && lum(o.palette.bg) > 0.85) ? true : '背景没换成米白') },
  // assets
  { id: 'icon-guitar', domain: 'asset', prompt: '加一个吉他 icon', check: all(noDesign, some('icon', o => /吉他/.test(o.want.zh ?? '') || (o.want.en ?? []).includes('guitar'), '没有插入吉他'), c => find(c, 'icon').some(o => o.style !== 'sticker') ? true : '说的是 icon 却选了贴纸') },
  { id: 'sticker-coffee', domain: 'asset', prompt: '右下角放个咖啡贴纸', check: all(noDesign, some('icon', o => (/咖啡/.test(o.want.zh ?? '') || (o.want.en ?? []).some(e => /coffee/.test(e))) && o.style !== 'line', '没有咖啡贴纸'), c => find(c, 'icon').some(o => o.to === 'bottom-right' || (o.x !== undefined && o.x > 0.6 && (o.y ?? 0) > 0.6)) || find(c, 'move').some(o => o.to === 'bottom-right') ? true : '没放在右下角') },
  { id: 'icon-near-title', domain: 'asset', prompt: '在标题旁边加个小灯泡', check: all(noDesign, some('icon', (o, c) => (/灯泡/.test(o.want.zh ?? '') || (o.want.en ?? []).some(e => /bulb|light/.test(e))) && (o.near !== undefined ? hits(o.near, c, 't1') : false), '灯泡没挨着标题')) },
  { id: 'icon-three-stars', domain: 'asset', prompt: '在左下角加三个小星星', check: all(noDesign, c => find(c, 'icon').filter(o => /星/.test(o.want.zh ?? '') || (o.want.en ?? []).some(e => /star|sparkle/.test(e))).length + find(c, 'duplicate').reduce((s, o) => s + (o.count ?? 1), 0) >= 3 || find(c, 'shape').filter(o => o.kind === 'star').length >= 3 ? true : '没有三个星星') },
  { id: 'icon-replace', domain: 'asset', prompt: '把星星换成爱心', check: all(noDesign, c => find(c, 'icon').some(o => (/心/.test(o.want.zh ?? '') || (o.want.en ?? []).some(e => /heart/.test(e))) && (hits(o.replace, c, 'i1') || find(c, 'remove').some(r => hits(r.target, c, 'i1')))) ? true : '没有把星星替换成爱心') },
  { id: 'decor-underline', domain: 'asset', prompt: '给副标题下面加一条下划线', check: all(noDesign, c => find(c, 'decor').some(o => o.items.some(i => /underline|squiggle/.test(i.kind))) || find(c, 'shape').some(o => o.kind === 'line' || o.kind === 'rect') || find(c, 'textPreset').length > 0 ? true : '没有下划线') },
  // layout
  { id: 'move-corner', domain: 'layout', prompt: '把星星挪到左下角', check: all(noDesign, some('move', (o, c) => hits(o.target, c, 'i1') && o.to === 'bottom-left', '星星没去左下角')) },
  { id: 'remove-rocket', domain: 'layout', prompt: '删掉火箭', check: all(noDesign, some('remove', (o, c) => hits(o.target, c, 'i2') && !hits(o.target, c, 'i1'), '没有删掉火箭')) },
  { id: 'shrink-rocket', domain: 'layout', prompt: '火箭太大了', check: all(noDesign, some('resize', (o, c) => hits(o.target, c, 'i2') && ((o.scale ?? 1) < 1 || (o.w ?? 1) < 0.2), '没有缩小火箭')) },
  { id: 'title-up', domain: 'layout', prompt: '标题往上挪一点', check: all(noDesign, some('move', (o, c) => hits(o.target, c, 't1') && ((o.dy ?? 0) < 0 || (o.y !== undefined && o.y < 0.27)), '标题没往上')) },
  { id: 'subtitle-bigger', domain: 'layout', prompt: '副标题放大一点', check: all(noDesign, textScale('t2', true)) },
  { id: 'layer-back', domain: 'layout', prompt: '把火箭放到最底层', check: all(noDesign, some('layer', (o, c) => hits(o.target, c, 'i2') && o.to === 'back', '火箭没到底层')) },
  { id: 'opacity', domain: 'layout', prompt: '星星透明一点', check: all(noDesign, some('set', (o, c) => hits(o.target, c, 'i1') && (o.opacity ?? 1) < 1, '星星没变透明')) },
  { id: 'rotate', domain: 'layout', prompt: '星星转 15 度', check: all(noDesign, some('set', (o, c) => hits(o.target, c, 'i1') && Math.abs(Math.abs(o.rotate ?? 0) - 15) < 1, '星星没转 15 度')) },
  { id: 'duplicate', domain: 'layout', prompt: '复制一个星星放到左上角', check: all(noDesign, some('duplicate', (o, c) => hits(o.target, c, 'i1'), '没有复制星星'), c => find(c, 'move').some(o => o.to === 'top-left') ? true : '副本没放到左上角') },
  { id: 'remove-badge', domain: 'layout', prompt: '把“干货”标签删了', check: all(noDesign, some('remove', (o, c) => hits(o.target, c, 't3'), '没删标签文字')) },
  { id: 'center-subtitle', domain: 'layout', prompt: '让副标题水平居中', check: all(noDesign, c => find(c, 'align').some(o => hits(o.target ?? 'selection', c, 't2') && o.to === 'center') || find(c, 'move').some(o => hits(o.target, c, 't2') && (o.to === 'center' || o.to === 'top' || o.to === 'bottom' || (o.x !== undefined && Math.abs(o.x - 0.5) < 0.02))) || find(c, 'style').some(o => hits(o.target, c, 't2') && o.align === 'center') ? true : '副标题没居中') },
  { id: 'lock-title', domain: 'layout', prompt: '把标题锁住，别让我误拖', check: all(noDesign, some('set', (o, c) => hits(o.target, c, 't1') && o.lock === true, '标题没锁定')) },
  // text
  { id: 'title-text', domain: 'text', prompt: '标题改成“AI 副业 7 步走”', check: all(noDesign, some('style', (o, c) => hits(o.target, c, 't1') && o.text === 'AI 副业 7 步走', '标题文案没改对')) },
  { id: 'title-font', domain: 'text', prompt: '标题换个更活泼的字体', check: all(noDesign, c => find(c, 'style').some(o => hits(o.target, c, 't1') && !!o.font && o.font !== '得意黑') ? true : '标题字体没换') },
  { id: 'subtitle-bold', domain: 'text', prompt: '副标题加粗', check: all(noDesign, some('style', (o, c) => hits(o.target, c, 't2') && o.bold === true, '副标题没加粗')) },
  { id: 'spacing', domain: 'text', prompt: '标题字间距大一点', check: all(noDesign, some('style', (o, c) => hits(o.target, c, 't1') && (o.letterSpacing ?? 0) > 0, '字间距没变大')) },
  { id: 'highlight', domain: 'text', prompt: '给标题加个荧光笔效果', check: all(noDesign, c => find(c, 'style').some(o => hits(o.target, c, 't1') && !!o.highlight) || find(c, 'textPreset').some(o => /marker|highlight/.test(o.id)) || find(c, 'decor').some(o => o.items.some(i => /marker|highlight|underline/.test(i.kind))) ? true : '没有荧光笔效果') },
  { id: 'font-calligraphy', domain: 'font', prompt: '标题换成书法字体', check: all(noDesign, some('style', (o, c) => hits(o.target, c, 't1') && ['马善政楷书', '志莽行书', '龙藏体', '刘建毛草'].includes(o.font ?? ''), '标题没换成中文书法字体')) },
  { id: 'font-handwriting', domain: 'font', prompt: '副标题换成手写感的字体', check: all(noDesign, c => find(c, 'style').some(o => hits(o.target, c, 't2') && !!o.font && !fontProblem(o.font, NODES.find(n => n.id === 't2')!.text!, c.fontBook, true)) ? true : `副标题字体不存在或显示不了中文（得到 ${JSON.stringify(find(c, 'style').map(o => o.font))}）`) },
  { id: 'font-redesign', domain: 'font', prompt: '重新排版，字体要更有个性', check: c => {
    if (!c.designs && !c.ops.some(o => o.op === 'design')) return '没有重新排版';
    const specs = [...c.specs, ...find(c, 'design')].map(s => { const p = pairingById(s.typeset); return { ...s, titleFont: s.titleFont ?? p?.title, bodyFont: s.bodyFont ?? p?.body }; }); const bad = specs.flatMap(s => [s.titleFont && fontProblem(s.titleFont, s.title ?? '普通人如何用 AI 做副业', c.fontBook, true), s.bodyFont && fontProblem(s.bodyFont, s.subtitle ?? '从 0 到月入 3000', c.fontBook, true)]).filter(Boolean);
    if (bad.length) return String(bad[0]);
    return new Set(specs.map(s => s.titleFont).filter(Boolean)).size >= 2 || specs.length < 2 ? true : '三个方案的标题字体没有区分';
  } },
  { id: 'typeset-tech', domain: 'font', prompt: '做一张封面：AI 编程助手实测，三个月写了十万行代码', check: c => {
    const specs = [...c.specs, ...find(c, 'design')]; if (!specs.length) return '没有给出方案';
    const sets = specs.map(s => s.typeset).filter(Boolean); if (sets.length < specs.length) return `有方案没写字体搭配（${JSON.stringify(specs.map(s => s.typeset ?? s.titleFont))}）`;
    if (specs.length > 1 && new Set(sets).size < specs.length) return '候选方案的字体搭配重复';
    return sets.some(t => t === 'tech' || t === 'trend' || t === 'punch') ? true : `科技话题没选科技 / 潮流 / 干货类搭配（${sets.join(',')}）`;
  } },
  // the current selection
  { id: 'sel-bigger', domain: 'selection', prompt: '这个大一点', selection: ['i1'], check: all(noDesign, some('resize', (o, c) => hits(o.target ?? 'selection', c, 'i1') && (o.scale ?? 0) > 1, '选中的星星没放大')) },
  { id: 'sel-blue', domain: 'selection', prompt: '它换成蓝色', selection: ['i1'], check: all(noDesign, some('recolor', (o, c) => hits(o.target ?? 'selection', c, 'i1') && isBlue(o.color), '选中的星星没变蓝')) },
  { id: 'sel-delete', domain: 'selection', prompt: '删掉它', selection: ['t2'], check: all(noDesign, some('remove', (o, c) => hits(o.target, c, 't2') && !hits(o.target, c, 't1'), '没删选中的副标题')) },
  // canvas and history
  { id: 'platform', domain: 'canvas', prompt: '换成 YouTube 尺寸', check: some('platform', o => o.id === 'youtube', '没切到 YouTube') },
  { id: 'mesh', domain: 'canvas', prompt: '背景换成弥散光', check: all(noDesign, some('background', o => !!o.mesh, '没换弥散光背景')) },
  { id: 'undo', domain: 'canvas', prompt: '撤销', check: some('undo', () => true, '没有撤销') },
  // whole page
  { id: 'redesign', domain: 'design', prompt: '重新排版，换个风格', check: c => c.designs > 0 || c.ops.some(o => o.op === 'design' || o.op === 'template') ? true : '没有重新排版' },
];
