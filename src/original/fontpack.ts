/** One-click font packs: downloads each missing font in turn, reports progress and carries on past a single failure. */
import { Notice } from '../harness-ui';
import type CoverPlugin from '../native-controller';
import { FONT_LIBRARY, FONT_PACKS } from './fontlib';

export interface PackResult { installed: string[]; failed: { family: string; message: string }[] }
export async function installPack(plugin: CoverPlugin, doc: Document, packId: string, onStep?: (done: number, total: number, family: string) => void): Promise<PackResult> {
  const pack = FONT_PACKS.find(p => p.id === packId); const res: PackResult = { installed: [], failed: [] };
  if (!pack) return res;
  const todo = pack.ids.map(id => FONT_LIBRARY.find(f => f.id === id)).filter((f): f is NonNullable<typeof f> => !!f && !plugin.fonts.hasFont(f.family));
  let n = 0;
  for (const f of todo) {
    onStep?.(n, todo.length, f.family);
    try { await plugin.fonts.installLib(f, doc); res.installed.push(f.family); }
    catch (e) { res.failed.push({ family: f.family, message: e instanceof Error ? e.message : String(e) }); }
    n++;
  }
  onStep?.(todo.length, todo.length, '');
  if (res.installed.length) plugin.repairOpenCovers();
  const zh = plugin.isZh();
  if (res.failed.length) new Notice(zh ? `已安装 ${res.installed.length} 款，${res.failed.length} 款失败（${res.failed.map(x => x.family).join('、')}）。网络受限时可稍后重试。` : `Installed ${res.installed.length}, ${res.failed.length} failed (${res.failed.map(x => x.family).join(', ')}). Try again later.`);
  else if (res.installed.length) new Notice(zh ? `字体包已就绪：${res.installed.length} 款` : `Font pack ready: ${res.installed.length} fonts`);
  return res;
}
export const packMissing = (plugin: CoverPlugin, packId: string): number =>
  (FONT_PACKS.find(p => p.id === packId)?.ids ?? []).filter(id => { const f = FONT_LIBRARY.find(x => x.id === id); return !!f && !plugin.fonts.hasFont(f.family); }).length;
