import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,readFileSync,rmSync} from 'node:fs';import os from 'node:os';import path from 'node:path';
import {ScriptStore} from '../backend/script-store.mjs';
const script=JSON.parse(readFileSync(new URL('../speeches/2026-120周年校庆/津门风云-9.23-v19.json',import.meta.url)));
test('future replacements cannot remove the guard and every accepted replacement has a recoverable backup',()=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'cue-insurance-')),store=new ScriptStore(path.join(dir,'script.json'));
 try{store.save(script,0);const bad=structuredClone(script);delete bad.replyPolicy;assert.throws(()=>store.save(bad,1),/保险/);assert.equal(store.get().revision,1);
  const missing=structuredClone(script);missing.blocks[0].sentences[0].mode='silent';missing.blocks[0].sentences[0].replies=[];assert.throws(()=>store.save(missing,1),/缺少接话/);assert.equal(store.get().revision,1);
  store.save({...script,title:'修改后'},1);assert.equal(store.backups().length,1);const restored=store.restore(store.backups()[0],2);assert.equal(restored.script.title,script.title);assert.equal(restored.revision,3);assert.throws(()=>store.restore('../script.json',3),/不存在/);
 }finally{rmSync(dir,{force:true,recursive:true});}
});
test('keyword replacement is backed up and cannot persist a missing trigger or invalid continuation',()=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'keyword-insurance-')),store=new ScriptStore(path.join(dir,'script.json')),next=JSON.parse(readFileSync(new URL('../speeches/2026-120周年校庆/津门风云-9.23-v21.json',import.meta.url)));
 try{store.save(script,0);store.save(next,1);assert.equal(store.backups().length,1);
  const missing=structuredClone(next);missing.blocks[0].sentences[1].trigger='';assert.throws(()=>store.save(missing,2),/触发短语/);assert.equal(store.get().revision,2);
  const invalid=structuredClone(next);invalid.blocks[0].sentences[2].dialogueLead='missing';assert.throws(()=>store.save(invalid,2),/有效接话/);assert.equal(store.get().revision,2);
  const restored=store.restore(store.backups()[0],2);assert.equal(restored.script.replyPolicy,'one-to-one');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
