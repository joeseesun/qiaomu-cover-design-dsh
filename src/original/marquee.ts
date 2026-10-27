import { ActiveSelection, type Canvas, type FabricObject } from 'fabric';
interface Box { left:number;top:number;width:number;height:number }
export function marqueeHits(box:Box,items:{box:Box;selectable:boolean;visible:boolean;background:boolean}[]):number[]{
  return items.flatMap((item,i)=>{const b=item.box,inside=b.left>=box.left && b.top>=box.top && b.left+b.width<=box.left+box.width && b.top+b.height<=box.top+box.height;
    const intersects=b.left<box.left+box.width && b.top<box.top+box.height && b.left+b.width>box.left && b.top+b.height>box.top;
    return item.selectable && item.visible && (item.background?inside:intersects)?[i]:[];});
}
/** Drag from outside the artboard, empty space or a full-bleed background. Other object drags remain native Fabric. */
export function bindMarquee(stage:HTMLElement,c:Canvas,width:number,height:number):()=>void{
  const win=stage.ownerDocument.defaultView!, controller=new AbortController(), signal=controller.signal;
  let cleanup:()=>void=()=>{};
  const background=(o:FabricObject)=>{const b=o.getBoundingRect();return b.left<=2 && b.top<=2 && b.left+b.width>=width-2 && b.top+b.height>=height-2;};
  stage.addEventListener('mousedown',e=>{
    if(e.button!==0 || !stage.isConnected || c.isDrawingMode)return;
    const inCanvas=c.wrapperEl.contains(e.target as Node),target=inCanvas?c.findTarget(e).target:undefined;
    if(target && !background(target))return;
    // Do not intercept active transform handles or editing a text box.
    if(target && (target as FabricObject & {isEditing?:boolean}).isEditing)return;
    if(target && c.getActiveObject()===target && target.findControl(c.getViewportPoint(e)))return;
    e.preventDefault();e.stopImmediatePropagation();cleanup();
    const start=c.getScenePoint(e),sx=e.clientX,sy=e.clientY,old=e.shiftKey?c.getActiveObjects().slice():[];
    let boxEl:HTMLElement|undefined,moved=false;
    const move=(event:MouseEvent)=>{
      if(!stage.isConnected){end();return;}
      if(!moved && Math.hypot(event.clientX-sx,event.clientY-sy)<4)return;
      moved=true;boxEl??=stage.createDiv('qc-marquee');const rect=stage.getBoundingClientRect();
      Object.assign(boxEl.style,{left:`${Math.min(sx,event.clientX)-rect.left+stage.scrollLeft}px`,top:`${Math.min(sy,event.clientY)-rect.top+stage.scrollTop}px`,width:`${Math.abs(event.clientX-sx)}px`,height:`${Math.abs(event.clientY-sy)}px`});
    };
    const end=(event?:MouseEvent)=>{
      win.removeEventListener('mousemove',move,true);win.removeEventListener('mouseup',end,true);win.removeEventListener('blur',blur);boxEl?.remove();cleanup=()=>{};
      if(!stage.isConnected)return;
      if(moved && event){const finish=c.getScenePoint(event),box={left:Math.min(start.x,finish.x),top:Math.min(start.y,finish.y),width:Math.abs(finish.x-start.x),height:Math.abs(finish.y-start.y)},objects=c.getObjects();
        const indices=marqueeHits(box,objects.map(o=>({box:o.getBoundingRect(),visible:o.visible,selectable:o.selectable && !o.lockMovementX && !o.lockMovementY,background:background(o)})));
        const chosen=[...new Set([...old,...indices.map(i=>objects[i]!)])];c.discardActiveObject();if(chosen.length===1)c.setActiveObject(chosen[0]!);else if(chosen.length)c.setActiveObject(new ActiveSelection(chosen,{canvas:c}));
      }else if(event){c.discardActiveObject();if(target?.selectable)c.setActiveObject(target);}
      c.requestRenderAll();
    };
    const blur=()=>end();cleanup=()=>end();win.addEventListener('mousemove',move,true);win.addEventListener('mouseup',end,true);win.addEventListener('blur',blur);
  },{capture:true,signal});
  return ()=>{controller.abort();cleanup();};
}
