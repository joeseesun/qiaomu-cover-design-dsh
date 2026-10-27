import { Modal, Notice, setIcon } from '../harness-ui';
import type { FabricImage } from 'fabric';
import { directImageConfig, imageLabel, imageReady, type AiConfig } from './aiparse';
import { seedreamCaps, seedreamFamily, type SeedreamFamily, type ImageReference, type SeedreamOptions } from './seedream';
import { AiService } from './ai';
import { jimengProtocol } from './jimeng';
import { ImageResultsDialog } from './imagejobdialog';
import { imageHash, type ImageJob, type ImageSelection } from './imagejobs';
import type { QObject } from './view';
import { promptLibrary } from './imageprompts';
import { ModelDialog } from './modeldialog';
import { textButton } from './ui';
import type { CoverView } from './view';

export interface ImageGenerationContext { reference?: ImageReference; selection?: ImageSelection; previousPrompt?: string; recipe?: ImageJob; target?: ImageJob['target'] }

/** A generation job is tied to its source canvas; edit results are reviewed before replacing the raster. */
export class ImageGenerateDialog extends Modal {
  private closed = false;
  private running = false;
  private unsubscribe?: () => void; private timer?: number;
  private valid: () => boolean;
  constructor(private view: CoverView, private done: () => void, private target?: FabricImage, private context?: ImageGenerationContext) { super(view.app); this.valid = view.imageGuard(target); }
  onOpen(): void {
    this.closed = false;
    const v = this.view, t = v.t.bind(v);
    const editing=!!(this.target || this.context?.reference);
    this.titleEl.setText(t(editing ? 'imageCreateSelection' : 'aiGenerateImage'));
    this.modalEl.addClass('qc-image-generate-modal');
    const el = this.contentEl; el.addClass('qc-modal', 'qc-image-generate'); el.empty();
    const heading = el.createDiv('qc-image-heading'); heading.createDiv({ text: t('imageBackgroundHint'), cls: 'qc-hint' }); textButton(heading, t('imageTasks'), () => { this.close(); v.plugin.openImageTasks(); }, 'qc-image-tasks-link', 'images');
    const controls = el.createDiv('qc-image-controls');
    const uid = `qc-image-${crypto.randomUUID()}`;
    const field = (parent: HTMLElement, name: string, suffix: string): HTMLElement => { const row = parent.createDiv('qc-image-field'); row.createEl('label', { text: name, attr: { for: `${uid}-${suffix}` } }); return row; };
    const select = (parent: HTMLElement, name: string, suffix: string) => field(parent, name, suffix).createEl('select', { cls: 'qc-select', attr: { id: `${uid}-${suffix}` } });
    const refs: ImageReference[] = [];
    if (this.context?.recipe?.request) refs.push(...(this.context.recipe.request.options.references ?? []));
    else if (this.context?.reference) refs.push(this.context.reference);
    else if (this.target) {
      const img = this.target.getElement(), canvas = v.doc.createElement('canvas');
      canvas.width = (img as HTMLImageElement).naturalWidth || img.width; canvas.height = (img as HTMLImageElement).naturalHeight || img.height;
      canvas.getContext('2d')!.drawImage(img, 0, 0);
      refs.push({ url: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height });
    }
    const prompt = field(el, t('imagePrompt'), 'prompt').createEl('textarea', { cls: 'qc-image-prompt', attr: { id: `${uid}-prompt`, rows: '5', placeholder: t(editing ? 'imageEditHint' : 'imagePromptHint') } });
    prompt.value = this.context?.recipe?.prompt ?? (editing ? '' : v.imageDraft);
    if(this.context?.previousPrompt)prompt.parentElement!.createDiv({text:`${t('imagePreviousRound')}：${this.context.previousPrompt}`,cls:'qc-image-previous'});
    prompt.addEventListener('input', () => { if (!editing) v.imageDraft = prompt.value; sync(); });
    promptLibrary(el, v.plugin, editing ? 'edit' : 'create', prompt, () => { if (!editing) v.imageDraft = prompt.value; sync(); });
    const modelRow = field(controls, t('imageModel'), 'model');
    const model = modelRow.createEl('select', { cls: 'qc-select qc-image-model', attr: { id: `${uid}-model` } });
    const populate = (): void => {
      model.empty(); const cfg = v.plugin.settings.ai;
      const ids = new Set(cfg.images.map(p => p.id)); if (cfg.imageId) ids.add(cfg.imageId);
      for (const id of ids) {
        const c = directImageConfig(cfg, id); if (!c || !imageReady({ ...c, enabled: true }) || (editing && (!(['ark', 'codex'].includes(c.imageEngine) || jimengProtocol(c)) || (c.imageEngine === 'ark' && (c.imageFamily ?? seedreamFamily(c.imageModel)) === '3.0')))) continue;
        model.createEl('option', { value: id, text: imageLabel(c) });
      }
      const wanted = this.context?.recipe?.request?.modelId || v.imageModelId || cfg.imageId;
      if (Array.from(model.options).some(o => o.value === wanted)) model.value = wanted;
      model.toggleClass('qc-hidden', !model.options.length); modelChanged();
    };
    const add = textButton(modelRow, t('imageAddModel'), () => new ModelDialog(v.plugin, 'image', () => { if (!this.closed) { v.imageModelId = v.plugin.settings.ai.imageId; populate(); } }).open(), 'qc-btn-sm qc-image-add-model', 'plus');
    add.setAttribute('aria-label', t('imageAddModel'));
    const ratio = select(controls, t('directImageRatio'), 'ratio'); ratio.addClass('qc-image-ratio');
    for (const id of ['canvas', '1:1', '3:4', '4:3', '16:9', '9:16', '3:2', '2:3', '21:9']) ratio.createEl('option', { value: id, text: id === 'canvas' ? t(editing ? 'imageOriginalRatio' : 'imageCanvasRatio') : id });
    const referenceRow = field(el, t(editing ? 'imageReferences' : 'imageReferenceOptional'), 'refs');
    referenceRow.addClass('qc-image-reference-section');
    const referenceList = referenceRow.createDiv('qc-image-references');
    const upload = referenceRow.createEl('input', { cls: 'qc-hidden', attr: { id: `${uid}-refs`, type: 'file', accept: 'image/png,image/jpeg,image/webp', multiple: '' } });
    const referenceAdd = textButton(referenceRow, t('imageUploadReference'), () => upload.click(), 'qc-image-upload', 'image-plus');
    const renderRefs = (): void => {
      referenceList.empty(); refs.forEach((ref, index) => {
        const card = referenceList.createDiv('qc-image-reference'); card.createEl('img', { attr: { src: ref.url, alt: `${t('imageReferences')} ${index + 1}` } });
        if (!(editing && index === 0)) textButton(card, t('remove'), () => { if (this.running) return; refs.splice(index, 1); renderRefs(); layers.checked = false; refreshSizes(); sync(); }, 'qc-btn-sm', 'x');
      });
    };
    upload.addEventListener('change', () => void (async () => {
      if (this.running) return;
      try {
        const c = config(), limit = c && jimengProtocol(c) ? 10 : c?.imageEngine === 'ark' ? seedreamCaps(family.value as SeedreamFamily).refs : 1;
        const files = Array.from(upload.files ?? []); if (refs.length + files.length > limit) throw new Error(t('imageReferenceLimit', { count: limit }));
        const added: ImageReference[] = [];
        for (const file of files) { const url = await v.prepareImage(file); const image = new v.win.Image(); image.src = url; await image.decode(); added.push({ url, width: image.naturalWidth, height: image.naturalHeight }); }
        if (!this.closed) { refs.push(...added); renderRefs(); layers.checked = false; refreshSizes(); sync(); }
      } catch (e) { status.setText(String(e)); } finally { upload.value = ''; }
    })());
    const advanced = el.createEl('details', { cls: 'qc-image-advanced' }); advanced.createEl('summary', { text: t('imageOptions') });
    const optionsEl = advanced.createDiv('qc-image-options');
    const family = select(optionsEl, t('seedreamVersion'), 'family');
    for (const id of ['5.0-pro', '5.0-flash', '5.0-lite', '4.5', '4.0', '3.0']) family.createEl('option', { value: id, text: `Seedream ${id.replace('-', ' ')}` });
    const size = select(optionsEl, t('imageResolution'), 'size');
    const custom = field(optionsEl, t('imagePixels'), 'pixels').createEl('input', { attr: { id: `${uid}-pixels`, placeholder: '2048x2048', type: 'text' } });
    const seed = field(optionsEl, t('imageSeed'), 'seed').createEl('input', { attr: { id: `${uid}-seed`, type: 'number', min: '-1', max: '2147483647', step: '1', value: '-1' } });
    const guidance = field(optionsEl, t('imageGuidance'), 'guidance').createEl('input', { attr: { id: `${uid}-guidance`, type: 'number', min: '1', max: '10', step: '.1', value: '2.5' } });
    const count = select(optionsEl, t('imageMaxCount'), 'count');
    for (let n = 1; n <= 15; n++) count.createEl('option', { value: String(n), text: String(n) });
    const format = select(optionsEl, t('imageFileFormat'), 'format'); for (const id of ['jpeg', 'png']) format.createEl('option', { value: id, text: id.toUpperCase() });
    const response = select(optionsEl, t('imageReturnFormat'), 'response'); for (const [id, name] of [['b64_json', 'Base64'], ['url', 'URL']]) response.createEl('option', { value: id, text: name });
    const optimize = select(optionsEl, t('imageOptimize'), 'optimize');
    for (const [id, name] of [['standard', t('imageQuality')], ['fast', t('imageFast')]]) optimize.createEl('option', { value: id, text: name });
    const check = (name: string, key: string): HTMLInputElement => { const label = optionsEl.createEl('label', { cls: 'qc-image-check' }); const input = label.createEl('input', { attr: { type: 'checkbox', 'data-option': key } }); label.createSpan({ text: name }); return input; };
    const watermark = check(t('imageWatermark'), 'watermark'), search = check(t('imageWebSearch'), 'search'), transparent = check(t('imageTransparent'), 'transparent'), layers = check(t('imageDecompose'), 'layers');
    const note = el.createDiv({ cls: 'qc-hint qc-image-note' });
    const enable = textButton(el, t('settings'), () => { this.close(); v.plugin.openSettings('assistant'); }, 'qc-btn-sm qc-image-settings');
    const status = el.createDiv({ cls: 'qc-image-status', attr: { role: 'status', 'aria-live': 'polite' } });

    const footer = el.createDiv('qc-modal-footer');
    const close = textButton(footer, t('cancel'), () => this.close());
    const generate = textButton(footer, t('imageGenerateInsert'), () => void run(), 'qc-primary qc-image-submit', 'sparkles');
    const config = (): AiConfig | undefined => { const c = directImageConfig(v.plugin.settings.ai, model.value); return c && imageReady(c) ? c : undefined; };
    const modelChanged = (): void => {
      const c = config(); if (c && !['ark', 'codex'].includes(c.imageEngine) && !jimengProtocol(c) && refs.length) { refs.splice(0); renderRefs(); }
      family.value = seedreamFamily(c?.imageModel ?? '') ?? c?.imageFamily ?? '5.0-pro';
      refreshSizes(); sync();
    };
    const refreshSizes = (): void => {
      const c = config(); if (c && jimengProtocol(c)) { size.empty(); for (const id of ['1k','2k','4k']) size.createEl('option', { value: id, text: id.toUpperCase() }); size.value = '2k'; return; }
      const caps = seedreamCaps(family.value as SeedreamFamily); size.empty();
      for (const id of layers.checked && caps.layers ? ['auto', ...caps.sizes] : ['pixels', ...caps.sizes, 'custom']) size.createEl('option', { value: id, text: id === 'pixels' ? t('imageExactRatio') : id === 'custom' ? t('imageCustomSize') : id });
      size.value = layers.checked && caps.layers ? 'auto' : 'pixels';
    };
    const sync = (): void => {
      const c = config(), ark = c?.imageEngine === 'ark', jimeng = c ? jimengProtocol(c) : false, caps = seedreamCaps(family.value as SeedreamFamily);
      generate.disabled = this.running || (!prompt.value.trim() && !layers.checked) || !c;
      generate.setText(t('imageCreateAction'));
      for (const input of Array.from(el.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input,select,textarea'))) input.disabled = this.running;
      add.disabled = this.running; referenceAdd.disabled = this.running; close.setText(t(this.running ? 'close' : 'cancel'));
      advanced.toggleClass('qc-hidden', !ark && !jimeng);
      for (const row of Array.from(optionsEl.children)) (row as HTMLElement).toggleClass('qc-hidden', jimeng);
      size.parentElement!.toggleClass('qc-hidden', !ark && !jimeng);
      if (jimeng) { family.parentElement!.addClass('qc-hidden'); seed.parentElement!.addClass('qc-hidden'); guidance.parentElement!.addClass('qc-hidden'); } family.disabled = this.running || !!seedreamFamily(c?.imageModel ?? '');
      seed.parentElement!.toggleClass('qc-hidden', family.value !== '3.0'); guidance.parentElement!.toggleClass('qc-hidden', family.value !== '3.0');
      optimize.parentElement!.toggleClass('qc-hidden', family.value === '3.0'); referenceRow.toggleClass('qc-hidden', (!ark && !jimeng && c?.imageEngine !== 'codex') || (ark && !caps.refs));
      custom.parentElement!.toggleClass('qc-hidden', size.value !== 'custom');
      count.disabled = this.running || !caps.groups; if (!caps.groups) count.value = '1';
      if (Number(count.value) > 15 - refs.length) count.value = String(Math.max(1, 15 - refs.length));
      for (const option of Array.from(count.options)) option.disabled = Number(option.value) > 15 - refs.length;
      format.parentElement!.toggleClass('qc-hidden', !caps.format);
      search.parentElement!.toggleClass('qc-hidden', !caps.search); if (!caps.search) search.checked = false;
      layers.parentElement!.toggleClass('qc-hidden', !caps.layers || refs.length !== 1); if (!caps.layers || refs.length !== 1) layers.checked = false;
      transparent.parentElement!.toggleClass('qc-hidden', !caps.layers || refs.length !== 1 || layers.checked); if (!caps.layers || refs.length !== 1 || layers.checked) transparent.checked = false;
      optimize.options[1]!.disabled = !caps.fast; if (!caps.fast) optimize.value = 'standard';
      family.parentElement!.toggleClass('qc-hidden', !ark || !!seedreamFamily(c?.imageModel ?? ''));
      if (jimeng) for (const row of Array.from(optionsEl.children)) (row as HTMLElement).toggleClass('qc-hidden', row !== size.parentElement);
      enable.toggleClass('qc-hidden', v.plugin.settings.ai.enabled);
      note.setText(this.running ? t('imageGenerationClose') : !v.plugin.settings.ai.enabled ? t('imageAiDisabled') : !model.options.length ? t('imageModelEmpty') : refs.length ? t('imageReferencePrivacy') : ark && Number(count.value) > 1 ? t('imageGroupHint') : '');
    };
    model.addEventListener('change', () => { v.imageModelId = model.value; modelChanged(); });
    family.addEventListener('change', () => { const settings = v.plugin.settings.ai, profile = settings.images.find(p => p.id === model.value); if (profile) profile.snap.imageFamily = family.value as SeedreamFamily; if (settings.imageId === model.value) settings.imageFamily = family.value as SeedreamFamily; void v.plugin.saveSettings(); layers.checked = transparent.checked = false; refreshSizes(); sync(); });
    for (const input of [ratio, size, custom, seed, guidance, count, format, response, optimize, watermark, search, transparent, layers]) input.addEventListener('change', () => { if (input === layers) refreshSizes(); sync(); });
    const run = async (): Promise<void> => {
      if (this.running || !this.valid()) return;
      const c = config(), d = v.design; if (!c || !d) return;
      const [rw, rh] = ratio.value === 'canvas' ? editing ? [refs[0]!.width, refs[0]!.height] : [d.width, d.height] : ratio.value.split(':').map(Number);
      const width = Math.round(1536 * rw! / Math.max(rw!, rh!)), height = Math.round(1536 * rh! / Math.max(rw!, rh!));
      c.imageSize = 'auto'; v.imageModelId = model.value;
      this.running = true; status.setText(t('imageGenerating')); sync();
      try {
        const caps = seedreamCaps(family.value as SeedreamFamily);
        const options: SeedreamOptions = c.imageEngine === 'ark' ? { family: family.value as SeedreamFamily, seed: family.value === '3.0' ? Number(seed.value) : undefined, guidance: family.value === '3.0' ? Number(guidance.value) : undefined, references: refs.slice(), size: size.value === 'custom' ? custom.value.trim() : size.value, maxImages: Number(count.value), outputFormat: caps.format ? format.value as 'png' | 'jpeg' : undefined, responseFormat: response.value as 'url' | 'b64_json', watermark: watermark.checked, optimize: optimize.value as 'standard' | 'fast', webSearch: search.checked, transparent: transparent.checked, layers: layers.checked } : jimengProtocol(c) ? { resolution: size.value as '1k' | '2k' | '4k', references: refs.slice() } : { references: refs.slice() };
        let target: {id:string;hash:string}|undefined=this.context?.target;
        if (this.target) { const object = this.target as QObject; object.qcImageId ??= crypto.randomUUID(); target = { id: object.qcImageId, hash: await imageHash(this.target.getSrc()) }; v.changed(); await v.flush(); }
        if (!this.valid() || !v.file || (this.context?.selection && !await v.selectionMatches(this.context.selection))) throw new Error(t('imageNotInserted'));
        v.plugin.scratch.delete(v.file.path);
        const snapshot = structuredClone(c), text = prompt.value.trim();
        const job=await v.plugin.imageJobs.submit({ prompt: text, model: imageLabel(c), path: v.file.path, layers: !!options.layers, target, selection:this.context?.selection, request:{modelId:model.value,width,height,options} }, () => new AiService(() => snapshot).images(text, width, height, options));
        if (!this.closed) waitFor(job);
      } catch (e) { if (!this.closed) status.setText(t('error', { message: e instanceof Error && e.message.includes('ModelNotOpen') ? t('seedreamNotOpen', { model: c.imageModel }) : e instanceof Error ? e.message : String(e) })); }
      finally { if (!this.unsubscribe) this.running = false; if (!this.closed) sync(); }
    };
    prompt.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); void run(); } });
    el.insertBefore(controls, prompt.parentElement!);
    const form=el.createDiv('qc-image-form');while(el.firstChild!==form)form.appendChild(el.firstChild!);
    const waiting=el.createDiv('qc-image-waiting');waiting.addClass('qc-hidden');
    const stopWaiting=():void=>{this.unsubscribe?.();this.unsubscribe=undefined;if(this.timer!==undefined)v.win.clearInterval(this.timer);this.timer=undefined;};
    const waitFor=(job:ImageJob):void=>{
      form.addClass('qc-hidden');waiting.empty();waiting.removeClass('qc-hidden');
      const art=waiting.createDiv({cls:'qc-image-wait-art',attr:{'aria-hidden':'true'}});setIcon(art,'image');art.createSpan({cls:'qc-image-wait-spark'});
      waiting.createDiv({text:t('imageGenerating'),cls:'qc-image-wait-title'});
      waiting.createDiv({text:job.model,cls:'qc-hint'});waiting.createDiv({text:job.prompt||t('imageDecompose'),cls:'qc-image-wait-prompt'});
      const elapsed=waiting.createDiv({cls:'qc-image-wait-time',attr:{role:'status','aria-live':'off'}}),tick=()=>elapsed.setText(t(job.state==='queued'?'imageTaskQueued':'imageWaitElapsed',{seconds:Math.floor((Date.now()-job.created)/1000)}));tick();this.timer=v.win.setInterval(tick,1000);
      waiting.createDiv({text:t('imageWaitHint'),cls:'qc-hint'});textButton(waiting,t('imageMoveBackground'),()=>{new Notice(t('imageBackgroundStarted'));this.close();},'qc-btn-sm qc-image-background','panel-bottom-close');
      const update=():void=>{
        if(this.closed)return;
        if(job.state==='ready'){stopWaiting();this.close();new ImageResultsDialog(v.plugin,job).open();}
        else if(job.state==='failed'||job.state==='interrupted'){stopWaiting();this.running=false;waiting.addClass('qc-hidden');form.removeClass('qc-hidden');status.setText(job.error||t('imageTaskInterrupted'));sync();}
      };this.unsubscribe=v.plugin.imageJobs.subscribe(update);update();
    };
    if(this.context?.selection)referenceRow.createDiv({text:t('imageSelectionHint',{count:this.context.selection.objects.length}),cls:'qc-hint'});
    renderRefs(); populate();
    const recipe=this.context?.recipe?.request;
    if(recipe){const o=recipe.options;
      if(o.family){family.value=o.family;refreshSizes();}
      if(o.size && Array.from(size.options).some(x=>x.value===o.size))size.value=o.size;else if(o.size){size.value='custom';custom.value=o.size;}
      if(o.resolution)size.value=o.resolution;if(o.seed!==undefined)seed.value=String(o.seed);if(o.guidance!==undefined)guidance.value=String(o.guidance);
      count.value=String(o.maxImages??1);if(o.outputFormat)format.value=o.outputFormat;if(o.responseFormat)response.value=o.responseFormat;if(o.optimize)optimize.value=o.optimize;
      watermark.checked=o.watermark??true;search.checked=!!o.webSearch;transparent.checked=!!o.transparent;layers.checked=!!o.layers;
      const nearest=Array.from(ratio.options).find(x=>x.value!=='canvas'&&Math.abs(Number(x.value.split(':')[0])/Number(x.value.split(':')[1])-recipe.width/recipe.height)<0.01);if(nearest)ratio.value=nearest.value;
      renderRefs();sync();
    }
    v.win.requestAnimationFrame(() => { if (prompt.isConnected) prompt.focus({ preventScroll: true }); });
  }
  onClose(): void { this.closed = true; this.unsubscribe?.(); this.unsubscribe=undefined; if(this.timer!==undefined)this.view.win.clearInterval(this.timer); this.contentEl.empty(); this.done(); }
}
