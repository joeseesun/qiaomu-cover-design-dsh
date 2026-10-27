import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
import { setEnv } from 'fabric';
import { COPY } from './fixtures/copy';

// Real text metrics need the native canvas binary (a Fabric dependency). Without it the layout checks are skipped, not failed.
let native = true; try { createRequire(import.meta.url)('canvas'); } catch { native = false; }
const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
setEnv({ document: dom.window.document, window: dom.window, isTouchSupported: false, WebGLProbe: { queryWebGL() {}, isSupported: () => false }, dispose() {}, copyPasteData: {} } as never);
const { TEMPLATES, templatesFor } = await import('../../src/original/templates');
const { CONTRACTS, outsideCapacity, titleUnits } = await import('../../src/original/contracts');
const { audit } = await import('../../src/original/audit');
const { layoutPass, textExtent, rectOf } = await import('../../src/original/calm');
const { PLATFORMS } = await import('../../src/original/platforms');

test('every template states its contract, and no contract outlives its template', () => {
  const ids = new Set(TEMPLATES.map(t => t.id));
  for (const id of ids) assert.ok(CONTRACTS[id], `template ${id} has no contract in src/contracts.ts`);
  for (const id of Object.keys(CONTRACTS)) assert.ok(ids.has(id), `contract ${id} has no template`);
  for (const [id, c] of Object.entries(CONTRACTS)) assert.ok(c.title[0] < c.title[1] && c.jobs.length && c.keep, id);
});
test('title capacity counts CJK as one and Latin letters as half', () => {
  assert.equal(titleUnits('别再熬夜'), 4); assert.equal(titleUnits('AI 副业'), 3);
  assert.equal(outsideCapacity('stack', '我测试了市面上所有的笔记软件'), 'long'); assert.equal(outsideCapacity('stack', '别再熬夜'), undefined);
  assert.equal(outsideCapacity('no-such-template', 'x'), undefined);
});
test('gallery templates pass the hard layout rules on every common shape', { skip: !native && 'native canvas binary missing (npm rebuild canvas)' }, () => {
  const bad: string[] = [];
  for (const shape of ['xhs', 'square', 'youtube', 'wechat']) {
    const p = PLATFORMS.find(x => x.id === shape)!;
    for (const copy of COPY.filter(c => c.id === 'short' || c.id === 'medium' || c.id === 'en')) for (const t of templatesFor(shape)) {
      const r = t.build({ width: p.width, height: p.height, zh: copy.zh, title: copy.title, subtitle: copy.subtitle, ...(copy.badge ? { badge: copy.badge } : {}) });
      layoutPass(r.objects, p.width, p.height);
      if(t.id === 'riso' && shape === 'square' && copy.id === 'short') console.log('RISO metrics', JSON.stringify(r.objects.slice(0,2).concat(r.objects.filter(o=>o.qcRole==='title')).map(o=>({type:o.type,fill:o.fill,opacity:o.opacity,fontSize:o.fontSize,text:o.text,rect:o.qcRole==='title'?textExtent(o):rectOf(o)}))));
      for (const f of audit({ width: p.width, height: p.height, background: r.background, objects: r.objects, platformId: p.id }).filter(x => x.hard)) bad.push(`${t.id} ${shape}/${copy.id}: ${f.rule} ${f.role} ${f.detail}`);
    }
  }
  assert.deepEqual(bad, [], `run \`npx tsx scripts/audit-templates.ts --failures\` to see them:\n${bad.join('\n')}`);
});
