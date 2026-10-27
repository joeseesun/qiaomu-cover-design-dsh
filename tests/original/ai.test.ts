import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AI_DEFAULTS, aiReady, directImageConfig, extractJson, imageReady, mergeAi, pickImageSize, sanitizeOps } from '../../src/original/aiparse';
import { STARTERS, IMAGE_STYLES } from '../../src/original/prompts';

const catalog = { platforms: ['xhs', 'youtube'], templates: ['number', 'impact', 'photo'] };

test('direct image profile selection opts in locally without changing saved defaults or the master switch', () => {
  const c = mergeAi({ enabled: true, imageOn: false, imageEngine: 'codex', images: [{ id: 'seed', snap: { imageOn: false, imageEngine: 'ark', imageKey: 'fixture', imageModel: 'seedream', imageBaseUrl: '', imageSize: 'auto' } }] });
  const before = JSON.stringify(c);
  const direct = directImageConfig(c, 'seed')!;
  assert.equal(direct.imageOn, true); assert.equal(direct.imageEngine, 'ark'); assert.ok(imageReady(direct));
  direct.images[0]!.snap.imageKey = 'changed';
  assert.equal(JSON.stringify(c), before);
  assert.equal(directImageConfig(c, 'missing'), undefined);
  assert.equal(imageReady(directImageConfig({ ...c, enabled: false }, 'seed')!), false);
});

test('extracts JSON from fenced or chatty model replies', () => {
  assert.deepEqual(extractJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(extractJson('好的！{"reply":"x}y","ops":[{"op":"undo"}]} 希望有帮助'), { reply: 'x}y', ops: [{ op: 'undo' }] });
  assert.throws(() => extractJson('no object here'));
});

test('design ops keep only known platforms, templates and valid hex colours', () => {
  const out = sanitizeOps({ reply: '好', ops: [{ op: 'design', platform: 'nope', template: 'number', title: ' 7 个技巧 ', badge: '7', palette: { bg: '#fff', ink: 'red', accent: '#EF4444' }, points: ['a', '', 'b'] }] }, catalog);
  assert.equal(out.reply, '好');
  assert.deepEqual(out.ops, [{ op: 'design', template: 'number', title: '7 个技巧', badge: '7', points: ['a', 'b'], palette: { bg: '#ffffff', accent: '#ef4444' } }]);
});

test('a model reply can never trigger export or unknown commands', () => {
  const out = sanitizeOps({ ops: [{ op: 'export' }, { op: 'delete', path: '/' }, { op: 'platform', id: 'youtube' }, 'x', null] }, catalog);
  assert.deepEqual(out.ops, [{ op: 'platform', id: 'youtube' }]);
});

test('values are clamped and a bare op object is accepted', () => {
  const out = sanitizeOps({ op: 'style', target: 'title', scale: 99, size: 1, color: 'javascript:x' }, catalog);
  assert.deepEqual(out.ops[0], { op: 'style', target: 'title', scale: 3, size: 8 });
  assert.equal(sanitizeOps(null, catalog).ops.length, 0);
});

test('configuration readiness and sizing', () => {
  const c = mergeAi({ ...AI_DEFAULTS, apiKey: 'k' });
  assert.equal(aiReady(AI_DEFAULTS), false); assert.equal(aiReady(c), true);
  assert.equal(aiReady({ ...AI_DEFAULTS, baseUrl: 'http://localhost:11434/v1' }), true);
  assert.equal(imageReady(c), false); assert.equal(imageReady({ ...c, imageOn: true }), true);
  assert.equal(imageReady({ ...c, imageOn: true, imageBaseUrl: 'https://x.test/v1' }), false);
  assert.equal(pickImageSize(1280, 720), '1536x1024'); assert.equal(pickImageSize(1080, 1440), '1024x1536'); assert.equal(pickImageSize(1080, 1080), '1024x1024'); assert.equal(pickImageSize(1080, 1080, '1536x1024'), '1536x1024');
  assert.equal(mergeAi({ protocol: 'evil', imageSize: 5 }).protocol, 'openai');
});

test('starter prompts are complete in both languages', () => {
  assert.ok(STARTERS.length >= 5);
  for (const g of STARTERS) for (const p of g.prompts) { assert.ok(p.zhPrompt && p.enPrompt && p.zh && p.en, p.id); assert.equal(/【/.test(p.zhPrompt), /【/.test(p.enPrompt), p.id); }
  assert.equal(new Set(STARTERS.flatMap(g => g.prompts.map(p => p.id))).size, STARTERS.flatMap(g => g.prompts).length);
  assert.ok(IMAGE_STYLES.some(s => s.id === 'auto' && !s.prompt));
});

test('codex preset needs no key and can generate images without an endpoint', () => {
  const c = { ...AI_DEFAULTS, preset: 'codex', protocol: 'codex' as const, imageEngine: 'codex' as const, baseUrl: '', model: '' };
  assert.equal(aiReady(c), true);
  assert.equal(imageReady({ ...c, imageOn: true }), true);
  assert.equal(imageReady({ ...c, imageOn: false }), false);
  assert.equal(mergeAi({ protocol: 'codex', imageEngine: 'codex' }).imageEngine, 'codex');
});

import { cutout, opaqueBounds } from '../../src/original/cutout';
import { DECOR_IDS, drawDecor } from '../../src/original/decor';

test('decor accepts only library pieces with clamped placement', () => {
  const out = sanitizeOps({ ops: [{ op: 'design', decor: [{ kind: 'sunburst', x: 0.6, y: -0.1, w: 0.7, tone: 'accent', opacity: 0.2 }, { kind: 'evil<script>', x: 0, y: 0, w: 0.1 }, { kind: 'ring', x: 0, y: 0, w: 99 }, { kind: 'dots', x: 0.1, y: 0.1, w: 0.1, tone: 'neon' }], subjectPrompt: 'a lamp', subjectAt: 'left' }] }, catalog);
  const spec = out.ops[0] as { decor?: { kind: string; tone?: string; opacity?: number }[]; subjectAt?: string };
  assert.deepEqual(spec.decor?.map(d => d.kind), ['sunburst', 'ring', 'dots']);
  assert.equal((spec.decor as { w: number }[])[1]!.w, 1.6);
  assert.equal(spec.decor?.[0]?.opacity, 0.2); assert.equal(spec.decor?.[2]?.tone, undefined); assert.equal(spec.subjectAt, 'left');
});

test('every decoration piece draws plain SVG in the palette colours', () => {
  const colors = { ink: '#111111', accent: '#ef4444', sub: '#777777', bg2: '#eeeeee', accentInk: '#ffffff' };
  for (const id of DECOR_IDS) {
    const art = drawDecor(id, colors, 'accent')!; assert.ok(art, id); assert.match(art.svg, /^<svg [^>]*viewBox="0 0 [\d.]+ [\d.]+"/); assert.ok(art.svg.includes('#ef4444'), id);
    assert.ok(!/<script|href|<image|<text/i.test(art.svg), id);
  }
  assert.equal(drawDecor('nope', colors), undefined);
});

test('cut-out removes a flat key background and enclosed key pockets but keeps pink that is part of the subject', () => {
  const w = 40, h = 40; const px = new Uint8ClampedArray(w * h * 4);
  for (let p = 0; p < w * h; p++) { px.set([255, 0, 255, 255], p * 4); }
  for (let y = 10; y < 30; y++) for (let x = 10; x < 30; x++) px.set([20, 120, 200, 255], (y * w + x) * 4); // blue square
  for (let y = 18; y < 23; y++) for (let x = 18; x < 23; x++) px.set([255, 90, 190, 255], (y * w + x) * 4); // a pink part of the subject stays
  for (let y = 12; y < 14; y++) for (let x = 12; x < 14; x++) px.set([255, 0, 255, 255], (y * w + x) * 4); // a pocket of pure key colour (the gap in a ring) goes
  const r = cutout(px, w, h)!; assert.ok(r);
  assert.equal(r.data[(2 * w + 2) * 4 + 3], 0);
  assert.equal(r.data[(20 * w + 20) * 4 + 3], 255); assert.equal(r.data[(12 * w + 12) * 4 + 3], 0);
  const box = opaqueBounds(r.data, w, h)!; assert.ok(box.x >= 10 && box.x <= 14 && box.w >= 12 && box.w <= 20, JSON.stringify(box));
  const busy = new Uint8ClampedArray(w * h * 4).map((_, i) => (i * 37) % 256); assert.equal(cutout(busy, w, h), undefined);
});

import { contrast, clearOfZones, ensureReadable, readableOn } from '../../src/original/quality';

test('contrast helpers pick readable colours', () => {
  assert.ok(contrast('#000000', '#ffffff')! > 20); assert.ok(contrast('#777777', '#808080')! < 1.2); assert.equal(contrast('red', '#fff'), undefined);
  assert.equal(readableOn('#0b1220'), '#ffffff'); assert.equal(readableOn('#fff7e6'), '#111111');
  assert.equal(ensureReadable('#ffffff', '#fde68a'), '#111111'); assert.equal(ensureReadable('#ffffff', '#0b1220'), '#ffffff'); assert.equal(ensureReadable('rgba(0,0,0,.5)', '#fff'), 'rgba(0,0,0,.5)');
});

test('text overlapping a platform zone is moved clear of it, or left alone when it cannot fit', () => {
  const avatar = { x: 0, y: 330, w: 450, h: 270 }; // X header: lower-left is covered
  const y = clearOfZones({ x: 60, y: 480, w: 600, h: 60 }, [avatar], 600, 20)!; assert.ok(y + 60 <= 330 - 20 + 0.01, String(y));
  assert.equal(clearOfZones({ x: 600, y: 480, w: 200, h: 60 }, [avatar], 600, 20), undefined);
  assert.equal(clearOfZones({ x: 60, y: 300, w: 600, h: 400 }, [avatar], 600, 20), undefined);
});

import { PATTERNS, PLAYBOOKS, expandPattern, patternById, playbookFor, playbookPrompt } from '../../src/original/playbook';
import { templateById } from '../../src/original/templates';
import { PLATFORMS } from '../../src/original/platforms';

test('every pattern points at real templates, library decoration and fonts', () => {
  assert.equal(new Set(PATTERNS.map(p => p.id)).size, PATTERNS.length);
  for (const p of PATTERNS) {
    assert.ok(templateById(p.template), `${p.id} template ${p.template}`);
    for (const d of p.decor) assert.ok(DECOR_IDS.includes(d.kind), `${p.id} decor ${d.kind}`);
    assert.ok(p.sample.title.length > 0 && p.copy.length > 0);
  }
  for (const pf of PLATFORMS) assert.ok(playbookFor(pf.id), pf.id);
  assert.ok(PLAYBOOKS.every(b => b.rules.length >= 4 && b.formulas.length >= 3));
});

test('a pattern fills only the gaps the model left', () => {
  const full = expandPattern({ pattern: 'yt-face', title: 'AI 写代码' }, f => f === '得意黑');
  assert.equal(full.template, 'impact'); assert.equal(full.titleFont, '得意黑'); assert.equal(full.subjectAt, 'right'); assert.ok(full.decor!.length > 0);
  const over = expandPattern({ pattern: 'yt-face', template: 'bold', palette: { accent: '#00ff00' }, decor: [] }, () => false);
  assert.equal(over.template, 'bold'); assert.equal(over.palette!.accent, '#00ff00'); assert.equal(over.palette!.bg, '#0b1b4d'); assert.deepEqual(over.decor, []); assert.equal(over.titleFont, undefined);
  assert.equal(expandPattern({ pattern: 'nope', title: 'x' }, () => true).template, undefined);
  assert.equal(patternById('xhs-number')!.family, 'xhs');
});

test('the playbook prompt carries the platform rules and only that family of patterns', () => {
  const xhs = playbookPrompt('xhs', true); assert.match(xhs, /xhs-number/); assert.doesNotMatch(xhs, /yt-face/); assert.match(xhs, /3:4/);
  const yt = playbookPrompt('youtube', false); assert.match(yt, /yt-number/); assert.doesNotMatch(yt, /yt-face/); assert.doesNotMatch(yt, /英文提示参考/);
});

import { fitTitle, orphaned, unwrap, wrapLines } from '../../src/original/templates';

test('wrapping never splits a Latin word, never strands closing punctuation, and avoids orphans', () => {
  const lines = wrapLines('5 分钟学会 Obsidian 吧', 5 * 100, 100); assert.ok(lines.some(l => l.includes('Obsidian')), lines.join('|'));
  assert.ok(lines.every(l => !/^[，。！？]/.test(l)), lines.join('|'));
  const punct = wrapLines('今天天气真的很好。', 6 * 100, 100); assert.ok(punct.every(l => !l.startsWith('。')), punct.join('|'));
  assert.equal(orphaned(['新手最容易踩的', '坑']), true); assert.equal(orphaned(['新手最容易', '踩的坑']), false);
  assert.equal(unwrap('学会\nObsi\ndian'), '学会Obsi dian');
});

test('a short headline grows large but settles on two lines or fewer without an orphan', () => {
  const size = fitTitle('别再这样做笔记了', 920, 1000, 210);
  const lines = wrapLines('别再这样做笔记了', 920, size); assert.ok(lines.length <= 2 && !orphaned(lines), `${size} ${lines.join('|')}`);
  const long = fitTitle('这是一个很长很长的标题用来测试在很多行时仍然可以放下而不溢出', 900, 600, 130); assert.ok(long >= 36 && long <= 130);
});

import { addChat, addImage, imageReady as imgReady, mergeAi, pickArkSize, pickAspect, removeChat, switchChat, switchImage, syncProfiles } from '../../src/original/aiparse';

test('old flat settings become the first saved models, and models can be added, switched and removed', () => {
  const c = mergeAi({ preset: 'deepseek', protocol: 'openai', baseUrl: 'https://api.deepseek.com/v1', apiKey: 'k1', model: 'deepseek-chat', imageOn: true, imageEngine: 'codex' });
  assert.equal(c.chats.length, 1); assert.equal(c.images.length, 1); assert.equal(c.chats[0]!.snap.model, 'deepseek-chat'); assert.equal(c.images[0]!.snap.imageEngine, 'codex');
  const first = c.chatId; const second = addChat(c); assert.equal(c.chats.length, 2); assert.equal(c.apiKey, ''); // a copy never carries the key
  c.model = 'other'; c.apiKey = 'k2'; syncProfiles(c);
  switchChat(c, first); assert.equal(c.model, 'deepseek-chat'); assert.equal(c.apiKey, 'k1');
  switchChat(c, second); assert.equal(c.model, 'other'); assert.equal(c.apiKey, 'k2');
  removeChat(c, second); assert.equal(c.chats.length, 1); assert.equal(c.model, 'deepseek-chat');
  removeChat(c, c.chatId); assert.equal(c.chats.length, 0); assert.equal(c.chatId, ''); assert.equal(aiReady(c), false); // removing the last model clears its credentials
  const img = addImage(c); c.imageEngine = 'ark'; c.imageModel = 'doubao-seedream-4-0-250828'; c.imageKey = 'ak'; syncProfiles(c); switchImage(c, c.images[0]!.id); assert.equal(c.imageEngine, 'codex'); switchImage(c, img); assert.equal(c.imageEngine, 'ark');
});

test('new picture engines need a model and a key; sizes and aspect ratios follow the canvas', () => {
  const c = mergeAi({ imageOn: true, imageEngine: 'gemini', imageModel: 'gemini-2.5-flash-image' }); assert.equal(imgReady(c), false);
  c.imageKey = 'k'; assert.equal(imgReady(c), true); c.imageEngine = 'ark'; assert.equal(imgReady(c), true); c.imageEngine = 'openrouter'; c.imageModel = ''; assert.equal(imgReady(c), false);
  assert.equal(pickAspect(1080, 1440), '3:4'); assert.equal(pickAspect(1280, 720), '16:9'); assert.equal(pickAspect(1080, 1080), '1:1');
  const [w, h] = pickArkSize(1920, 1080).split('x').map(Number); assert.ok(w! * h! >= 1024 * 1024 && Math.abs(w! / h! - 16 / 9) < 0.02, `${w}x${h}`);
});

import { TEMPLATES, templatesFor } from '../../src/original/templates';
import { PLATFORMS } from '../../src/original/platforms';

test('template ids are unique, picture slots stay on the artboard, and the studio layouts are in the gallery', () => {
  // Building text needs a DOM canvas, so layout is checked in the browser; slots and the catalogue are pure.
  const all = TEMPLATES.map(t => t.id); assert.equal(new Set(all).size, all.length);
  for (const t of TEMPLATES) for (const pf of PLATFORMS) {
    const slot = t.slot?.({ width: pf.width, height: pf.height, title: '', subtitle: '', zh: true });
    if (slot) assert.ok(slot.w > 0 && slot.h > 0 && slot.x >= -1 && slot.y >= -1 && slot.x + slot.w <= pf.width + 1 && slot.y + slot.h <= pf.height + 1, `${t.id} slot on ${pf.id}`);
  }
  const gallery = templatesFor('xhs').map(t => t.id);
  for (const id of ['highlight', 'notes', 'chat', 'keyword', 'riso', 'ticket', 'window', 'newspaper', 'polaroid', 'stack', 'serial']) assert.ok(gallery.includes(id), id);
});

test('wrapping glues a lone last character back onto its line', () => {
  const lines = wrapLines('三十天学会写作', 6 * 100, 100); assert.ok(!orphaned(lines), lines.join('|'));
});

import { addSeries, contentHints, mergeSeries, pickVariants, seriesPrompt } from '../../src/original/series';
import { thumbCheck } from '../../src/original/quality';

test('series keep only valid colours, replace their own duplicates and brief the assistant', () => {
  const list = mergeSeries([{ id: 'a', name: '干货', template: 'highlight', palette: { bg: '#FFFFFF', ink: 'red', accent: '#ffe14d' } }, { id: 'b' }, 'x']);
  assert.deepEqual(list, [{ id: 'a', name: '干货', template: 'highlight', palette: { bg: '#ffffff', accent: '#ffe14d' } }]);
  const more = addSeries(list, { id: 'c', name: '同款', template: 'highlight', palette: { bg: '#ffffff', accent: '#ffe14d' } });
  assert.equal(more.length, 1); assert.equal(more[0]!.id, 'c');
  assert.match(seriesPrompt(more), /【默认】同款/); assert.equal(seriesPrompt([]), '');
});

test('A/B variants follow the words and come from different families', () => {
  const all = ['folio', 'highlight', 'keyword', 'sage', 'notes', 'riso', 'numeral', 'chat', 'mega', 'acid'];
  assert.deepEqual(contentHints({ title: '7 个技巧', subtitle: '为什么没人告诉你？' }).slice(0, 3), ['numeral', 'number', 'chat']);
  const v = pickVariants(all, 'folio', { title: '30 天学会写作', subtitle: '从零开始' });
  assert.equal(v.length, 3); assert.equal(v[0], 'numeral'); assert.ok(!v.includes('folio') && !v.includes('acid'));
  assert.ok(!v.includes('highlight'), 'same family as the current layout is skipped while others exist');
  assert.ok(!pickVariants(all, 'folio', { title: 'AI 时代的设计师' }).includes('numeral'), 'no numeral without a number');
});

test('the feed-size check flags tiny words and over-long headlines', () => {
  assert.deepEqual(thumbCheck([{ role: 'title', size: 160, text: '30 天学会写作' }, { role: 'subtitle', size: 48, text: 'x' }], 1080, 'xhs'), []);
  const bad = thumbCheck([{ role: 'title', size: 60, text: '新手做小红书最容易踩的十个坑和解决办法' }, { role: 'subtitle', size: 24, text: 'x' }], 1080, 'xhs');
  assert.deepEqual(bad.map(b => `${b.role}:${b.kind}`), ['title:small', 'subtitle:small', 'title:long']);
});

test('a headline the writer broke into lines keeps one line per paragraph', () => {
  const text = '7 个技巧\n笔记效率翻倍'; const size = fitTitle(text, 700, 900, 190);
  assert.deepEqual(wrapLines(text, 700, size), ['7 个技巧', '笔记效率翻倍'], String(size));
});

test('Seedream family survives opaque endpoint profile persistence without leaking to other models', async () => {
  const { AI_DEFAULTS, mergeAi, saveImage, switchImage, directImageConfig } = await import('../../src/original/aiparse');
  const config = mergeAi(AI_DEFAULTS); const old = saveImage(config, { imageOn: true, imageEngine: 'api', imageBaseUrl: 'https://example.com/v1', imageKey: 'fixture', imageModel: 'image', imageSize: 'auto' });
  const id = saveImage(config, { imageOn: true, imageEngine: 'ark', imageBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3', imageKey: 'fixture', imageModel: 'ep-custom', imageSize: 'auto', imageFamily: '4.5' });
  const restored = mergeAi(JSON.parse(JSON.stringify(config))); assert.equal(directImageConfig(restored, id)?.imageFamily, '4.5');
  switchImage(restored, old); assert.equal(restored.imageFamily, undefined); assert.equal(directImageConfig(restored, id)?.imageFamily, '4.5');
});

test('model aliases survive persistence, switch independently and never replace provider model IDs', async () => {
  const { chatLabel, imageLabel, saveChat, saveImage, switchChat, switchImage, syncProfiles, pickChat, pickImage } = await import('../../src/original/aiparse');
  const c = mergeAi({});
  const chat = saveChat(c, { ...pickChat(c), model: 'actual-layout-model', chatAlias: '我的排版助手' });
  const image = saveImage(c, { ...pickImage(c), imageOn: true, imageEngine: 'ark', imageModel: 'doubao-seedream-5-0-260128', imageKey: 'fixture', imageAlias: '封面插画' });
  syncProfiles(c); const restored = mergeAi(JSON.parse(JSON.stringify(c)));
  assert.equal(chatLabel(pickChat(restored)), '我的排版助手'); assert.equal(imageLabel(pickImage(restored)), '封面插画');
  assert.equal(restored.model, 'actual-layout-model'); assert.equal(restored.imageModel, 'doubao-seedream-5-0-260128');
  const noAliasChat = saveChat(restored, { ...pickChat(restored), chatAlias: undefined, model: 'second-model' });
  const noAliasImage = saveImage(restored, { ...pickImage(restored), imageAlias: undefined, imageModel: 'gpt-image-1', imageEngine: 'api' });
  assert.equal(chatLabel(pickChat(restored)), 'second-model'); assert.equal(imageLabel(pickImage(restored)), 'gpt-image-1');
  switchChat(restored, chat); switchImage(restored, image); assert.equal(restored.chatAlias, '我的排版助手'); assert.equal(restored.imageAlias, '封面插画');
  switchChat(restored, noAliasChat); switchImage(restored, noAliasImage); assert.equal(restored.chatAlias, undefined); assert.equal(restored.imageAlias, undefined);
  assert.equal(directImageConfig(restored, image)!.imageAlias, '封面插画');
  saveImage(restored, { ...restored.images.find(p => p.id === image)!.snap, imageAlias: '插画改名' }, image); saveChat(restored, { ...restored.chats.find(p => p.id === chat)!.snap, chatAlias: '排版改名' }, chat);
  assert.equal(restored.chatId, noAliasChat); assert.equal(restored.imageId, noAliasImage); assert.equal(restored.chatAlias, undefined); assert.equal(restored.imageAlias, undefined);
});
