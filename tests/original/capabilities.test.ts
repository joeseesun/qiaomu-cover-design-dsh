import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CAPABILITIES, UI_ONLY } from '../../src/original/capabilities';

const read = (f: string): string => readFileSync(new URL(`../../src/original/${f}`, import.meta.url), 'utf8');
/** Body of a CoverView method, for the canvas context menu and keyboard shortcuts. */
function method(src: string, name: string): string { const i = src.indexOf(`private ${name}(`); assert.ok(i >= 0, name); const next = src.indexOf('\n  private ', i + 10); return src.slice(i, next < 0 ? undefined : next); }

test('everything the interface can do is an assistant capability or a documented UI-only call', () => {
  const ui = ['panels.ts', 'insertpop.ts', 'modals.ts', 'fontbrowser.ts'].map(read).join('\n'); const view = read('view.ts');
  const calls = new Set([...ui.matchAll(/view\.(\w+)\(/g)].map(m => m[1]!));
  for (const body of [method(view, 'contextMenu'), method(view, 'keyboard')]) for (const m of body.matchAll(/this\.(\w+)\(/g)) calls.add(m[1]!);
  for (const m of ui.matchAll(/update\(\{([^}]*)\}/g)) for (const k of m[1]!.matchAll(/(\w+):/g)) calls.add(`update:${k[1]}`);
  const covered = new Set(CAPABILITIES.flatMap(c => c.ui ?? []));
  const missing = [...calls].filter(c => !covered.has(c) && !(c in UI_ONLY)).sort();
  assert.deepEqual(missing, [], `register these in a capability's ui list (or UI_ONLY with a reason): ${missing.join(', ')}`);
});

test('capability ops are unique and their ui entries point at real view methods', () => {
  const ops = CAPABILITIES.map(c => c.op); assert.equal(new Set(ops).size, ops.length);
  const view = read('view.ts');
  for (const name of CAPABILITIES.flatMap(c => c.ui ?? []).filter(n => !n.startsWith('update:'))) assert.match(view, new RegExp(`\\n  (?:async |private )?${name}\\(`), `${name} is not a CoverView method`);
});
