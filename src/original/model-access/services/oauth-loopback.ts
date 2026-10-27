import {nativeHost} from '../../../harness-ui';
import {watchJob} from '../../../native-jobs';
export interface OAuthCallback {redirect:string;result:Promise<URL>;close():void}
export async function listenOAuth(state:string,signal:AbortSignal,tokenDance=false):Promise<OAuthCallback>{signal.throwIfAborted();const job=await nativeHost().oauthStart({state,tokenDance});const handle=watchJob(job.id,'oauthPoll','oauthCancel',signal);return{redirect:job.redirect,result:handle.result.then(value=>new URL(value)),close:handle.cancel};}
