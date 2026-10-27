/**
 * Which fonts can set which words. Bundled and library fonts know whether they carry Chinese glyphs; a Latin-only face on a
 * Chinese headline would silently fall back to a system font, so the assistant is told up front and checked at run time.
 */
import { FONT_LIBRARY } from './fontlib';

export interface BookFont { family: string; source: string; zh?: string; mood?: string; hint?: string; cjk?: boolean }
export type Script = 'cjk' | 'latin' | 'unknown';
const CJK = /[㐀-鿿]/;

export function scriptOf(f: BookFont): Script {
  if (f.cjk === true) return 'cjk'; if (f.cjk === false) return 'latin';
  const lib = FONT_LIBRARY.find(x => x.family === f.family); if (lib) return lib.mood === 'latin' ? 'latin' : 'cjk';
  if (f.zh && CJK.test(f.zh)) return 'cjk';
  return 'unknown';
}
/** Why `family` cannot set `text`, or undefined when it can (unknown scripts get the benefit of the doubt). */
export function fontProblem(family: string, text: string, book: BookFont[], zh: boolean): string | undefined {
  const f = book.find(x => x.family.toLowerCase() === family.trim().toLowerCase());
  if (!f) return zh ? `没有「${family}」这款字体；只能用字体清单里的` : `There is no font "${family}"; use one from the font list`;
  if (CJK.test(text) && scriptOf(f) === 'latin') return zh ? `「${family}」只有英文字形，「${text.replace(/\s+/g, '').slice(0, 12)}」里的中文会变成系统默认字；中文请选中文字体` : `"${family}" has no Chinese glyphs; pick a Chinese font for this text`;
  return undefined;
}
