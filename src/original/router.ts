/**
 * Which capability domains a request touches, decided locally from its words so the prompt only carries the cards it needs.
 * When nothing matches, every domain is loaded: an unsure route costs prompt length, never a missing capability.
 */
import { DOMAINS, type Domain } from './capabilities';

const RULES: [Domain, RegExp][] = [
  ['design', /(做|生成|设计|出)(一|个|张|版)*封面|重新排版|重排|重做|换个?(风格|版式|排版|布局)|再来一版|换一版|改文案|重写|标题改成|起个标题|换个标题|更好看|高级一点|整体(优化|调整)|优化一下|大气一点|redesign|new cover|another version|restyle/i],
  ['layout', /移|挪|放到|放在|摆到|左边|右边|上面|下面|上方|下方|角落|[左右上下]角|居中|对齐|大一点|小一点|放大|缩小|变大|变小|尺寸|删|去掉|移除|不要了|复制|再来一个|多加几个|层|置顶|置底|最前|最后面|挡住|遮住|透明|旋转|翻转|锁|间距|分布|排列|位置|往[左右上下]|靠[左右上下]|bigger|smaller|move|delete|remove|duplicate|rotate|opacity|align|layer/i],
  ['text', /字|标题|文案|副标题|字体|字号|加粗|斜体|阴影|描边|行距|字距|荧光|写上|写成|改成「|改成“|"|“|text|font|title|bold|italic/i],
  ['color', /色|配色|颜色|暖|冷|暗|亮|素一点|淡一点|鲜艳|饱和|反差|对比|色调|tone|colou?r|palette|warmer|cooler|darker|lighter/i],
  ['asset', /图标|icon|贴纸|表情|emoji|形状|装饰|下划线|箭头|星星|爱心|圆形|方块|插入|加(一|个|上|点)|放(一|个)|来(一|个)|照片|素材|logo|sticker|shape|decor|photo|add a/i],
  ['canvas', /平台|尺寸|比例|小红书|youtube|油管|b站|哔哩|公众号|抖音|视频号|推特|背景|模板|配图|生成图|画一|插图|弥散|渐变|template|background|platform/i],
  ['history', /撤销|重做|上一步|恢复|undo|redo/i],
];
/** Domains for a request. `blank` (an empty canvas) and long pasted material always mean a full design. */
export function routeDomains(prompt: string, o: { blank: boolean }): { domains: Domain[]; sure: boolean } {
  const text = prompt.trim();
  if (o.blank || text.length > 80 || /[\r\n]/.test(text) || /^https?:\/\//.test(text)) return { domains: ['design', ...DOMAINS.map(d => d.id).filter(d => d !== 'design')], sure: true };
  const hit = new Set<Domain>(RULES.filter(([, re]) => re.test(text)).map(([d]) => d));
  if (!hit.size) return { domains: DOMAINS.map(d => d.id), sure: false };
  // New things need somewhere to go, and a colour ask about a single layer needs the layer tools.
  if (hit.has('asset') || hit.has('text')) hit.add('layout');
  if (hit.has('color')) hit.add('layout');
  if (hit.has('layout')) hit.add('text');
  return { domains: DOMAINS.map(d => d.id).filter(d => hit.has(d)), sure: true };
}
