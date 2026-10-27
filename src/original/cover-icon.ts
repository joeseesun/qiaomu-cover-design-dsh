import { addIcon, getIcon } from '../harness-ui';
export const COVER_ICON = 'qiaomu-cover-image';
/** Reuse the host's unchanged Lucide shapes for the image + sparkles mark. */
export function registerCoverIcon(): void {
  const image = getIcon('image'), stars = getIcon('sparkles');
  if (!image || !stars) return;
  addIcon(COVER_ICON, `<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><defs><mask id="qc-cover-mark-mask"><rect width="100" height="100" fill="white"/><rect x="56" y="0" width="44" height="44" fill="black"/></mask></defs><g mask="url(#qc-cover-mark-mask)"><g transform="translate(0 20) scale(3.33)">${image.innerHTML}</g></g><g transform="translate(56 0) scale(1.7)">${stars.innerHTML}</g></g>`);
}
