import {createHash} from 'node:crypto';
import {existsSync,readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runtimeDir} from '../backend/runtime-paths.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
const node=process.execPath;
const gh=process.env.GH_BIN||'gh';
const paths=['show/scenes.json','show/script.json','show/scene-assets'];
const intervalMs=5000,quietMs=15000;
let busy=false,lastSignature='',changedAt=0,lastError='',retryAt=0;

function run(command,args,{allowFailure=false,timeout=60000}={}){
 const result=spawnSync(command,args,{cwd:root,env:process.env,encoding:'utf8',timeout});
 if(result.error||(!allowFailure&&result.status!==0))throw Error(result.error?.message||`${command} ${args.at(-1)}: ${(result.stderr||result.stdout||'失败').trim()}`);
 return result;
}
function git(args){return run('git',args);}
function remoteGit(args){
 const helper=`!${JSON.stringify(gh)} auth git-credential`;
 return git(['-c','credential.helper=','-c',`credential.helper=${helper}`,'-c','http.version=HTTP/1.1',...args]);
}
function signature(){
 const hash=createHash('sha256');
 for(const name of ['scenes.json','script.json']){
  const filename=path.join(runtimeDir,name);
  if(!existsSync(filename))throw Error(`当前网站缺少 ${filename}`);
  hash.update(readFileSync(filename));
 }
 return hash.digest('hex');
}
function sync(){
 const branch=git(['branch','--show-current']).stdout.trim();
 if(branch!=='main')throw Error(`自动同步仅允许 main，当前是 ${branch||'分离的提交'}`);
 const staged=git(['diff','--cached','--name-only']).stdout.trim().split('\n').filter(Boolean);
 if(staged.some(name=>!paths.some(allowed=>name===allowed||name.startsWith(allowed+'/'))))throw Error('仓库中已有其他待提交文件，请先处理，自动同步已暂停。');
 const local=git(['rev-parse','HEAD']).stdout.trim();
 const remote=remoteGit(['ls-remote','origin','refs/heads/main']).stdout.trim().split(/\s+/)[0];
 if(remote!==local)throw Error('GitHub main 已由别处更新。为避免覆盖协作者修改，自动同步已暂停；请先合并远端更新。');
 run(node,['scripts/sync-show.mjs','save']);
 git(['add','--',...paths]);
 const diff=run('git',['diff','--cached','--quiet'],{allowFailure:true});
 if(diff.status===0)return false;
 if(diff.status!==1)throw Error('无法检查待提交的演出数据。');
 git(['commit','-m','Sync saved director show data']);
 remoteGit(['push','origin','main']);
 console.log(`${new Date().toISOString()} 已推送导演台保存内容：${git(['rev-parse','--short','HEAD']).stdout.trim()}`);
 return true;
}
function check(){
 if(busy||Date.now()<retryAt)return;
 try{
  const current=signature();
  if(current!==lastSignature){lastSignature=current;changedAt=Date.now();return;}
  if(!changedAt||Date.now()-changedAt<quietMs)return;
  busy=true;changedAt=0;
  try{sync();lastError='';}
  catch(error){const message=error.message||String(error);if(message!==lastError)console.error(`${new Date().toISOString()} ${message}`);lastError=message;retryAt=Date.now()+30000;changedAt=Date.now();}
  finally{busy=false;}
 }catch(error){const message=error.message||String(error);if(message!==lastError)console.error(`${new Date().toISOString()} ${message}`);lastError=message;retryAt=Date.now()+30000;}
}

console.log(`监听已保存的导演台演出数据：${runtimeDir}`);
lastSignature=signature();changedAt=Date.now();
if(process.argv.includes('--once')){sync();}
else setInterval(check,intervalMs);
