import { Modal } from '../harness-ui';
import type CoverPlugin from '../native-controller';
import { iconButton, textButton } from './ui';
export interface ImagePrompt {id:string;mode:'create'|'edit';name:string;text:string}
// Original bilingual presets informed by Poster Studio's quick-prompts / AI transform workflow (MIT).
export function imagePromptPresets(zh:boolean):ImagePrompt[]{
  const rows:[string,ImagePrompt['mode'],string,string,string,string][]=[
    ['paper','create','纸艺海报','Paper poster','用纸雕与水彩质感创作一张海报。主题：［填写主题］。柔和配色、明确视觉中心、边缘细腻。文字仅使用我提供的标题，不添加无关文字。','Create a paper-cut and watercolor poster about [topic]. Soft colors, a clear focal point and fine edges. Use only the title I supply.'],
    ['minimal','create','极简背景','Minimal background','为封面生成低饱和几何背景，少量抽象形状、细腻纸张质感。留出大块干净区域供后续排标题，不生成任何文字。','Generate a muted geometric cover background with a few abstract shapes and subtle paper texture. Leave generous clean space for a title. No text.'],
    ['product','create','产品摄影','Product photo','主题：［填写产品］。自然光产品摄影，主体清晰、背景简洁，保留真实材质与细节，构图适合封面。不要加入文字、水印或商标。','Natural-light product photo of [product]. Clear subject, simple background, authentic material and detail, composed for a cover. No text, watermarks or added logos.'],
    ['illustration','create','编辑插画','Editorial illustration','围绕［填写主题］绘制一张编辑插画，以一个清楚的视觉隐喻表达重点。配色克制、构图简洁、边缘清晰，留白便于后续排版，不加文字。','Create an editorial illustration about [topic] using one clear visual metaphor. Restrained colors, simple composition, crisp edges and negative space. No text.'],
    ['background','edit','换背景','Change background','保留原图主体的身份、形状、姿态与细节，只将背景替换为［描述新背景］。匹配自然光线、透视和接触阴影，不添加文字或新主体。','Preserve the subject identity, shape, pose and details. Replace only the background with [new background]. Match lighting, perspective and contact shadows. No added text or subjects.'],
    ['clean','edit','纯色背景','Plain background','保留主体及细节，将背景换成干净的纯白色，边缘自然清晰，保留轻微接触阴影。不要改变主体颜色、比例或位置。','Keep the subject and its details. Replace the background with clean white, natural crisp edges and a subtle contact shadow. Preserve subject colors, proportions and position.'],
    ['watercolor','edit','水彩画风','Watercolor','将原图转换为柔和水彩画风。保留主体、构图、姿态和可辨识特征，使用细腻水彩纸质感与自然笔触，不改变图片中的文字内容。','Transform into soft watercolor. Preserve subjects, composition, poses, identifiable features and existing text. Use fine paper texture and natural brush strokes.'],
    ['cartoon','edit','卡通插画','Cartoon','将原图转为简洁卡通插画，清晰轮廓、协调配色。保留原主体身份、构图与动作，不增添无关物体或文字。','Turn into a clean cartoon illustration with clear outlines and harmonious colors. Preserve subject identity, composition and action. No unrelated objects or text.'],
    ['sketch','edit','铅笔素描','Pencil sketch','将原图转为精细铅笔素描，以自然线条和明暗层次表达材质。保留主体、构图与重要细节，不添加文字。','Convert into a detailed pencil sketch with natural lines and shading. Preserve subjects, composition and important details. No added text.'],
    ['restore','edit','清晰修复','Restore details','改善原图的清晰度，减少噪点与压缩痕迹，恢复合理的细节。严格保留人物身份、原有文字、构图与色彩，不编造新物体。','Improve clarity, reduce noise and compression artifacts and restore plausible detail. Preserve identity, existing text, composition and colors. Do not invent objects.'],
  ];return rows.map(([id,mode,zn,en,zt,et])=>({id,mode,name:zh?zn:en,text:zh?zt:et}));
}
class PromptEditor extends Modal{
  constructor(private plugin:CoverPlugin,private item:ImagePrompt,private save:(item:ImagePrompt)=>void){super(plugin.app);}
  onOpen():void{const t=this.plugin.t.bind(this.plugin);this.titleEl.setText(t('imageEditPreset'));this.contentEl.addClass('qc-modal','qc-image-generate');const uid=crypto.randomUUID();this.contentEl.createEl('label',{text:t('imagePresetName'),attr:{for:uid}});const name=this.contentEl.createEl('input',{attr:{id:uid,type:'text'}});name.value=this.item.name;this.contentEl.createEl('label',{text:t('imagePrompt'),attr:{for:`${uid}-text`}});const text=this.contentEl.createEl('textarea',{cls:'qc-image-prompt',attr:{id:`${uid}-text`,rows:'6'}});text.value=this.item.text;textButton(this.contentEl,t('save'),()=>{if(name.value.trim()&&text.value.trim()){this.save({...this.item,name:name.value.trim(),text:text.value.trim()});this.close();}},'qc-primary');}
  onClose():void{this.contentEl.empty();}
}
export function promptLibrary(parent:HTMLElement,p:CoverPlugin,mode:ImagePrompt['mode'],input:HTMLTextAreaElement,changed:()=>void):void{
  const t=p.t.bind(p),bar=parent.createDiv('qc-image-prompt-tools'),id=crypto.randomUUID();bar.createEl('label',{cls:'qc-sr-only',text:t('imageQuickPrompts'),attr:{for:id}});
  const picker=bar.createEl('select',{cls:'qc-image-prompt-picker',attr:{id}});
  const all=()=>p.settings.imagePrompts??imagePromptPresets(p.isZh());
  const persist=(items:ImagePrompt[])=>{p.settings.imagePrompts=items;void p.saveSettings();render();};
  const edit=(item:ImagePrompt)=>new PromptEditor(p,item,replacement=>{const list=all().slice(),at=list.findIndex(x=>x.id===item.id);if(at>=0)list[at]=replacement;else list.push(replacement);persist(list);}).open();
  const editButton=iconButton(bar,'pencil',t('imageEditPreset'),()=>{const item=all().find(x=>x.id===picker.value);if(item)edit(item);});
  const remove=iconButton(bar,'trash-2',t('remove'),()=>persist(all().filter(x=>x.id!==picker.value)));
  iconButton(bar,'bookmark-plus',t('imageSavePrompt'),()=>{if(input.value.trim())edit({id:crypto.randomUUID(),mode,name:t('imageQuickPrompts'),text:input.value.trim()});});
  const sync=()=>{editButton.disabled=remove.disabled=!picker.value;};
  picker.addEventListener('change',()=>{const item=all().find(x=>x.id===picker.value);if(item){input.value=item.text;changed();input.focus();}sync();});
  const render=()=>{const selected=picker.value;picker.empty();picker.createEl('option',{value:'',text:t('imageQuickPrompts')});for(const item of all().filter(x=>x.mode===mode))picker.createEl('option',{value:item.id,text:item.name});picker.value=all().some(x=>x.id===selected)?selected:'';sync();};render();
}
