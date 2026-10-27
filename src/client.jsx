import {createNativeRuntime} from './native-runtime';
import {createHomeProvider} from './home-provider';
import { remoteApi } from "./remote.js";
import React, { useEffect, useState } from "react";
import { BookOpen, Palette, AudioLines, FileText } from "lucide-react";
import { NAME, ID, TITLE, EN_TITLE, SERVICE } from "./meta.js";
import { App } from "./native-app.jsx";
import hostCss from "./harness-ui.css";
import originalCss from "./original/styles.css";
const css=hostCss+"\n"+originalCss;
import coverIcon from '../icon.svg';
const ICON=()=> <span className="qcover-dsh-sidebar-icon" dangerouslySetInnerHTML={{__html:coverIcon}}/>;
export const inject = ["slots", "remote", "locale"];
export function apply(ctx) {
  const picker=globalThis.__DSH_DIRECTORY_PICKER__;const pickDirectory=picker?()=>picker.pick():undefined;
  let actionHandler=null,pendingAction=null;
  const actions={subscribe(fn){actionHandler=fn;if(pendingAction){const next=pendingAction;pendingAction=null;queueMicrotask(()=>fn(next));}return()=>{if(actionHandler===fn)actionHandler=null;};},send(id){if(actionHandler)actionHandler(id);else pendingAction=id;}};
  const runtime=createNativeRuntime(actions,pickDirectory);
  ctx.effect(()=>()=>{void runtime.dispose();});
  ctx.inject(['shortcuts','layout'],ready=>{
    for(const [id,label] of [['open-designer','打开封面设计'],['new-cover','新建封面'],['open-existing','打开已有封面'],['image-library','打开图库'],['image-tasks','查看图片任务'],['export-active','导出封面'],['ab-variants','A/B 变体'],['save-series','保存系列'],['cover-from-note','从笔记创建封面'],['ai-cover-from-note','AI 笔记封面'],['settings','封面设置'],['files','工作区文件']])ready.effect(()=>ready.shortcuts.register({id:`${ID}.${id}`,label:()=>`${TITLE} · ${label}`,aliases:[label,'Qiaomu Cover'],defaults:{},regions:['page','editable'],modals:[],resolve:()=>({status:'handled',run:()=>{ready.layout.selectPanel(ID);actions.send(id);}})}));
  });
  const listeners = new Set();const homeListeners=new Set();
  actions.changed=()=>homeListeners.forEach(fn=>fn());
  ctx.inject(["qiaomuHome","layout"],ready=>ready.effect(()=>ready.qiaomuHome.register(NAME,createHomeProvider({inventory:()=>api?.inventory()??Promise.resolve({files:[]}),open:action=>{ready.layout.selectPanel(ID);actions.send(action);},subscribe:fn=>{homeListeners.add(fn);return()=>homeListeners.delete(fn);}}),{label:TITLE})));
  let api = null,
    error = "";
  const notify = () => listeners.forEach((f) => f());
  let disposed = false;
  ctx.effect(() => {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.append(style);
    return () => style.remove();
  });
  ctx.effect(() =>
    ctx.locale.register(ID, { zh: { title: TITLE,language:'zh' }, en: { title: EN_TITLE,language:'en' } }),
  );
  const codec = () => ({
    mode: "strict",
    typeSymbol: NAME + "#json",
    create: () => ({
      parse: (v) => v,
      safeParse: (v) => ({ success: true, data: v }),
    }),
  });
  const methods = ["load","save","info","inventory","fileRead","fileWrite","fileRename","fileStat","fileList","fileMkdir","fileTrash","exportFile","folderImages","folderImageData","magpie","oauthStart","oauthPoll","oauthCancel","codexCall","codexLoginStart","codexLoginPoll","codexLoginCancel","request","secretGet","secretSet"];
  const descriptors = methods.map((method) => ({
    id: `${NAME}#${SERVICE}/${method}`,
    service: SERVICE,
    namespace: SERVICE,
    method,
    invocation: { kind: "direct" },
    parameters: ["load", "info", "inventory", "magpie"].includes(method)
      ? []
      : [{ name: "request", wire: "request", source: "json", codec: codec() }],
    result: { mode: "src-json" },
    cancellation: { parameter: "signal" },
  }));
  ctx.effect(() => () => {
    disposed = true;
    api = null;
    listeners.clear();
  });
  ctx.remote
    .$mount({ package: NAME, descriptors })
    .then(() => {
      if (disposed) return;
      ctx.inject(["remote." + SERVICE], (ready) => {
        api = remoteApi(ready.remote[SERVICE], methods);
        error = "";
        notify();
        return () => {
          api = null;
          notify();
        };
      });
    })
    .catch((e) => {
      error = e.message;
      notify();
    });
  function Panel() {
    const [, render] = useState(0);
    useEffect(() => {
      const f = () => render((x) => x + 1);
      listeners.add(f);
      return () => listeners.delete(f);
    }, []);
    return (
      <div className="qcover-dsh-host" data-plugin={NAME}>
        {api ? (
          <App api={api} actions={actions} language={ctx.locale.bind(ID)('language')} runtime={runtime} />
        ) : (
          <p role="status">{error || "正在连接本地服务 / Connecting…"}</p>
        )}
      </div>
    );
  }
  ctx.effect(() =>
    ctx.slots.inject("main", () =>
      ctx.slots.register({ name: "main", key: ID, locale: ID }, Panel),
    ),
  );
  ctx.effect(() =>
    ctx.slots.inject("sidebar.panellist", () =>
      ctx.slots.register(
        {
          name: "sidebar.panellist",
          id: ID,
          order: 45,
          locale: ID,
          label: () => TITLE,
        },
        ICON,
      ),
    ),
  );
}
