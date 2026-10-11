import {actorProfile} from './actor-profiles.mjs';
import {backgroundProfile} from './background-profiles.mjs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,mkdir,stat,unlink} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const execute=promisify(execFile),source=fileURLToPath(new URL('../native/asset-analysis.m',import.meta.url));
let compile;
export async function analyzeAsset(store,url,role){
 if(!['actor','background'].includes(role))throw Error('素材类型无效');
 const name=String(url).split('/').pop();store.readAsset(name);
 if(role==='actor'){const profile=actorProfile(name);if(profile){try{store.readAsset(profile.personMask.split('/').pop());return profile;}catch{}}}
 if(role==='background'){const profile=backgroundProfile(name);if(profile)return profile;}
 const directory=path.join(path.dirname(store.filename),'asset-analysis'),binary=path.join(directory,'analyze');
 await mkdir(directory,{recursive:true,mode:0o700});
 compile??=(async()=>{const newer=await stat(binary).catch(()=>null);if(!newer||newer.mtimeMs<(await stat(source)).mtimeMs)await execute('/usr/bin/clang',['-fobjc-arc','-framework','Foundation','-framework','Vision','-framework','CoreImage','-framework','ImageIO','-framework','CoreGraphics',source,'-o',binary],{timeout:120000,maxBuffer:16384});})();
 try{await compile;const output=path.join(directory,name+'.mask.png');const {stdout}=await execute(binary,[path.join(store.assetDir,name),output,role],{timeout:60000,maxBuffer:16384});const analysis=JSON.parse(stdout);if(role==='background')Object.assign(analysis,{occluders:[],message:'新背景尚无已复核遮挡轮廓 · 请补充前景图'});if(role==='actor'){analysis.personMask=store.upload(await readFile(output),'image/png').url;await unlink(output).catch(()=>{});}return analysis;}
 catch{compile=null;return {review:true,method:'unavailable',message:'本机自动分离未完成，保留原素材，请在预览复核人物与家具。'};}
}
