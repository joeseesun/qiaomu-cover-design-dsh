/**
 * Type pairings: the unit both the templates and the assistant design with. Each one fixes the three roles a cover has — a
 * Chinese headline face, a quiet body face, and a Latin face for numbers, issue tags and English words — from the default
 * font library, so every combination is one a designer would sign off on.
 */
export interface Pairing { id: string; zh: string; en: string; use: string; title: string; body: string; latin: string; /** Small Latin labels (issue numbers, kickers); defaults to `latin`. */ tag?: string }

export const PAIRINGS: Pairing[] = [
  { id: 'editorial', zh: '编辑杂志', en: 'Editorial', use: '深度长文、观点、访谈、杂志感', title: '思源宋体 Heavy', body: '思源黑体', latin: 'Instrument Serif', tag: 'Instrument Serif Italic' },
  { id: 'literary', zh: '文化书卷', en: 'Literary', use: '读书、历史、文化、人文随笔', title: '朱雀仿宋', body: '霞鹜文楷', latin: 'Cormorant Garamond' },
  { id: 'tech', zh: '科技产品', en: 'Tech', use: 'AI、工具、发布会、数据结论', title: '未来荧黑', body: '思源黑体', latin: 'Space Grotesk', tag: 'JetBrains Mono' },
  { id: 'trend', zh: '潮流种草', en: 'Trend', use: '小红书种草、创作者、产品推荐', title: '得意黑', body: '思源黑体', latin: 'Bricolage Grotesque' },
  { id: 'youth', zh: '短视频', en: 'Short video', use: '抖音 / 视频号、年轻生活方式', title: '抖音美好体', body: '思源黑体', latin: 'Inter Bold', tag: 'Bebas Neue' },
  { id: 'punch', zh: '干货冲击', en: 'Punch', use: '清单、避坑、榜单、教程', title: '思源黑体 Heavy', body: '思源黑体', latin: 'Anton', tag: 'Bebas Neue' },
  { id: 'promo', zh: '促销亲切', en: 'Promo', use: '探店、优惠、活动、电商', title: '站酷庆科黄油体', body: '思源黑体', latin: 'Archivo Black' },
  { id: 'soft', zh: '圆润亲切', en: 'Soft', use: '母婴、家居、健康、生活技巧', title: '江城圆体', body: '思源黑体', latin: 'Fraunces' },
  { id: 'playful', zh: '俏皮可爱', en: 'Playful', use: '美食、宠物、亲子、轻松话题', title: '猫啃什锦黑', body: '思源黑体', latin: 'Bricolage Grotesque' },
  { id: 'warm', zh: '温暖手记', en: 'Warm', use: '情绪、成长、读书笔记、日常', title: '霞鹜文楷', body: '思源黑体', latin: 'Fraunces', tag: 'Caveat' },
  { id: 'guofeng', zh: '国风书法', en: 'Chinese ink', use: '节气、诗词、传统文化', title: '马善政楷书', body: '朱雀仿宋', latin: 'Cormorant Garamond' },
  { id: 'guochao', zh: '国潮热血', en: 'Bold heritage', use: '国潮、运动、武侠、热血', title: '铁蒺藜体', body: '思源黑体', latin: 'Unbounded' },
];
export const pairingById = (id: string | undefined): Pairing | undefined => PAIRINGS.find(p => p.id === id);
/** One line per pairing for the assistant's prompt. */
export const pairingGuide = (): string => PAIRINGS.map(p => `   · ${p.id}（${p.zh}）：标题 ${p.title} / 正文 ${p.body} / 英文数字 ${p.latin}${p.tag && p.tag !== p.latin ? `、角标 ${p.tag}` : ''}——${p.use}`).join('\n');
