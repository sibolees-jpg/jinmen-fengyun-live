import {runtimePath} from './runtime-paths.mjs';
import {readFileSync,writeFileSync,renameSync,unlinkSync,mkdirSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import Script from '../speech-script.js';
export const SCRIPT_PATH=runtimePath('script.json');
export class ScriptStore{
 constructor(filename=SCRIPT_PATH){this.filename=filename;}
 get(){try{const record=JSON.parse(readFileSync(this.filename,'utf8'));return {revision:record.revision,script:record.script===null?null:Script.create(record.script)};}catch(error){if(error.code==='ENOENT')return {revision:0,script:null};throw error;}}
 backups(){const dir=path.join(path.dirname(this.filename),'script-backups');try{return readdirSync(dir).filter(n=>/^revision-\d+-\d+\.json$/.test(n)).sort((a,b)=>Number(b.match(/-(\d+)\.json$/)[1])-Number(a.match(/-(\d+)\.json$/)[1]));}catch(error){if(error.code==='ENOENT')return [];throw error;}}
 restore(name,revision,validate=()=>{}){if(!this.backups().includes(name))throw Error('备份不存在');const record=JSON.parse(readFileSync(path.join(path.dirname(this.filename),'script-backups',name),'utf8'));validate(record.script);return this.save(record.script,revision);}
 save(value,revision){
  const current=this.get();if(!Number.isInteger(revision)||revision!==current.revision){const error=new Error('剧本已有更新，请载入新版后再保存。');error.code='CONFLICT';throw error;}
  if(value?.kind==='rehearsal')throw new Error('测试包须通过测试剧本入口保存。');
  if(['one-to-one','keyword-dialogue'].includes(current.script?.replyPolicy)&&value!==null&&!['one-to-one','keyword-dialogue'].includes(value?.replyPolicy))throw Error('换稿保险已启用：请先完成接话编排和检查，旧稿仍保留。');
  const next={revision:current.revision+1,script:value===null?null:Script.create(value)},temporary=`${this.filename}.${process.pid}.tmp`;
  mkdirSync(path.dirname(this.filename),{recursive:true,mode:0o700});
  try{if(current.script){const dir=path.join(path.dirname(this.filename),'script-backups');mkdirSync(dir,{recursive:true,mode:0o700});writeFileSync(path.join(dir,`revision-${current.revision}-${Date.now()}.json`),JSON.stringify(current,null,2)+'\n',{mode:0o600});}writeFileSync(temporary,JSON.stringify(next,null,2)+'\n',{mode:0o600});renameSync(temporary,this.filename);}catch(error){try{unlinkSync(temporary);}catch{}throw error;}return next;
 }
}
