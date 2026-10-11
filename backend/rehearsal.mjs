import {runtimePath} from './runtime-paths.mjs';
import {readFileSync,unlinkSync,writeFileSync,renameSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import Script from '../speech-script.js';
export const REHEARSAL_PATH=runtimePath('rehearsal.json');
export class RehearsalStore{
 constructor(filename=REHEARSAL_PATH){this.filename=filename;}
 read(){try{return JSON.parse(readFileSync(this.filename,'utf8'));}catch(error){if(error.code==='ENOENT')return null;throw error;}}
 get(){const raw=this.read();return raw?.castId===Script.CAST_ID?Script.create(raw):null;}
 hasInactive(){const raw=this.read();return Boolean(raw&&raw.castId!==Script.CAST_ID);}
 save(value,{allowCreate=false}={}){
  if(value?.castId!==Script.CAST_ID)throw new Error('剧本角色版本不匹配，请按《津门风云》九人名单重新编排。');
  const current=this.get();if(!current&&!allowCreate){const error=new Error('测试包已清除；如需恢复，请重新导入剧本。');error.code='CONFLICT';throw error;}if(current&&(value?.id!==current.id||value?.revision!==current.revision)){const error=new Error('剧本已有更新，请刷新后再保存。');error.code='CONFLICT';throw error;}
  const next=Script.create({...value,id:current?.id||value?.id,kind:'rehearsal',revision:(current?.revision||0)+1}),temporary=`${this.filename}.${process.pid}.tmp`;
  try{writeFileSync(temporary,JSON.stringify(next,null,2)+'\n',{encoding:'utf8',mode:0o600});renameSync(temporary,this.filename);}catch(error){try{unlinkSync(temporary);}catch{}throw error;}
  return next;
 }
 clear(){try{unlinkSync(this.filename);}catch(error){if(error.code!=='ENOENT')throw error;}}
}
