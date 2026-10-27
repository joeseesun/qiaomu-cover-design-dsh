import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEEDREAM_MODELS, seedreamBody, seedreamCaps, seedreamFamily, type SeedreamOptions } from '../../src/original/seedream';
const reference = { url: 'data:image/png;base64,AQID', width: 1024, height: 1024 };
test('every Seedream model uses its own supported resolution and capability constraints', () => {
  for (const model of SEEDREAM_MODELS) {
    const caps = seedreamCaps(model.family); assert.equal(seedreamFamily(model.id), model.family);
    const body = seedreamBody(model.id, 'a cover', 1080, 1440);
    assert.ok(!('n' in body)); const [w, h] = String(body.size).split('x').map(Number); assert.ok(w! * h! >= caps.minArea && w! * h! <= caps.maxArea);
    for (const size of caps.sizes) assert.equal(seedreamBody(model.id, 'test', 3, 4, { size }).size, size);
    if (model.family !== '3.0') assert.equal(seedreamBody(model.id, 'edit', 3, 4, { references: [reference] }).image, reference.url);
    if (caps.groups) assert.equal((seedreamBody(model.id, 'generate 3 images', 3, 4, { references: [reference], maxImages: 3 }).sequential_image_generation_options as {max_images:number}).max_images, 3);
    else assert.throws(() => seedreamBody(model.id, 'test', 3, 4, { maxImages: 2 }), /count/);
    if (!caps.layers) assert.throws(() => seedreamBody(model.id, '', 3, 4, { references: [reference], layers: true, size: 'auto' }), /decomposition|reference/);
  }
});
test('validation prevents unsupported and expensive combinations before sending a request', () => {
  const model = 'doubao-seedream-5-0-pro-260628';
  for (const opts of [{ size: '4K' }, { size: '512x512' }, { size: '4096x4096' }, { webSearch: true }, { maxImages: 7 }, { transparent: true }, { layers: true, references: [reference, reference] }, { references: Array(11).fill(reference) }, { references: [{...reference, width: 14}] }]) assert.throws(() => seedreamBody(model, 'test', 3, 4, opts as SeedreamOptions));
  assert.throws(() => seedreamBody('doubao-seedream-4-5-251128', 'test', 3, 4, { outputFormat: 'png' }), /JPEG/);
  assert.throws(() => seedreamBody('doubao-seedream-5-0-260128', 'test', 3, 4, { references: Array(14).fill(reference), maxImages: 2 }), /count/);
  assert.throws(() => seedreamBody(model, 'test', 100, 1), /aspect/);
  assert.throws(() => seedreamBody(model, 'test', NaN, 1), /aspect/);
});
test('Pro/Flash layer decomposition and transparent edit use the documented fields', () => {
  const model = 'doubao-seedream-5-0-flash-260915';
  const layer = seedreamBody(model, '', 3, 4, { references: [reference], layers: true, size: 'auto', outputFormat: 'png' });
  assert.equal(layer.layer_decomposition, true); assert.equal(layer.size, 'auto'); assert.ok(!('sequential_image_generation' in layer));
  const edit = seedreamBody(model, 'keep transparency', 3, 4, { references: [reference], transparent: true }); assert.equal(edit.background, 'transparent'); assert.equal(edit.output_format, 'png');
});
test('opaque endpoint IDs accept explicit family selection; legacy 3.0 remains text-only', () => {
  const body = seedreamBody('ep-custom', 'make 4 related pictures', 3, 4, { family: '4.0', maxImages: 4, size: '1K' }); assert.equal(body.size, '1K');
  const old = seedreamBody('doubao-seedream-3-0-t2i-250415', 'test', 3, 4, { seed: 123, guidance: 3 }); assert.equal(old.seed, 123); assert.equal(old.guidance_scale, 3); assert.ok(!('optimize_prompt_options' in old));
  assert.throws(() => seedreamBody('doubao-seedream-3-0-t2i-250415', 'test', 3, 4, { references: [reference] }));
});
