import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AI_DEFAULTS, mergeAi, saveChat, switchChat, imageReady } from '../../src/original/aiparse';
import { CHAT_SOURCES, IMAGE_SOURCES, chatSnapFrom } from '../../src/original/catalog';
test('subscription models preserve source identity and reasoning across save/reload, images stay separate', () => {
 const ai = structuredClone(AI_DEFAULTS);
 const magpie = CHAT_SOURCES.find(s => s.id === 'magpie')!;
 const snap = { ...chatSnapFrom(magpie, { key: '', baseUrl: magpie.baseUrl, model: 'claude/subscription/opus' }), chatEfforts: ['max', 'ultra'], chatEffort: 'ultra' };
 const id = saveChat(ai, snap, undefined, true); switchChat(ai, id);
 const restored = mergeAi(JSON.parse(JSON.stringify(ai)));
 assert.equal(restored.model, 'claude/subscription/opus'); assert.equal(restored.chatEffort, 'ultra');
 const chatgpt = CHAT_SOURCES.find(s => s.id === 'chatgpt')!;
 const second = saveChat(restored, chatSnapFrom(chatgpt, { key: 'secret-reference', baseUrl: chatgpt.baseUrl, model: 'fixture' }), undefined, false);
 assert.equal(restored.chatId, id); switchChat(restored, second);
 assert.equal(restored.chatEffort, undefined); assert.equal(restored.protocol, 'openai-responses');
 restored.imageOn = true; restored.imageKey = ''; restored.imageBaseUrl = ''; assert.equal(imageReady(restored), false);
 assert.equal(IMAGE_SOURCES.some(s => s.id === 'chatgpt'), false);
 assert.equal(CHAT_SOURCES.filter(s => s.group === 'plan').length, 7);
});
