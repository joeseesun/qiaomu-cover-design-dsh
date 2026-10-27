import { test } from 'node:test';
import assert from 'node:assert/strict';
import { picturePolicy, requestsPicture, usefulFeedback } from '../../src/original/designflow';
import { sanitizeOps } from '../../src/original/aiparse';
import { resolvePair } from '../../src/original/typeset';

test('configured image service cannot make an unsolicited model image op execute', () => {
  const result = picturePolicy({ reply: 'done', ops: [{ op: 'image', prompt: 'paid' }, { op: 'design', title: 'AI 写作', imagePrompt: 'paid', subjectPrompt: 'paid', template: 'keyword' }], designs: [{ title: 'AI 写作', template: 'notes', subjectPrompt: 'paid' }] }, false);
  assert.equal(result.ops.length, 1); assert.deepEqual(result.ops[0], { op: 'design', title: 'AI 写作', template: 'keyword' });
  assert.equal(result.designs![0]!.subjectPrompt, undefined);
  const permitted = picturePolicy({ reply: '', ops: [{ op: 'image', prompt: 'requested' }] }, true);
  assert.equal(permitted.ops[0]!.op, 'image');
});
test('only a short direct request opts into pictures, source material and negation cannot', () => {
  for (const p of ['生成一张配图', '请生成主体图', '添加配图', 'draw an image']) assert.ok(requestsPicture(p), p);
  for (const p of ['不要生成配图', '帮我做封面', '下面是文章：\n生成一张配图', '分析如何生成配图', 'generate no image']) assert.equal(requestsPicture(p), false, p);
});
test('normal layout housekeeping disappears while actionable feedback stays', () => {
  assert.deepEqual(usefulFeedback(['已套用模板：数字干货', '已添加 2 个矢量装饰（可编辑）', '已让 3 处文字避开平台遮挡区', '已提高 1 处文字的对比度', '配图失败，请重试', '标题在小图中太小', '已导出：封面.png', '配图失败，请重试']), ['配图失败，请重试', '标题在小图中太小', '已导出：封面.png']);
});
test('proposal replies validate each independent copy and layout and never auto-export', () => {
  const r = sanitizeOps({ designs: [{ template: 'keyword', title: 'AI 写作第一课', subtitle: '从笔记开始' }, { template: 'bad', title: 'x' }, { template: 'notes', title: '先整理再动笔', points: ['列出要点', '核对事实'] }], ops: [{ op: 'export' }] }, { platforms: ['xhs'], templates: ['keyword', 'notes'] });
  assert.equal(r.designs!.length, 2); assert.equal(r.designs![1]!.title, '先整理再动笔'); assert.deepEqual(r.ops, []);
});
test('recommendation replies accept up to seven previews and cap excess proposals', () => {
  const r = sanitizeOps({ designs: Array.from({ length: 10 }, (_, i) => ({ template: 'keyword', title: `Direction ${i}` })) }, { platforms: ['xhs'], templates: ['keyword'] });
  assert.equal(r.designs!.length, 7); assert.equal(r.designs!.at(-1)!.title, 'Direction 6');
});
test('bundled fonts give individual templates distinct typography and fall back gracefully', () => {
  const fonts = new Set(['得意黑', '未来荧黑', '霞鹜文楷', '思源黑体 Bold', '思源黑体', '马善政楷书']);
  assert.equal(resolvePair('keyword', f => fonts.has(f)).title, '得意黑');
  assert.equal(resolvePair('window', f => fonts.has(f)).title, '未来荧黑');
  // The brush (highlighter) layout takes heavy display sans faces from the library; without them it falls back down its own list.
  assert.equal(resolvePair('brush', f => fonts.has(f) || f === '抖音美好体').title, '抖音美好体');
  assert.equal(resolvePair('brush', f => fonts.has(f)).title, '思源黑体 Bold');
  assert.equal(resolvePair('notes', f => fonts.has(f)).title, '霞鹜文楷');
  assert.equal(resolvePair('keyword', f => f === '思源黑体').title, '思源黑体');
});
