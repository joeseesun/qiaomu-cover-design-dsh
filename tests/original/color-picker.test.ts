import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hexToHsv, hsvToHex } from '../../src/original/color-picker-math';
import { MESH_LIBRARY, MESH_PRESETS } from '../../src/original/mesh';

test('picker roundtrips primaries, neutral colors and arbitrary RGB without hue-sector errors', () => {
  for (const color of ['#000000', '#ffffff', '#808080', '#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#2563eb', '#b7dca6']) assert.equal(hsvToHex(...hexToHsv(color)), color);
  assert.equal(hsvToHex(360, 1, 1), '#ff0000');
  assert.equal(hsvToHex(-60, 1, 1), '#ff00ff');
  assert.equal(hsvToHex(120, 2, 2), '#00ff00');
});
test('mesh menu prioritizes ten pastel choices and two dark choices while restoring older presets', () => {
  assert.equal(MESH_PRESETS.length, 12);
  assert.ok(MESH_PRESETS.slice(0, 10).every(p => !p.dark));
  assert.ok(MESH_PRESETS.slice(10).every(p => p.dark));
  for (const id of ['aurora', 'sunset', 'violet']) assert.ok(MESH_LIBRARY.some(p => p.id === id));
  assert.equal(new Set(MESH_LIBRARY.map(p => p.id)).size, MESH_LIBRARY.length);
});

test('restored font-metric normalization keeps the redo branch', async () => {
  const { History } = await import('../../src/original/model');
  const history = new History(); history.reset('before'); history.push('after');
  assert.equal(history.step(-1), 'before'); history.replaceCurrent('before with measured fonts');
  history.push('before with measured fonts');
  assert.equal(history.step(1), 'after');
  assert.equal(history.step(-1), 'before with measured fonts');
});
