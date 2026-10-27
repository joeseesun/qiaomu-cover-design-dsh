/**
 * What each template promises, written down so a layout can be chosen and edited on purpose rather than by look alone.
 * Borrowed from hugohe3/ppt-master, where every reusable layout ships a spec next to its SVGs:
 * - jobs      the communication jobs it does well (ppt-master's "page role vocabulary": a role, not a topic);
 * - title     how many title characters it holds well (its slot capacity; Latin counts about two letters per character);
 * - keep      its signature: the few things that make it this template, which an edit must not remove or recolour;
 * - tone      light or dark ground, so a set of variants can mix them on purpose.
 * The structure lives in templates.ts and colour comes from the palette (or the user's series), so a contract says nothing
 * about either: one owner per fact.
 */
export type Job = 'opinion' | 'list' | 'number' | 'howto' | 'review' | 'compare' | 'quote' | 'story' | 'lifestyle' | 'news' | 'series' | 'launch' | 'qa' | 'event';
export interface Contract { jobs: Job[]; title: [number, number]; keep: string; tone: 'light' | 'dark' }

export const JOB_ZH: Record<Job, string> = {
  opinion: '观点', list: '清单', number: '数字榜单', howto: '教程', review: '测评', compare: '对比', quote: '金句', story: '故事 / Vlog',
  lifestyle: '生活种草', news: '资讯 / 评论', series: '系列栏目', launch: '发布 / 产品', qa: '问答', event: '活动 / 课程',
};

export const CONTRACTS: Record<string, Contract> = {
  regeng: { jobs: ['news', 'series', 'list'], title: [4, 14], keep: '黑色话题条、三层错位描边卡片、左下 No. 期号', tone: 'light' },
  interview: { jobs: ['howto', 'list', 'opinion'], title: [4, 12], keep: '黑底黄字、指向标题的手绘大箭头、白框英文标签', tone: 'dark' },
  brush: { jobs: ['list', 'howto', 'opinion'], title: [6, 16], keep: '末行下的绿色笔刷、歪贴的“建议收藏”标签、✓ 清单行', tone: 'light' },
  calendar: { jobs: ['quote', 'series', 'event'], title: [4, 14], keep: '纯色底上带装订环的白色日历页', tone: 'light' },
  frame: { jobs: ['event', 'news', 'launch'], title: [2, 8], keep: '纯色底、一圈细内框、撑满框的超大标题、角落太阳圆', tone: 'light' },
  kicker: { jobs: ['qa', 'opinion', 'story'], title: [4, 10], keep: '细字引题 + 粗黑主标题、双线胶囊标签、右滑查看', tone: 'light' },
  corner: { jobs: ['list', 'howto', 'lifestyle'], title: [4, 12], keep: '右下斜切的薄荷色块、黑色胶囊副标题、弯箭头', tone: 'light' },
  folio: { jobs: ['opinion', 'story', 'news'], title: [6, 16], keep: '贴左大标题、一条细线、过半留白', tone: 'light' },
  highlight: { jobs: ['howto', 'list', 'opinion'], title: [6, 16], keep: '每行标题下的荧光笔条', tone: 'light' },
  keyword: { jobs: ['review', 'howto', 'launch'], title: [3, 10], keep: '饱和纯色底、超粗白字、倾斜的黄色关键词标签', tone: 'dark' },
  sage: { jobs: ['opinion', 'lifestyle', 'story'], title: [6, 16], keep: '鼠尾草底上的一张米白纸卡，字都在卡上', tone: 'light' },
  notes: { jobs: ['list', 'howto', 'lifestyle'], title: [6, 16], keep: '备忘录界面：返回键、日期、勾选清单（points）', tone: 'light' },
  riso: { jobs: ['story', 'event', 'lifestyle'], title: [4, 14], keep: '粉与蓝两种专色、轻微错版的标题、颗粒', tone: 'light' },
  numeral: { jobs: ['number', 'list', 'howto'], title: [4, 14], keep: '标题里的数字放成巨型单色数字', tone: 'light' },
  ticket: { jobs: ['event', 'story', 'series'], title: [4, 14], keep: '缺口与齿孔、存根上的标签和条码', tone: 'light' },
  polaroid: { jobs: ['story', 'lifestyle'], title: [4, 14], keep: '贴胶带的拍立得相纸（图位）和相纸下沿的标签', tone: 'light' },
  serial: { jobs: ['series', 'news'], title: [6, 18], keep: '深绿栏目条：栏目名与大期号', tone: 'light' },
  chat: { jobs: ['qa', 'opinion'], title: [4, 16], keep: '一问一答两个气泡：副标题是问，标题是答', tone: 'light' },
  window: { jobs: ['howto', 'review', 'launch'], title: [6, 16], keep: 'macOS 窗口：红黄绿三点与文件名标签', tone: 'light' },
  newspaper: { jobs: ['news', 'opinion', 'series'], title: [8, 20], keep: '衬线报头、双线、期号栏与分栏灰条', tone: 'light' },
  stack: { jobs: ['quote', 'opinion'], title: [2, 8], keep: '同一句标题重复渐淡，中间一行红色实字', tone: 'light' },
  bili: { jobs: ['howto', 'review', 'news'], title: [6, 16], keep: '粉蓝双色、分区标签、小电视画框（图位）', tone: 'light' },
  pop: { jobs: ['lifestyle', 'list', 'launch'], title: [4, 14], keep: '明黄底、歪贴的彩色贴纸、白色胶囊副标题', tone: 'light' },
  swiss: { jobs: ['opinion', 'event', 'news'], title: [4, 12], keep: '红圆、极粗无衬线、网格细线', tone: 'light' },
  collage: { jobs: ['lifestyle', 'story'], title: [4, 14], keep: '牛皮纸、撕纸色块、胶带与贴纸', tone: 'light' },
  mega: { jobs: ['opinion', 'quote', 'review'], title: [2, 10], keep: '标题撑满画面的高饱和纯色底', tone: 'dark' },
  ticker: { jobs: ['review', 'launch'], title: [3, 10], keep: '斜向滚动字带', tone: 'light' },
  memo: { jobs: ['howto', 'list'], title: [6, 16], keep: '横线纸、红色页边线、荧光笔', tone: 'light' },
  mag: { jobs: ['story', 'news', 'series'], title: [6, 16], keep: '衬线巨标题、巨型虚影期号、报头细线', tone: 'light' },
  print: { jobs: ['opinion', 'event'], title: [4, 14], keep: '黑、米白与一抹朱红，裁切线、套准标、条码', tone: 'light' },
  bento: { jobs: ['list', 'howto'], title: [4, 12], keep: '深色标题卡加三张彩色要点卡（points）', tone: 'light' },
  calm: { jobs: ['opinion', 'story', 'lifestyle'], title: [4, 14], keep: '大号衬线标题、竖线与弧线、沿边小字', tone: 'light' },
  seal: { jobs: ['quote', 'story'], title: [2, 10], keep: '宣纸、淡墨巨圆、红印章；短中文标题竖排', tone: 'light' },
  compare: { jobs: ['compare', 'review'], title: [4, 14], keep: '斜切分屏与 VS，副标题写成「A | B」', tone: 'light' },
  split: { jobs: ['review', 'launch', 'story'], title: [4, 14], keep: '右侧橙色拱门窗（图位）与太阳圆', tone: 'light' },
  impact: { jobs: ['review', 'launch'], title: [2, 8], keep: '放射光与红色角标，右侧主体位', tone: 'dark' },
  neon: { jobs: ['launch', 'howto'], title: [4, 14], keep: '透视网格、霓虹字、取景框角标', tone: 'dark' },
  quote: { jobs: ['quote'], title: [6, 20], keep: '巨型金色引号与衬线金句', tone: 'dark' },
  cinema: { jobs: ['story'], title: [4, 14], keep: '青橙调光、取景角、字距拉开的衬线片名', tone: 'dark' },
  minimal: { jobs: ['opinion', 'news'], title: [6, 18], keep: '只有字和一条强调短线', tone: 'light' },
  bold: { jobs: ['opinion', 'review', 'howto'], title: [4, 14], keep: '高饱和纯色与黑色粗字', tone: 'light' },
  poster: { jobs: ['quote', 'opinion'], title: [2, 10], keep: '满屏居中大字', tone: 'dark' },
  number: { jobs: ['number', 'list'], title: [4, 12], keep: '标题里的数字做超大钩子', tone: 'light' },
  neo: { jobs: ['lifestyle', 'howto', 'launch'], title: [4, 14], keep: '黑粗框、硬阴影卡片、荧光底', tone: 'light' },
  acid: { jobs: ['launch', 'lifestyle'], title: [4, 12], keep: '粉紫弥散光、颗粒与一枚闪光', tone: 'light' },
  glass: { jobs: ['launch', 'howto'], title: [4, 14], keep: '磨砂玻璃卡片与悬浮胶囊', tone: 'light' },
};

/** Title length as a reader counts it: a CJK character is one, a Latin letter about half. */
export function titleUnits(title: string): number {
  const flat = title.replace(/\s+/g, ''); let n = 0;
  for (const ch of flat) n += /[㐀-鿿豈-﫿]/.test(ch) ? 1 : 0.5;
  return Math.round(n);
}
/** True when the title is longer or shorter than the template holds well. Templates without a contract never complain. */
export function outsideCapacity(id: string, title: string): 'long' | 'short' | undefined {
  const c = CONTRACTS[id]; if (!c) return undefined; const n = titleUnits(title);
  return n > c.title[1] ? 'long' : n < c.title[0] ? 'short' : undefined;
}
/** One line per template for the assistant: when to use it, what it holds, and what an edit must keep. */
export function contractLine(id: string): string {
  const c = CONTRACTS[id]; if (!c) return '';
  return `；做：${c.jobs.map(j => JOB_ZH[j]).join('/')}；标题 ${c.title[0]}–${c.title[1]} 字；改它时保留：${c.keep}`;
}
