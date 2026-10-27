/**
 * One assistant turn, independent of the transport: route the request, build the prompt, ask the model, validate, and when the
 * reply had no usable JSON or commands that failed validation, send the reasons back once for a corrected reply. The plugin
 * passes an Obsidian-backed `Complete`; the intent eval passes a fetch-based one, so both run the very same logic.
 */
import { noteMaterial } from './notecontext';
import { extractJson } from './aiparse';
import { sanitizeOps, type Domain } from './capabilities';
import type { AssistantInput, AssistantResult } from './ops';
import { PLATFORMS } from './platforms';
import { buildPrompt } from './prompt';
import { routeDomains } from './router';
import { TEMPLATES } from './templates';

export type Complete = (system: string, history: { role: 'user' | 'assistant'; text: string }[], user: string) => Promise<string>;
export interface Plan extends AssistantResult { domains: Domain[]; /** True when a repair round was needed. */ repaired?: boolean }

const catalog = (): { platforms: string[]; templates: string[] } => ({ platforms: PLATFORMS.map(p => p.id), templates: TEMPLATES.map(t => t.id) });
function parse(text: string): { parsed?: unknown; error?: string } {
  try { return { parsed: extractJson(text) }; } catch { return { error: '输出里没有 JSON 对象' }; }
}

export async function planTurn(complete: Complete, input: AssistantInput, imageOn: boolean): Promise<Plan> {
  const blank = input.scene ? !input.scene.nodes.some(n => n.kind !== 'effect') : !(input.canvas ?? []).length;
  const { domains } = routeDomains(input.prompt, { blank });
  const system = buildPrompt(input, imageOn, domains);
  const user = input.prompt + noteMaterial(input.source);
  const text = await complete(system, input.history ?? [], user);
  let { parsed, error } = parse(text);
  let result = parsed !== undefined ? sanitizeOps(parsed, catalog()) : undefined;
  const problems = error ? [error] : result?.rejected ?? [];
  // One repair round: the model sees exactly why its reply could not be used and answers the same request again.
  if (problems.length && !(result && result.options?.length)) {
    const fix = `${user}\n\n[系统] 你上一次的输出：${text.trim().slice(0, 1200)}\n问题：${problems.join('；')}\n请只输出修正后的完整 JSON 对象（intent / reply / ops），指令名和参数必须来自“可用指令”。`;
    const retry = parse(await complete(system, input.history ?? [], fix));
    if (retry.parsed !== undefined) {
      const second = sanitizeOps(retry.parsed, catalog());
      if (second.ops.length || second.designs?.length || second.options?.length || !result) { result = second; parsed = retry.parsed; error = undefined; return finish(result, domains, true); }
    }
  }
  if (!result) {
    console.debug('[qiaomu-cover] assistant reply had no JSON, nothing applied:', text.trim().slice(0, 500));
    return { reply: text.trim().slice(0, 300), ops: [], domains };
  }
  if (result.rejected.length) console.debug('[qiaomu-cover] ops dropped by validation:', result.rejected);
  return finish(result, domains, false);
}
function finish(r: ReturnType<typeof sanitizeOps>, domains: Domain[], repaired: boolean): Plan {
  const { rejected: _, ...rest } = r; void _;
  if (rest.intent) console.debug('[qiaomu-cover] intent:', rest.intent);
  return { ...rest, domains, ...(repaired ? { repaired } : {}) };
}
