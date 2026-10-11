import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {ScriptStore} from '../backend/script-store.mjs';
import {createAppServer} from '../server.mjs';
import Client from '../script-sync.js';
const source={castId:'jinmen-fengyun-v1',title:'校庆合成稿',text:'先观察。再实验。'};
test('fresh clients share the saved formal script, edits survive restart, and clear stays cleared',async t=>{
 const dir=mkdtempSync(path.join(tmpdir(),'shared-script-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const file=path.join(dir,'script.json'),store=new ScriptStore(file);
 const server=createAppServer({scripts:store});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const base=`http://127.0.0.1:${server.address().port}`;
 const seenA=[],seenB=[],a=new Client.ScriptSync(s=>seenA.push(s),{fetchImpl:(u,o)=>fetch(base+u,o)}),b=new Client.ScriptSync(s=>seenB.push(s),{fetchImpl:(u,o)=>fetch(base+u,o)});
 await a.refresh();await b.refresh();assert.equal(seenB.at(-1),null);
 await a.save(source);await b.refresh();assert.equal(seenB.at(-1).title,source.title);assert.equal(seenB.at(-1).blocks[0].sentences.length,2);
 await b.save({...seenB.at(-1),title:'编辑后的稿'});assert.equal(new ScriptStore(file).get().script.title,'编辑后的稿');
 await assert.rejects(a.save({...seenA.at(-1),title:'过期覆盖'}),/更新/);assert.equal(store.get().script.title,'编辑后的稿');
 await a.refresh();await a.save(null);await b.refresh();assert.equal(seenB.at(-1),null);assert.equal(new ScriptStore(file).get().script,null);
 const cross=await fetch(base+'/api/script',{method:'PUT',headers:{'Content-Type':'application/json',Origin:'https://example.com'},body:JSON.stringify({revision:a.revision,script:source})});assert.equal(cross.status,403);
 assert.equal((await fetch(base+'/backend/script-store.mjs')).status,404);
});
test('formal storage rejects test-package and cast mixing without replacing current content',t=>{
 const dir=mkdtempSync(path.join(tmpdir(),'script-validate-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const store=new ScriptStore(path.join(dir,'script.json'));const saved=store.save(source,0);
 assert.throws(()=>store.save({...source,kind:'rehearsal'},saved.revision),/测试/);assert.throws(()=>store.save({...source,castId:'legacy'},saved.revision),/角色/);assert.equal(store.get().script.title,source.title);
});
test('a late read cannot overwrite a completed shared save',async()=>{
 let release;const seen=[],sync=new Client.ScriptSync(s=>seen.push(s),{fetchImpl:async(_url,options)=>options?.method==='PUT'?{ok:true,json:async()=>({revision:2,script:source})}:new Promise(r=>release=r)});sync.revision=1;
 const old=sync.refresh();await sync.save(source);release({ok:true,json:async()=>({revision:1,script:null})});await old;assert.equal(seen.at(-1).title,source.title);assert.equal(sync.revision,2);
});
