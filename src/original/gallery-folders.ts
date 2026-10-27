import {nativeHost} from '../harness-ui';
export interface FolderImage{name:string;path:string;type:string;size:number;modified:number}
export const folderImages=(folder:string):Promise<FolderImage[]>=>nativeHost().folderImages({folder});
export async function folderImageData(folder:string,image:FolderImage):Promise<ArrayBuffer>{const result=await nativeHost().folderImageData({folder,image});return Uint8Array.from(atob(result.base64),c=>c.charCodeAt(0)).buffer;}
