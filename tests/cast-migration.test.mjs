import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import Script from '../speech-script.js';
import {RehearsalStore} from '../backend/rehearsal.mjs';
import Rehearsal from '../rehearsal.js';
const {RehearsalSync}=Rehearsal;
const pack=()=>({kind:'rehearsal',id:'old-cast',title:'合成稿',text:'原句。',blocks:[{title:'主题',source:'原句。',cues:['原句'],replies:[{actor:0,text:'旧角色台词',replyTo:null}]}]});
test('legacy rehearsal stays on disk but cannot load or enable old cast cues',t=>{
 const dir=mkdtempSync(path.join(tmpdir(),'cast-migration-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const filename=path.join(dir,'rehearsal.json'),original=JSON.stringify(pack());writeFileSync(filename,original);
 const store=new RehearsalStore(filename);assert.equal(store.get(),null);assert.equal(store.hasInactive(),true);assert.equal(readFileSync(filename,'utf8'),original);
 assert.throws(()=>store.save(pack(),{allowCreate:true}),/角色版本/);
 store.clear();assert.equal(existsSync(filename),false);assert.equal(store.hasInactive(),false);
});
test('new scripts carry cast identity and reject mismatched imports and invalid actors',()=>{
 const current=Script.create({title:'新稿',text:'原句。'});assert.equal(current.castId,'jinmen-fengyun-v1');assert.notEqual(Script.KEY,'gongcishi-speech-v1');
 assert.throws(()=>Script.create({...current,castId:'legacy-15'}),/角色版本/);
 const invalid=pack();invalid.castId=current.castId;invalid.blocks[0].replies[0].actor=9;assert.throws(()=>Script.create(invalid),/角色/);
});
test('sync exposes inactive content before rendering and clears its notice after purge',async()=>{
 let inactive=true;const snapshots=[];const sync=new RehearsalSync(p=>snapshots.push({p,inactive:sync.inactive}),{fetchImpl:async(url,options)=>{if(options?.method==='DELETE')inactive=false;return {ok:true,json:async()=>({id:null,revision:null,inactive})};}});
 await sync.refresh();assert.deepEqual(snapshots,[{p:null,inactive:true}]);await sync.clear();assert.equal(sync.inactive,false);assert.deepEqual(snapshots.at(-1),{p:null,inactive:false});
});
