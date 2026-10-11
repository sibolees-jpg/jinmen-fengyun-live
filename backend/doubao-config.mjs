import {runtimePath} from './runtime-paths.mjs';
import {readFileSync,writeFileSync,renameSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
export const CONFIG_PATH=runtimePath('doubao.json');
export const RESOURCES=['volc.seedasr.sauc.duration','volc.seedasr.sauc.concurrent','volc.bigasr.sauc.duration','volc.bigasr.sauc.concurrent'];
export function loadSpeechConfig(filename=CONFIG_PATH,env=process.env){
 let saved={};try{saved=JSON.parse(readFileSync(filename,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
 return {apiKey:env.DOUBAO_ASR_API_KEY||saved.apiKey||'',appId:env.DOUBAO_ASR_APP_ID||saved.appId||'',accessToken:env.DOUBAO_ASR_ACCESS_TOKEN||saved.accessToken||'',resourceId:env.DOUBAO_ASR_RESOURCE_ID||saved.resourceId||RESOURCES[0]};
}
export function speechConfigStatus(c){return {configured:Boolean(c.apiKey||(c.appId&&c.accessToken)),authMode:c.apiKey?'apiKey':'legacy',resourceId:c.resourceId};}
export function saveSpeechConfig(value,filename=CONFIG_PATH){
 if(!value||!['apiKey','legacy'].includes(value.authMode)||!RESOURCES.includes(value.resourceId))throw new Error('请选择语音凭据方式与资源版本。');
 const valid=v=>typeof v==='string'&&/^[\x21-\x7E]{4,512}$/.test(v);
 if(value.authMode==='apiKey'?!valid(value.apiKey):(!valid(value.appId)||!valid(value.accessToken)))throw new Error('请完整填写火山引擎语音凭据。');
 const next={apiKey:value.authMode==='apiKey'?value.apiKey:'',appId:value.authMode==='legacy'?value.appId:'',accessToken:value.authMode==='legacy'?value.accessToken:'',resourceId:value.resourceId};
 mkdirSync(path.dirname(filename),{recursive:true,mode:0o700});const temp=filename+'.tmp';writeFileSync(temp,JSON.stringify(next)+'\n',{mode:0o600});renameSync(temp,filename);return speechConfigStatus(next);
}
