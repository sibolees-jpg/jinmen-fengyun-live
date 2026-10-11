import {runtimeDir,initializeRuntime} from './backend/runtime-paths.mjs';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {mkdirSync,openSync,closeSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('.',import.meta.url));
let port=Number(process.env.PORT)||8879;
let url=`http://127.0.0.1:${port}`;
try{await import('ws');}catch{console.error('缺少语音连接依赖。请在项目文件夹运行 npm ci 后重试。');process.exit(1);}
async function running(){try{const r=await fetch(url+'/api/status',{signal:AbortSignal.timeout(700)});if(!r.ok)return false;const info=await r.json();return info.app==='gongcishi-stage'?info:false;}catch{return false;}}
initializeRuntime();
const instance=createHash('sha256').update(root+runtimeDir).digest('hex').slice(0,16);
let existing=await running();
for(let i=0;existing&&existing.instance!==instance&&i<30;i++){port++;url=`http://127.0.0.1:${port}`;existing=await running();}

if(existing&&existing.version!==13){
 console.error('检测到旧版 Demo 服务，请先停止旧服务再重新启动；请勿混用新旧页面。');process.exitCode=1;
}else if(existing){
 console.log(`讨论服务已在后台运行：${url}/`);
}else{
 mkdirSync(runtimeDir,{recursive:true,mode:0o700});
 const log=openSync(path.join(runtimeDir,'server.log'),'a',0o600);
 const child=spawn(process.execPath,[path.join(root,'server.mjs')],{cwd:root,detached:true,stdio:['ignore',log,log],env:{...process.env,PORT:String(port),DISCUSSION_RUNTIME_DIR:runtimeDir,DISCUSSION_TEST_MODE:process.env.DISCUSSION_TEST_MODE??'1'}});
 let spawnFailed=false;child.on('error',()=>{spawnFailed=true;});child.unref();closeSync(log);
 let ready=false;
 for(let attempt=0;attempt<20&&!spawnFailed;attempt++){
  await new Promise(resolve=>setTimeout(resolve,200));
  if(await running()){ready=true;break;}
 }
 if(ready){
  writeFileSync(path.join(runtimeDir,'server.pid'),String(child.pid),{mode:0o600});
  console.log(`讨论服务已在后台启动：${url}/\n导演控制台：${url}/director.html\n现在可以关闭此启动窗口；关闭聊天也不会停止服务。`);
 }else{
  if(child.pid)try{child.kill();}catch{}
  console.error('本地服务未能启动，请检查端口是否被旧预览占用。');process.exitCode=1;
 }
}
