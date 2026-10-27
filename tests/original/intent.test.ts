import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assignIds, describeScene, layoutIssues, placeBox, regionOf, resolveTarget } from '../../src/original/scene';
import { adjustPalette, colorMap, fixPalette, hexToHsl, mergePalette, toneOf } from '../../src/original/color';
import { contrast } from '../../src/original/quality';
import { rankAssets } from '../../src/original/resolve';
import type { AssetItem } from '../../src/original/assets';
import { lucideZh } from '../../src/original/lucidezh';
import { CAPABILITIES, capabilityCards, sanitizeOps, target } from '../../src/original/capabilities';
import { routeDomains } from '../../src/original/router';
import { buildPrompt } from '../../src/original/prompt';
import { interpret, type AssistantInput } from '../../src/original/ops';
import { META, NODES, PALETTE } from './fixtures/scene';
import { fontProblem, scriptOf } from '../../src/original/fontcheck';

const catalog = { platforms: ['xhs', 'youtube'], templates: ['folio', 'number'] };
const at = { selection: [] as string[], width: META.width, height: META.height };

test('ids are stable, unique per kind, and duplicates from a copy get fresh ones', () => {
  assert.deepEqual(assignIds([{ kind: 'text' }, { kind: 'icon' }, { kind: 'text' }]), ['t1', 'i1', 't2']);
  assert.deepEqual(assignIds([{ id: 't4', kind: 'text' }, { id: 't4', kind: 'text' }, { kind: 'sticker' }]), ['t4', 't5', 'i1']);
  // A wrong prefix (a layer whose kind changed) is renumbered rather than trusted.
  assert.deepEqual(assignIds([{ id: 'i9', kind: 'text' }]), ['t1']);
});

test('the scene lists every layer with id, kind, colour token and box, effects folded into a count', () => {
  const text = describeScene(NODES, { ...META, selection: ['i1'] });
  assert.match(text, /#t1 文字 \[title\] 「普通人如何用 AI 做副业」 得意黑 132px ink\(#1f1a14\) x8-88% y17-38%/);
  assert.match(text, /#i1 线性图标 line:star accent\(#e4572e\) x80-93% y6-16% ← 选中/);
  assert.match(text, /另有 1 层背景光效/);
  assert.doesNotMatch(text, /#e1/);
});

test('targets resolve by id, role, plural kind, region and order; effects are never targets', () => {
  assert.deepEqual(resolveTarget('#i1', NODES, at), ['i1']);
  assert.deepEqual(resolveTarget('title', NODES, at), ['t1']);
  assert.deepEqual(resolveTarget('icons', NODES, at), ['i1', 'i2']);
  assert.deepEqual(resolveTarget({ kind: 'icon', where: 'top-right' }, NODES, at), ['i1']);
  assert.deepEqual(resolveTarget({ kind: 'icon', where: 'bottom' }, NODES, at), ['i2']);
  assert.deepEqual(resolveTarget({ kind: 'text', nth: 1 }, NODES, at), ['t2']);
  assert.deepEqual(resolveTarget(undefined, NODES, { ...at, selection: ['t2'] }), ['t2']);
  assert.deepEqual(resolveTarget('#e1', NODES, at), []);
  assert.deepEqual(resolveTarget('#zz9', NODES, at), []);
  assert.equal(regionOf({ x: 860, y: 90, w: 140, h: 140 }, 1080, 1440), 'top-right');
});

test('placement keeps a margin, steps around the words, and honours explicit centres', () => {
  const canvas = { width: 1080, height: 1440 }; const m = 1080 * 0.06;
  assert.deepEqual(placeBox({ w: 100, h: 100 }, { anchor: 'bottom-right' }, canvas), { x: Math.round(1080 - m - 100), y: Math.round(1440 - m - 100) });
  // The title fills the top-left: an icon asked for there lands on the nearest free spot instead.
  const title = { x: 40, y: 40, w: 600, h: 400 };
  const p = placeBox({ w: 120, h: 120 }, { anchor: 'top-left' }, canvas, [title]);
  assert.ok(p.x >= title.x + title.w || p.y >= title.y + title.h, `placed at ${JSON.stringify(p)}`);
  const beside = placeBox({ w: 80, h: 80 }, { near: title, side: 'right' }, canvas);
  assert.ok(beside.x > title.x + title.w && Math.abs(beside.y + 40 - (title.y + 200)) < 2);
  assert.deepEqual(placeBox({ w: 100, h: 100 }, { x: 0.5, y: 0.5 }, canvas), { x: 490, y: 670 });
});

test('self-check flags an icon over the words and a layer pushed off the canvas', () => {
  const nodes = [...NODES, { id: 'i3', kind: 'icon' as const, box: { x: 300, y: 300, w: 200, h: 200 }, z: 9 }, { id: 's2', kind: 'shape' as const, box: { x: 1050, y: 10, w: 200, h: 100 }, z: 10 }];
  const issues = layoutIssues(nodes, META, ['i3', 's2']);
  assert.deepEqual(issues.map(i => `${i.id}:${i.kind}`).sort(), ['i3:covers-text', 's2:off-canvas']);
  assert.deepEqual(layoutIssues(NODES, META, ['d1']), []);
});

test('palettes: relative moves shift hue and lightness and always stay readable', () => {
  const warm = adjustPalette(PALETTE, 'warmer'); const cool = adjustPalette(PALETTE, 'cooler');
  // Cooler means blue gains on red, warmer the reverse, and neutral grounds keep their lightness (beige → grey-blue, never green).
  const tilt = (h: string): number => { const n = parseInt(h.slice(1), 16); return (n & 255) - (n >> 16 & 255); };
  for (const k of ['bg', 'accent', 'sub'] as const) { assert.ok(tilt(cool[k]) > tilt(PALETTE[k]), `cooler ${k}`); assert.ok(tilt(warm[k]) < tilt(PALETTE[k]), `warmer ${k}`); }
  assert.ok(Math.abs(hexToHsl(cool.bg)[2] - hexToHsl(PALETTE.bg)[2]) < 0.02);
  const [h, , ] = hexToHsl(cool.bg); assert.ok(h > 180 && h < 260, `cool ground hue ${h}`);
  const dark = adjustPalette(PALETTE, 'darker'); assert.ok(hexToHsl(dark.bg)[2] < hexToHsl(PALETTE.bg)[2]);
  for (const p of [warm, cool, dark, adjustPalette(PALETTE, 'contrast'), adjustPalette(PALETTE, 'muted')]) assert.ok((contrast(p.ink, p.bg) ?? 0) >= 4.5, JSON.stringify(p));
  const fixed = fixPalette({ ...PALETTE, ink: '#eeeeee' }); assert.ok((contrast(fixed.ink, fixed.bg) ?? 0) >= 4.5);
  const merged = mergePalette(PALETTE, { bg: '#101010' }); assert.equal(merged.bg2, '#101010'); assert.ok((contrast(merged.ink, merged.bg) ?? 0) >= 4.5);
  const map = colorMap(PALETTE, merged); assert.equal(map.get('#f6efe3'), '#101010'); assert.equal(map.has('#e4572e'), false);
  assert.equal(toneOf('#E4572E', PALETTE), 'accent'); assert.equal(toneOf('#123456', PALETTE), undefined);
});

test('the asset resolver ranks both libraries with every phrasing and respects the style preference', () => {
  const item = (cat: 'line' | 'sticker', id: string, zh: string, tags = ''): AssetItem => ({ id, cat, zh, hay: `${zh} ${tags} ${id.replace(/-/g, ' ')}`.toLowerCase(), body: '' });
  const all = {
    stickers: [item('sticker', 'guitar', '吉他', '乐器 音乐'), item('sticker', 'rocket', '火箭')],
    lines: [item('line', 'guitar', 'guitar', lucideZh('guitar')), item('line', 'file-music', 'file music', lucideZh('file-music')), item('line', 'music', 'music', lucideZh('music'))],
  };
  const guitar = rankAssets(all, { zh: '吉他', en: ['guitar', 'music'] }, 'line').map(a => `${a.cat}:${a.id}`);
  assert.equal(guitar[0], 'line:guitar'); assert.ok(guitar.includes('sticker:guitar'), 'the other library stays available as a runner-up');
  assert.equal(rankAssets(all, { zh: '吉他' }, 'sticker')[0]!.cat, 'sticker');
  assert.equal(rankAssets(all, { en: ['music'] }, 'line')[0]!.id, 'music');
  assert.deepEqual(rankAssets(all, { zh: '潜水艇', en: ['submarine'] }), []);
  assert.match(lucideZh('guitar'), /吉他/); assert.match(lucideZh('coffee'), /咖啡/); assert.match(lucideZh('file-music'), /文件 .*音乐/);
});

test('every capability validates and clamps its own command; unknown and unsafe ones are reported', () => {
  const r = sanitizeOps({ intent: '移动图标', reply: '好', ops: [
    { op: 'move', target: '#i1', to: 'bottom-left' },
    { op: 'icon', want: { zh: '吉他', en: ['guitar', 'music'] }, style: 'line', size: 'm', near: 'title', side: 'right', tone: 'accent' },
    { op: 'palette', adjust: 'warmer' }, { op: 'palette', palette: { bg: '#FFF', ink: 'red' } },
    { op: 'resize', target: 'selection', scale: 99 }, { op: 'remove', target: 'drop table' },
    { op: 'set', target: '#p1', opacity: 3, fit: 'stretch' }, { op: 'teleport' }, { op: 'export' },
  ] }, catalog);
  assert.equal(r.intent, '移动图标');
  assert.deepEqual(r.ops[0], { op: 'move', target: '#i1', to: 'bottom-left' });
  assert.deepEqual(r.ops[1], { op: 'icon', want: { zh: '吉他', en: ['guitar', 'music'] }, style: 'line', size: 0.17, tone: 'accent', near: 'title', side: 'right' });
  assert.deepEqual(r.ops[2], { op: 'palette', adjust: 'warmer' });
  assert.deepEqual(r.ops[3], { op: 'palette', palette: { bg: '#ffffff' } });
  assert.deepEqual(r.ops[4], { op: 'resize', target: 'selection', scale: 6 });
  assert.deepEqual(r.ops[5], { op: 'set', target: '#p1', opacity: 1 });
  assert.equal(r.ops.length, 6);
  assert.equal(r.rejected.length, 2); assert.match(r.rejected.join(' '), /remove 参数无效/); assert.match(r.rejected.join(' '), /未知指令 "teleport"/);
  // The old sticker command still works.
  assert.deepEqual(sanitizeOps({ op: 'sticker', query: '火箭' }, catalog).ops, [{ op: 'sticker', query: '火箭' }]);
  assert.equal(target('x; rm -rf'), undefined); assert.deepEqual(target({ kind: 'icon', where: 'top-right', nth: 2.4 }), { kind: 'icon', where: 'top-right', nth: 2 });
});

test('capability cards carry syntax and examples for the routed domains only', () => {
  const cards = capabilityCards(['asset', 'layout']);
  assert.match(cards, /"op":"icon"/); assert.match(cards, /"op":"move"/); assert.match(cards, /加一个吉他 icon/);
  assert.doesNotMatch(cards, /"op":"palette"/); assert.doesNotMatch(cards, /"op":"design"/);
  for (const c of CAPABILITIES) assert.ok(c.card || ['sticker', 'export', 'redo'].includes(c.op), `${c.op} has no prompt card`);
});

test('requests route to the domains they touch; blank canvases and pasted material get the full design prompt', () => {
  const r = (p: string, blank = false): string[] => routeDomains(p, { blank }).domains;
  assert.deepEqual(r('换下配色'), ['layout', 'text', 'color']);
  assert.ok(r('加一个吉他 icon').includes('asset'));
  assert.ok(r('把图标挪到右下角').includes('layout'));
  assert.ok(r('重新排版').includes('design'));
  assert.ok(r('换下配色', true).includes('design'));
  assert.ok(r('x'.repeat(200)).includes('design'));
  assert.equal(routeDomains('嗯…', { blank: false }).sure, false);
});

test('a local edit gets a short prompt with the scene; a redesign keeps the full rulebook', () => {
  const input: AssistantInput = { prompt: '加一个吉他 icon', zh: true, fonts: [], size: { width: 1080, height: 1440 }, scene: { nodes: NODES, meta: META }, feedback: ['move：找不到 "#i9"'] };
  const edit = buildPrompt(input, false, ['asset', 'layout', 'text']);
  const full = buildPrompt(input, false, ['design', 'asset', 'layout', 'text', 'color', 'canvas', 'history']);
  assert.match(edit, /#t1 文字 \[title\]/); assert.match(edit, /最小改动/); assert.match(edit, /"op":"icon"/); assert.match(edit, /找不到 "#i9"/);
  assert.doesNotMatch(edit, /大师法则/);
  assert.match(full, /大师法则/); assert.match(full, /#t1 文字/); assert.match(full, /"op":"palette"/);
  assert.ok(edit.length < full.length / 2, `edit ${edit.length} vs full ${full.length}`);
});

test('the offline interpreter speaks the new commands', () => {
  const run = (prompt: string): unknown[] => interpret({ prompt, zh: true, fonts: [], size: { width: 1080, height: 1440 } }).ops;
  assert.deepEqual(run('加一个吉他 icon'), [{ op: 'icon', want: { zh: '吉他' }, style: 'line' }]);
  assert.deepEqual(run('右下角放一个火箭贴纸'), [{ op: 'icon', want: { zh: '火箭' }, style: 'sticker', to: 'bottom-right' }]);
  assert.deepEqual(run('删掉'), [{ op: 'remove', target: 'selection' }]);
  assert.deepEqual(run('挪到左下角'), [{ op: 'move', target: 'selection', to: 'bottom-left' }]);
  assert.deepEqual(run('换个暖一点的配色'), [{ op: 'palette', adjust: 'warmer' }]);
  assert.equal((run('换下配色')[0] as { op: string }).op, 'palette');
});

test('fonts: Latin-only faces are fenced off from Chinese text, unknown names are refused', () => {
  const book = [{ family: '得意黑', source: 'bundled', cjk: true }, { family: 'Anton', source: 'bundled', cjk: false }, { family: 'Bebas Neue', source: 'vault' }, { family: 'Mystery Sans', source: 'vault' }, { family: 'PingFang SC', source: 'system', zh: '苹方' }];
  assert.equal(scriptOf(book[2]!), 'latin'); assert.equal(scriptOf(book[3]!), 'unknown'); assert.equal(scriptOf(book[4]!), 'cjk');
  assert.equal(fontProblem('得意黑', '普通人如何用 AI', book, true), undefined);
  assert.equal(fontProblem('Anton', 'NO. 01', book, true), undefined);
  assert.match(fontProblem('Anton', '普通人如何用 AI', book, true)!, /只有英文字形/);
  assert.match(fontProblem('Bebas Neue', '副业', book, true)!, /只有英文字形/);
  assert.equal(fontProblem('Mystery Sans', '副业', book, true), undefined);
  assert.match(fontProblem('不存在的字体', '副业', book, true)!, /没有「不存在的字体」/);
});

test('the font guide groups faces by what they can set and says nothing needs installing', () => {
  const fontBook = [{ family: '得意黑', source: 'bundled', mood: 'display', hint: '科技', cjk: true }, { family: '思源黑体', source: 'bundled', mood: 'sans', hint: '正文', cjk: true }, { family: 'Anton', source: 'bundled', mood: 'display', hint: '冲击', cjk: false }];
  const p = buildPrompt({ prompt: '换个字体', zh: true, fonts: [], size: { width: 1080, height: 1440 }, fontBook }, false, ['text']);
  assert.match(p, /不需要另外安装/);
  assert.match(p, /中文标题字体[^]*· 得意黑[^]*中文正文字体[^]*· 思源黑体[^]*仅英文字体[^]*· Anton/);
});
