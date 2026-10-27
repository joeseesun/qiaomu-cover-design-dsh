import type { AiConfig } from './aiparse';
export const JIMENG_MODELS = ['4.5', '5.0', '4.6', '4.1', '4.0', '3.1', '3.0'].map(v => ({ id: `jimeng-${v}`, name: `Jimeng ${v}` }));
export function jimengProtocol(c: Pick<AiConfig, 'imageEngine' | 'imageBaseUrl' | 'imageModel'>): boolean {
  return c.imageEngine === 'api' && !/^jimeng-video/i.test(c.imageModel) && (/^jimeng(?:$|-(?:5\.0|4\.[0651]|3\.[01])$)/i.test(c.imageModel) || /\/jimeng-api(?:\/|$)/i.test(c.imageBaseUrl));
}
export function jimengModels(base: string, list: {id:string;name?:string}[]): {id:string;name?:string}[] {
  const images = list.filter(m => !/video/i.test(m.id) && /image|flux|diffusion|dall|cogview|seedream|imagen|^jimeng(?:$|-)/i.test(m.id));
  if (!/\/jimeng-api(?:\/|$)/i.test(base) && !images.some(m => /^jimeng/i.test(m.id))) return images;
  return [...images.filter(m => m.id !== 'jimeng'), ...JIMENG_MODELS.filter(m => !images.some(i => i.id === m.id))];
}
export function jimengBody(model: string, prompt: string, width: number, height: number, resolution = '2k', response = 'url'): Record<string, unknown> {
  if (!['jimeng', ...JIMENG_MODELS.map(m => m.id)].includes(model)) throw new Error('Jimeng: unknown image model');
  if (!prompt.trim() || !Number.isFinite(width / height) || width <= 0 || height <= 0) throw new Error('Jimeng: prompt and valid dimensions required');
  if (!['1k', '2k', '4k'].includes(resolution)) throw new Error('Jimeng: unsupported resolution');
  const ratios = ['1:1','4:3','3:4','16:9','9:16','3:2','2:3','21:9'];
  const distance = (ratio: string) => { const [w,h]=ratio.split(':').map(Number); return Math.abs(Math.log(width / height / (w! / h!))); };
  const ratio = ratios.reduce((best, next) => distance(next) < distance(best) ? next : best);
  return {model: model === 'jimeng' ? 'jimeng-4.5' : model, prompt:prompt.trim(), ratio, resolution, response_format:response, intelligent_ratio:false};
}
