import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guardSelection, simpleColour } from '../../src/original/edit-scope';
import type { AssistantInput, AssistantResult, Op } from '../../src/original/ops';
const input: AssistantInput = { prompt: '改成红色', zh: true, fonts: [], size: { width: 1000, height: 1000 }, editScope: { kind: 'selection', ids: ['t1', 's1'] }, scene: { meta: { width: 1000, height: 1000, selection: ['t2'] }, nodes: [{ id: 't1', kind: 'text', role: 'title', box: { x: 0, y: 0, w: 100, h: 100 }, z: 0 }, { id: 't2', kind: 'text', role: 'subtitle', box: { x: 0, y: 200, w: 100, h: 100 }, z: 1 }, { id: 's1', kind: 'shape', box: { x: 200, y: 0, w: 100, h: 100 }, z: 2 }] } };
const guard = (ops: Op[]) => guardSelection({ reply: 'all changed', ops }, input);
test('simple colour commands preserve exact hex and never mistake a longer brief or negation for a direct edit', () => {
  assert.equal(simpleColour('改成红色'), '#e11d2e'); assert.equal(simpleColour('请把选中的元素改为#12AB34'), '#12ab34'); assert.equal(simpleColour('make it white'), '#ffffff'); assert.equal(simpleColour('change color to #ABCDEF'), '#abcdef');
  for (const text of ['不要红色', '红色背景和蓝色文字', '做一个小红书封面', '把标题改成“红色”', '绿色环保主题', 'remove red', 'make it red and larger']) assert.equal(simpleColour(text), undefined, text);
});
test('all, role and explicit targets are intersected with the original selection, not the current selection', () => {
  const r = guard([{ op: 'recolor', target: 'all', color: '#123456' }, { op: 'style', target: 'title', size: 80 }, { op: 'remove', target: ['t1', 't2'] }, { op: 'set', target: 't2', opacity: 0 }]);
  assert.deepEqual(r.result.ops, [{ op: 'recolor', target: ['t1','s1'], color: '#123456' }, { op: 'style', target: ['t1'], size: 80 }, { op: 'remove', target: ['t1'] }]); assert.equal(r.problems.length, 1);
});
test('selected edits reject global commands and complete design proposals', () => {
  const ops: Op[] = [{ op: 'palette', palette: { bg: '#000000' } }, { op: 'background', color: '#ff0000' }, { op: 'design', title: 'replace everything' }, { op: 'template', id: 'minimal' }, { op: 'platform', id: 'youtube' }, { op: 'undo' }, { op: 'photo', query: 'red' }, { op: 'addText', text: 'not selected' }];
  const r = guardSelection({ reply: 'replaced', ops, designs: [{ title: 'new layout' }] }, input); assert.deepEqual(r.result.ops, []); assert.equal(r.result.designs, undefined); assert.equal(r.problems.length, 1);
});
test('without a selection full-canvas operations remain available; missing selected IDs never fall back to all', () => {
  const result: AssistantResult = { reply: 'new palette', ops: [{ op: 'palette', palette: { bg: '#ee0000' } }] };
  assert.equal(guardSelection(result, { ...input, editScope: { kind: 'canvas' } }).result, result);
  const missing = { ...input, editScope: { kind: 'selection' as const, ids: ['missing'] } };
  assert.deepEqual(guardSelection({ reply: 'changed', ops: [{ op: 'recolor', color: '#123456' }] }, missing).result.ops, []);
});
