import type { AssistantResult, DesignSpec, Op } from './ops';
export const DESIGN_PREVIEW_LIMIT = 7;

/** Enforced at the execution boundary, even if a provider ignores the prompt. */
export function withoutPictures(spec: DesignSpec): DesignSpec {
  const copy = { ...spec }; delete copy.imagePrompt; delete copy.subjectPrompt; delete copy.imageRole; delete copy.subjectAt; return copy;
}
export function picturePolicy(result: AssistantResult, allow: boolean): AssistantResult {
  if (allow) return result;
  return { ...result, ops: result.ops.filter(o => o.op !== 'image').map((o): Op => o.op === 'design' ? { op: 'design', ...withoutPictures(o) } : o), ...(result.designs ? { designs: result.designs.map(withoutPictures) } : {}) };
}
/** Only a short, direct request can opt in; pasted source text cannot enable a paid image job. */
export function requestsPicture(prompt: string): boolean {
  return prompt.length < 180 && !/[\r\n]/.test(prompt) && !/不要|不生成|不配图|纯文字|no (?:image|picture)|without/i.test(prompt) && /^(?:请|帮我)?(?:生成|画|添加|补|重画|换)(?:一(?:张|个))?(?:配图|图片|主体|背景图|插图)|^(?:generate|draw|add|redraw) (?:an? |the )?(?:image|picture|illustration|subject)/i.test(prompt.trim());
}
/** Hide normal housekeeping, retain failures, output paths and readability warnings. */
export function usefulFeedback(notes: string[]): string[] {
  return [...new Set(notes.filter(n => !/^(已套用模板|已切换平台|已添加 \d+ 个矢量装饰|已提高 \d+ 处文字的对比度|Raised contrast on \d+ text|已让 \d+ 处文字避开|已调整|已更新|已对齐|Template:|Platform:|Added \d+ editable|Moved \d+ text|Text updated|Background updated|Aligned)/.test(n)))];
}
