import type { AssistantInput, AssistantResult, Op } from './ops';
import { resolveTarget } from './scene';

/** Recognize only an unambiguous one-colour command, never colours mentioned in a longer brief. */
export function simpleColour(prompt: string): string | undefined {
  const colours: Record<string, string> = { 红: '#e11d2e', red: '#e11d2e', 绿: '#16a34a', green: '#16a34a', 蓝: '#2563eb', blue: '#2563eb', 黄: '#ffe04b', yellow: '#ffe04b', 橙: '#f97316', orange: '#f97316', 紫: '#7c3aed', purple: '#7c3aed', 粉: '#fb7185', pink: '#fb7185', 黑: '#111111', black: '#111111', 白: '#ffffff', white: '#ffffff', 灰: '#737373', grey: '#737373', gray: '#737373' };
  const text = prompt.trim().toLowerCase().replace(/[。！!\.]+$/, '').trim();
  const colour = '(#[0-9a-f]{6}|红|绿|蓝|黄|橙|紫|粉|黑|白|灰|red|green|blue|yellow|orange|purple|pink|black|white|grey|gray)';
  const zh = new RegExp(`^(?:请|帮我)?(?:把|将)?(?:这个|这些|它|它们|选中的(?:元素|文字|图形)?|选中元素)?(?:的)?(?:颜色)?(?:改成|改为|换成|换为|变成|设为|设置为|调整为|用)?${colour}(?:色)?(?:吧|一下)?$`);
  const en = new RegExp(`^(?:(?:please )?(?:make|change|set|recolou?r)(?: (?:it|them|this|these|the selection|selected elements|colou?r))?(?: to)? )?${colour}$`);
  const value = zh.exec(text)?.[1] ?? en.exec(text)?.[1];
  return value?.startsWith('#') ? value : value ? colours[value] : undefined;
}

export function selectionIds(input: AssistantInput): string[] {
  return input.editScope?.kind === 'selection' ? input.editScope.ids : input.editScope?.kind === 'canvas' ? [] : input.scene?.meta.selection ?? [];
}

/** Selection is an execution boundary, independent of the model's interpretation. */
export function guardSelection(result: AssistantResult, input: AssistantInput): { result: AssistantResult; problems: string[] } {
  const ids = selectionIds(input), scene = input.scene;
  if (!ids.length || !scene) return { result, problems: [] };
  const live = ids.filter(id => scene.nodes.some(n => n.id === id));
  const ops: Op[] = [], problems: string[] = [];
  const denied = input.zh ? '本次只调整发送时选中的元素。请使用选区中的图层 ID；整张画布操作需要先取消选择。' : 'This request only edits the elements selected when sent. Use their layer IDs; canvas-wide operations require clearing the selection.';
  if (result.designs?.length) problems.push(denied);
  for (const op of result.ops) {
    switch (op.op) {
      case 'style': case 'recolor': case 'move': case 'resize': case 'align': case 'distribute': case 'layer': case 'set': case 'remove': case 'duplicate': case 'select': {
        const wanted = resolveTarget(op.target, scene.nodes, { ...scene.meta, selection: live });
        const target = wanted.filter(id => live.includes(id));
        if (target.length) ops.push({ ...op, target }); else problems.push(denied);
        break;
      }
      case 'icon': {
        // Replacing an existing selected icon is local; inserting unrelated content is not.
        const target = op.replace ? resolveTarget(op.replace, scene.nodes, { ...scene.meta, selection: live }).filter(id => live.includes(id)) : [];
        if (target.length === 1) ops.push({ ...op, replace: target }); else problems.push(denied);
        break;
      }
      default: problems.push(denied);
    }
  }
  return { result: { ...result, ops, designs: undefined }, problems: [...new Set(problems)] };
}
