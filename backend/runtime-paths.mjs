import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {existsSync,mkdirSync,copyFileSync,cpSync} from 'node:fs';
export const projectRoot=fileURLToPath(new URL('..',import.meta.url));
export const showDir=path.join(projectRoot,'show');
export const runtimeDir=path.resolve(process.env.DISCUSSION_RUNTIME_DIR||(existsSync(showDir)?path.join(projectRoot,'.runtime'):path.join(projectRoot,'../.anniversary-discussion-private')));
export const runtimePath=name=>path.join(runtimeDir,name);
export function initializeRuntime(){
 if(!existsSync(showDir))return;
 mkdirSync(runtimeDir,{recursive:true,mode:0o700});
 for(const name of ['scenes.json','script.json'])if(!existsSync(runtimePath(name)))copyFileSync(path.join(showDir,name),runtimePath(name));
 // Assets are content addressed. New files from a collaborator may be copied safely.
 if(existsSync(path.join(showDir,'scene-assets')))cpSync(path.join(showDir,'scene-assets'),runtimePath('scene-assets'),{recursive:true,force:false});
}
