import { requestUrl } from '../harness-ui';
import { trimBase, type AiConfig } from './aiparse';
import { seedreamBody, type SeedreamOptions, type ImageResult, type GeneratedPicture } from './seedream';

export async function seedreamGenerate(c: AiConfig, prompt: string, width: number, height: number, options: SeedreamOptions = {}): Promise<ImageResult> {
  const body = seedreamBody(c.imageModel, prompt, width, height, { ...options, family: options.family ?? c.imageFamily });
  const response = await requestUrl({ url: `${trimBase(c.imageBaseUrl || 'https://ark.cn-beijing.volces.com/api/v3')}/images/generations`, method: 'POST', contentType: 'application/json', headers: { Authorization: `Bearer ${c.imageKey.trim()}` }, body: JSON.stringify(body), throw: false });
  let payload: unknown; try { payload = response.json; } catch { /* plain HTTP errors */ }
  if (!payload) { try { payload = JSON.parse(response.text); } catch { payload = {}; } }
  const json = payload as { error?: { code?: string; message?: string }; data?: { url?: string; b64_json?: string; output_format?: string; size?: string; error?: { code?: string; message?: string }; z_index?: number; name?: string; bounding_box?: { absolute?: number[] } }[]; usage?: ImageResult['usage'] };
  if (response.status >= 400 || json.error) throw new Error(`Seedream HTTP ${response.status}: ${json.error?.code ?? ''} ${json.error?.message?.slice(0, 240) ?? ''}`);
  const pictures: GeneratedPicture[] = [], warnings: string[] = [];
  for (const item of json.data ?? []) {
    if (item.error) { warnings.push(`${item.error.code ?? ''}: ${item.error.message?.slice(0, 240) ?? 'image failed'}`); continue; }
    try {
      let data: ArrayBuffer, type: string;
      if (item.b64_json) {
        const bytes = Uint8Array.from(atob(item.b64_json), ch => ch.charCodeAt(0)); data = bytes.buffer;
        type = item.output_format === 'png' || bytes[0] === 0x89 ? 'image/png' : 'image/jpeg';
      } else if (item.url && /^https:\/\//i.test(item.url)) {
        const res = await requestUrl({ url: item.url, throw: false });
        if (res.status >= 400) throw new Error(`Image download HTTP ${res.status}`);
        data = res.arrayBuffer; type = (res.headers['content-type'] ?? `image/${item.output_format ?? 'jpeg'}`).split(';')[0]!;
      } else throw new Error('empty-image');
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(type)) throw new Error('unsupported image format');
      const box = item.bounding_box?.absolute;
      pictures.push({ data, type, size: item.size, zIndex: item.z_index, name: item.name, box });
    } catch (e) { warnings.push(e instanceof Error ? e.message : String(e)); }
  }
  if (!pictures.length || (options.layers && warnings.length)) throw new Error(warnings.join('\n') || 'empty-image');
  return { pictures, warnings, usage: json.usage };
}
