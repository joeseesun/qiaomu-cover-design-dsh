/** A typical Xiaohongshu cover as the assistant sees it: shared by the unit tests and the intent eval. */
import type { SceneMeta, SceneNode } from '../../src/scene';

export const PALETTE = { bg: '#f6efe3', bg2: '#f6efe3', ink: '#1f1a14', sub: '#6b5d4b', accent: '#e4572e', accentInk: '#ffffff' };
export const META: SceneMeta = { width: 1080, height: 1440, platform: 'xhs', platformName: '小红书 · 3:4', template: 'folio', background: '#f6efe3', palette: PALETTE, selection: [] };
export const NODES: SceneNode[] = [
  { id: 'e1', kind: 'effect', role: 'grain', box: { x: 0, y: 0, w: 1080, h: 1440 }, z: 0 },
  { id: 's1', kind: 'shape', role: 'badge', color: '#e4572e', tone: 'accent', box: { x: 86, y: 120, w: 180, h: 64 }, z: 1 },
  { id: 't3', kind: 'text', role: 'badge', text: '干货', font: '思源黑体', size: 36, color: '#ffffff', tone: 'accentInk', box: { x: 110, y: 130, w: 132, h: 44 }, z: 2 },
  { id: 't1', kind: 'text', role: 'title', text: '普通人如何用 AI 做副业', font: '得意黑', size: 132, color: '#1f1a14', tone: 'ink', box: { x: 86, y: 240, w: 860, h: 300 }, z: 3 },
  { id: 'd1', kind: 'decor', role: 'decor', name: 'underline', color: '#e4572e', tone: 'accent', box: { x: 86, y: 548, w: 420, h: 24 }, z: 4 },
  { id: 't2', kind: 'text', role: 'subtitle', text: '从 0 到月入 3000 的完整路线', font: '思源黑体', size: 48, color: '#6b5d4b', tone: 'sub', box: { x: 86, y: 600, w: 700, h: 64 }, z: 5 },
  { id: 'i1', kind: 'icon', name: 'line:star', color: '#e4572e', tone: 'accent', box: { x: 860, y: 90, w: 140, h: 140 }, z: 6 },
  { id: 'i2', kind: 'sticker', name: 'sticker:rocket', box: { x: 760, y: 1100, w: 220, h: 220 }, z: 7 },
];
