import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conversationContext, mergeConversations, newConversation, savedMessages, type SavedChat } from '../../src/original/conversations';
import { mergeSettings } from '../../src/original/config';

test('only complete successful pairs enter context, failed prompts and orphan messages stay out', () => {
  const messages: SavedChat[] = [{ role: 'assistant', text: 'orphan' }, { role: 'user', text: 'make green' }, { role: 'assistant', text: 'failed', failed: true }, { role: 'user', text: 'make red' }, { role: 'assistant', text: 'pretended done', warn: ['no actions'] }, { role: 'user', text: 'make blue' }, { role: 'assistant', text: 'done' }, { role: 'user', text: 'incomplete' }];
  assert.deepEqual(conversationContext(messages), [{ role: 'user', text: 'make blue' }, { role: 'assistant', text: 'done' }]);
});
test('long conversations retain recent complete pairs within a bounded context budget', () => {
  const messages = Array.from({ length: 20 }, (_, i): SavedChat[] => [{ role: 'user', text: `${i}`.repeat(1500) }, { role: 'assistant', text: `${i} done`.repeat(1500) }]).flat();
  const context = conversationContext(messages);
  assert.equal(context.length, 4); assert.equal(context[0]!.role, 'user'); assert.ok(context[0]!.text.startsWith('18')); assert.ok(context.at(-1)!.text.startsWith('19')); assert.equal(context.reduce((n, m) => n + m.text.length, 0), 6000);
});
test('saved sessions preserve active empty threads, drafts and failure exclusion on reload', () => {
  const failed = newConversation([{ role: 'user', text: 'old request' }, { role: 'assistant', text: 'error', failed: true }], 1, 'old');
  const empty = newConversation([], 2, 'new'); empty.draft = 'new direction';
  const books = mergeConversations({ 'a.qcover': { active: 'new', sessions: [empty, failed] } });
  assert.equal(books['a.qcover']!.active, 'new'); assert.equal(books['a.qcover']!.sessions[0]!.draft, 'new direction'); assert.deepEqual(conversationContext(books['a.qcover']!.sessions[1]!.messages), []);
  assert.equal(mergeConversations({ 'a.qcover': { active: 'missing', sessions: [empty] } })['a.qcover']!.active, 'new');
});
test('legacy chat settings survive until their canvas is opened and malformed sessions cannot break startup', () => {
  const settings = mergeSettings({ chats: { 'legacy.qcover': [{ role: 'user', text: 'a legacy direction' }] }, conversations: { 'bad.qcover': { sessions: [null, { id: 'one', messages: 'bad' }, { id: 'one', title: 'duplicate' }, { role: 'unknown' }] } } });
  assert.equal(settings.chats['legacy.qcover']![0]!.text, 'a legacy direction'); assert.equal(settings.conversations['bad.qcover']!.sessions.length, 1); assert.deepEqual(savedMessages([{ role: 'unknown', text: 'no' }, null]), []);
});
