// Narrow native-DOM host boundary for the original Qiaomu UI components.
// No Obsidian runtime or global Element prototype modifications.
import {icons,createElement as svgElement} from 'lucide';
import DOMPurify from 'dompurify';
import Turndown from 'turndown';
import {gfm} from 'turndown-plugin-gfm';
const markdownConverter=new Turndown({headingStyle:'atx',codeBlockStyle:'fenced',bulletListMarker:'-'});markdownConverter.use(gfm);
export const htmlToMarkdown=(html:string)=>markdownConverter.turndown(DOMPurify.sanitize(html));
type AnyElement = HTMLElement & Record<string, any>;
const cleanups = new Map<HTMLElement, Set<()=>void>>();
let observer: MutationObserver | null = null;
const surfaces = new Set<{close:()=>void}>();
export function onRemove(el: HTMLElement,fn:()=>void) {
 if(!cleanups.has(el))cleanups.set(el,new Set());cleanups.get(el)!.add(fn);
 if(!observer){observer=new MutationObserver(()=>{for(const [el,callbacks] of cleanups)if(!el.isConnected){callbacks.forEach(fn=>fn());cleanups.delete(el);}});observer.observe(document.body,{childList:true,subtree:true});}
}
export function disposeSurfaces() {for(const s of [...surfaces])s.close();for(const callbacks of cleanups.values())callbacks.forEach(fn=>fn());cleanups.clear();observer?.disconnect();observer=null;}
export function enhance<T extends HTMLElement>(element:T):T & Record<string,any> {
 const el=element as AnyElement;if(el.createDiv)return el as any;
 Object.assign(el,{
  createEl:(tag:string,options:any={},callback?:any)=>{const child=createEl(tag,options);el.appendChild(child);callback?.(child);return child;},
  createDiv:(options:any={},callback?:any)=>el.createEl('div',options,callback),
  createSpan:(options:any={},callback?:any)=>el.createEl('span',options,callback),
  empty:()=>{el.replaceChildren();return el;},setText:(text:any)=>{el.textContent=String(text??'');return el;},
  addClass:(...names:string[])=>{el.classList.add(...names.flatMap(n=>n.split(/\s+/)).filter(Boolean));return el;},
  removeClass:(...names:string[])=>{el.classList.remove(...names);return el;},
  hasClass:(name:string)=>el.classList.contains(name),toggleClass:(name:string,on:boolean)=>{el.classList.toggle(name,on);return el;},
  setAttr:(name:string,value:any)=>{if(value==null)el.removeAttribute(name);else el.setAttribute(name,String(value));return el;},getAttr:(name:string)=>el.getAttribute(name),
  setCssProps:(values:Record<string,string>)=>{for(const [name,value] of Object.entries(values))el.style.setProperty(name,value);return el;},
  setCssStyles:(values:Record<string,string>)=>{Object.assign(el.style,values);return el;},
  hide:()=>{el.style.display='none';},show:()=>{el.style.removeProperty('display');},
 });return el as any;
}
export function createEl(tag:string,options:any={}) {
 const el=enhance(document.createElement(tag));if(typeof options==='string')options={cls:options};
 if(options.cls)el.className=options.cls;if(options.text!=null)el.textContent=String(options.text);
 for(const key of ['type','placeholder','href','title','value'])if(options[key]!=null)el.setAttribute(key,String(options[key]));
 for(const [k,v] of Object.entries(options.attr||{}))el.setAttr(k,v);
 if(tag==='a'){el.setAttribute('rel','noopener noreferrer');}
 return el;
}
export function setIcon(el:HTMLElement,name:string) {const key=name.replace(/(^|-)(\w)/g,(_,dash,c)=>c.toUpperCase());const data=(icons as any)[key];el.replaceChildren();if(!data){const custom=customIcons.get(name);if(custom)el.append(custom.cloneNode(true));return;}const svg=svgElement(data,{class:'svg-icon',width:18,height:18,'aria-hidden':'true'});el.append(svg);}
export class Notice {
 el:AnyElement;timer:any;
 constructor(text:string|Node,duration=4500){this.el=createEl('div',{cls:'qcover-dsh-toast',attr:{role:'status'}});if(typeof text==='string')this.el.setText(text);else this.el.append(text);document.body.append(this.el);surfaces.add(this);if(duration)this.timer=setTimeout(()=>this.hide(),duration);}
 hide(){clearTimeout(this.timer);this.el.remove();surfaces.delete(this);}close(){this.hide();}
}
export class ItemView {
 contentEl:AnyElement;containerEl:AnyElement;app:any;
  disposers:Array<()=>void>=[];
 constructor(leaf:any){this.contentEl=enhance(leaf.contentEl);this.containerEl=this.contentEl;this.app=leaf.app;}
  register(fn:()=>void){this.disposers.push(fn);}
  registerDomEvent(el:EventTarget,name:string,fn:any,options?:any){el.addEventListener(name,fn,options);this.register(()=>el.removeEventListener(name,fn,options));}
  registerEvent(ref:any){this.register(()=>ref.dispose());}
  async onOpen(){} async onClose(){}
  async close(){await this.onClose();for(const dispose of this.disposers.splice(0))dispose();}
}
export class Modal {
 titleEl:any;
 app:any;modalEl:AnyElement;contentEl:AnyElement;containerEl:AnyElement;scope:any;previous:Element|null=null;keys:any[]=[];opened=false;
 constructor(app:any){this.app=app;this.containerEl=createEl('div',{cls:'qcover-dsh-surface qcover-dsh-overlay modal-container'});this.modalEl=this.containerEl.createDiv({cls:'modal',attr:{role:'dialog','aria-modal':'true',tabindex:'-1'}});const close=this.modalEl.createEl('button',{cls:'modal-close-button',attr:{'aria-label':'关闭 / Close'}});setIcon(close,'x');close.onclick=()=>this.close();this.titleEl=this.modalEl.createDiv({cls:'modal-title',attr:{id:'qcover-title-'+crypto.randomUUID()}});this.modalEl.setAttribute('aria-labelledby',this.titleEl.id);this.contentEl=this.modalEl.createDiv('modal-content');this.scope={register:(mods:any,key:string,fn:any)=>this.keys.push({mods,key,fn})};this.containerEl.addEventListener('pointerdown',e=>{if(e.target===this.containerEl)this.close();});}
 onKey=(e:KeyboardEvent)=>{if([...surfaces].at(-1) instanceof Menu)return;if([...surfaces].filter(s=>s instanceof Modal).at(-1)!==this)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();this.close();return;}if(e.key==='Tab'){const nodes=[...this.modalEl.querySelectorAll<HTMLElement>('button:not([disabled]),input,textarea,select,a[href],[tabindex="0"]')].filter(el=>el.getClientRects().length);const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===this.modalEl)){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
 for(const binding of this.keys)if(e.key===binding.key&&!!(e.metaKey||e.ctrlKey)===!!binding.mods?.includes('Mod')&&e.shiftKey===!!binding.mods?.includes('Shift')&&e.altKey===!!binding.mods?.includes('Alt')&&binding.fn(e)===false){e.preventDefault();e.stopPropagation();}};
 setTitle(value:string){if(!this.titleEl){this.titleEl=createEl('div',{cls:'modal-title'});this.modalEl.insertBefore(this.titleEl,this.contentEl);}this.titleEl.setText(value);this.modalEl.setAttribute('aria-label',value);}
 open(){if(this.opened)return;this.opened=true;this.previous=document.activeElement;surfaces.add(this);document.body.append(this.containerEl);applyHostTheme();document.addEventListener('keydown',this.onKey,true);try{this.onOpen();}catch(e:any){new Notice(e.message);this.close();throw e;}this.modalEl.focus();}
 close(){if(!this.opened)return;this.opened=false;this.onClose();document.removeEventListener('keydown',this.onKey,true);this.containerEl.remove();surfaces.delete(this);if(this.previous instanceof HTMLElement&&this.previous.isConnected)this.previous.focus();}
 onOpen(){}onClose(){}
}
class MenuItem {
 el:AnyElement;label:AnyElement;icon:AnyElement;action?:()=>any;
 constructor(root:AnyElement){this.el=root.createEl('button',{cls:'qcover-dsh-menu-item',attr:{role:'menuitem'}});this.icon=this.el.createSpan();this.label=this.el.createSpan();}
 setWarning(value=true){this.el.classList.toggle('mod-warning',value);return this;}setDisabled(value:boolean){this.el.disabled=value;return this;}setIsLabel(value:boolean){this.el.disabled=value;this.el.setAttr('role',value?'presentation':'menuitem');return this;}setTitle(text:string){this.label.setText(text);return this;}setIcon(icon:string){setIcon(this.icon,icon);return this;}setChecked(on:boolean){this.el.setAttr('aria-checked',on);this.el.setAttr('role','menuitemcheckbox');if(on)setIcon(this.icon,'check');return this;}onClick(fn:()=>any){this.action=fn;return this;}
}
export class Menu {
 parent:HTMLElement|null=null;setUseNativeMenu(_value:boolean){return this;}setParentElement(element:HTMLElement){this.parent=element;return this;}
 el=createEl('div',{cls:'qcover-dsh-surface qcover-dsh-menu',attr:{role:'menu'}});items:MenuItem[]=[];previous:Element|null=null;
 addItem(fn:(item:MenuItem)=>any){const item=new MenuItem(this.el);fn(item);item.el.onclick=()=>{this.close();Promise.resolve().then(()=>item.action?.()).catch(e=>new Notice(e.message));};this.items.push(item);return this;}
 addSeparator(){this.el.createEl('hr');return this;}
 outside=(e:Event)=>{if(!this.el.contains(e.target as Node))this.close();};
 key=(e:KeyboardEvent)=>{const index=this.items.findIndex(i=>i.el===document.activeElement);if(e.key==='Escape'){e.preventDefault();this.close();}else if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();this.items[(index+(e.key==='ArrowDown'?1:-1)+this.items.length)%this.items.length]?.el.focus();}};
 showAtMouseEvent(e:MouseEvent){this.showAtPosition({x:e.clientX,y:e.clientY});}
 showAtPosition({x,y}:{x:number,y:number}){this.previous=document.activeElement;document.body.append(this.el);surfaces.add(this);this.el.style.left=Math.min(x,innerWidth-this.el.offsetWidth-8)+'px';this.el.style.top=Math.min(y,innerHeight-this.el.offsetHeight-8)+'px';queueMicrotask(()=>document.addEventListener('pointerdown',this.outside));document.addEventListener('keydown',this.key,true);this.items[0]?.el.focus();}
 close(){this.el.remove();document.removeEventListener('pointerdown',this.outside);document.removeEventListener('keydown',this.key,true);surfaces.delete(this);if(this.previous instanceof HTMLElement&&this.previous.isConnected)this.previous.focus();}
}
export class PluginSettingTab {containerEl:AnyElement;constructor(public app:any,public plugin:any){this.containerEl=createEl('div');}hide(){}display(){}}
class Control {
 get inputEl(){return this.el;}get buttonEl(){return this.el;}get selectEl(){return this.el;}
 setDisabled(value:boolean){this.el.disabled=value;return this;}setCta(){this.el.addClass('mod-cta');return this;}
 constructor(public el:any){const label=el.closest('.setting-item')?.querySelector('.setting-item-name')?.textContent;if(label&&['INPUT','TEXTAREA','SELECT'].includes(el.tagName))el.setAttribute('aria-label',label);}setValue(value:any){if(this.el.type==='checkbox')this.el.checked=!!value;else this.el.value=value;return this;}
 setPlaceholder(text:string){this.el.placeholder=text;return this;}addOption(value:string,text:string){this.el.createEl('option',{text,attr:{value}});return this;}
 onChange(fn:any){this.el.addEventListener(this.el.tagName==='INPUT'&&this.el.type!=='checkbox'?'input':'change',()=>Promise.resolve(fn(this.el.type==='checkbox'?this.el.checked:this.el.value)).catch(e=>new Notice(e.message)));return this;}
 setButtonText(text:string){this.el.setText(text);return this;}setIcon(icon:string){const span=this.el.createSpan();setIcon(span,icon);return this;}onClick(fn:any){this.el.addEventListener('click',()=>Promise.resolve().then(fn).catch(e=>new Notice(e.message)));return this;}setWarning(){this.el.addClass('mod-warning');return this;}
}
export class Setting {
 get controlEl(){return this.controls;}get settingEl(){return this.el;}get descEl(){return this.desc;}get nameEl(){return this.name;}
 setHeading(){this.el.addClass('setting-item-heading');return this;}
 el:AnyElement;name:AnyElement;desc:AnyElement;controls:AnyElement;
 constructor(root:AnyElement){this.el=root.createDiv('setting-item');const info=this.el.createDiv('setting-item-info');this.name=info.createDiv('setting-item-name');this.desc=info.createDiv('setting-item-description');this.controls=this.el.createDiv('setting-item-control');}
 setName(s:string){this.name.setText(s);return this;}setDesc(s:string){this.desc.setText(s);return this;}
 addTextArea(fn:any){fn(new Control(this.controls.createEl('textarea')));return this;}
 addDropdown(fn:any){fn(new Control(this.controls.createEl('select')));return this;}addText(fn:any){fn(new Control(this.controls.createEl('input',{type:'text'})));return this;}addToggle(fn:any){fn(new Control(this.controls.createEl('input',{type:'checkbox'})));return this;}addButton(fn:any){fn(new Control(this.controls.createEl('button')));return this;}
}
export const normalizePath=(p:string)=>p.replace(/\\/g,'/').replace(/\/+/g,'/');

export const createDiv=(options:any={},callback?:any)=>{const el=createEl("div",options);callback?.(el);return el;};
export const createSpan=(options:any={},callback?:any)=>{const el=createEl("span",options);callback?.(el);return el;};

export const appendBodyDiv=(options:any={})=>{const el=createDiv(options);el.addClass("qcover-dsh-surface");document.body.append(el);applyHostTheme();return el;};
export const sanitizeHTMLToDom=(html:string)=>DOMPurify.sanitize(html,{RETURN_DOM_FRAGMENT:true,FORCE_BODY:true,ADD_TAGS:['style'],ALLOWED_URI_REGEXP:/^(?:(?:https?|mailto|tel|blob|data):|[^a-z]|[a-z+.-]+(?:[^a-z+.:\-]|$))/i,USE_PROFILES:{html:true,svg:true,mathMl:true}});
export const getLinkpath=(value:string)=>value.split('#')[0];
export const Platform={isDesktop:true,isDesktopApp:true,isMacOS:false};
export class TFile {path:string;name:string;basename:string;extension:string;stat:any;parent:any;constructor(value:any){Object.assign(this,value);this.path=value.path;this.name=this.path.split('/').at(-1)!;this.extension=this.name.includes('.')?this.name.split('.').at(-1)!:'';this.basename=this.name.slice(0,this.extension?-this.extension.length-1:undefined);this.stat=value.stat||{};this.parent=new TFolder({path:this.path.split('/').slice(0,-1).join('/')});}}
export class MarkdownView {file:TFile|null=null;containerEl:any;contentEl:any;editor:any;getMode(){return 'source';}}
export class Component {disposers:Array<()=>void>=[];register(fn:()=>void){this.disposers.push(fn);}load(){}unload(){for(const fn of this.disposers.splice(0))fn();}}
export type App=any;
export type Plugin=any;
let nativeRemote:any=null,nativeLanguage='zh';
export function configureNativeHost(api:any,info:any={},language='zh'){nativeRemote=api;nativeLanguage=language;Platform.isMacOS=info.platform==='darwin';return()=>{if(nativeRemote===api)nativeRemote=null;};}
export const getLanguage=()=>nativeLanguage;
export function nativeHost(){if(!nativeRemote)throw Error('Cover service disconnected');return nativeRemote;}
export type RequestUrlParam={url:string;method?:string;headers?:Record<string,string>;contentType?:string;body?:string|ArrayBuffer;throw?:boolean};
export async function requestUrl(input:RequestUrlParam|string){
 const request=typeof input==='string'?{url:input}:input;const binary=request.body instanceof ArrayBuffer;
 const base64=binary?bytesToBase64(new Uint8Array(request.body as ArrayBuffer)):undefined;
 const result=await nativeHost().request({...request,body:binary?undefined:request.body,base64});
 const bytes=Uint8Array.from(atob(result.base64),c=>c.charCodeAt(0));const text=new TextDecoder().decode(bytes);let json:any;
 try{json=JSON.parse(text);}catch{}
 if(request.throw!==false&&(result.status<200||result.status>=300))throw Error(`HTTP ${result.status}`);
 return{status:result.status,headers:result.headers,arrayBuffer:bytes.buffer,text,json};
}
export function bytesToBase64(bytes:Uint8Array){let value='';for(let at=0;at<bytes.length;at+=32768)value+=String.fromCharCode(...bytes.subarray(at,at+32768));return btoa(value);}
export function applyHostTheme(){const value=getComputedStyle(document.body).getPropertyValue('--dsw-alias-bg-base').trim();let channels:number[]=[];if(/^#[0-9a-f]{6,8}$/i.test(value))channels=[1,3,5].map(at=>parseInt(value.slice(at,at+2),16));else if(value.startsWith('rgb'))channels=(value.match(/[\d.]+/g)||[]).slice(0,3).map(Number);const dark=channels.length===3&&(channels[0]*.2126+channels[1]*.7152+channels[2]*.0722)<128;for(const el of document.querySelectorAll('.qcover-dsh-surface')){el.classList.toggle('theme-dark',dark);el.classList.toggle('theme-light',!dark);}}
export function watchHostTheme(){applyHostTheme();const observer=new MutationObserver(applyHostTheme);observer.observe(document.head,{subtree:true,childList:true,characterData:true,attributes:true});observer.observe(document.documentElement,{attributes:true});observer.observe(document.body,{attributes:true});return()=>observer.disconnect();}

const customIcons=new Map<string,SVGElement>();
export function addIcon(name:string,source:string){const holder=document.createElement('div');holder.append(sanitizeHTMLToDom(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" class="svg-icon">${source}</svg>`));const svg=holder.querySelector('svg');if(svg)customIcons.set(name,svg);}
export function getIcon(name:string){const el=document.createElement('span');setIcon(el,name);return el.firstElementChild as SVGElement|null;}
export class FileView extends ItemView {file:TFile|null=null;leaf:any;constructor(leaf:any){super(leaf);this.leaf=leaf;}async onLoadFile(_file:TFile){}async onUnloadFile(){} }
export type WorkspaceLeaf=any;
export class TFolder {path:string;name:string;children:any[]=[];stat:any;constructor(value:any){Object.assign(this,value);this.path=value.path;this.name=this.path.split('/').at(-1)||'';}isRoot(){return !this.path;}}
export class TextComponent extends Control {constructor(root:HTMLElement){super(enhance(root).createEl('input',{type:'text'}));}getValue(){return this.el.value;}}
export class ButtonComponent extends Control {constructor(root:HTMLElement){super(enhance(root).createEl('button',{type:'button'}));}setTooltip(value:string){this.el.title=value;return this;}}
export class DropdownComponent extends Control {constructor(root:HTMLElement){super(enhance(root).createEl('select'));}addOptions(values:Record<string,string>){for(const [value,text] of Object.entries(values))this.addOption(value,text);return this;}getValue(){return this.el.value;}}
export class ToggleComponent extends Control {constructor(root:HTMLElement){super(enhance(root).createEl('input',{type:'checkbox',cls:'checkbox-container'}));}getValue(){return this.el.checked;}}
export class SliderComponent extends Control {constructor(root:HTMLElement){super(enhance(root).createEl('input',{type:'range'}));}setLimits(min:number,max:number,step:number){Object.assign(this.el,{min,max,step});return this;}setDynamicTooltip(){this.el.oninput=()=>this.el.title=this.el.value;return this;}onChange(fn:any){return super.onChange((v:string)=>fn(Number(v)));}}
export class FuzzySuggestModal<T=any> extends Modal {
 placeholder='';setPlaceholder(value:string){this.placeholder=value;return this;}getItems():T[]{return [];}getItemText(item:T){return String(item);}onChooseItem(_item:T){}
 onOpen(){this.setTitle(this.placeholder);const input=this.contentEl.createEl('input',{type:'search',placeholder:this.placeholder,attr:{'aria-label':this.placeholder}});const list=this.contentEl.createDiv({cls:'qcover-file-list',attr:{role:'listbox'}});let selected=0,visible:T[]=[];const choose=(item:T)=>{this.close();this.onChooseItem(item);};const draw=()=>{visible=this.getItems().filter(i=>this.getItemText(i).toLocaleLowerCase().includes(input.value.toLocaleLowerCase())).slice(0,200);selected=Math.min(selected,Math.max(0,visible.length-1));list.empty();visible.forEach((item,i)=>{const b=list.createEl('button',{text:this.getItemText(item),attr:{role:'option','aria-selected':String(i===selected)}});b.onclick=()=>choose(item);});};input.oninput=()=>{selected=0;draw();};input.onkeydown=(e:KeyboardEvent)=>{if(e.key==='Enter'&&visible[selected]){e.preventDefault();choose(visible[selected]);}else if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();selected=Math.max(0,Math.min(visible.length-1,selected+(e.key==='ArrowDown'?1:-1)));draw();}};draw();queueMicrotask(()=>input.focus());}
}
export class SecretComponent {
 id='';callback=(value:string)=>{};button:ButtonComponent;
 constructor(public app:any,root:HTMLElement){this.button=new ButtonComponent(root).setButtonText('链接… / Link…').onClick(()=>{const modal=new Modal(app);modal.setTitle('系统密钥库 / System credentials');const input=modal.contentEl.createEl('input',{type:'password',attr:{autocomplete:'new-password','aria-label':'密钥 / API key'}});const save=modal.contentEl.createEl('button',{text:'保存 / Save'});save.onclick=async()=>{save.disabled=true;const id=this.id||'cover-secret-'+crypto.randomUUID();try{await app.secretStorage.setSecretAsync(id,input.value);this.setValue(id);this.callback(id);modal.close();}catch(e:any){save.disabled=false;new Notice(e.message);}};modal.open();});}
 setValue(id:string){this.id=id;this.button.setButtonText(id?'已链接 · 管理 / Manage':'链接… / Link…');return this;}onChange(fn:(v:string)=>void){this.callback=fn;return this;}
}
