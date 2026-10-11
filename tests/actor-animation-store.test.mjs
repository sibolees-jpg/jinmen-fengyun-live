import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,readFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import path from 'node:path';import C from '../scene-catalog.js';import {SceneStore} from '../backend/scene-store.mjs';
test('selected animation packs survive portable scene export/import with every frame and independent options',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'stage-animation-'));try{
  const store=new SceneStore(path.join(dir,'first/scenes.json')),other=new SceneStore(path.join(dir,'second/scenes.json'));
  const lib=JSON.parse(readFileSync(new URL('../assets/actor-animation-library/library.json',import.meta.url))),item=lib.items.find(v=>v.animation),pack=structuredClone(item.animation),urls=new Map();
  for(const src of new Set(Object.values(pack.clips).flat()))urls.set(src,store.upload(readFileSync(new URL('../'+src,import.meta.url)),'image/png').url);
  pack.base=urls.get(pack.base);for(const k in pack.clips)pack.clips[k]=pack.clips[k].map(src=>urls.get(src));
  const catalog=C.normalize(C.seed()),actor=catalog.maps[1].scenes[0].actors[item.actor];actor.poses.idle=pack.base;actor.animation=pack;actor.motion.stationary=true;
  store.save(catalog,0);const bundle=store.export(),restored=other.import(bundle,0);assert.deepEqual(restored.catalog.maps[1].scenes[0].actors[item.actor].animation,pack);assert.equal(restored.catalog.maps[1].scenes[1].actors[item.actor].animation,null);
  for(const url of Object.values(pack.clips).flat())assert.ok(other.readAsset(url.split('/').at(-1)).data.length);
  const missing=structuredClone(bundle);delete missing.assets[pack.clips.breath[0]];assert.throws(()=>other.import(missing,1),/缺少/);assert.equal(other.get().revision,1);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
