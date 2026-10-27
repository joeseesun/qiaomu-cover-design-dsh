/**
 * Starter prompts and picture styles. A lazy user clicks one, replaces the 【bracketed】 part with their own topic
 * (or pastes a whole paragraph) and presses Enter. The wording follows what works on each platform:
 * a numeric or pain-point hook, very short large type, one clear subject, high contrast.
 */
export interface StarterPrompt { id: string; zh: string; en: string; zhPrompt: string; enPrompt: string }
export interface StarterGroup { id: string; zh: string; en: string; platforms: string[]; prompts: StarterPrompt[] }

const sp = (id: string, zh: string, en: string, zhPrompt: string, enPrompt: string): StarterPrompt => ({ id, zh, en, zhPrompt, enPrompt });

export const STARTERS: StarterGroup[] = [
  { id: 'xhs', zh: '小红书', en: 'Xiaohongshu', platforms: ['xhs', 'xhs-square', 'portrait', 'square'], prompts: [
    sp('xhs-number', '数字干货', 'Numbered tips', '做一张小红书干货封面：主题【7 个让笔记效率翻倍的技巧】。用数字做钩子，标题短而狠（不超过 12 个字），高对比配色。', 'Make a Xiaohongshu tips cover: topic 【7 tricks that double your note-taking speed】. Lead with the number, keep the headline very short, high contrast.'),
    sp('xhs-pit', '避坑指南', 'Pitfalls', '做一张小红书避坑封面：主题【新手学 AI 绘画最容易踩的 5 个坑】。情绪强烈，红黑或黄黑配色，像大字报。', 'Make a Xiaohongshu “mistakes to avoid” cover: topic 【5 traps beginners fall into with AI art】. Strong emotion, red/black or yellow/black, poster-like.'),
    sp('xhs-grass', '好物种草', 'Product pick', '做一张小红书种草封面：主题【用了半年才敢推荐的桌面好物】。低饱和柔和配色，生活感，上方是标题，留出放产品图的位置。如果能生图，配一张干净的桌面产品摄影。', 'Make a Xiaohongshu product-pick cover: topic 【desk gear I trust after six months】. Soft muted palette, lifestyle feel, leave room for a product shot. If images are available, add clean desk product photography.'),
    sp('xhs-steps', '教程步骤', 'Step list', '做一张小红书教程封面：主题【3 步做出高级感 PPT】，用清单体，points 写 3 个简短步骤。', 'Make a Xiaohongshu tutorial cover: topic 【3 steps to a polished slide deck】, checklist style with 3 short steps.'),
    sp('xhs-compare', '前后对比', 'Before / after', '做一张前后对比封面：主题【出租屋 500 元改造】，副标题写【改造前 | 改造后】。', 'Make a before/after cover: topic 【a 500-yuan rental makeover】, subtitle 【Before | After】.'),
    sp('xhs-quote', '金句卡片', 'Quote card', '把这句话做成小红书金句卡：【你不是没时间，只是没把它排在前面。】，副标题写【——时间管理读书笔记】。', 'Turn this line into a quote card: 【You are not out of time, you just have not put it first.】 with the source 【— time management notes】.'),
    sp('xhs-book', '读书笔记', 'Book notes', '做一张读书笔记封面：书名【《原子习惯》】，一句话讲清最大的收获【每天进步 1%，一年后强 37 倍】，杂志风，衬线字体。', 'Make a book-notes cover: 【Atomic Habits】, one-line takeaway 【1% better a day is 37× in a year】, editorial serif look.'),
    sp('xhs-para', '一段话直出', 'Paste a paragraph', '把下面这段话直接做成封面，标题、模板、配色都由你决定：\n【在这里粘贴你的段落或文章要点】', 'Turn the paragraph below into a cover. You pick the headline, template and colours:\n【paste your paragraph or key points here】'),
  ] },
  { id: 'youtube', zh: 'YouTube', en: 'YouTube', platforms: ['youtube', 'wide', 'bilibili-hd'], prompts: [
    sp('yt-tutorial', '教程', 'Tutorial', '做 YouTube 缩略图：视频主题【用 AI 十分钟做出一个 App】。标题不超过 4 个词，黄字黑描边，右侧留人像位置，用红色标签点出“新手”。', 'Make a YouTube thumbnail: video 【Build an app with AI in 10 minutes】. At most 4 words, yellow type with a black outline, leave the right side for a face, red tag saying “Beginner”.'),
    sp('yt-vs', '对比测评', 'Versus review', '做 YouTube 缩略图：主题【iPhone 对比 安卓，谁更值得买】，用对比模板，副标题写【iPhone | Android】。', 'Make a YouTube thumbnail: 【iPhone vs Android — which is worth it】, versus layout, subtitle 【iPhone | Android】.'),
    sp('yt-mystery', '悬念', 'Curiosity gap', '做 YouTube 缩略图：主题【我连续 30 天只用 AI 工作】。要有悬念和冲击力，摄影封面，配戏剧化光影的主体图，大字压在暗角上。', 'Make a YouTube thumbnail: 【I worked only with AI for 30 days】. Curiosity and impact, full-image look with dramatic lighting, big type on the scrim.'),
    sp('yt-top', '榜单', 'Top list', '做 YouTube 缩略图：主题【2026 年最好用的 5 款笔记软件】，数字做钩子，鲜艳高对比。', 'Make a YouTube thumbnail: 【the 5 best note apps of 2026】, number as the hook, vivid and high contrast.'),
    sp('yt-story', '故事', 'Story', '做 YouTube 缩略图：主题【我是怎么被裁员后做出月入十万的产品】，情绪化，深色底，一句话大字。', 'Make a YouTube thumbnail: 【How I built a six-figure product after getting laid off】, emotional, dark backdrop, one big line.'),
    sp('yt-para', '一段话直出', 'Paste a paragraph', '根据下面的视频简介做一张缩略图，把标题压缩到 4 个词以内：\n【粘贴视频简介】', 'Make a thumbnail from this video description, compress the headline to 4 words or fewer:\n【paste description】'),
  ] },
  { id: 'bilibili', zh: 'B 站', en: 'Bilibili', platforms: ['bilibili', 'bilibili-43'], prompts: [
    sp('bili-know', '知识区', 'Explainer', '做 B 站封面：主题【三分钟看懂大模型是怎么思考的】，粉橙热血风，标题粗描边，副标题写一个具体收益，底部留空不放字。', 'Make a Bilibili cover: 【Understand how LLMs think in three minutes】, pink-orange punchy look, outlined title, concrete benefit as the subtitle, keep the bottom clear.'),
    sp('bili-game', '游戏', 'Gaming', '做 B 站封面：主题【零氪通关全流程】，高饱和对比色，油管冲击风格，右侧留角色位置。', 'Make a Bilibili cover: 【Full no-spend clear】, saturated contrast, impact style, leave the right side for a character.'),
    sp('bili-tech', '数码开箱', 'Unboxing', '做 B 站封面：主题【M5 MacBook 一个月真实体验】，深色科技风，标题不超过 10 个字，加“真实体验”角标。', 'Make a Bilibili cover: 【One month with the M5 MacBook】, dark tech look, headline within 10 characters, add a tag “Honest review”.'),
    sp('bili-series', '系列教程', 'Series', '做 B 站封面：主题【零基础学 Python 第 3 集】，用数字干货模板，数字写 03。', 'Make a Bilibili cover: 【Python from zero, episode 3】, big-number layout with 03.'),
    sp('bili-vlog', 'Vlog', 'Vlog', '做 B 站封面：主题【在大理住了 30 天】，摄影封面，配一张日落古城的摄影风格图，标题简短有画面感。', 'Make a Bilibili cover: 【30 days in Dali】, full-image look with a sunset old-town photograph, short evocative title.'),
    sp('bili-para', '一段话直出', 'Paste a paragraph', '根据下面的视频简介做 B 站封面，标题要有点击欲：\n【粘贴视频简介】', 'Make a Bilibili cover from this description with a click-worthy headline:\n【paste description】'),
  ] },
  { id: 'short', zh: '竖屏短视频', en: 'Vertical video', platforms: ['vertical'], prompts: [
    sp('v-hook', '开头钩子', 'Opening hook', '做抖音视频封面：主题【月薪 3000 也能存下钱的 3 个方法】，标题放在上中部，大字高对比，底部不放字。', 'Make a vertical video cover: 【3 ways to save on a small salary】, headline in the upper-middle, big contrast type, keep the bottom clear.'),
    sp('v-story', '故事口播', 'Talking head', '做视频号封面：主题【我为什么劝你别创业】，大字报风格，情绪强。', 'Make a Channels cover: 【Why I tell people not to start a company】, poster style, strong emotion.'),
    sp('v-para', '一段话直出', 'Paste a paragraph', '把下面这段口播稿做成竖屏封面：\n【粘贴口播稿】', 'Turn this script into a vertical cover:\n【paste script】'),
  ] },
  { id: 'banner', zh: '公众号 / X', en: 'WeChat / X', platforms: ['wechat', 'x'], prompts: [
    sp('wx-essay', '深度长文', 'Essay', '做公众号头图：文章标题【为什么聪明人都在做减法】，杂志风，衬线字体，主体放中间（列表里会被裁成方图）。', 'Make an article banner: 【Why smart people subtract】, editorial serif, keep the subject centred (the feed crops a square).'),
    sp('wx-ai', 'AI 资讯', 'AI news', '做公众号头图：主题【本周 AI 大事件速览】，深色科技风，加“周报”标签。', 'Make a banner: 【This week in AI】, dark tech look with a “Weekly” tag.'),
    sp('x-header', 'X 个人主页', 'X header', '做 X 主页封面：一句话介绍【Building in public · AI × Design】，极简，左下角留给头像。', 'Make an X header: 【Building in public · AI × Design】, minimal, keep the lower-left clear for the avatar.'),
    sp('wx-para', '一段话直出', 'Paste a paragraph', '根据下面的文章摘要做一张头图，标题要像钩子而不是摘要：\n【粘贴摘要】', 'Make a banner from this summary; the headline should be a hook, not a summary:\n【paste summary】'),
  ] },
];

export function startersFor(platformId: string | undefined): StarterGroup[] {
  const first = STARTERS.find(g => g.platforms.includes(platformId ?? ''));
  return first ? [first, ...STARTERS.filter(g => g !== first)] : STARTERS;
}

export interface ImageStyle { id: string; zh: string; en: string; prompt: string }
/** Appended to the model's picture prompt as the preferred look. */
export const IMAGE_STYLES: ImageStyle[] = [
  { id: 'auto', zh: '自动', en: 'Auto', prompt: '' },
  { id: 'none', zh: '不配图', en: 'No picture', prompt: '' },
  { id: '3d', zh: '3D 黏土', en: '3D clay', prompt: '3D clay render, soft studio lighting, pastel colours, rounded friendly shapes, shallow depth of field' },
  { id: 'flat', zh: '扁平插画', en: 'Flat vector', prompt: 'flat vector illustration, bold simple shapes, limited palette, clean composition' },
  { id: 'photo', zh: '电影摄影', en: 'Cinematic photo', prompt: 'cinematic photograph, 35mm, shallow depth of field, dramatic rim light, rich colour grading' },
  { id: 'neon', zh: '赛博霓虹', en: 'Neon cyber', prompt: 'cyberpunk neon scene, dark background, magenta and cyan glow, volumetric light, reflections' },
  { id: 'minimal', zh: '极简几何', en: 'Minimal geometry', prompt: 'minimal geometric composition, flat colour fields, floating shapes, generous negative space' },
  { id: 'watercolor', zh: '水彩手绘', en: 'Watercolour', prompt: 'hand-painted watercolour, paper texture, soft bleeding colours, airy' },
  { id: 'memphis', zh: '孟菲斯波普', en: 'Memphis pop', prompt: 'memphis pop design, bold colours, playful squiggles and shapes, high energy' },
  { id: 'guofeng', zh: '国潮', en: 'Guochao', prompt: 'Chinese guochao style, ink wash texture, vermilion and gold accents, modern graphic layout' },
  { id: 'isometric', zh: '等距科技', en: 'Isometric tech', prompt: 'isometric tech illustration, interface cards, clean flat shading, soft shadows' },
  { id: 'collage', zh: '拼贴杂志', en: 'Paper collage', prompt: 'paper cut-out collage, halftone dots, retro magazine texture, torn edges' },
];
/** Always added: a model-drawn headline would clash with the real one and cannot be edited. */
export const IMAGE_RULES = 'No text, no letters, no numbers, no logos, no watermark. No blur, no distortion, no extra fingers, no low-quality artefacts. Keep a calm, uncluttered area where a headline can sit.';
export function imageStyleById(id: string): ImageStyle { return IMAGE_STYLES.find(s => s.id === id) ?? IMAGE_STYLES[0]!; }

/** For the cut-out subject: a flat key colour the local keyer can remove. Must match KEY_COLOR in cutout.ts. */
export const SUBJECT_RULES = 'Isolated single subject centred on a perfectly flat, uniform solid magenta (#FF00FF) background, no gradient, no floor, no cast shadow on the background, no magenta anywhere in the subject, the whole subject fully inside the frame with clear margin on every side. No text, no letters, no logos, no watermark.';
