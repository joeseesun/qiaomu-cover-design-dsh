/**
 * Extra vector shapes beyond the basic six, as 24 × 24 SVG paths. Pure data: the insert menu draws them as
 * buttons, the canvas fills them with the palette accent, and the assistant picks them by id.
 */
export const BASIC_SHAPES = ['rect', 'rounded', 'circle', 'triangle', 'line', 'star'] as const;
export type BasicShape = (typeof BASIC_SHAPES)[number];

export const PATH_SHAPES: [string, string, string][] = [
  ['diamond', '菱形', 'M12 1 22.5 12 12 23 1.5 12Z'], ['pentagon', '五边形', 'M12 1.5 22.5 9 18.5 21.5h-13L1.5 9Z'], ['hexagon', '六边形', 'M12 1.5 21.5 6.8v10.4L12 22.5 2.5 17.2V6.8Z'],
  ['cross', '十字', 'M9 2h6v7h7v6h-7v7H9v-7H2V9h7Z'], ['arrow', '箭头', 'M2 9h12V3l8 9-8 9v-6H2Z'], ['chevron', '折角箭头', 'M7 2l10 10L7 22l-3-3 7-7-7-7Z'],
  ['heart', '爱心', 'M12 21.5S2.5 15.8 2.5 9.2A5.2 5.2 0 0 1 12 6.5a5.2 5.2 0 0 1 9.5 2.7c0 6.600-9.500 12.300-9.500 12.300Z'], ['drop', '水滴', 'M12 2s7.500 8 7.500 13.200a7.500 7.500 0 0 1-15 0C4.500 10 12 2 12 2Z'],
  ['bubble', '对话框', 'M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-8l-5 4v-4H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z'], ['cloud', '云朵', 'M7 19a4.500 4.500 0 0 1-.8-8.900A6.500 6.500 0 0 1 18.700 11 4 4 0 0 1 18 19Z'],
  ['half', '半圆', 'M1.500 18a10.500 10.500 0 0 1 21 0Z'], ['burst', '爆炸星', 'M12 1l2.300 5.200L19.800 4l-1.400 5.600L24 12l-5.600 2.400L19.800 20l-5.500-2.200L12 23l-2.300-5.200L4.200 20l1.400-5.600L0 12l5.600-2.400L4.200 4l5.500 2.200Z'],
  ['ticket', '票券', 'M2 5h20v4a3 3 0 0 0 0 6v4H2v-4a3 3 0 0 0 0-6Z'], ['ribbon', '标签', 'M3 4h18l-3 5 3 5H3Z'], ['moon', '月牙', 'M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z'], ['bolt', '闪电', 'M13 1 4 14h6l-1 9 10-14h-6Z'],
];
export const SHAPE_IDS: string[] = [...BASIC_SHAPES, ...PATH_SHAPES.map(([id]) => id)];
