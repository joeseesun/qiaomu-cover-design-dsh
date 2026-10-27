import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { FONT_LIBRARY, looksLikeFont, unzipEntry } from '../../src/original/fontlib';

function zip(files: { name: string; data: Buffer; deflate?: boolean }[]): ArrayBuffer {
  const parts: Buffer[] = []; const central: Buffer[] = []; let offset = 0;
  for (const f of files) {
    const body = f.deflate ? deflateRawSync(f.data) : f.data; const name = Buffer.from(f.name);
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(f.deflate ? 8 : 0, 8); h.writeUInt32LE(body.length, 18); h.writeUInt32LE(f.data.length, 22); h.writeUInt16LE(name.length, 26);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(f.deflate ? 8 : 0, 10); c.writeUInt32LE(body.length, 20); c.writeUInt32LE(f.data.length, 24); c.writeUInt16LE(name.length, 28); c.writeUInt32LE(offset, 42);
    parts.push(h, name, body); central.push(c, name); offset += 30 + name.length + body.length;
  }
  const dir = Buffer.concat(central); const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(dir.length, 12); end.writeUInt32LE(offset, 16);
  const all = Buffer.concat([...parts, dir, end]); return all.buffer.slice(all.byteOffset, all.byteOffset + all.byteLength) as ArrayBuffer;
}

test('unzipEntry reads stored and deflated entries by name, also inside folders', async () => {
  const ttf = Buffer.concat([Buffer.from([0, 1, 0, 0]), Buffer.alloc(4000, 7)]);
  const archive = zip([{ name: 'readme.txt', data: Buffer.from('hi') }, { name: 'pkg/Font-Regular.ttf', data: ttf, deflate: true }]);
  const out = Buffer.from(await unzipEntry(archive, 'Font-Regular.ttf')); assert.ok(out.equals(ttf));
  assert.equal(Buffer.from(await unzipEntry(archive, 'readme.txt')).toString(), 'hi');
  await assert.rejects(unzipEntry(archive, 'missing.ttf'));
  await assert.rejects(unzipEntry(new ArrayBuffer(10), 'x'));
});

test('font sniffing rejects html error pages', () => {
  assert.equal(looksLikeFont(new Uint8Array([0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]).buffer), true);
  assert.equal(looksLikeFont(new Uint8Array([0x4f, 0x54, 0x54, 0x4f, 0, 0, 0, 0, 0, 0, 0, 0]).buffer), true);
  assert.equal(looksLikeFont(new TextEncoder().encode('<!DOCTYPE html><html>').buffer as ArrayBuffer), false);
});

test('library entries are unique, https, licensed and safe as file names', () => {
  assert.equal(new Set(FONT_LIBRARY.map(f => f.id)).size, FONT_LIBRARY.length);
  assert.equal(new Set(FONT_LIBRARY.map(f => f.family)).size, FONT_LIBRARY.length);
  for (const f of FONT_LIBRARY) { assert.ok(f.urls.length && f.urls.every(u => u.startsWith('https://')), f.id); assert.ok(f.license.length > 0, f.id); assert.ok(!/[\\/:*?"<>|]/.test(f.family), f.id); if (f.urls[0]!.endsWith('.zip')) assert.ok(f.entry, f.id); }
  for (const name of ['朱雀仿宋', '霞鹜文楷', '得意黑']) assert.ok(FONT_LIBRARY.some(f => f.family === name), name);
});
