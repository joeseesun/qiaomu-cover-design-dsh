
export type SeedreamFamily = '3.0' | '4.0' | '4.5' | '5.0-lite' | '5.0-pro' | '5.0-flash';
export const SEEDREAM_MODELS: { family: SeedreamFamily; id: string; name: string }[] = [
  { family: '5.0-pro', id: 'doubao-seedream-5-0-pro-260628', name: 'Seedream 5.0 Pro' },
  { family: '5.0-flash', id: 'doubao-seedream-5-0-flash-260915', name: 'Seedream 5.0 Flash' },
  { family: '5.0-lite', id: 'doubao-seedream-5-0-260128', name: 'Seedream 5.0 Lite' },
  { family: '4.5', id: 'doubao-seedream-4-5-251128', name: 'Seedream 4.5' },
  { family: '4.0', id: 'doubao-seedream-4-0-20260415', name: 'Seedream 4.0 (20260415)' },
  { family: '3.0', id: 'doubao-seedream-3-0-t2i-250415', name: 'Seedream 3.0 (text to image)' },
  { family: '4.0', id: 'doubao-seedream-4-0-250828', name: 'Seedream 4.0' },
];
export function seedreamFamily(model: string): SeedreamFamily | undefined {
  if (/seedream[-/.]5[-.]0[-.]pro/i.test(model)) return '5.0-pro';
  if (/seedream[-/.]5[-.]0[-.]flash/i.test(model)) return '5.0-flash';
  if (/seedream[-/.]5[-.]0/i.test(model)) return '5.0-lite';
  if (/seedream[-/.]4[-.]5/i.test(model)) return '4.5';
  if (/seedream[-/.]4[-.]0/i.test(model)) return '4.0';
  if (/seedream[-/.]3[-.]0/i.test(model)) return '3.0';
  return undefined;
}
export function seedreamCaps(family: SeedreamFamily) {
  const layers = family === '5.0-pro' || family === '5.0-flash';
  return { layers, groups: !layers && family !== '3.0', refs: family === '3.0' ? 0 : layers ? 10 : 14, format: family.startsWith('5.'), search: family === '5.0-lite', fast: family === '4.0' || family === '5.0-pro', minArea: family === '3.0' ? 262144 : family === '4.5' || family === '5.0-lite' ? 3686400 : 921600, maxArea: family === '3.0' ? 4194304 : layers ? 4624220 : 16777216, sizes: family === '3.0' ? [] : layers ? ['1K', '1.5K', '2K'] : family === '5.0-lite' ? ['2K', '3K', '4K'] : family === '4.5' ? ['2K', '4K'] : ['1K', '2K', '4K'] };
}
export interface ImageReference { url: string; width: number; height: number }
export interface SeedreamOptions {
  resolution?: '1k' | '2k' | '4k'; family?: SeedreamFamily; references?: ImageReference[]; size?: string; maxImages?: number;
  outputFormat?: 'png' | 'jpeg'; responseFormat?: 'url' | 'b64_json'; watermark?: boolean;
  seed?: number; guidance?: number;
  optimize?: 'standard' | 'fast'; webSearch?: boolean; transparent?: boolean; layers?: boolean;
}
export interface GeneratedPicture { data: ArrayBuffer; type: string; size?: string; zIndex?: number; name?: string; box?: number[] }
export interface ImageResult { pictures: GeneratedPicture[]; warnings: string[]; usage?: { generated_images?: number; total_tokens?: number; tool_usage?: { web_search?: number } } }
export function seedreamBody(model: string, prompt: string, width: number, height: number, options: SeedreamOptions = {}): Record<string, unknown> {
  const family = seedreamFamily(model) ?? options.family;
  // An opaque endpoint ID cannot reveal capabilities. Use only the common single-image API until its family is selected.
  const caps = family ? seedreamCaps(family) : undefined;
  const refs = options.references ?? []; const count = options.maxImages ?? 1;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || width / height < 1 / 16 || width / height > 16) throw new Error('Seedream: aspect ratio must be between 1:16 and 16:1');
  if (!prompt.trim() && !options.layers) throw new Error('Seedream: prompt required');
  if (refs.length > (caps?.refs ?? 10)) throw new Error('Seedream: too many reference images');
  for (const r of refs) {
    if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(r.url)) throw new Error('Seedream: invalid reference image');
    if (!Number.isFinite(r.width) || !Number.isFinite(r.height) || r.url.length * 0.75 > 30 * 1024 * 1024 || r.width <= 14 || r.height <= 14 || r.width * r.height > 36000000 || r.width / r.height < 1 / 16 || r.width / r.height > 16) throw new Error('Seedream: reference exceeds image size limits');
  }
  if (!Number.isInteger(count) || count < 1 || count > 15 - refs.length || (count > 1 && !caps?.groups)) throw new Error('Seedream: unsupported image count');
  if (options.layers && (!caps?.layers || refs.length !== 1 || refs[0]!.width * refs[0]!.height < 262144 || !/^data:image\/(png|jpeg);/.test(refs[0]!.url))) throw new Error('Seedream: layer decomposition requires one PNG/JPEG reference and Pro/Flash');
  if (options.transparent && (!caps?.layers || refs.length !== 1 || !refs[0]!.url.startsWith('data:image/png;') || options.outputFormat === 'jpeg' || options.layers)) throw new Error('Seedream: transparent editing requires one transparent PNG and Pro/Flash');
  if (options.webSearch && !caps?.search) throw new Error('Seedream: web search requires 5.0 Lite');
  if (options.optimize === 'fast' && !caps?.fast) throw new Error('Seedream: fast prompt optimization is unsupported');
  if (options.outputFormat && !caps?.format) throw new Error('Seedream: this model returns JPEG only');
  let size = options.size ?? 'pixels';
  if (size === 'pixels') { const area = family === '3.0' ? 1024 * 1024 : 2048 * 2048, ratio = width / height; size = `${Math.round(Math.sqrt(area * ratio))}x${Math.round(Math.sqrt(area / ratio))}`; }
  if (/^\d+x\d+$/.test(size)) {
    const [w, h] = size.split('x').map(Number); const area = w! * h!;
    if (options.layers || area < (caps?.minArea ?? 3686400) || area > (caps?.maxArea ?? 4624220) || w! / h! < 1 / 16 || w! / h! > 16) throw new Error('Seedream: invalid output dimensions for this model');
  } else if (!(options.layers && size === 'auto') && !(caps?.sizes ?? ['2K']).includes(size)) throw new Error('Seedream: unsupported resolution');
  const body: Record<string, unknown> = { model, prompt: /^\d+x\d+$/.test(size) || options.layers ? prompt.trim() : `${prompt.trim()}\nImage aspect ratio: ${width}:${height}.`, size, response_format: options.responseFormat ?? 'b64_json', watermark: options.watermark ?? false };
  if (refs.length) body.image = refs.length === 1 ? refs[0]!.url : refs.map(r => r.url);
  if (caps?.groups) { body.sequential_image_generation = count > 1 ? 'auto' : 'disabled'; body.stream = false; if (count > 1) body.sequential_image_generation_options = { max_images: count }; }
  if (options.layers) body.layer_decomposition = true;
  if (options.transparent) body.background = 'transparent';
  if (options.outputFormat || options.transparent) body.output_format = options.transparent ? 'png' : options.outputFormat;
  if (family === '3.0') {
    if (options.seed !== undefined && (!Number.isInteger(options.seed) || options.seed < -1 || options.seed > 2147483647)) throw new Error('Seedream: invalid seed');
    if (options.guidance !== undefined && (!Number.isFinite(options.guidance) || options.guidance < 1 || options.guidance > 10)) throw new Error('Seedream: invalid guidance scale');
    if (options.seed !== undefined) body.seed = options.seed;
    if (options.guidance !== undefined) body.guidance_scale = options.guidance;
  }
  if (options.optimize && family !== '3.0') body.optimize_prompt_options = { mode: options.optimize };
  if (options.webSearch) body.tools = [{ type: 'web_search' }];
  return body;
}
