import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import path from 'node:path';import {RehearsalStore} from '../backend/rehearsal.mjs';import {createAppServer} from '../server.mjs';
test('purge removes test content from disk and API while preserving unrelated configuration',async t=>{
 const dir=mkdtempSync(path.join(tmpdir(),'stage-rehearsal-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const filename=path.join(dir,'rehearsal.json'),config=path.join(dir,'config.json');writeFileSync(config,'{"keep":true}');
 const pack={castId:'jinmen-fengyun-v1',kind:'rehearsal',id:'purge-fixture',title:'合成稿',text:'测试一句。',blocks:[{title:'测试',source:'测试一句。',cues:['测试一句'],replies:[{actor:0,text:'合成回应。',replyTo:null}]}]};writeFileSync(filename,JSON.stringify(pack));
 const store=new RehearsalStore(filename),server=createAppServer({rehearsal:store,getConfig:()=>({apiKey:'',model:'test',testDiscussion:true})});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const url=`http://127.0.0.1:${server.address().port}`;
 assert.equal((await (await fetch(url+'/api/rehearsal')).json()).id,'purge-fixture');
 const response=await fetch(url+'/api/rehearsal',{method:'DELETE'});assert.equal(response.status,200);
 assert.equal(existsSync(filename),false);assert.equal(store.get(),null);assert.deepEqual(JSON.parse(readFileSync(config,'utf8')),{keep:true});
 assert.deepEqual(await (await fetch(url+'/api/rehearsal/status')).json(),{id:null,revision:null});assert.equal(await (await fetch(url+'/api/rehearsal')).json(),null);
 assert.equal((await (await fetch(url+'/api/status')).json()).testDiscussion,false);
});
test('PUT validates and atomically replaces the same rehearsal package with a new revision',async t=>{
 const dir=mkdtempSync(path.join(tmpdir(),'stage-rehearsal-save-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const filename=path.join(dir,'rehearsal.json'),pack={castId:'jinmen-fengyun-v1',kind:'rehearsal',id:'same-id',revision:2,title:'合成稿',text:'测试一句。',blocks:[{title:'测试',source:'测试一句。',sentences:[{id:'cue-1',text:'测试一句。',trigger:'测试一句',mode:'reply',delayMs:0,holdMs:1000,replies:[{actor:0,text:'回应。',replyTo:null}]}]}]};writeFileSync(filename,JSON.stringify(pack));
 const store=new RehearsalStore(filename),server=createAppServer({rehearsal:store,getConfig:()=>({apiKey:'',model:'test',testDiscussion:true})});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const url=`http://127.0.0.1:${server.address().port}`;
 const edited=structuredClone(pack);edited.blocks[0].sentences[0].delayMs=350;
 const response=await fetch(url+'/api/rehearsal',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(edited)});assert.equal(response.status,200);
 const saved=await response.json();assert.equal(saved.id,'same-id');assert.equal(saved.revision,3);assert.equal(JSON.parse(readFileSync(filename,'utf8')).blocks[0].sentences[0].delayMs,350);
 const wrong=structuredClone(edited);wrong.id='replacement';assert.equal((await fetch(url+'/api/rehearsal',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(wrong)})).status,409);
 const stale=structuredClone(pack);stale.blocks[0].sentences[0].delayMs=999;assert.equal((await fetch(url+'/api/rehearsal',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(stale)})).status,409);
});
test('only an explicit import PUT can restore a rehearsal after purge',async t=>{
 const dir=mkdtempSync(path.join(tmpdir(),'stage-rehearsal-import-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const filename=path.join(dir,'rehearsal.json');
 const store=new RehearsalStore(filename),pack={castId:'jinmen-fengyun-v1',kind:'rehearsal',id:'imported',title:'导入剧本',text:'原句。',blocks:[{title:'第一幕',source:'原句。',sentences:[{id:'s1',text:'原句。',trigger:'原句',mode:'silent',replies:[],delayMs:0,holdMs:900}]}]};
 assert.throws(()=>store.save(pack),/已清除/);const saved=store.save(pack,{allowCreate:true});assert.equal(saved.id,'imported');assert.equal(saved.revision,1);assert.equal(store.get().blocks[0].sentences[0].text,'原句。');
});
