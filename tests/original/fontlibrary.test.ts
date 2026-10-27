import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { BUNDLED_FONTS, FONT_LIBRARY_REPO, FONT_LIBRARY_VERSION } from '../../src/original/fontmanifest';
import { fetchFont, fontMirrors, syncFonts, syncPlan, type SyncIO } from '../../src/original/fontsync';
import { PAIRINGS } from '../../src/original/pairings';
import { MOODS, resolvePair } from '../../src/original/typeset';
import { TEMPLATES } from '../../src/original/templates';
import type { BundledFont } from '../../src/original/fonts';

const families = new Set(BUNDLED_FONTS.map(f => f.family));
const byFamily = new Map(BUNDLED_FONTS.map(f => [f.family, f]));

test('the library manifest is complete, unique and open-licence', () => {
  assert.ok(BUNDLED_FONTS.length >= 30);
  for (const key of ['id', 'family', 'file'] as const) assert.equal(new Set(BUNDLED_FONTS.map(f => f[key])).size, BUNDLED_FONTS.length, `duplicate ${key}`);
  for (const f of BUNDLED_FONTS) {
    assert.match(f.sha256, /^[0-9a-f]{64}$/, f.id); assert.ok(f.bytes > 1000, f.id); assert.equal(f.license, 'OFL-1.1', f.id);
    assert.ok(f.roles.length && [1, 2, 3].includes(f.priority), f.id); assert.match(f.file, /\.(woff2|ttf|otf)$/, f.id);
    if (f.cjk) assert.ok((f.coverage ?? 0) >= 6000, `${f.id} covers ${f.coverage} of the 8105 standard characters`);
  }
  assert.match(FONT_LIBRARY_VERSION, /^\d+\.\d+\.\d+$/); assert.equal(FONT_LIBRARY_REPO, 'joeseesun/qiaomu-cover-fonts');
});

test('every pairing uses library faces in the right script', () => {
  assert.ok(PAIRINGS.length >= 10); assert.equal(new Set(PAIRINGS.map(p => p.id)).size, PAIRINGS.length);
  for (const p of PAIRINGS) {
    for (const f of [p.title, p.body]) assert.equal(byFamily.get(f)?.cjk, true, `${p.id}: ${f} must be a Chinese library face`);
    for (const f of [p.latin, p.tag ?? p.latin]) assert.equal(byFamily.get(f)?.cjk, false, `${p.id}: ${f} must be a Latin library face`);
    assert.notEqual(p.title, p.body, `${p.id}: headline and body need contrast`);
  }
});

test('with only the library installed, every template gets library faces for headline and body', () => {
  for (const mood of Object.values(MOODS)) assert.ok(families.has(mood.title[0]!) && families.has(mood.body[0]!), `${mood.zh} should lead with library faces`);
  for (const t of TEMPLATES) {
    const r = resolvePair(t.id, f => families.has(f));
    assert.ok(r.title && families.has(r.title) && r.body && families.has(r.body), `${t.id} → ${r.title} / ${r.body}`);
    assert.equal(r.titleBold, false, `${t.id}: library faces are single weight and must not be faux-bolded`);
  }
});

const font = (id: string, priority: number, bytes: number, data = `font-${id}`): BundledFont & { data: string } => ({ id, family: id, en: id, mood: 'sans', roles: ['title'], zh: '', hint: '', file: `${id}.woff2`, bytes, sha256: createHash('sha256').update(data).digest('hex'), cjk: true, priority, license: 'OFL-1.1', home: '', data });
const enc = (s: string): ArrayBuffer => { const b = new TextEncoder().encode(s); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; };
function fakeIO(serve: (url: string) => string | undefined): SyncIO & { written: Map<string, string> } {
  const written = new Map<string, string>();
  return {
    written,
    fetch: async url => { const body = serve(url); if (body === undefined) throw new Error('404'); return enc(body); },
    sha256: async data => createHash('sha256').update(Buffer.from(data)).digest('hex'),
    write: async (path, data) => { written.set(path, Buffer.from(data).toString()); },
  };
}

test('sync plan: missing files only, default-template faces first, smaller first', () => {
  const fonts = [font('c', 3, 10), font('a2', 1, 900), font('a1', 1, 100), font('b', 2, 50), font('done', 1, 5)];
  assert.deepEqual(syncPlan(fonts, new Set(['done'])).map(f => f.id), ['a1', 'a2', 'b', 'c']);
  const m = fontMirrors('o/r', '1.0.0');
  assert.equal(m[0], 'https://cdn.jsdelivr.net/gh/o/r@1.0.0/'); assert.equal(m.at(-1), 'https://raw.githubusercontent.com/o/r/1.0.0/');
});

test('a file is only written when its bytes match the manifest; a bad mirror falls through to the next', async () => {
  const f = font('x', 1, 'font-x'.length);
  const io = fakeIO(url => url.startsWith('https://bad/') ? 'corrupt' : url.endsWith('x.woff2') ? 'font-x' : url.endsWith('x.txt') ? 'OFL' : undefined);
  await fetchFont(f, ['https://bad/', 'https://good/'], io);
  assert.equal(io.written.get('fonts/x.woff2'), 'font-x'); assert.equal(io.written.get('fonts/licenses/x.txt'), 'OFL');
  const never = fakeIO(() => 'corrupt');
  await assert.rejects(fetchFont(f, ['https://bad/'], never)); assert.equal(never.written.size, 0);
});

test('sync carries on past failures, reports them, and signals once the default faces are in', async () => {
  const plan = [font('p1', 1, 7, 'font-p1'), font('p2', 1, 7, 'font-p2'), font('s1', 2, 7, 'font-s1'), font('broken', 3, 11, 'font-broken')];
  const io = fakeIO(url => { const m = /fonts\/(\w+)\.woff2$/.exec(url); return m && m[1] !== 'broken' ? `font-${m[1]}` : undefined; });
  const ready: string[] = []; let priority = 0;
  const r = await syncFonts({ plan, mirrors: ['https://m/'], io, onReady: f => ready.push(f.id), onPriorityDone: () => { priority++; } });
  assert.deepEqual(r.failed, ['broken']); assert.deepEqual(ready.sort(), ['p1', 'p2', 's1']); assert.equal(priority, 1);
});

test('a failing callback (a tab that is not loaded yet) never stops the downloads', async () => {
  const plan = [font('a', 1, 6, 'font-a'), font('b', 2, 6, 'font-b'), font('c', 3, 6, 'font-c')];
  const io = fakeIO(url => { const m = /fonts\/(\w)\.woff2$/.exec(url); return m ? `font-${m[1]}` : undefined; });
  const ready: string[] = []; const err = console.error; console.error = () => undefined;
  try {
    const r = await syncFonts({ plan, mirrors: ['https://m/'], io, concurrency: 1, onReady: f => { ready.push(f.id); throw new Error('view not ready'); }, onPriorityDone: () => { throw new Error('repairFonts is not a function'); } });
    assert.deepEqual(r.failed, []); assert.deepEqual(ready, ['a', 'b', 'c']);
  } finally { console.error = err; }
});
