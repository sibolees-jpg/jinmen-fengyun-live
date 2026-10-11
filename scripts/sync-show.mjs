import {existsSync,mkdirSync,readFileSync,writeFileSync,copyFileSync,cpSync} from 'node:fs';
import path from 'node:path';
import {showDir,runtimeDir,runtimePath,initializeRuntime} from '../backend/runtime-paths.mjs';
import Catalog from '../scene-catalog.js';
import Script from '../speech-script.js';
const mode=process.argv[2];
if(!['save','load'].includes(mode))throw Error('请使用 npm run show:save 或 npm run show:load');
initializeRuntime();
const source=mode==='save'?runtimeDir:showDir,target=mode==='save'?showDir:runtimeDir;
const scenes=JSON.parse(readFileSync(path.join(source,'scenes.json'))),script=JSON.parse(readFileSync(path.join(source,'script.json')));
scenes.catalog=Catalog.normalize(scenes.catalog);script.script=Script.create(script.script);
const refs=new Set(scenes.catalog.maps.flatMap(m=>m.scenes.flatMap(Catalog.assets)).filter(url=>url.startsWith('/api/scene-assets/')));
for(const ref of refs)if(!existsSync(path.join(source,'scene-assets',path.basename(ref))))throw Error('缺少素材：'+ref);
mkdirSync(target,{recursive:true});
if(mode==='load'){
 const backup=path.join(runtimeDir,'backups',new Date().toISOString().replace(/[:.]/g,'-'));mkdirSync(backup,{recursive:true});
 for(const name of ['scenes.json','script.json'])if(existsSync(runtimePath(name)))copyFileSync(runtimePath(name),path.join(backup,name));
 scenes.revision=(JSON.parse(readFileSync(runtimePath('scenes.json'))).revision||0)+1;
 script.revision=(JSON.parse(readFileSync(runtimePath('script.json'))).revision||0)+1;
}else {scenes.revision=1;script.revision=1;}
delete scenes.previous;delete scenes.canRestore;
mkdirSync(path.join(target,'scene-assets'),{recursive:true});
for(const ref of refs)copyFileSync(path.join(source,'scene-assets',path.basename(ref)),path.join(target,'scene-assets',path.basename(ref)));
for(const [name,data]of [['scenes.json',scenes],['script.json',script]])writeFileSync(path.join(target,name),JSON.stringify(data,null,2)+'\n');
console.log(mode==='save'?'场次、讲稿和素材已同步到 show/，可提交给协作者；未包含密钥。':'已载入协作版本，原配置已备份。请刷新导演台和大屏。');
