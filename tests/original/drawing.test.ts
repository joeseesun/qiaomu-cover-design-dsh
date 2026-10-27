import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inkPath } from '../../src/original/drawing';
import { Path } from 'fabric/node';
test('dots and fast strokes produce closed finite editable paths', () => {
  for (const points of [[[25, 40, .5]], [[0, 0, .5], [100, 120, .5], [1600, -100, .5], [300, 40, .5]]] as [number, number, number][][]) {
    const d = inkPath(points, 12); assert.ok(d.startsWith('M') && d.endsWith('Z')); assert.ok(!/NaN|Infinity/.test(d));
    const path = new Path(d); assert.ok(path.width > 0 && path.height > 0);
  }
});
test('mouse width ignores artificial pressure, pen width follows real pressure', () => {
  const low: [number,number,number][] = [[0,0,.15],[50,0,.15],[100,0,.15]], high = low.map(p => [p[0],p[1],.9] as [number,number,number]);
  assert.equal(inkPath(low, 16), inkPath(high, 16));
  assert.ok(new Path(inkPath(high,16,true)).height > new Path(inkPath(low,16,true)).height);
});
