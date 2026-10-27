import { TypertRemoteService, Remote } from "@deepseek-ai/dsh-typert-protocol";
import path from "node:path";
import { homedir } from "node:os";
import { StateStore } from "./storage.js";
import { NAME, SERVICE } from "./meta.js";
import {CoverWorkspace,writeSystemFile} from './workspace-store.js';
import {SecureSettings} from './secure-settings.js';
import {NativeJobs} from './host-services/jobs';
import {folderImages,folderImageData} from './host-services/gallery-folders';
import {magpieAddress} from './host-services/magpie';
import {CredentialStore} from './credential-store.js';
import {boundedHttpRequest} from './network.js';
export const Config = {
  "~standard": {
    version: 1,
    vendor: NAME,
    validate(value) {
      if (value == null) return { value: {} };
      if (
        typeof value !== "object" ||
        Array.isArray(value) ||
        Object.keys(value).some((k) => !['dataDir','notesDir'].includes(k)) ||
        (value.notesDir !== undefined && (typeof value.notesDir !== 'string' || !path.isAbsolute(value.notesDir))) ||
        (value.dataDir !== undefined &&
          (typeof value.dataDir !== "string" ||
            !path.isAbsolute(value.dataDir)))
      )
        return {
          issues: [{ message: "dataDir must be an absolute directory" }],
        };
      return { value };
    },
  },
};
export default class PluginService extends TypertRemoteService {
  constructor(ctx, config = {}) {
    super(ctx, SERVICE);
    this.store = new StateStore(
      config.dataDir ||
        path.join(
          process.env.DSH_HOME || path.join(homedir(), ".dsh"),
          "qiaomu",
          NAME,
        ),
    );
    this.notes=new CoverWorkspace(config.notesDir||path.join(path.dirname(this.store.file),'workspace'));
    this.credentials=new CredentialStore();this.settings=new SecureSettings(this.store,this.credentials);this.jobs=new NativeJobs();ctx.effect(()=>()=>this.jobs.dispose());
  }
  load(){return this.settings.load();}
  save(request){return this.settings.save(request);}
  info(){return{platform:process.platform,workspaceRoot:this.notes.root};}
  inventory(){return this.notes.inventory();}
  fileRead(request){return this.notes.read(request.path,request.binary);}
  fileWrite(request){return this.notes.write(request);}
  fileRename(request){return this.notes.rename(request);}
  fileStat(request){return this.notes.stat(request.path);}
  fileList(request){return this.notes.list(request.path);}
  fileMkdir(request){return this.notes.mkdir(request.path);}
  fileTrash(request){return this.notes.trash(request.path);}
  exportFile(request){return writeSystemFile(request.directory,request.filename,request.base64);}
  folderImages(request){return folderImages(request.folder);}
  async folderImageData(request){return{base64:Buffer.from(await folderImageData(request.folder,request.image)).toString('base64')};}
  magpie(){return magpieAddress();}
  request(request){const url=new URL(request.url);if(url.hostname==='api.deepseek.com'&&request.body){let body;try{body=JSON.parse(request.body);}catch{}if(body?.model&&body.model!=='deepseek-flash')throw Error('DeepSeek calls must use deepseek-flash');}return boundedHttpRequest(request);}
  secretGet(request){return this.credentials.get(request.id);}
  secretSet(request){return this.credentials.set(request.id,request.value);}
  oauthStart(request){return this.jobs.oauth(request);}
  oauthPoll(request){return this.jobs.poll(request.id);}
  oauthCancel(request){return this.jobs.cancel(request.id);}
  codexCall(request){return this.jobs.call(request);}
  codexLoginStart(request){return this.jobs.login(request);}
  codexLoginPoll(request){return this.jobs.poll(request.id);}
  codexLoginCancel(request){return this.jobs.cancel(request.id);}

}
for (const name of ["load", "save", "info", "inventory", "fileRead", "fileWrite", "fileRename", "fileStat", "fileList", "fileMkdir", "fileTrash", "exportFile", "folderImages", "folderImageData", "magpie", "request", "secretGet", "secretSet", "oauthStart", "oauthPoll", "oauthCancel", "codexCall", "codexLoginStart", "codexLoginPoll", "codexLoginCancel"])
  Remote(name)(PluginService.prototype[name], {
    name,
    private: false,
    static: false,
    addInitializer(fn) {
      fn.call(Object.create(PluginService.prototype));
    },
  });
