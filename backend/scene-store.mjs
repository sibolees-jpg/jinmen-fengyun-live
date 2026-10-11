import {runtimePath} from './runtime-paths.mjs';
import {readFileSync,writeFileSync,renameSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import Catalog from '../scene-catalog.js';
const DEFAULT=runtimePath('scenes.json');
const types={png:'image/png',jpg:'image/jpeg',webp:'image/webp',ttf:'font/ttf',otf:'font/otf',woff:'font/woff',woff2:'font/woff2'};
export class SceneStore{
 constructor(filename=DEFAULT){this.filename=filename;this.assetDir=path.join(path.dirname(filename),'scene-assets');}
 get(){if(!existsSync(this.filename))return {revision:0,catalog:Catalog.seed(),canRestore:false};const record=JSON.parse(readFileSync(this.filename,'utf8'));return {revision:record.revision,catalog:Catalog.normalize(record.catalog),canRestore:Boolean(record.previous)};}
 save(catalog,revision){const current=this.get();if(!Number.isInteger(revision)||revision!==current.revision){const e=Error('场次库已有更新，请关闭编辑窗口并重新载入。');e.code='CONFLICT';throw e;}const normalized=Catalog.normalize(catalog);for(const map of normalized.maps)for(const scene of map.scenes)for(const ref of Catalog.assets(scene))if(ref!==Catalog.STOCK)this.readAsset(ref.split('/').pop());const next={revision:current.revision+1,catalog:normalized,previous:current.catalog};this.write(next);return {...next,previous:undefined,canRestore:true};}
 write(value){mkdirSync(path.dirname(this.filename),{recursive:true,mode:0o700});const tmp=this.filename+'.tmp';writeFileSync(tmp,JSON.stringify(value,null,2)+'\n',{mode:0o600});renameSync(tmp,this.filename);}
 restore(revision){const raw=existsSync(this.filename)?JSON.parse(readFileSync(this.filename,'utf8')):{};if(!raw.previous)throw Error('没有可恢复的上一版本');return this.save(raw.previous,revision);}
 upload(bytes,type){if(!bytes.length||bytes.length>50*1024*1024)throw Error('图片需在 50 MB 以内');let ext;if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))ext='png';else if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)ext='jpg';else if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')ext='webp';if(!ext&&bytes.length>=12){const magic=bytes.toString('ascii',0,4);if(bytes.readUInt32BE(0)===0x00010000)ext='ttf';else ext={OTTO:'otf',wOFF:'woff',wOF2:'woff2'}[magic];}if(!ext||type!==types[ext])throw Error('仅支持 PNG、JPG、WebP 图片或 TTF、OTF、WOFF 字体');const name=createHash('sha256').update(bytes).digest('hex')+'.'+ext;mkdirSync(this.assetDir,{recursive:true,mode:0o700});const file=path.join(this.assetDir,name);if(!existsSync(file))writeFileSync(file,bytes,{mode:0o600});return {url:'/api/scene-assets/'+name};}
 readAsset(name){if(!/^[a-f0-9]{64}\.(png|jpg|webp|ttf|otf|woff2?)$/.test(name))throw Error('素材不存在');return {data:readFileSync(path.join(this.assetDir,name)),type:types[name.split('.').pop()]};}
 export(){const {catalog}=this.get(),assets={};for(const map of catalog.maps)for(const scene of map.scenes)for(const url of Catalog.assets(scene)){if(url===Catalog.STOCK||assets[url])continue;const file=this.readAsset(url.split('/').pop());assets[url]={type:file.type,base64:file.data.toString('base64')};}return {format:'anniversary-scenes-v1',catalog,assets};}
 import(bundle,revision){if(bundle?.format!=='anniversary-scenes-v1')throw Error('请选择导出的场次素材包');const catalog=Catalog.normalize(bundle.catalog);const refs=new Set(catalog.maps.flatMap(m=>m.scenes.flatMap(Catalog.assets)).filter(x=>x!==Catalog.STOCK));const prepared=[];for(const ref of refs){const value=bundle.assets?.[ref];if(!value||typeof value.base64!=='string')throw Error('素材包缺少图片');const data=Buffer.from(value.base64,'base64');const expected=createHash('sha256').update(data).digest('hex');if(!ref.split('/').pop().startsWith(expected+'.'))throw Error('素材校验失败');prepared.push({data,type:value.type,ref});}if(this.get().revision!==revision){const e=Error('场次库已有更新，请重新载入');e.code='CONFLICT';throw e;}for(const v of prepared)if(this.upload(v.data,v.type).url!==v.ref)throw Error('素材格式不符');return this.save(catalog,revision);}
}
export async function routeScenes(store,req,res,url){
 const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
 try{const route=url.pathname;if(route.startsWith('/api/scene-assets/')&&['GET','HEAD'].includes(req.method)){const file=store.readAsset(route.slice('/api/scene-assets/'.length));res.writeHead(200,{'Content-Type':file.type,'Cache-Control':'public, max-age=31536000, immutable'});res.end(req.method==='HEAD'?undefined:file.data);return;}
 if(route==='/api/scenes'&&req.method==='GET')return json(200,store.get());
 if(route==='/api/scenes/export'&&req.method==='GET')return json(200,store.export());
 const limit=route==='/api/scenes/import'?256*1024*1024:route==='/api/scene-assets'?50*1024*1024:2*1024*1024;const chunks=[];let size=0;
 if(!['PUT','POST'].includes(req.method))return json(405,{error:{message:'不支持该操作'}});
 for await(const chunk of req){size+=chunk.length;if(size>limit)return json(413,{error:{message:'文件过大'}});chunks.push(chunk);}const bytes=Buffer.concat(chunks);
 if(route==='/api/scene-assets'&&req.method==='POST')return json(200,store.upload(bytes,req.headers['content-type']));
 if(!req.headers['content-type']?.startsWith('application/json'))throw Error('需要 JSON 内容');const body=JSON.parse(bytes.toString());
 if(route==='/api/scenes'&&req.method==='PUT')return json(200,store.save(body.catalog,body.revision));
 if(route==='/api/scenes/restore'&&req.method==='POST')return json(200,store.restore(body.revision));
 if(route==='/api/scenes/import'&&req.method==='POST')return json(200,store.import(body.bundle,body.revision));
 return json(404,{error:{message:'场次接口不存在'}});
 }catch(error){json(error.code==='CONFLICT'?409:400,{error:{message:error.code==='ENOENT'?'素材文件不存在':error.message||'场次未保存'}});}
}
