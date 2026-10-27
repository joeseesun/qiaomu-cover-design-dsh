import {Modal} from './harness-ui';
import {textButton,onEnter} from './original/ui';
/** A browser client cannot recover an absolute host path from an uploaded File.
 * Reuse the original small dialog controls for that host-only boundary. Desktop
 * clients retain Harness's native folder chooser. */
export function chooseDirectory(app:any,zh:boolean):Promise<string|undefined>{
 if(app.pickDirectory)return app.pickDirectory().then((path:string|null)=>path||undefined);
 return new Promise(resolve=>{
  const modal=new Modal(app);let chosen:string|undefined;
  modal.onOpen=()=>{
   modal.setTitle(zh?'选择图片或导出文件夹':'Choose an image or export folder');modal.contentEl.addClass('qc-modal');
   modal.contentEl.createDiv({cls:'qc-hint',text:zh?'输入运行 Harness 的电脑上的文件夹绝对路径。':'Enter an absolute folder path on the computer running Harness.'});
   const input=modal.contentEl.createEl('input',{type:'text',cls:'qc-input',attr:{'aria-label':zh?'文件夹路径':'Folder path',placeholder:app.workspaceRoot||'/absolute/folder'}});
   const error=modal.contentEl.createDiv({cls:'qc-export-error',attr:{role:'status'}});
   const footer=modal.contentEl.createDiv('qc-modal-footer');textButton(footer,zh?'取消':'Cancel',()=>modal.close());
   const accept=textButton(footer,zh?'选择':'Choose',()=>{const path=input.value.trim();if(!/^(?:\/|[A-Za-z]:[\\/]|\\\\)/.test(path)){error.setText(zh?'请输入绝对路径':'Enter an absolute path');return;}chosen=path;modal.close();},'qc-primary');onEnter(input,e=>{e.preventDefault();accept.click();});queueMicrotask(()=>input.focus());
  };modal.onClose=()=>resolve(chosen);modal.open();
 });
}
