// Local-only wire fixture: captures the actual JSON body without recording request headers/credentials.
import http from 'node:http';
import { appendFileSync, writeFileSync } from 'node:fs';
const log = process.env.COVER_NOTE_QA_LOG || '/tmp/cover-note-wire.jsonl';
writeFileSync(log, '');
http.createServer((req, res) => {
  req.setEncoding('utf8');
  let raw = ''; req.on('data', bytes => { raw += bytes; });
  req.on('end', () => {
    try {
      const body = JSON.parse(raw); appendFileSync(log, JSON.stringify(body) + '\n');
      const system = body.messages?.[0]?.content || '', user = body.messages?.at(-1)?.content || '';
      let content;
      if (system.includes('整理封面设计素材')) {
        const input = JSON.parse(user);
        content = [...input.text.matchAll(/事实\d+:[^\n]+/g)].map(m => m[0]).join('\n') || '背景：阅读体验。';
      } else {
        const title = user.startsWith('突出 EPUB') ? 'EPUB 导出更方便' : user.includes('离线朗读') ? '离线朗读恢复' : user.includes('正文变更') ? '正文变更已读取' : '基于来源笔记设计';
        content = process.env.COVER_NOTE_CHOICES ? JSON.stringify({ reply: '选择正文设计方向', ops: [], designs: [
          {template:'folio',title,subtitle:'保存暂停位置，重开继续读',typeset:'editorial'},
          {template:'highlight',title:'暂停不丢进度',subtitle:'离线朗读恢复',badge:'更新',typeset:'editorial'},
          {template:'notes',title:'朗读更新',subtitle:'离线阅读',points:['保存暂停位置','重开继续读','导出 EPUB']},
        ] }) : JSON.stringify({ reply: '已根据正文调整标题', ops: [{ op: 'style', target: 'title', text: title }] });
      }
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ choices: [{ message: { content } }] }));
    } catch { res.writeHead(500); res.end('{}'); }
  });
}).listen(19131, '127.0.0.1', () => console.log('Note request fixture listening on 127.0.0.1:19131'));
