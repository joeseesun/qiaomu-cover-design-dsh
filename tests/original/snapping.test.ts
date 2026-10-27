import { test } from 'node:test';
import assert from 'node:assert/strict';
import { snapAxis } from '../../src/original/snapping';

test('snap keeps the acquired edge and guide when competing lines become closer', () => {
  const acquired = snapAxis([95, 145, 195], [100, 106, 156], 6)!;
  assert.equal(acquired.line, 100);
  const held = snapAxis([104, 154, 204], [100, 106, 156], 6, acquired)!;
  assert.equal(held.line, 100);
  assert.equal(held.edge, 0);
  assert.equal(held.delta, -4);
  assert.equal(snapAxis([111, 161, 211], [100], 6, held), undefined);
});

test('zoom uses a constant screen radius and axes can release independently', () => {
  for (const zoom of [0.25, 0.55, 1, 2]) {
    const radius = 6 / zoom;
    assert.ok(snapAxis([100 - 5 / zoom], [100], radius));
    assert.equal(snapAxis([100 - 7 / zoom], [100], radius), undefined);
  }
});
