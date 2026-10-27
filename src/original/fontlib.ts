/**
 * Curated open-source font library: one click downloads a font into the vault font folder. Every entry is OFL-licensed
 * and its URL was checked against the project's release assets or the google/fonts repository. Nothing is downloaded
 * until the user presses the button.
 */
export type FontMood = 'serif' | 'sans' | 'display' | 'brush' | 'latin';
export interface LibFont {
  id: string;
  /** Becomes the file name, so also the font family name in the canvas. */
  family: string; en: string; mood: FontMood; zh: string; hint: string;
  urls: string[]; /** For zip downloads: the file inside to keep. */ entry?: string; ext: 'ttf' | 'otf';
  mb: number; license: string; home: string; /** Only some glyphs, e.g. Japanese kanji. */ note?: string;
  /** Widely recommended by designers: shown first and installed by the starter pack. */ hot?: boolean;
}
const MIRRORS = ['https://cdn.jsdelivr.net', 'https://fastly.jsdelivr.net', 'https://gcore.jsdelivr.net', 'https://testingcf.jsdelivr.net'];
// jsDelivr refuses single files over ~50 MB and whole packages over 150 MB; unpkg serves those, so it is the last mirror.
const NPM = (pkg: string, file: string): string[] => [...MIRRORS.map(m => `${m}/npm/${pkg}/${file}`), `https://unpkg.com/${pkg}/${file}`];
const GF = (path: string): string[] => [...MIRRORS.map(m => `${m}/gh/google/fonts@main/${path}`), `https://github.com/google/fonts/raw/main/${path}`];

export const FONT_MOODS: { id: FontMood; zh: string; en: string }[] = [
  { id: 'serif', zh: '宋 · 仿宋 · 楷', en: 'Serif & calligraphic' }, { id: 'sans', zh: '黑体', en: 'Sans' }, { id: 'display', zh: '标题 · 展示', en: 'Display' },
  { id: 'brush', zh: '手写 · 书法', en: 'Brush & script' }, { id: 'latin', zh: '西文', en: 'Latin' },
];

export const FONT_LIBRARY: LibFont[] = [
  { id: 'zhuque', hot: true, family: '朱雀仿宋', en: 'Zhuque Fangsong', mood: 'serif', zh: '开源仿宋，典雅克制，做杂志感、文化类标题最出效果', hint: '文化 · 书籍 · 深度', urls: NPM('@fontpkg/zhuque-fangsong-technical-preview@0.212.0', 'ZhuqueFangsong-Regular.ttf'), ext: 'ttf', mb: 8.8, license: 'OFL', home: 'https://github.com/TrionesType/zhuque' },
  { id: 'wenkai', hot: true, family: '霞鹜文楷', en: 'LXGW WenKai Lite', mood: 'serif', zh: '温润的开源楷体，有手写温度，适合生活、读书、情绪类', hint: '生活 · 读书 · 温暖', urls: ['https://github.com/lxgw/LxgwWenKai-Lite/releases/download/v1.522/LXGWWenKaiLite-Medium.ttf'], ext: 'ttf', mb: 13, license: 'OFL', home: 'https://github.com/lxgw/LxgwWenKai' },
  { id: 'notoserif', hot: true, family: '思源宋体', en: 'Source Han Serif SC Bold', mood: 'serif', zh: 'Adobe 与 Google 的宋体（粗），最稳的标题宋体', hint: '通用 · 严肃 · 编辑', urls: [`https://unpkg.com/@fontpkg/source-han-serif-sc@2.3.3/SourceHanSerifSC-Bold.otf`, ...GF('ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf')], ext: 'otf', mb: 25, license: 'OFL', home: 'https://fonts.google.com/noto/specimen/Noto+Serif+SC' },
  { id: 'shippori', family: '筑紫明朝', en: 'Shippori Mincho Bold', mood: 'serif', zh: '日系明朝体，粗细对比强，电影海报与日杂感', hint: '日系 · 海报 · 文艺', note: '覆盖日文汉字，部分简体字会回退到系统字体', urls: GF('ofl/shipporimincho/ShipporiMincho-Bold.ttf'), ext: 'ttf', mb: 8.2, license: 'OFL', home: 'https://fonts.google.com/specimen/Shippori+Mincho' },
  { id: 'zenantique', family: '禅古印', en: 'Zen Antique', mood: 'serif', zh: '古风粗明朝，笔画有金石味，适合国风、传统题材', hint: '国风 · 古典', note: '覆盖日文汉字，部分简体字会回退到系统字体', urls: GF('ofl/zenantique/ZenAntique-Regular.ttf'), ext: 'ttf', mb: 5.3, license: 'OFL', home: 'https://fonts.google.com/specimen/Zen+Antique' },
  { id: 'smiley', hot: true, family: '得意黑', en: 'Smiley Sans', mood: 'display', zh: '斜体黑体，轻快有设计感，科技、产品、潮流标题的热门选择', hint: '科技 · 潮流 · 产品', urls: NPM('@fontpkg/smiley-sans@2.0.4', 'SmileySans-Oblique.ttf'), ext: 'ttf', mb: 2.6, license: 'OFL', home: 'https://github.com/atelier-anchor/smiley-sans' },
  { id: 'neoxihei', family: '霞鹜新晰黑', en: 'LXGW Neo XiHei', mood: 'sans', zh: '清晰耐看的开源黑体，正文和副标题都稳', hint: '通用 · 副标题', urls: ['https://github.com/lxgw/LxgwNeoXiHei/releases/download/v1.305/LXGWNeoXiHei.ttf'], ext: 'ttf', mb: 7, license: 'OFL', home: 'https://github.com/lxgw/LxgwNeoXiHei' },
  { id: 'notosans', hot: true, family: '思源黑体', en: 'Noto Sans SC', mood: 'sans', zh: '字重可变的标准黑体，粗体做大标题很有冲击', hint: '通用 · 冲击', urls: GF('ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf'), ext: 'ttf', mb: 17, license: 'OFL', home: 'https://fonts.google.com/noto/specimen/Noto+Sans+SC' },
  { id: 'huangyou', hot: true, family: '站酷庆科黄油体', en: 'ZCOOL QingKe HuangYou', mood: 'display', zh: '圆润厚重的招牌字，小红书、种草、促销标题', hint: '种草 · 促销 · 活泼', urls: GF('ofl/zcoolqingkehuangyou/ZCOOLQingKeHuangYou-Regular.ttf'), ext: 'ttf', mb: 8, license: 'OFL', home: 'https://fonts.google.com/specimen/ZCOOL+QingKe+HuangYou' },
  { id: 'kuaile', family: '站酷快乐体', en: 'ZCOOL KuaiLe', mood: 'display', zh: '俏皮的手绘感，亲子、美食、轻松题材', hint: '轻松 · 可爱', urls: GF('ofl/zcoolkuaile/ZCOOLKuaiLe-Regular.ttf'), ext: 'ttf', mb: 1.5, license: 'OFL', home: 'https://fonts.google.com/specimen/ZCOOL+KuaiLe' },
  { id: 'xiaowei', family: '站酷小薇体', en: 'ZCOOL XiaoWei', mood: 'serif', zh: '纤细雅致的衬线，美妆、女性、品牌感标题', hint: '雅致 · 品牌', urls: GF('ofl/zcoolxiaowei/ZCOOLXiaoWei-Regular.ttf'), ext: 'ttf', mb: 6, license: 'OFL', home: 'https://fonts.google.com/specimen/ZCOOL+XiaoWei' },
  { id: 'dela', family: 'Dela Gothic One', en: 'Dela Gothic One', mood: 'display', zh: '超粗的日系标题黑体，B 站、游戏、冲击感', hint: '冲击 · 游戏', note: '主要覆盖西文与日文，简体字会回退', urls: GF('ofl/delagothicone/DelaGothicOne-Regular.ttf'), ext: 'ttf', mb: 2.4, license: 'OFL', home: 'https://fonts.google.com/specimen/Dela+Gothic+One' },
  { id: 'mashan', family: '马善政楷书', en: 'Ma Shan Zheng', mood: 'brush', zh: '毛笔楷书，国风、节日、书法感', hint: '书法 · 国风', urls: GF('ofl/mashanzheng/MaShanZheng-Regular.ttf'), ext: 'ttf', mb: 5.6, license: 'OFL', home: 'https://fonts.google.com/specimen/Ma+Shan+Zheng' },
  { id: 'zhimang', family: '志莽行书', en: 'Zhi Mang Xing', mood: 'brush', zh: '奔放的行书，气势强，适合金句与热血标题', hint: '行书 · 气势', urls: GF('ofl/zhimangxing/ZhiMangXing-Regular.ttf'), ext: 'ttf', mb: 3.9, license: 'OFL', home: 'https://fonts.google.com/specimen/Zhi+Mang+Xing' },
  { id: 'longcang', family: '龙藏体', en: 'Long Cang', mood: 'brush', zh: '潇洒的草书手写，个人风格、随笔', hint: '手写 · 随笔', urls: GF('ofl/longcang/LongCang-Regular.ttf'), ext: 'ttf', mb: 4.9, license: 'OFL', home: 'https://fonts.google.com/specimen/Long+Cang' },
  /* ---- widely used free Chinese fonts (jsDelivr npm mirrors; copyright stays with the original authors) ---- */
  { id: 'puhui', family: '阿里巴巴普惠体', en: 'Alibaba PuHuiTi 3.0', mood: 'sans', hot: true, zh: '电商和海报最常用的免费黑体，字形端正、数字好看，做副标题和正文最稳', hint: '通用 · 正文 · 电商', urls: NPM('@fontpkg/alibaba-pu-hui-ti-3-0@3.1.2', 'AlibabaPuHuiTi-3-55-Regular.ttf'), ext: 'ttf', mb: 8.5, license: '免费商用', home: 'https://fonts.alibabagroup.com/#/font' },
  { id: 'puhui-heavy', family: '阿里巴巴普惠体 Heavy', en: 'Alibaba PuHuiTi Heavy', mood: 'display', hot: true, zh: '普惠体的特粗字重，做标题有力量又不失规整，和普惠体 Regular 天然成对', hint: '标题 · 冲击 · 信息', urls: NPM('@fontpkg/alibaba-pu-hui-ti-3-0@3.1.2', 'AlibabaPuHuiTi-3-105-Heavy.ttf'), ext: 'ttf', mb: 2.5, license: '免费商用', home: 'https://fonts.alibabagroup.com/#/font' },
  { id: 'youshe', family: '优设标题黑', en: 'YouSheBiaoTiHei', mood: 'display', hot: true, zh: '设计圈公认的标题黑体，粗壮锐利，小红书和 B 站封面的“标配”大字', hint: '标题 · 封面 · 种草', urls: NPM('@fontpkg/you-she-biao-ti-hei@1.0.0', '%E4%BC%98%E8%AE%BE%E6%A0%87%E9%A2%98%E9%BB%91.ttf'), ext: 'ttf', mb: 1.4, license: '免费商用', home: 'https://www.uisdc.com/' },
  { id: 'shuhei', family: '阿里妈妈数黑体', en: 'Alimama ShuHeiTi', mood: 'display', hot: true, zh: '粗黑、略带几何感的数字风黑体，科技、数据、榜单类标题很抓眼', hint: '科技 · 数据 · 榜单', urls: NPM('@fontpkg/alimama-shu-hei-ti@1.0.5', 'AlimamaShuHeiTi-Bold.ttf'), ext: 'ttf', mb: 1.3, license: '免费商用', home: 'https://fonts.alibabagroup.com/#/font' },
  { id: 'douyin', family: '抖音美好体', en: 'Douyin Sans', mood: 'display', hot: true, zh: '字形饱满圆润、年轻有活力，短视频和潮流内容的标题很合适', hint: '潮流 · 短视频 · 年轻', urls: NPM('@fontpkg/douyin-sans@1.0.0', 'DouyinSansBold.otf'), ext: 'otf', mb: 2, license: 'OFL', home: 'https://developer.open-douyin.com/' },
  { id: 'pangmen', family: '庞门正道标题体', en: 'PangMen ZhengDao', mood: 'display', zh: '方正有力的标题体，笔画有手工感，适合观点与口号', hint: '标题 · 口号 · 观点', urls: NPM('@fontpkg/pang-men-zheng-dao-biao-ti-ti-mian-fei-ban-4@4.0.0', '%E5%BA%9E%E9%97%A8%E6%AD%A3%E9%81%93%E6%A0%87%E9%A2%98%E4%BD%93%E5%85%8D%E8%B4%B9%E7%89%88.ttf'), ext: 'ttf', mb: 1, license: '免费商用（免费版）', home: 'https://pmzd.cn/', note: '仅免费版可商用，请核对授权' },
  { id: 'misans', family: 'MiSans', en: 'MiSans', mood: 'sans', hot: true, zh: '小米的系统字体，字形饱满、屏显清晰，做界面感和小字最舒服', hint: '正文 · 小字 · 界面感', urls: NPM('@fontpkg/mi-sans@4.3.0', 'MiSans-Regular.otf'), ext: 'otf', mb: 6.5, license: '免费商用', home: 'https://hyperos.mi.com/font/' },
  { id: 'misans-heavy', family: 'MiSans Heavy', en: 'MiSans Heavy', mood: 'display', zh: 'MiSans 的特粗字重，现代、干净的粗标题', hint: '标题 · 现代', urls: NPM('@fontpkg/mi-sans@4.3.0', 'MiSans-Heavy.otf'), ext: 'otf', mb: 6.4, license: '免费商用', home: 'https://hyperos.mi.com/font/' },
  { id: 'harmony', family: '鸿蒙黑体', en: 'HarmonyOS Sans SC', mood: 'sans', zh: '华为鸿蒙系统字体，端正耐看，副标题与正文都稳', hint: '通用 · 正文', urls: NPM('@fontpkg/harmony-os-sans-sc@1.0.3', 'HarmonyOS_Sans_SC_Regular.ttf'), ext: 'ttf', mb: 8, license: '免费商用', home: 'https://developer.huawei.com/consumer/cn/doc/design-guides/font-0000001828772061' },
  { id: 'harmony-black', family: '鸿蒙黑体 Black', en: 'HarmonyOS Sans Black', mood: 'display', zh: '鸿蒙黑体的最粗字重，稳重有分量的大标题', hint: '标题 · 稳重', urls: NPM('@fontpkg/harmony-os-sans-sc@1.0.3', 'HarmonyOS_Sans_SC_Black.ttf'), ext: 'ttf', mb: 7.9, license: '免费商用', home: 'https://developer.huawei.com/consumer/cn/doc/design-guides/font-0000001828772061' },
  { id: 'daoli', family: '阿里妈妈刀隶体', en: 'Alimama DaoLiTi', mood: 'brush', zh: '刀刻感的隶书，锋利有金石味，国风、武侠、传统题材', hint: '国风 · 武侠 · 传统', urls: NPM('@fontpkg/alimama-dao-li-ti@1.0.5', 'AlimamaDaoLiTi.ttf'), ext: 'ttf', mb: 4.9, license: '免费商用', home: 'https://fonts.alibabagroup.com/#/font' },
  { id: 'xiaxing', family: '演示夏行楷', en: 'Yanshi Xiaxingkai', mood: 'brush', zh: '流畅的行楷，手写温度，适合金句、情绪与读书', hint: '手写 · 金句 · 情绪', urls: NPM('@fontpkg/slidexiaxing@1.0.0', '%E6%BC%94%E7%A4%BA%E5%A4%8F%E8%A1%8C%E6%A5%B7.ttf'), ext: 'ttf', mb: 9.8, license: '免费商用', home: 'https://www.npmjs.com/package/@fontpkg/slidexiaxing' },
  /* ---- more display and handwriting faces (personal use is always fine; check the licence before commercial work) ---- */
  { id: 'zcoolkuhei', family: '站酷酷黑体', en: 'ZCOOL KuHei', mood: 'display', zh: '粗黑方正，海报和电商大字的经典选择', hint: '标题 · 海报 · 电商', urls: NPM('@fontpkg/zcool-ku-hei@3.12.0', '%E7%AB%99%E9%85%B7%E9%85%B7%E9%BB%91%E4%BD%93.ttf'), ext: 'ttf', mb: 2.1, license: '个人免费，商用请核对授权', home: 'https://www.zcool.com.cn/special/zcoolfonts/' },
  { id: 'zcoolwenyi', family: '站酷文艺体', en: 'ZCOOL WenYi', mood: 'serif', zh: '带手作温度的文艺体，生活方式、读书、咖啡类封面', hint: '文艺 · 生活 · 读书', urls: NPM('@fontpkg/zcoolwenyiti@1.0.0', '%E7%AB%99%E9%85%B7%E6%96%87%E8%89%BA%E4%BD%93.ttf'), ext: 'ttf', mb: 4, license: '个人免费，商用请核对授权', home: 'https://www.zcool.com.cn/special/zcoolfonts/' },
  { id: 'houdihei', family: 'Aa 厚底黑', en: 'Aa HouDiHei', mood: 'display', zh: '圆厚的底部加粗，很有设计感的潮流标题', hint: '潮流 · 标题 · 种草', urls: NPM('@fontpkg/aa-hou-di-hei@1.0.0', 'Aa%E5%8E%9A%E5%BA%95%E9%BB%91.ttf'), ext: 'ttf', mb: 1.8, license: '个人免费，商用请核对授权', home: 'https://www.zitijia.com/' },
  { id: 'jianhao', family: 'Aa 剑豪体', en: 'Aa JianHao', mood: 'brush', zh: '锋利有劲的毛笔体，武侠、游戏、热血类标题', hint: '热血 · 武侠 · 游戏', urls: NPM('@fontpkg/aa-jian-hao-ti@1.0.0', 'AaJianHaoTi.ttf'), ext: 'ttf', mb: 5.5, license: '个人免费，商用请核对授权', home: 'https://www.zitijia.com/' },
  { id: 'bifeng', family: '千图笔锋手写体', en: 'Qiantu Bifeng', mood: 'brush', zh: '笔锋流畅的手写体，口号和情绪金句很有力', hint: '手写 · 金句 · 情绪', urls: NPM('@fontpkg/qiantubifengshouxieti@1.0.0', '%E5%8D%83%E5%9B%BE%E7%AC%94%E9%94%8B%E6%89%8B%E5%86%99%E4%BD%93.ttf'), ext: 'ttf', mb: 2.1, license: '免费商用（千图字体声明）', home: 'https://www.58pic.com/' },
  { id: 'softbrush', family: '沐瑶软笔手写体', en: 'Muyao Softbrush', mood: 'brush', zh: '软笔的柔和与力度，国风、茶、散文的好选择', hint: '国风 · 软笔 · 散文', urls: NPM('@fontpkg/muyao-softbrush@1.0.0', 'Muyao-Softbrush.ttf'), ext: 'ttf', mb: 4.5, license: '免费商用（作者声明）', home: 'https://www.npmjs.com/package/@fontpkg/muyao-softbrush' },
  { id: 'chunfeng', family: '演示春风楷', en: 'Slide ChunFeng Kai', mood: 'brush', zh: '端庄清秀的楷体，读书、教育、文化类', hint: '楷体 · 读书 · 文化', urls: NPM('@fontpkg/slidechunfeng@1.0.0', '%E6%BC%94%E7%A4%BA%E6%98%A5%E9%A3%8E%E6%A5%B7.ttf'), ext: 'ttf', mb: 9.7, license: '免费商用', home: 'https://www.npmjs.com/package/@fontpkg/slidechunfeng' },
  { id: 'honglei', family: '鸿雷行书', en: 'Honglei Xingshu', mood: 'brush', zh: '潇洒的行书，适合气势、豪情和励志', hint: '行书 · 励志 · 气势', urls: NPM('@fontpkg/hongleixingshu@2.0.0', '%E9%B8%BF%E9%9B%B7%E8%A1%8C%E4%B9%A6%E7%AE%80%E4%BD%93.otf'), ext: 'otf', mb: 9, license: '免费商用', home: 'https://www.npmjs.com/package/@fontpkg/hongleixingshu' },
  { id: 'maoken', family: '猫啃珠圆体', en: 'Maoken Zhuyuan', mood: 'display', zh: '圆润的珠圆体，亲切可爱，母婴、美食、生活', hint: '可爱 · 美食 · 生活', urls: NPM('@fontpkg/maoken-zhuyuan-ti@1.0.0', '%E7%8C%AB%E5%95%83%E7%8F%A0%E5%9C%86%E4%BD%93%20MaokenZhuyuanTi.ttf'), ext: 'ttf', mb: 5.7, license: '免费商用（作者声明）', home: 'https://github.com/MaokenStudio/MaokenZhuyuanTi' },
  { id: 'biantao', family: '字魂扁桃体', en: 'Zihun Biantao', mood: 'display', zh: '扁扁的可爱标题体，萌系、活动类', hint: '萌系 · 活动 · 种草', urls: NPM('@fontpkg/zihunbiantaoti@1.0.0', '%E5%AD%97%E9%AD%82%E6%89%81%E6%A1%83%E4%BD%93.ttf'), ext: 'ttf', mb: 2.3, license: '个人免费，商用请核对授权', home: 'https://izihun.com/' },
  { id: 'pangmencu', family: '庞门正道粗书体', en: 'PangMen Cushu', mood: 'display', zh: '气势磅礴的粗书体，大标题的冲击力很强', hint: '标题 · 冲击 · 国潮', urls: NPM('@fontpkg/pang-men-zheng-dao-cu6-0@6.0.0', '%E5%BA%9E%E9%97%A8%E6%AD%A3%E9%81%93%E7%B2%97%E4%B9%A6%E4%BD%93.ttf'), ext: 'ttf', mb: 11, license: '免费商用（免费版）', home: 'https://pmzd.cn/' },
  { id: 'glow', family: '未来荧黑', en: 'Glow Sans SC Heavy', mood: 'display', zh: '几何感很强的粗黑，科技与现代感，OFL 开源', hint: '科技 · 现代 · 开源', urls: NPM('@fontpkg/glow-sans-sc@0.93.2', 'GlowSansSC-Normal-Heavy.otf'), ext: 'otf', mb: 9.2, license: 'OFL', home: 'https://github.com/welai/glow-sans' },
  { id: 'pixel', family: '缝合像素字体', en: 'Fusion Pixel', mood: 'display', zh: '像素风，游戏、复古、极客类，OFL 开源', hint: '像素 · 游戏 · 复古', urls: NPM('@fontpkg/fusion-pixel@20220405.0.0', 'fusion-pixel.ttf'), ext: 'ttf', mb: 3.5, license: 'OFL', home: 'https://github.com/TakWolf/fusion-pixel-font' },
  { id: 'kangkang', family: '素材集市康康体', en: 'Sucai KangKang', mood: 'display', zh: '圆润又有性格的标题体，生活类、活泼内容', hint: '生活 · 活泼 · 标题', urls: NPM('@fontpkg/sucaijishikangkangti@3.1.0', '%E7%B4%A0%E6%9D%90%E9%9B%86%E5%B8%82%E5%BA%B7%E5%BA%B7%E4%BD%933.001.ttf'), ext: 'ttf', mb: 4.6, license: '个人免费，商用请核对授权', home: 'https://www.sucaijishi.com/' },
  { id: 'maocao', family: '刘建毛草', en: 'Liu Jian Mao Cao', mood: 'brush', zh: '潇洒草书，古风、武侠，Google Fonts 开源', hint: '草书 · 古风 · 开源', urls: NPM('@fontpkg/liu-jian-mao-cao@1.1.0', 'Liu%20Jian%20Mao%20Cao.ttf'), ext: 'ttf', mb: 4.9, license: 'OFL', home: 'https://fonts.google.com/specimen/Liu+Jian+Mao+Cao' },
  /* ---- open source (OFL): free for any use, including commercial ---- */
  { id: 'zhenkai', family: '霞鹜臻楷', en: 'LXGW ZhenKai', mood: 'serif', zh: '比文楷更端正的开源楷体，读书、文化、国学类标题', hint: '楷体 · 文化 · 开源', urls: NPM('@fontpkg/lxgw-zhen-kai@0.60.0', 'LXGWZhenKai.ttf'), ext: 'ttf', mb: 3.9, license: 'OFL', home: 'https://github.com/lxgw/LxgwZhenKai' },
  { id: 'jiangcheng', family: '江城圆体', en: 'JiangCheng YuanTi', mood: 'display', zh: '饱满的开源圆体，亲切不幼稚，生活、母婴、教育类大字', hint: '圆体 · 亲切 · 开源', urls: NPM('@fontpkg/jiang-cheng-yuan-ti@3.6.0', '%E6%B1%9F%E5%9F%8E%E5%9C%86%E4%BD%93%20600W.ttf'), ext: 'ttf', mb: 15.1, license: 'OFL', home: 'https://github.com/Buernia/JiangChengYuanTi' },
  { id: 'chillround', family: '寒蝉全圆体', en: 'Chill Round F', mood: 'display', zh: '圆润干净的开源圆体，清新、可爱、生活方式', hint: '圆体 · 清新 · 开源', urls: NPM('@fontpkg/chill-round-f@3.0.0', 'ChillRoundF.ttf'), ext: 'ttf', mb: 6.2, license: 'OFL', home: 'https://github.com/Warren2060/ChillRound' },
  { id: 'maru975', family: '975圆体', en: '975 Maru SC', mood: 'sans', zh: '耐看的开源圆黑，正文与标题都温和', hint: '圆黑 · 温和 · 开源', urls: NPM('@fontpkg/975-maru-sc@2.1.2', '975MaruSC-Medium.ttf'), ext: 'ttf', mb: 18, license: 'OFL', home: 'https://github.com/lemonjar/975maru' },
  { id: 'genjyuu', family: '源柔黑体', en: 'Gen Jyuu Gothic Heavy', mood: 'display', zh: '思源黑体的圆角版，粗而柔和，可爱又有分量的标题', hint: '圆角 · 可爱 · 开源', note: '基于日文版思源黑体，个别简体字形是日式写法', urls: NPM('@fontpkg/gen-jyuu-gothic@1.2.20150607', 'GenJyuuGothic-Heavy.ttf'), ext: 'ttf', mb: 12, license: 'OFL', home: 'http://jikasei.me/font/genjyuu/' },
  { id: 'tiejili', family: '铁蒺藜体', en: 'Tiejili SC', mood: 'display', zh: '硬朗有棱角的开源标题体，热血、游戏、街头感', hint: '棱角 · 热血 · 开源', urls: NPM('@fontpkg/tiejili-sc@1.100.1', 'TiejiliSC-Regular.ttf'), ext: 'ttf', mb: 5.8, license: 'OFL', home: 'https://github.com/Buernia/Tiejili' },
  { id: 'maokenassorted', family: '猫啃什锦黑', en: 'Maoken Assorted Sans', mood: 'display', zh: '活泼跳跃的开源黑体，种草、美食、生活', hint: '活泼 · 种草 · 开源', urls: NPM('@fontpkg/maoken-assorted-sans@1.62.1', 'MaokenAssortedSans.ttf'), ext: 'ttf', mb: 12.3, license: 'OFL', home: 'https://github.com/MaokenStudio/MaokenAssortedSans' },
  { id: 'zhengrui', family: '卢帅正锐黑体', en: 'Lushuai ZhengRui Hei', mood: 'display', zh: '锐利的斜切黑体，速度感强，运动、科技、电竞标题', hint: '锐利 · 运动 · 开源', urls: NPM('@fontpkg/lianmengqiyilushuaizhengruiheiti@1.0.0', '%E8%81%94%E7%9B%9F%E8%B5%B7%E8%89%BA%E5%8D%A2%E5%B8%85%E6%AD%A3%E9%94%90%E9%BB%91%E4%BD%93.ttf'), ext: 'ttf', mb: 1.4, license: 'OFL', home: 'https://www.npmjs.com/package/@fontpkg/lianmengqiyilushuaizhengruiheiti' },
  { id: 'xiaolai', family: '小赖字体', en: 'Xiaolai SC', mood: 'brush', zh: '可爱的开源手写体，日记、手账、亲子', hint: '手写 · 可爱 · 开源', urls: NPM('@fontpkg/xiaolai-sc@3.11.0', 'XiaolaiSC-Regular.ttf'), ext: 'ttf', mb: 21.9, license: 'OFL', home: 'https://github.com/lxgw/kose-font' },
  /* ---- free for commercial use by the maker's own statement ---- */
  { id: 'jinbu', family: '钉钉进步体', en: 'DingTalk JinBuTi', mood: 'display', hot: true, zh: '斜切的粗黑，向上有冲劲，职场、成长、干货标题的热门选择', hint: '冲劲 · 职场 · 干货', urls: NPM('@fontpkg/ding-talk-jin-bu-ti@1.0.3', 'DingTalk%20JinBuTi.ttf'), ext: 'ttf', mb: 2.1, license: '免费商用', home: 'https://www.dingtalk.com/' },
  { id: 'oppo', family: 'OPPO Sans', en: 'OPPO Sans 4.0', mood: 'sans', zh: 'OPPO 系统字体，字重可变，现代干净，正文和副标题', hint: '正文 · 现代', urls: NPM('@fontpkg/oppo-sans-4-0@1.700.0', 'OPPO%20Sans%204.0.ttf'), ext: 'ttf', mb: 22.7, license: '免费商用', home: 'https://open.oppomobile.com/new/developmentDoc/info?id=13223' },
  { id: 'vivo-heavy', family: 'vivo Sans Heavy', en: 'vivo Sans Heavy', mood: 'display', zh: 'vivo 系统字体的特粗字重，几何感强的现代大标题', hint: '标题 · 现代 · 几何', urls: NPM('@fontpkg/vivo-sans@1.0.3', 'vivoSans-Heavy.ttf'), ext: 'ttf', mb: 7.7, license: '免费商用', home: 'https://developers.vivo.com/doc/d/fe3eadb8a8f14ae3a2d3d9d73d2a07d2' },
  { id: 'honor-bold', family: '荣耀字体 Bold', en: 'HONOR Sans CN Bold', mood: 'display', zh: '荣耀系统字体粗体，端正有力，数码、科技类标题', hint: '标题 · 数码 · 科技', urls: NPM('@fontpkg/honor-sans-cn@1.2.0', 'HONORSansCN-Bold.ttf'), ext: 'ttf', mb: 8, license: '免费商用', home: 'https://developer.honor.com/cn/doc/guides/101359' },
  { id: 'fangyuan', family: '阿里妈妈方圆体', en: 'Alimama FangYuanTi VF', mood: 'display', zh: '方中带圆的可变字重标题体，电商、生活、亲和的品牌感', hint: '方圆 · 电商 · 亲和', urls: NPM('@fontpkg/alimama-fangyuanti-vf@0.0.0', 'AlimamaFangYuanTiVF-Thin.ttf'), ext: 'ttf', mb: 7.4, license: '免费商用', home: 'https://fonts.alibabagroup.com/#/font' },
  { id: 'maicai', family: '淘宝买菜体', en: 'TaoBao MaiCaiTi', mood: 'display', zh: '圆鼓鼓的手作感标题字，美食、生鲜、生活种草', hint: '美食 · 生活 · 可爱', urls: NPM('@fontpkg/taobaomaicaiti@0.0.0', 'TaoBaoMaiCaiTi-Regular.ttf'), ext: 'ttf', mb: 2.3, license: '免费商用', home: 'https://www.npmjs.com/package/@fontpkg/taobaomaicaiti' },
  { id: 'gaoduanhei', family: '站酷高端黑', en: 'ZCOOL GaoDuanHei', mood: 'display', zh: '瘦高利落的黑体，时尚、高级感、品牌海报', hint: '时尚 · 高级 · 品牌', urls: NPM('@fontpkg/zcool-gdh@2.10.0', '%20%E7%AB%99%E9%85%B7%E9%AB%98%E7%AB%AF%E9%BB%91%E4%BF%AE%E8%AE%A2151105.ttf'), ext: 'ttf', mb: 4, license: '免费商用', home: 'https://www.zcool.com.cn/special/zcoolfonts/' },
  { id: 'haoshen', family: '优设好身体', en: 'YouShe HaoShenTi', mood: 'display', zh: '粗壮紧凑的标题体，运动、健身、冲击感大字', hint: '运动 · 冲击 · 标题', urls: NPM('@fontpkg/yoush-ehaoshenti@1.0.0', 'YSHaoShenTi-2.ttf'), ext: 'ttf', mb: 3.3, license: '免费商用', home: 'https://www.uisdc.com/' },
  { id: 'youshe-yuan', family: '优设标题圆', en: 'YouShe BiaoTiYuan', mood: 'display', zh: '优设标题黑的圆体版，醒目又亲和，小红书大字', hint: '圆体 · 标题 · 种草', urls: NPM('@fontpkg/you-she-biao-ti-yuan@1.5.0', '%E4%BC%98%E8%AE%BE%E6%A0%87%E9%A2%98%E5%9C%86.otf'), ext: 'otf', mb: 1.7, license: '免费商用', home: 'https://www.uisdc.com/' },
  { id: 'qingsong', family: '庞门正道轻松体', en: 'PangMen QingSong', mood: 'display', zh: '轻松随性的手写黑，生活、日常、轻松话题', hint: '轻松 · 日常 · 手写', urls: NPM('@fontpkg/pangmenzhengdaoqingsongti@1.0.0', '%E5%BA%9E%E9%97%A8%E6%AD%A3%E9%81%93%E8%BD%BB%E6%9D%BE%E4%BD%93.otf'), ext: 'otf', mb: 3.3, license: '免费商用', home: 'https://pmzd.cn/' },
  { id: 'zhushi', family: '杨任东竹石体', en: 'YRD ZhuShi Heavy', mood: 'display', zh: '带书写骨架的粗黑，有人情味的标题，读书、观点', hint: '标题 · 人文 · 观点', urls: NPM('@fontpkg/yrdzst@1.23.0', '%E6%9D%A8%E4%BB%BB%E4%B8%9C%E7%AB%B9%E7%9F%B3%E4%BD%93-Heavy.ttf'), ext: 'ttf', mb: 4, license: '免费商用', home: 'https://www.npmjs.com/package/@fontpkg/yrdzst' },
  { id: 'tezhan', family: '字体传奇特战体', en: 'ZiTiChuanQi TeZhan', mood: 'display', zh: '军事感的硬朗标题字，游戏、电竞、挑战类', hint: '游戏 · 电竞 · 硬朗', urls: NPM('@fontpkg/ziticqtezhanti@1.0.0', '%E5%AD%97%E4%BD%93%E4%BC%A0%E5%A5%87%E7%89%B9%E6%88%98%E4%BD%93(%E6%AD%A3%E5%BC%8F%E7%89%88).ttf'), ext: 'ttf', mb: 4.7, license: '免费商用', home: 'https://www.npmjs.com/package/@fontpkg/ziticqtezhanti' },
  { id: 'kuaikan', family: '快看世界体', en: 'Kuaikan World', mood: 'display', zh: '漫画对白感的粗体，二次元、漫画、搞笑', hint: '漫画 · 二次元 · 搞笑', urls: NPM('@fontpkg/kuaikanshijieti@1.3.0', 'kuaikanshijieti20231213.ttf'), ext: 'ttf', mb: 4, license: '免费商用', home: 'https://www.kuaikanmanhua.com/' },
  { id: 'douyu', family: '斗鱼追光体', en: 'Douyu ZhuiGuang', mood: 'display', zh: '倾斜有速度的粗体，直播、游戏、热血', hint: '直播 · 游戏 · 速度', urls: NPM('@fontpkg/douyu@1.0.0', '%E6%96%97%E9%B1%BC%E8%BF%BD%E5%85%89%E4%BD%932.0.ttf'), ext: 'ttf', mb: 5.2, license: '免费商用', home: 'https://www.douyu.com/' },
  { id: 'yuyang', family: '仓耳渔阳体', en: 'Tsanger YuYang W03', mood: 'sans', zh: '清秀有书卷气的黑体，副标题与正文很雅', hint: '文艺 · 正文 · 书卷', urls: NPM('@fontpkg/tsanger-yu-yang-t@1.0.0', '%E4%BB%93%E8%80%B3%E6%B8%94%E9%98%B3%E4%BD%93-W03.ttf'), ext: 'ttf', mb: 1.6, license: '免费商用（W01–W05）', home: 'https://tsanger.cn/' },
  { id: 'kinghwa', family: '京华老宋体', en: 'KingHwa OldSong', mood: 'serif', zh: '民国老报刊的宋体味道，复古、人文、杂志感标题', hint: '复古 · 人文 · 杂志', urls: NPM('@fontpkg/king-hwa-old-song@2.2.0', '%E4%BA%AC%E8%8F%AF%E8%80%81%E5%AE%8B%E4%BD%93v2.002.ttf'), ext: 'ttf', mb: 36.6, license: '免费商用（作者声明）', home: 'https://zhuanlan.zhihu.com/p/637491623' },
  { id: 'huiwen', family: '汇文明朝体', en: 'Huiwen Mincho', mood: 'serif', zh: '古籍刻本风的明朝体，书卷气、文化与读书类', hint: '古籍 · 书卷 · 文化', urls: NPM('@fontpkg/huiwen-mincho@1.0.0', 'Huiwen-mincho.otf'), ext: 'otf', mb: 24.4, license: '免费商用（作者声明）', home: 'https://www.npmjs.com/package/@fontpkg/huiwen-mincho' },
  { id: 'qiuhong', family: '演示秋鸿楷', en: 'Slide QiuHong Kai', mood: 'brush', zh: '清丽的行楷，散文、诗词、国风金句', hint: '行楷 · 诗词 · 国风', urls: NPM('@fontpkg/slideqiuhong@1.0.0', '%E6%BC%94%E7%A4%BA%E7%A7%8B%E9%B8%BF%E6%A5%B7.ttf'), ext: 'ttf', mb: 14.9, license: '免费商用', home: 'https://www.npmjs.com/package/@fontpkg/slideqiuhong' },
  { id: 'youran', family: '演示悠然小楷', en: 'Slide YouRan XiaoKai', mood: 'brush', zh: '安静的小楷，读书笔记、手账、文艺生活', hint: '小楷 · 读书 · 文艺', urls: NPM('@fontpkg/slideyouran@1.0.0', '%E6%BC%94%E7%A4%BA%E6%82%A0%E7%84%B6%E5%B0%8F%E6%A5%B7.ttf'), ext: 'ttf', mb: 12.6, license: '免费商用', home: 'https://www.npmjs.com/package/@fontpkg/slideyouran' },
  { id: 'zhuoshu', family: '鸿雷拙书', en: 'Honglei ZhuoShu', mood: 'brush', zh: '稚拙可爱的毛笔字，节日、国潮、文创', hint: '拙书 · 国潮 · 文创', urls: NPM('@fontpkg/hong-lei-zhuo-shu@1.0.1', '%E9%B8%BF%E9%9B%B7%E6%8B%99%E4%B9%A6%E7%AE%80%E4%BD%93.otf'), ext: 'otf', mb: 6.5, license: '免费商用', home: 'https://www.npmjs.com/package/@fontpkg/hong-lei-zhuo-shu' },
  { id: 'playfair', family: 'Playfair Display', en: 'Playfair Display', mood: 'latin', zh: '高反差的西文衬线，杂志大标题的经典', hint: '杂志 · 优雅', urls: GF('ofl/playfairdisplay/PlayfairDisplay%5Bwght%5D.ttf'), ext: 'ttf', mb: 0.3, license: 'OFL', home: 'https://fonts.google.com/specimen/Playfair+Display' },
  { id: 'anton', family: 'Anton', en: 'Anton', mood: 'latin', zh: '窄而粗的西文无衬线，YouTube 缩略图标配', hint: '缩略图 · 冲击', urls: GF('ofl/anton/Anton-Regular.ttf'), ext: 'ttf', mb: 0.2, license: 'OFL', home: 'https://fonts.google.com/specimen/Anton' },
  { id: 'bebas', family: 'Bebas Neue', en: 'Bebas Neue', mood: 'latin', zh: '全大写窄体，数字和短词标题利落', hint: '数字 · 短标题', urls: GF('ofl/bebasneue/BebasNeue-Regular.ttf'), ext: 'ttf', mb: 0.06, license: 'OFL', home: 'https://fonts.google.com/specimen/Bebas+Neue' },
];
/** One-click bundles. The designer pack covers body, headline, impact and warm display in about 30 MB. */
export const FONT_PACKS: { id: string; zh: string; en: string; desc: string; ids: string[] }[] = [
  { id: 'designer', zh: '设计师基础包', en: 'Designer starter pack', desc: '普惠体（正文）+ 普惠体 Heavy + 优设标题黑 + 数黑体 + 得意黑：覆盖信息、冲击、科技三种气质，约 15 MB', ids: ['puhui', 'puhui-heavy', 'youshe', 'shuhei', 'smiley'] },
  { id: 'editorial', zh: '文艺杂志包', en: 'Editorial pack', desc: '朱雀仿宋 + 霞鹜文楷 + 思源宋体：深度、读书、文化类', ids: ['zhuque', 'wenkai', 'notoserif'] },
  { id: 'social', zh: '种草潮流包', en: 'Trend pack', desc: '抖音美好体 + 站酷庆科黄油体 + 站酷快乐体：小红书、短视频的活泼标题', ids: ['douyin', 'huangyou', 'kuaile'] },
  { id: 'impact', zh: '冲击标题包', en: 'Impact pack', desc: '钉钉进步体 + 优设好身体 + 站酷高端黑 + vivo Sans Heavy：干货、运动、品牌的大标题', ids: ['jinbu', 'haoshen', 'gaoduanhei', 'vivo-heavy'] },
  { id: 'round', zh: '圆体可爱包', en: 'Rounded pack', desc: '江城圆体 + 寒蝉全圆体 + 优设标题圆 + 淘宝买菜体：生活、美食、母婴', ids: ['jiangcheng', 'chillround', 'youshe-yuan', 'maicai'] },
  { id: 'opensource', zh: '开源全家桶', en: 'Open-source set', desc: '全部 OFL 开源字体：思源黑体 / 宋体、霞鹜文楷 / 臻楷 / 新晰黑、朱雀仿宋、得意黑、江城圆体、寒蝉全圆体等，任何用途都放心', ids: ['notosans', 'notoserif', 'wenkai', 'zhenkai', 'neoxihei', 'zhuque', 'smiley', 'jiangcheng', 'chillround', 'maru975', 'huangyou', 'kuaile', 'mashan', 'glow'] },
];
export const fontLibById = (id: string): LibFont | undefined => FONT_LIBRARY.find(f => f.id === id);

const u16 = (d: DataView, o: number): number => d.getUint16(o, true);
const u32 = (d: DataView, o: number): number => d.getUint32(o, true);
/** Reads one file out of a zip (stored or deflate). Enough for the release archives above; no dependency. */
export async function unzipEntry(buf: ArrayBuffer, name: string): Promise<ArrayBuffer> {
  const d = new DataView(buf); const bytes = new Uint8Array(buf);
  let eocd = -1; for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66000); i--) if (u32(d, i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('zip-invalid');
  let p = u32(d, eocd + 16); const count = u16(d, eocd + 10); const decoder = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (u32(d, p) !== 0x02014b50) throw new Error('zip-invalid');
    const method = u16(d, p + 10), csize = u32(d, p + 20), nameLen = u16(d, p + 28), extra = u16(d, p + 30), comment = u16(d, p + 32), local = u32(d, p + 42);
    const entry = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    if (entry === name || entry.endsWith(`/${name}`)) {
      const start = local + 30 + u16(d, local + 26) + u16(d, local + 28); const data = bytes.subarray(start, start + csize);
      if (method === 0) return data.slice().buffer;
      if (method !== 8) throw new Error('zip-method');
      const out = new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')));
      return out.arrayBuffer();
    }
    p += 46 + nameLen + extra + comment;
  }
  throw new Error('zip-entry-missing');
}
/** True when the bytes start like a TrueType/OpenType font, so an HTML error page is never saved as a font. */
export function looksLikeFont(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 12) return false; const d = new DataView(buf); const tag = d.getUint32(0);
  return tag === 0x00010000 || tag === 0x4f54544f || tag === 0x74727565 || tag === 0x74746366;
}
