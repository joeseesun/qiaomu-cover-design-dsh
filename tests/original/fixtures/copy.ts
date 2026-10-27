/** Copy the template audit lays out: the range real covers have, from a four-character hook to a long mixed CJK/Latin title. */
export interface Copy { id: string; zh: boolean; title: string; subtitle: string; badge?: string; points?: string[] }
export const COPY: Copy[] = [
  { id: 'short', zh: true, title: '别再熬夜', subtitle: '三个习惯让你睡得更好', badge: '健康' },
  { id: 'medium', zh: true, title: '普通人如何用 AI 做副业', subtitle: '从 0 到月入 3000 的完整路线', badge: '干货' },
  { id: 'long', zh: true, title: '我测试了市面上所有的笔记软件，最后只留下这一个', subtitle: '用了三个月，说说真实的感受和取舍', badge: '深度测评', points: ['同步稳定，不丢数据', '插件生态丰富', '本地文件，永远属于自己'] },
  { id: 'points', zh: true, title: '7 个睡眠技巧', subtitle: '固定起床；睡前不看手机；午睡别太久', badge: '收藏', points: ['每天固定时间起床', '睡前一小时不看手机', '午睡不超过 20 分钟'] },
  { id: 'en', zh: false, title: 'How I Built a Second Brain in Obsidian', subtitle: 'A practical system for notes, tasks and writing', badge: 'Guide' },
];
/** One platform per canvas shape: 3:4, 1:1, 9:16, 16:9, 2.35:1 and 5:2 with an avatar zone. */
export const SHAPES = ['xhs', 'square', 'vertical', 'youtube', 'wechat', 'x'];
