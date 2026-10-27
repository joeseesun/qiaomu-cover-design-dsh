/** HSV uses hue in degrees and saturation/brightness in [0, 1]. */
export function hexToHsv(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const v = Math.max(r, g, b), d = v - Math.min(r, g, b);
  const h = !d ? 0 : v === r ? ((g - b) / d + 6) % 6 : v === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, v ? d / v : 0, v];
}
export function hsvToHex(h: number, s: number, v: number): string {
  h = ((h % 360) + 360) % 360; s = Math.min(1, Math.max(0, s)); v = Math.min(1, Math.max(0, v));
  const c = v * s, x = c * (1 - Math.abs(h / 60 % 2 - 1)), m = v - c;
  const rgb = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return '#' + rgb.map(a => Math.round((a + m) * 255).toString(16).padStart(2, '0')).join('');
}
