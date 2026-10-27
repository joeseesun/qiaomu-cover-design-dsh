import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeSettings } from '../../src/original/config';
import { mergeAi, removeChat, removeImage, saveChat, saveImage, switchImage, imageConnection } from '../../src/original/aiparse';
import { CHAT_SOURCES, IMAGE_SOURCES, chatSnapFrom, imageSnapFrom, imageSourceOf } from '../../src/original/catalog';

test('new installations start with hidden center lines, while explicit saved preferences survive', () => {
  assert.equal(mergeSettings(null).guides.center, false);
  assert.equal(mergeSettings({guides: {center: true}}).guides.center, true);
  assert.equal(mergeSettings({guides: {center: false}}).guides.center, false);
});
test('new model lists are empty; a legacy configured service is migrated and can be removed completely', () => {
  assert.deepEqual(mergeAi(null).chats, []); assert.deepEqual(mergeAi(null).images, []);
  const c = mergeAi({apiKey:'fixture',model:'layout',imageOn:true,imageKey:'picture',imageModel:'image'});
  assert.equal(c.chats.length,1); assert.equal(c.images.length,1);
  removeChat(c,c.chatId); removeImage(c,c.imageId);
  const restored=mergeAi(JSON.parse(JSON.stringify(c)));
  assert.equal(restored.chats.length,0); assert.equal(restored.images.length,0);
  assert.equal(restored.apiKey,''); assert.equal(restored.imageKey,'');
});
test('editing another model preserves the default, image options and existing credentials', () => {
  const c=mergeAi(null);const source=IMAGE_SOURCES.find(s=>s.id==='ark')!;
  const first=saveImage(c,{...imageSnapFrom(source,{key:'a',baseUrl:source.baseUrl,model:'ep-1'}),imageSize:'1024x1024',imageFamily:'5.0-pro'});
  const second=saveImage(c,imageSnapFrom(source,{key:'b',baseUrl:source.baseUrl,model:'ep-2'}));
  switchImage(c,first);saveImage(c,{...c.images.find(p=>p.id===second)!.snap,imageAlias:'My model'},second);
  assert.equal(c.imageId,first);assert.equal(c.imageFamily,'5.0-pro');assert.equal(c.imageSize,'1024x1024');assert.equal(c.imageKey,'a');
  removeImage(c,second);assert.equal(c.imageId,first);assert.equal(c.imageFamily,'5.0-pro');
});
test('saved login connections use standard adapter credentials and model identity survives reload', () => {
  const c=mergeAi(null);const source=CHAT_SOURCES.find(s=>s.id==='openrouter')!;
  const a=saveChat(c,chatSnapFrom(source,{key:'oauth-fixture',baseUrl:source.baseUrl,model:'one'}));
  saveChat(c,chatSnapFrom(source,{key:'oauth-fixture',baseUrl:source.baseUrl,model:'two'}));
  const restored=mergeAi(JSON.parse(JSON.stringify(c)));
  assert.equal(restored.chats.find(p=>p.id===a)!.snap.apiKey,'oauth-fixture');assert.equal(restored.chats.length,2);
  assert.equal(imageSourceOf(imageSnapFrom(IMAGE_SOURCES.find(s=>s.id==='openai')!,{key:'x',baseUrl:'https://api.openai.com/v1',model:'gpt-image-1'})).id,'openai');
});

test('legacy inherited image connections keep their actual endpoint and do not borrow a key for an explicit endpoint', () => {
  const snap=imageSnapFrom(IMAGE_SOURCES.find(s=>s.id==='custom')!,{key:'',baseUrl:'',model:'custom-image'});
  const inherited=imageConnection({protocol:'openai',baseUrl:'https://relay.example/v1',apiKey:'layout-key'},snap);
  assert.equal(inherited.imageBaseUrl,'https://relay.example/v1');assert.equal(inherited.imageKey,'layout-key');assert.equal(imageSourceOf(inherited).id,'custom');
  const explicit=imageConnection({protocol:'openai',baseUrl:'https://relay.example/v1',apiKey:'layout-key'},{...snap,imageBaseUrl:'https://another.example/v1'});
  assert.equal(explicit.imageKey,'');assert.equal(snap.imageBaseUrl,'');
});

test('batch append keeps existing defaults, aliases and image parameters intact after reload', async () => {
  const { pickChat, pickImage } = await import('../../src/original/aiparse');
  const c = mergeAi(null), chat = CHAT_SOURCES.find(s => s.id === 'openrouter')!, image = IMAGE_SOURCES.find(s => s.id === 'ark')!;
  saveChat(c, { ...chatSnapFrom(chat, { key: 'original', baseUrl: chat.baseUrl, model: 'default-chat' }), chatAlias: 'My default' });
  saveImage(c, { ...imageSnapFrom(image, { key: 'original', baseUrl: image.baseUrl, model: 'default-image' }), imageAlias: 'My image', imageFamily: '5.0-pro', imageSize: '1536x1024' });
  const before = { chat: pickChat(c), image: pickImage(c), chatId: c.chatId, imageId: c.imageId };
  for (const model of ['new-one', 'new-two']) {
    saveChat(c, chatSnapFrom(chat, { key: 'other', baseUrl: chat.baseUrl, model }), undefined, false);
    saveImage(c, imageSnapFrom(image, { key: 'other', baseUrl: image.baseUrl, model }), undefined, false);
  }
  const loaded = mergeAi(JSON.parse(JSON.stringify(c)));
  assert.deepEqual({ chat: pickChat(loaded), image: pickImage(loaded), chatId: loaded.chatId, imageId: loaded.imageId }, before);
  assert.equal(loaded.chats.length, 3); assert.equal(loaded.images.length, 3);
});

test('added-model detection respects endpoint, credentials, inherited images and Codex executable identity', async () => {
  const { sameChatModel, sameImageModel } = await import('../../src/original/aiparse');
  const chat = chatSnapFrom(CHAT_SOURCES.find(s => s.id === 'openrouter')!, { key: 'a', baseUrl: 'https://relay.example/v1/', model: 'same' });
  assert.equal(sameChatModel(chat, { ...chat, baseUrl: 'https://relay.example/v1', preset: 'custom', chatAlias: 'alias' }), true);
  assert.equal(sameChatModel(chat, { ...chat, apiKey: 'b' }), false);
  assert.equal(sameChatModel(chat, { ...chat, baseUrl: 'https://different.example/v1' }), false);
  const codex = chatSnapFrom(CHAT_SOURCES.find(s => s.id === 'codex')!, { key: '', baseUrl: '', model: '', codexBin: '/opt/bin/codex' });
  assert.equal(sameChatModel(codex, { ...codex, codexBin: '/other/codex' }), false);
  const c = mergeAi({ apiKey: 'a', baseUrl: 'https://relay.example/v1' });
  const image = imageSnapFrom(IMAGE_SOURCES.find(s => s.id === 'custom')!, { key: '', baseUrl: '', model: 'same' });
  assert.equal(sameImageModel(c, image, { ...image, imageBaseUrl: c.baseUrl, imageKey: 'a', imageAlias: 'alias' }), true);
  assert.equal(sameImageModel(c, image, { ...image, imageBaseUrl: c.baseUrl, imageKey: 'b' }), false);
});
