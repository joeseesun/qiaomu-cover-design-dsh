import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {mountedCanvasSize} from '../src/canvas-layout.ts';
test('detached and hidden Harness panels cannot overwrite canvas geometry',()=>{
 const dom=new JSDOM('<div id="mount"></div>');const root=dom.window.document.getElementById('mount');
 const stage=dom.window.document.createElement('div');root.append(stage);
 let visible=true;Object.defineProperties(stage,{clientWidth:{get:()=>visible?640:0},clientHeight:{get:()=>visible?720:0}});
 assert.equal(mountedCanvasSize(stage),true);
 root.remove();assert.equal(mountedCanvasSize(stage),false);
 dom.window.document.body.append(root);assert.equal(mountedCanvasSize(stage),true);
 visible=false;assert.equal(mountedCanvasSize(stage),false);
 visible=true;assert.equal(mountedCanvasSize(stage),true);dom.window.close();
});
