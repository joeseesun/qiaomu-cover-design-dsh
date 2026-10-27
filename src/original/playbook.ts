/**
 * Platform playbook: what high-CTR covers on Xiaohongshu, Bilibili, YouTube and the WeChat/X banners have in common, as data.
 * Three consumers: the assistant's system prompt (rules, headline formulas, pattern catalogue), the pattern gallery in the
 * UI (one click starts a pattern) and `expandPattern`, which turns a pattern id into a complete layout so the model only
 * has to write the words. Sources and reasoning are in docs/PLATFORM-PLAYBOOK.md.
 */
import type { DecorSpec, DesignSpec } from './ops';

export type Family = 'xhs' | 'video' | 'banner';
export interface Formula { zh: string; en: string; pattern: string; example: string }
export interface Pattern {
  id: string; family: Family; zh: string; en: string;
  /** When to choose it (shown to the assistant and in the gallery). */
  use: string; enUse: string;
  /** Sample words for the gallery thumbnail. */
  sample: { title: string; subtitle?: string; badge?: string; points?: string[] };
  template: string; palette: NonNullable<DesignSpec['palette']>; decor: DecorSpec[];
  /** The picture this pattern wants: a cut-out subject or a full background, with an English prompt skeleton. */
  picture?: { kind: 'subject' | 'background'; at?: 'left' | 'right' | 'center'; hint: string };
  /** Headline faces in order of preference; the first one installed wins. */
  fonts?: string[];
  /** Copy rule for this pattern, one line. */
  copy: string;
}
export interface Playbook { family: Family; zh: string; en: string; platforms: string[]; essence: string; rules: string[]; avoid: string[]; formulas: Formula[] }

const f = (zh: string, pattern: string, example: string, en = zh): Formula => ({ zh, en, pattern, example });

export const PLAYBOOKS: Playbook[] = [
  {
    family: 'xhs', zh: '小红书', en: 'Xiaohongshu', platforms: ['xhs', 'xhs-square', 'portrait', 'square'],
    essence: '封面决定点击：第一张图 3 秒内要让人看懂“这篇对我有什么用”。信息只留一个：醒目的数字/关键词 + 一个主视觉。点击率低于 6% 就该换封面和标题。',
    rules: [
      '3:4 竖版 1080×1440，比横版多占约 40% 屏幕；整篇只用一种比例。',
      '主标题 3~7 个字最好（最长 12），字占画面宽度的大半；副标题约为标题的 1/2~1/3；全图 3~4 级字号。',
      '标题用「数字 + 利益点 + 痛点」：3 步、5 个、7 天、500 元，数字越具体越好。',
      '固定 2~3 种颜色并高对比：深底浅字或浅底深字；暖色（陶土/焦糖/奶油）显可信，科技内容用黑底加荧光色。',
      '最重要的信息加色块底框（红/黄），文字周围留至少 20% 空白，让眼睛能喘气。',
      '文字放上半部，避开被界面遮挡的底部；主视觉占 60% 以上，背景干净。',
      '纯文字封面适合要收藏的干货（数字、方法论）；真人/实拍封面靠真实感，背景整洁、表情可信。',
      '同一账号固定字体和配色，形成辨识度；封面与第一张内页风格一致。',
    ],
    avoid: ['信息大杂烩、字太小', '模板化堆砌贴纸', '低质量随手拍和过度滤镜', '同一篇混用多种比例', '把标题放在底部'],
    formulas: [
      f('数字榜单', '{数字}个{人群/场景}{利益点}的{事物}', '7 个让笔记效率翻倍的技巧'),
      f('痛点反转', '别再{错误做法}了 / {90%}的人都做错了{事}', '别再这样做笔记了'),
      f('身份+场景+方案', '{身份}{场景}，{时间}搞定{事}', '打工人午休 15 分钟学会剪辑'),
      f('结果对比', '{花费/时间}{动作}，{结果}', '花 500 元改造出租屋'),
      f('亲测背书', '亲测{时间}，{结论}', '亲测 30 天，我扔掉了 3 个 App'),
      f('收藏清单', '{场景}必备清单 / 收藏级{主题}', '新手必备清单'),
    ],
  },
  {
    family: 'video', zh: '视频平台（YouTube / B 站 / 抖音）', en: 'Video (YouTube / Bilibili / Shorts)', platforms: ['youtube', 'bilibili', 'bilibili-43', 'bilibili-hd', 'wide', 'vertical'],
    essence: '缩略图在手机上只有拇指大，要在 0.4 秒内讲完一个故事：一个主体（人脸或物体）+ 一句极短的话 + 一个悬念。承诺必须和视频内容一致，B 站用户对封面欺诈零容忍。',
    rules: [
      'YouTube 1280×720，B 站 16:10（投稿 4:3 在信息流会被裁成 16:10，文字放中间）。',
      '文字 YouTube 最多 3~5 个词（MrBeast 不超过 12 个字符）；B 站 6~12 字，用「谁 + 做了什么 + 结果」。',
      '主体占画面约 40%：夸张表情加直视镜头的人脸，或一个有冲击力的物体；视觉元素不超过 3 个（一脸、一物、一问）。',
      '高对比、高饱和：黄/白字加 8~15px 黑描边，深蓝/红/橙底；主体比背景亮或暗至少 30%。',
      '背景极简：纯色为主，复杂背景虚化或替换；用 70% 主体 + 30% 辅助元素。',
      '制造好奇缺口：箭头、圆圈、问号、被遮住的一部分；具体数字（$10,457、30 天）比“很多”点击更高。',
      '右下角留空（时长标签）；B 站底部约 16% 会被播放数据遮挡；重要内容不要贴边。',
      'B 站偏“内容感”：真实画面/关键帧、明确主体、明亮、加文字；背景加半透明遮罩降饱和以托出主体。',
      '品牌一致：固定配色、字体、版式位置，让订阅者一眼认出。',
    ],
    avoid: ['超过 5 个词的文字', '表情过度夸张但与内容不符（B 站）', '主体太小或贴边', '低对比灰蒙蒙', '复杂背景抢戏', '封面与内容不一致'],
    formulas: [
      f('谁做了什么结果', '{谁}{做了什么}，{结果}', '我用 AI 写了一个 App'),
      f('数字结果', '{时间/金额}{动作}→{结果}', '30 天涨粉 10 万'),
      f('悬念问句', '{事物}居然{反常}？', '这个功能居然免费？'),
      f('对决 VS', '{A} vs {B}', 'Cursor vs Trae'),
      f('限制挑战', '只用{限制}{做成事}', '只用 100 元装一间书房'),
      f('诚实测评', '{事物}真实测评 / 值不值', 'Trae 到底强在哪'),
    ],
  },
  {
    family: 'banner', zh: '公众号 / X 横幅', en: 'WeChat / X banners', platforms: ['wechat', 'x'],
    essence: '横幅要“稳而有质感”：公众号头图 2.35:1，转发时会被裁成中间的 1:1，所以关键内容放在中央正方形里；X 横幅左下角会被头像盖住。',
    rules: [
      '公众号头图 2.35:1（900×383 的比例）；转发/分享封面是中间 1:1，标题和主体放在居中的正方形内。',
      '次条小图是 1:1，别用竖版图当头图（会被裁成中间一条）。',
      '一个主标题加最多一行副标题，字号大、层级清楚；宁可留白，不要堆元素。',
      '用统一的品牌色和字体；杂志感（衬线大标题加细线）适合深度内容，深色科技风适合 AI/工具。',
      'X 横幅（5:2）：左下角头像区不要放字；文字偏右或居中。',
    ],
    avoid: ['关键内容放在左右两端（转发时被裁掉）', '竖版图硬塞横幅', '文字太小', '色彩超过 3 种'],
    formulas: [
      f('观点型', '{判断}：{理由}', 'AI 编程工具，选对比努力重要'),
      f('深度长文', '{主题}，我想了三年', '关于独立开发，我想了三年'),
      f('清单型', '{数字}个{主题}', '7 个值得长期关注的 AI 工具'),
    ],
  },
];

const P = (p: Pattern): Pattern => p;
const warmPalette = { bg: '#fff7e6', bg2: '#fff7e6', ink: '#1a1a1a', sub: '#6b7280', accent: '#ef4444', accentInk: '#ffffff' };

export const PATTERNS: Pattern[] = [
  /* ---- Xiaohongshu ---- */
  P({ id: 'xhs-number', family: 'xhs', zh: '数字干货', en: 'Numbered tips', use: '步骤、技巧、榜单；数字当钩子，收藏率高', enUse: 'Tips and listicles with a huge numeral',
    sample: { title: '个让笔记效率翻倍的技巧', subtitle: '亲测一个月，每天省 1 小时', badge: '7' }, template: 'number', palette: warmPalette,
    decor: [{ kind: 'sunburst', x: -0.25, y: -0.18, w: 0.9, tone: 'accent', opacity: 0.12 }, { kind: 'underline', at: 'title', x: 0, y: 0, w: 0.8, tone: 'accent' }, { kind: 'sparkle', x: 0.82, y: 0.08, w: 0.12 }],
    fonts: ['阿里巴巴普惠体', '思源黑体'], copy: 'badge 写数字；标题用「个/步/招 + 利益点」，≤12 字；副标题给出处或时间成本。' }),
  P({ id: 'xhs-pit', family: 'xhs', zh: '避坑警告', en: 'Mistakes to avoid', use: '避坑、踩雷、别再…；情绪强，停留高', enUse: 'Warnings and mistakes; high emotion',
    sample: { title: '新手最容易踩的 5 个坑', subtitle: '第 3 个 90% 的人都中招', badge: '避坑' }, template: 'pop', palette: { bg: '#ffd23f', bg2: '#ffd23f', ink: '#151515', sub: '#151515', accent: '#ff4f8b', accentInk: '#ffffff' },
    decor: [],
    fonts: ['站酷庆科黄油体', '得意黑', '思源黑体'], copy: '标题带“别再/千万别/踩坑”，数字写进标题；badge 写“避坑/警告”。' }),
  P({ id: 'xhs-bigtype', family: 'xhs', zh: '大字报', en: 'Big type', use: '纯文字收藏型：方法论、观点、金句；高对比大字', enUse: 'Text-only, save-worthy methods',
    sample: { title: '别再这样做笔记了', subtitle: '换成这个方法，复习效率翻倍' }, template: 'mega', palette: { bg: '#2f4cff', bg2: '#2f4cff', ink: '#ffe14d', sub: '#ffffff', accent: '#ffe14d', accentInk: '#111111' },
    decor: [],
    fonts: ['阿里巴巴普惠体', '思源黑体', '站酷庆科黄油体'], copy: '一句话讲完，≤10 字；关键词用强调色，副标题补一个具体收益。' }),
  P({ id: 'xhs-compare', family: 'xhs', zh: '前后对比', en: 'Before / after', use: '改造、变化、测评；效果一眼可见', enUse: 'Transformations and reviews',
    sample: { title: '出租屋 500 元改造', subtitle: '改造前 | 改造后', badge: '实测' }, template: 'compare', palette: {}, decor: [],
    fonts: ['思源黑体'], copy: '副标题必须写成「A | B」；标题写总花费/总时间。' }),
  P({ id: 'xhs-checklist', family: 'xhs', zh: '清单笔记', en: 'Checklist', use: '清单、步骤、必备合集；信息密度高，适合收藏', enUse: 'Dense useful lists',
    sample: { title: '新手必备清单', subtitle: '照着做就行', points: ['先定目标', '再拆步骤', '每天复盘'] }, template: 'bento', palette: { bg: '#f1eee6', bg2: '#f1eee6', ink: '#171717', sub: '#525252', accent: '#171717', accentInk: '#ffffff' },
    decor: [], fonts: ['思源黑体'], copy: 'points 写 3~4 条，每条 ≤10 字，动词开头。' }),
  P({ id: 'xhs-lifestyle', family: 'xhs', zh: '生活种草', en: 'Lifestyle pick', use: '好物、穿搭、家居、情绪；低饱和柔和，真实感', enUse: 'Products and mood; soft and real',
    sample: { title: '周末慢生活', subtitle: '把日子过成喜欢的样子', badge: '日常' }, template: 'calm', palette: { bg: '#ece6dc', bg2: '#ece6dc', ink: '#2b2118', sub: '#7c6a62', accent: '#c97b63', accentInk: '#ffffff' },
    decor: [{ kind: 'blob', at: 'subject', x: 0, y: 0, w: 1.5, tone: 'accent', opacity: 0.35 }, { kind: 'squiggle', at: 'title', x: 0, y: 0, w: 0.5, tone: 'accent' }],
    picture: { kind: 'subject', at: 'center', hint: 'a single hero product on a plain surface, soft diffused daylight, warm muted tones, natural shadow, shallow depth of field' }, fonts: ['霞鹜文楷', '站酷小薇体', '思源宋体'], copy: '标题像聊天，带情绪词；副标题写使用感受。' }),
  P({ id: 'xhs-quote', family: 'xhs', zh: '金句卡', en: 'Quote card', use: '金句、观点、读书摘录；稳重有质感', enUse: 'Quotes and notes; calm and weighty',
    sample: { title: '你不是没时间，只是没把它排在前面。', subtitle: '—— 时间管理读书笔记' }, template: 'quote', palette: { bg: '#121212', bg2: '#121212', ink: '#f5efe2', sub: '#b9ad94', accent: '#e8b960', accentInk: '#111111' },
    decor: [], fonts: ['朱雀仿宋', '霞鹜文楷', '思源宋体'], copy: '金句 ≤20 字，一句话成立；副标题写出处。' }),

  /* ---- video: YouTube / Bilibili ---- */
  P({ id: 'yt-face', family: 'video', zh: '表情冲击', en: 'Reaction face', use: '一张夸张表情的脸 + 3 个词；YouTube 最稳的点击公式', enUse: 'Big reaction face plus three words',
    sample: { title: 'AI 写代码', badge: '实测' }, template: 'impact', palette: { bg: '#0b1b4d', bg2: '#1d4ed8', ink: '#fde047', sub: '#e0e7ff', accent: '#ef4444', accentInk: '#ffffff' },
    decor: [{ kind: 'glow', at: 'subject', x: 0, y: 0, w: 2, tone: 'accent', opacity: 0.6 }, { kind: 'sparkle', at: 'subject', x: -0.55, y: 0.3, w: 0.22, tone: 'accentInk' }],
    picture: { kind: 'subject', at: 'right', hint: 'close-up of a fictional person with an exaggerated shocked expression, wide eyes, open mouth, looking straight at camera, bright studio lighting, cyan rim light' },
    fonts: ['得意黑', 'Anton', '思源黑体'], copy: '标题 ≤3 个词/≤8 个汉字，用结果或悬念；不要副标题。' }),
  P({ id: 'yt-product', family: 'video', zh: '产品评测', en: 'Product hero', use: '评测、开箱、工具；产品特写 + 信任词', enUse: 'Reviews and unboxings',
    sample: { title: 'Trae 真实测评', badge: '实测' }, template: 'impact', palette: { bg: '#0b0f1a', bg2: '#1e293b', ink: '#fde047', sub: '#cbd5e1', accent: '#22d3ee', accentInk: '#06121f' },
    decor: [{ kind: 'glow', at: 'subject', x: 0, y: 0, w: 2.1, tone: 'accent', opacity: 0.55 }, { kind: 'ring', at: 'subject', x: 0, y: 0, w: 1.15, tone: 'accent', opacity: 0.35 }, { kind: 'arrow', x: 0.42, y: 0.52, w: 0.14, tone: 'accent', rotate: 12 }],
    picture: { kind: 'subject', at: 'right', hint: 'macro hero shot of a single glossy product, dramatic rim light, floating, clean dark studio' }, fonts: ['得意黑', 'Anton'], copy: '标题写「产品名 + 真实/到底/值不值」。' }),
  P({ id: 'yt-number', family: 'video', zh: '数字结果', en: 'Number result', use: '涨粉、赚钱、省时间；具体数字提高 15~25% 点击', enUse: 'Concrete results and numbers',
    sample: { title: '天涨粉十万', subtitle: '我做对了这三件事', badge: '30' }, template: 'number', palette: { bg: '#facc15', bg2: '#facc15', ink: '#111111', sub: '#3f3f46', accent: '#dc2626', accentInk: '#ffffff' },
    decor: [{ kind: 'sunburst', x: 0.35, y: -0.2, w: 0.9, tone: 'ink', opacity: 0.08 }, { kind: 'underline', at: 'title', x: 0, y: 0, w: 0.7, tone: 'accent' }],
    fonts: ['得意黑', 'Anton'], copy: 'badge 写核心数字；标题写数字的单位和结果。' }),
  P({ id: 'yt-versus', family: 'video', zh: 'A 对 B', en: 'Versus', use: '对比评测、二选一；冲突感强', enUse: 'Head-to-head comparisons',
    sample: { title: 'Cursor vs Trae', subtitle: 'Cursor | Trae' }, template: 'compare', palette: {}, decor: [],
    fonts: ['Anton', '得意黑'], copy: '副标题写成「A | B」；标题 ≤4 个词。' }),
  P({ id: 'bili-knowledge', family: 'video', zh: '知识科普', en: 'Explainer', use: 'B 站知识区：有信息感，明确主体，谁+做了什么+结果', enUse: 'Bilibili explainers: informative with a clear subject',
    sample: { title: '字节的 AI 编程工具', subtitle: '到底强在哪', badge: '实测' }, template: 'bili', palette: {},
    decor: [],
    picture: { kind: 'subject', at: 'right', hint: 'a single clear object that represents the topic, stylised 3D render, bright saturated colours, soft studio lighting' }, fonts: ['得意黑', '站酷庆科黄油体', '思源黑体'], copy: '标题 6~12 字，「谁+做了什么+结果」；不要夸张到与内容不符。' }),
  P({ id: 'bili-game', family: 'video', zh: '游戏高光', en: 'Game highlight', use: '游戏/动画/热血；霓虹、冲击、角色', enUse: 'Games and action; neon and punch',
    sample: { title: '一刀秒杀全场', badge: '高能' }, template: 'impact', palette: { bg: '#12082e', bg2: '#4c1d95', ink: '#ffffff', sub: '#e9d5ff', accent: '#22d3ee', accentInk: '#06121f' },
    decor: [{ kind: 'glow', at: 'subject', x: 0, y: 0, w: 2.2, tone: 'accent', opacity: 0.6 }, { kind: 'beam', x: 0.1, y: -0.05, w: 0.4, tone: 'accent', opacity: 0.4 }, { kind: 'burst', at: 'subject', x: -0.5, y: -0.3, w: 0.5, tone: 'accentInk' }],
    picture: { kind: 'subject', at: 'right', hint: 'stylised hero character in a dynamic action pose, dramatic rim lighting, saturated neon colours' }, fonts: ['Dela Gothic One', '得意黑'], copy: '标题 ≤8 字，动词开头，带结果词（秒杀/翻盘/极限）。' }),
  P({ id: 'bili-vlog', family: 'video', zh: '生活 Vlog', en: 'Vlog photo', use: '生活、旅行、日常；真实画面 + 简短标题', enUse: 'Lifestyle with a real photo',
    sample: { title: '搬进新家的第一天', badge: 'VLOG' }, template: 'polaroid', palette: { bg: '#111111', ink: '#ffffff' }, decor: [],
    picture: { kind: 'background', hint: 'bright candid lifestyle photograph, natural window light, warm tones, shallow depth of field, authentic and unposed' }, fonts: ['霞鹜文楷', '思源黑体'], copy: '标题 ≤10 字，像一句日记；图要真实明亮。' }),
  P({ id: 'bili-tutorial', family: 'video', zh: '教程步骤', en: 'Tutorial', use: '教程、攻略、工具；清晰告诉观众学到什么', enUse: 'Tutorials and guides',
    sample: { title: '5 分钟学会 Obsidian', subtitle: '从零到能用', badge: '教程' }, template: 'split', palette: { accent: '#00a1d6' },
    decor: [],
    picture: { kind: 'subject', at: 'right', hint: 'a clean illustrated laptop or app window floating at an angle, simple shapes, bright flat colours' }, fonts: ['得意黑', '思源黑体'], copy: '标题写「时间 + 学会什么」；badge 写“教程/入门”。' }),

  /* ---- banners ---- */
  P({ id: 'wx-editorial', family: 'banner', zh: '杂志长文', en: 'Editorial', use: '深度文章、观点、人文；衬线大标题加细线', enUse: 'Essays and opinion',
    sample: { title: '关于独立开发，我想了三年', subtitle: '一些不太成熟的观察', badge: '深度' }, template: 'mag', palette: { bg: '#efe7d8', bg2: '#e5dac4', ink: '#17130d', sub: '#6b5f4b', accent: '#b6402a', accentInk: '#fff7ea' },
    decor: [], fonts: ['朱雀仿宋', '思源宋体', '霞鹜文楷'], copy: '标题放在中间正方形内；一句话观点，不要标点堆砌。' }),
  P({ id: 'wx-tech', family: 'banner', zh: '产品科技', en: 'Product arch', use: 'AI、工具、效率；奶油底 + 拱门窗放产品主体，干净有质感', enUse: 'AI and tools with the product in an arch window on cream',
    sample: { title: 'TRAE', subtitle: '字节的 AI 编程工具，到底强在哪', badge: '实测' }, template: 'split', palette: {},
    decor: [],
    picture: { kind: 'subject', at: 'right', hint: 'a friendly stylised 3D clay robot or a glowing floating code window, soft studio lighting, pastel colours' }, fonts: ['得意黑', '思源黑体'], copy: '主标题极短且巨大（产品名/一个词）；副标题放问句或结论。' }),
  P({ id: 'x-banner', family: 'banner', zh: 'X 横幅', en: 'X header', use: 'X 个人横幅；留出左下角头像，主体偏右', enUse: 'X profile header; keep the avatar corner clear',
    sample: { title: 'Build in public', subtitle: 'AI · Design · Indie', badge: '@you' }, template: 'stack', palette: {},
    decor: [], fonts: ['抖音美好体', '阿里巴巴普惠体'], copy: '一句话定位；文字偏右上，避开左下角。' }),
];

/* The strongest styles come first: these are what a new user sees. */
const sp = (id: string, family: Family, zh: string, en: string, use: string, enUse: string, template: string, sample: Pattern['sample'], copy: string, fonts?: string[]): Pattern =>
  ({ id, family, zh, en, use, enUse, sample, template, palette: {}, decor: [], copy, ...(fonts ? { fonts } : {}) });
PATTERNS.push(
  sp('xhs-collage', 'xhs', '拼贴手账', 'Paper collage', '生活、手账、种草；牛皮纸、撕纸和胶带，亲切有手感', 'Lifestyle and journaling on kraft paper', 'collage', { title: '周末手账', subtitle: '把日子过成喜欢的样子', badge: '日常' }, '标题像手写便签，≤8 字；副标题写一句感受。', ['霞鹜文楷', '站酷快乐体']),
  sp('xhs-print', 'xhs', '印刷海报', 'Print poster', '观点、文化、设计；黑白 + 朱红，裁切线与条码，欧洲字体海报的质感', 'Opinion and design with a European typographic look', 'print', { title: '设计的本质是取舍', subtitle: 'LESS BUT BETTER', badge: '01' }, '标题 ≤10 字，一个判断；副标题可用英文短句。'),
  sp('xhs-acid', 'xhs', '酸性潮流', 'Acid mesh', '潮流、AI、音乐、科技；弥散光斑 + 颗粒 + 居中大字', 'Trends, AI and music with mesh glows', 'acid', { title: 'AI 时代的设计师', subtitle: '三个正在发生的变化', badge: '新' }, '标题 ≤8 字，有冲击；副标题给数字或结论。', ['得意黑', '站酷庆科黄油体']),
  sp('xhs-memo', 'xhs', '学习笔记', 'Study notes', '学习、干货、教程；横线笔记纸 + 荧光笔划重点', 'Study notes with a highlighter on ruled paper', 'memo', { title: '一周搞定 Python', subtitle: '每天 30 分钟的学习路径', badge: '笔记' }, '标题带数字和时间；副标题写适合谁。', ['霞鹜文楷']),
  sp('xhs-mag', 'xhs', '杂志封面', 'Magazine cover', '深度、人物、专题；衬线巨标题 + 期号虚影，像一本真杂志', 'Depth and profiles with a serif headline and ghost issue numeral', 'mag', { title: '关于独立开发，我想了三年', subtitle: '一些不太成熟的观察', badge: '专题' }, '标题像杂志封面标题，≤14 字；副标题是一句导语。', ['朱雀仿宋', '思源宋体']),
  sp('yt-ticker', 'video', '跑马灯', 'Ticker', '奶黄底 + 斜向滚动字带 + 硬阴影大字，视频信息流里很抢眼', 'Diagonal ticker bands with hard-shadow type for feeds', 'ticker', { title: 'AI 写代码', subtitle: '一次跑通整段', badge: '实测' }, '标题 ≤4 个词；badge 是滚动字带上的关键词。', ['得意黑', 'Anton']),
  sp('yt-neon', 'video', '霓虹科技', 'Neon grid', 'AI、编程、赛博；透视网格 + 霓虹发光字', 'AI and code with a perspective grid and neon glow', 'neon', { title: 'Trae 真实测评', subtitle: '到底强在哪', badge: 'AI' }, '标题写「产品名 + 结果」；副标题是问句。', ['得意黑', 'Anton']),
  sp('yt-cinema', 'video', '电影感', 'Cinematic', 'Vlog、纪录片、深度内容；上下黑边 + 暗角 + 光痕', 'Vlogs and documentaries with letterbox bars and a light streak', 'cinema', { title: '搬进新家的第一天', subtitle: '一个人的第 3 年', badge: 'A FILM' }, '标题像片名，≤8 字；副标题是一句旁白。', ['朱雀仿宋', '思源宋体']),
  sp('wx-swiss', 'banner', '瑞士网格', 'Swiss grid', '工具、设计、方法论头图；米白底 + 红色圆 + 大黑字', 'Tools and methods on off-white with a red disc', 'swiss', { title: '设计师的效率工具箱', subtitle: '十个每天都在用的小工具', badge: '合集' }, '标题 ≤10 字，一个判断；副标题给数量。'),
  sp('wx-calm', 'banner', '松弛留白', 'Calm', '生活、读书、慢内容；大面积留白 + 细线 + 衬线', 'Slow reads with generous whitespace', 'calm', { title: '慢慢来，比较快', subtitle: '一个自由职业者的第二年', badge: '随笔' }, '标题像一句话；越短越好。'),
  sp('wx-bento', 'banner', '便当清单', 'Bento list', '清单、合集、盘点头图；标题卡 + 三张要点卡', 'Lists and roundups as a bento grid', 'bento', { title: '今年值得读的 3 本书', subtitle: '给想把事做好的人', badge: '书单', points: ['原则', '深度工作', '纳瓦尔宝典'] }, '标题带数字；要点各 ≤6 字。'),
  sp('wx-print', 'banner', '印刷海报', 'Print poster', '观点与设计类头图；黑白 + 朱红，印刷标记', 'Opinion and design headers with print marks', 'print', { title: '少即是多', subtitle: 'LESS IS MORE', badge: '01' }, '标题 ≤8 字；副标题一句英文。'),
  sp('wx-quote', 'banner', '金句海报', 'Quote poster', '一句话撑满的头图；墨黑底 + 金色大引号', 'A single statement on ink black with a gold quote mark', 'quote', { title: '你不是没时间，只是没把它排在前面。', subtitle: '—— 时间管理读书笔记' }, '金句 ≤20 字；副标题写出处。', ['朱雀仿宋', '思源宋体']),
  sp('wx-cinema', 'banner', '电影感', 'Cinematic', '深度长文、人物特稿；黑边 + 暗角', 'Long reads and profiles with letterbox bars', 'cinema', { title: '一个人的纪录片', subtitle: '关于坚持的 36 小时', badge: 'DOCUMENTARY' }, '标题像片名，≤8 字。', ['朱雀仿宋']),
);
PATTERNS.push(
  sp('xhs-highlight', 'xhs', '划重点', 'Highlighter', '干货、观点、方法；白纸黑字 + 荧光笔划过每行，信息感最强', 'Tips and opinions with a highlighter under every line', 'highlight', { title: '普通人做副业的 3 条底线', subtitle: '第 2 条最容易被忽略', badge: '干货' }, '标题 8~12 字，带数字或判断；badge 写“干货/必看”。'),
  sp('xhs-notes', 'xhs', '备忘录截图', 'Notes screenshot', '经验、清单、复盘；像随手记在手机备忘录里，亲切可信', 'Experience and lists as a phone notes screenshot', 'notes', { title: '裸辞三个月后的真实感受', subtitle: '写给想辞职的你', badge: '今天 · 笔记', points: ['存款撑多久', '作息怎么排', '下一步做什么'] }, '标题像一句心里话；points 写 3~4 条 ≤10 字的清单；badge 写日期感的短语。'),
  sp('xhs-chat', 'xhs', '对话截图', 'Chat Q&A', '问答、AI、情感、职场；副标题提问，标题回答', 'Q&A, AI and work told as a chat', 'chat', { title: '先把简历第一行改掉', subtitle: '为什么我投了 100 份都没回音？', badge: 'HR 朋友' }, 'subtitle 写成用户的提问（带问号）；title 是一句干脆的回答 ≤12 字；badge 写对话对象。'),
  sp('xhs-ticket', 'xhs', '票根活动', 'Ticket', '活动、课程、展览、旅行攻略；入场券的仪式感', 'Events, courses and trips as an admission ticket', 'ticket', { title: '周末逛展指南', subtitle: '上海 10 月必看的 5 个展', badge: '入场券' }, '标题 ≤10 字；副标题写时间地点或数量；badge 写票种。'),
  sp('xhs-polaroid', 'xhs', '拍立得', 'Polaroid', '旅行、Vlog、生活记录；相纸里放一张真实照片', 'Travel and everyday life with a real photo in an instant print', 'polaroid', { title: '一个人的京都三日', subtitle: '不赶路的旅行路线', badge: 'KYOTO · 10.09' }, '标题像日记；badge 写地点和日期，会写在相纸下沿。'),
  sp('yt-keyword', 'video', '一词冲击', 'Keyword punch', '结果、观点、挑战；饱和纯色 + 超粗白字 + 黄色关键词', 'Results and challenges with heavy white type and one yellow keyword', 'keyword', { title: '一周只工作 4 天', subtitle: '真实结果', badge: '实验' }, '标题 ≤8 字或 ≤4 个英文词；subtitle 是 2~4 字的黄色关键词（结果/真相/别买）。', ['得意黑', 'Anton']),
  sp('bili-explainer', 'video', 'B 站知识区', 'Bilibili explainer', '科普、测评、知识区；粉色分区标签 + 小电视画框放主体', 'Explainers with a section tag and a little-TV frame for the subject', 'bili', { title: '字节的 AI 编程工具', subtitle: '到底强在哪', badge: '知识区' }, '标题 6~12 字「谁+做了什么+结果」；badge 写分区或系列名。'),
  sp('bili-window', 'video', '窗口教程', 'App window', '教程、工具、编程；macOS 窗口里的大标题', 'Tutorials and tools inside a macOS window', 'window', { title: '5 分钟学会 Obsidian', subtitle: '从零到能用的最短路径', badge: 'obsidian.md' }, '标题写「时间 + 学会什么」；badge 写文件名或工具名，像窗口标题栏。'),
  sp('wx-newspaper', 'banner', '头版头条', 'Front page', '评论、深度、年度盘点；报头 + 分栏，把观点做成头条', 'Opinion and reviews as a newspaper front page', 'newspaper', { title: '2026，AI 改变了什么', subtitle: '一份不太乐观的年度观察', badge: '乔木周报 12' }, '标题像新闻标题 ≤14 字；badge 写报名（可带期号）。', ['思源宋体', '朱雀仿宋']),
  sp('wx-serial', 'banner', '栏目头图', 'Column header', '系列文章、周刊、播客；左侧栏目条 + 期号，转发裁成方图时标题仍在中间', 'Recurring series with a column band and issue number', 'serial', { title: '本周值得看的 AI 工具', subtitle: '每周五更新', badge: '工具周刊 37' }, 'badge 写「栏目名 + 期号」；标题 ≤14 字。'),
  sp('wx-riso', 'banner', '孔版印刷', 'Risograph', '文化、展览、设计、潮流；粉蓝双色叠印，有手作感', 'Culture and design in pink and blue overprint', 'riso', { title: '小众杂志正在回来', subtitle: '独立出版的第二春', badge: 'ZINE' }, '标题 ≤10 字；badge 写英文短词。'),
);
PATTERNS.push(
  sp('xhs-brush', 'xhs', '笔刷收藏', 'Brush highlight', '副业、避坑、干货；粗黑大字 + 绿色笔刷 + “建议收藏”标签 + ✓ 清单，最像爆款笔记', 'Tips and side hustles with a brush stroke, a save tag and a check row', 'brush', { title: '副业赚钱先看避坑指南', subtitle: '避坑、干货、少走弯路', badge: '建议收藏!' }, '标题 ≤12 字；points 或副标题写 3 个 ≤4 字的收益词；badge 写“建议收藏!”。'),
  sp('xhs-regeng', 'xhs', '每日热梗', 'Daily drop', '每日资讯、热点、系列笔记；黑色话题条 + 三层描边卡片 + 期号', 'Daily news and series in stacked outlined cards with an issue number', 'regeng', { title: '每日热梗实时放送', subtitle: '今天互联网都在聊什么', badge: '每日新鲜事 12' }, 'badge 写话题名（可带期号数字）；标题 ≤10 字。'),
  sp('xhs-interview', 'xhs', '黑黄箭头', 'Black & yellow', '面试、考试、清单；黑底黄字 + 手绘大箭头，强对比', 'Interviews and exams in yellow on black with a hand-drawn arrow', 'interview', { title: '背完这些再去面试', subtitle: 'HR 最爱问的 20 个问题', badge: 'INTERVIEW' }, '标题 ≤10 字，动词开头；badge 写一个英文词。'),
  sp('xhs-kicker', 'xhs', '粗细引题', 'Kicker', '经验、问答、职场；细字引题 + 粗黑主句', 'Experience and Q&A with a thin kicker over a heavy line', 'kicker', { title: '第一份工作是什么', subtitle: '毕业后找到的', badge: '工作党请进' }, 'subtitle 是前半句（细字），title 是关键后半句（粗字），合起来一句话。'),
  sp('xhs-calendar', 'xhs', '日历一句', 'Calendar page', '每日一句、打卡、待办；蓝底白色日历页', 'Daily lines and check-ins on a calendar page', 'calendar', { title: '和谐共处', subtitle: '和自己，也和这个世界', badge: '今日' }, '标题 ≤8 字，一个短语；badge 写日期感的词。'),
  sp('xhs-corner', 'xhs', '斜角计划', 'Corner wedge', '计划、自律、学习清单；白底斜切色块 + 黑色胶囊', 'Plans and study lists with a mint wedge and a black pill', 'corner', { title: '暑假不摆烂', subtitle: '准大学生自律清单' }, '标题 ≤8 字；副标题写清单名。'),
  sp('wx-frame', 'banner', '框线大字', 'Framed type', '招聘、通知、开学、活动头图；纯色内框 + 超大标题', 'Hiring and notices with an inset frame and huge type', 'frame', { title: '校招开启', subtitle: '2026 届秋招，现在投递', badge: '招聘' }, '标题 2~6 字，越短越好；副标题写时间和动作。'),
);
// Big type and flat colour first; mesh-gradient looks last (they read as generic in a feed).
const ORDER = ['xhs-brush', 'xhs-highlight', 'xhs-regeng', 'xhs-bigtype', 'xhs-kicker', 'xhs-pit', 'xhs-notes', 'xhs-interview', 'xhs-chat', 'xhs-calendar', 'xhs-corner', 'xhs-number', 'xhs-print', 'xhs-ticket', 'xhs-polaroid', 'xhs-memo', 'xhs-collage', 'xhs-mag', 'xhs-checklist', 'xhs-lifestyle', 'xhs-quote', 'xhs-compare', 'xhs-acid',
  'yt-keyword', 'yt-number', 'bili-explainer', 'bili-window', 'bili-tutorial', 'bili-vlog', 'yt-face', 'yt-ticker', 'yt-product', 'bili-knowledge', 'yt-versus', 'yt-neon', 'bili-game', 'yt-cinema',
  'wx-editorial', 'wx-frame', 'wx-serial', 'wx-newspaper', 'wx-swiss', 'wx-print', 'wx-tech', 'wx-riso', 'wx-calm', 'x-banner', 'wx-bento', 'wx-quote', 'wx-cinema'];
PATTERNS.sort((a, b) => (ORDER.indexOf(a.id) + 1 || 99) - (ORDER.indexOf(b.id) + 1 || 99));

export const PATTERN_IDS = PATTERNS.map(p => p.id);
export const patternById = (id: string | undefined): Pattern | undefined => PATTERNS.find(p => p.id === id);
export const playbookFor = (platformId: string | undefined): Playbook => PLAYBOOKS.find(b => b.platforms.includes(platformId ?? '')) ?? PLAYBOOKS[0]!;
const HIDDEN_PATTERNS = new Set(['bili-knowledge', 'yt-face', 'yt-product', 'bili-game', 'yt-neon', 'yt-cinema', 'wx-cinema', 'yt-versus', 'xhs-compare', 'xhs-quote', 'wx-quote', 'yt-ticker']); // dark / loud: never listed
export const patternsFor = (family: Family): Pattern[] => PATTERNS.filter(p => p.family === family && !HIDDEN_PATTERNS.has(p.id));

/**
 * Fills a design with the pattern's defaults. Anything the model (or the user) wrote wins; only gaps are filled, so a
 * pattern is a starting point and never a cage. `hasFont` tells which headline faces are installed.
 */
export function expandPattern(spec: DesignSpec, hasFont: (family: string) => boolean): DesignSpec {
  const p = patternById(spec.pattern); if (!p) return spec;
  const out: DesignSpec = { ...spec };
  out.template ??= p.template; out.palette = { ...p.palette, ...spec.palette }; out.decor ??= p.decor;
  if (p.picture?.kind === 'subject') out.subjectAt ??= p.picture.at;
  if (p.picture?.kind === 'background') out.imageRole ??= 'background';
  const face = p.fonts?.find(hasFont); if (face) out.titleFont ??= face;
  return out;
}

/** The assistant's briefing for one platform: rules, headline formulas and the pattern catalogue with picture hints. */
export function playbookPrompt(platformId: string | undefined, imageOn: boolean): string {
  const b = playbookFor(platformId); const ps = patternsFor(b.family);
  const lines = ps.map(p => `   · ${p.id}（${p.zh}）：${p.use}。版式 ${p.template}${p.picture && imageOn ? `；画：${p.picture.kind === 'subject' ? '主体' : '背景'}，英文提示参考 “${p.picture.hint}”` : ''}。文案：${p.copy}`);
  return `# 本平台打法：${b.zh}
${b.essence}
规则：
${b.rules.map(r => `- ${r}`).join('\n')}
避免：${b.avoid.join('；')}
标题公式（选最贴合内容的一种来写 title，别照抄例子）：
${b.formulas.map(x => `- ${x.zh}：${x.pattern}，例：${x.example}`).join('\n')}
封面套路：在 design 里写 "pattern":"套路id"，插件会自动套上该套路的默认版式、配色和装饰；你写的字段会覆盖默认值。一次只选一个最贴合的套路：
${lines.join('\n')}`;
}
