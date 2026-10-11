const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const C=require('../scene-catalog.js'),L=require('../stage-layout.js'),Scenes=require('../scene-playback.js'),catalog=require('../show/scenes.json').catalog,pack=require('../integration/scene-block/scenes.json');
const scenes=catalog.maps.flatMap(m=>m.scenes),a=C.locate(catalog,'sc-q925-a1').scene,b=C.locate(catalog,'sc-q925-a2').scene;
const flush=()=>new Promise(r=>setImmediate(r));
test('25 isolated scene blocks map by full display code, T2 shares T1 graphics without sharing configuration',()=>{
 assert.equal(scenes.length,25);assert.equal(new Set(scenes.map(s=>s.sceneBlock.code)).size,25);
 for(const s of scenes){assert.ok(pack.scenes[s.sceneBlock.code]);assert.equal(s.sceneBlock.revision,pack.sourceRevision);assert.equal(C.visualScene(s).backgroundAspect,C.isDynamic(s)?16/9:s.composition.width/s.composition.height);if(s.id!==catalog.standbySceneId)assert.ok(C.visualScene(s).actors.every(a=>a.embedded));}
 const standby=C.locate(catalog,catalog.standbySceneId).scene;assert.equal(C.isDynamic(standby),false);assert.equal(standby.composition.enabled,false);assert.equal(C.visualScene(standby).actors.filter(a=>a.present&&a.poses.idle).length,8);assert.equal(standby.actors[7].present,false);
 assert.deepEqual(pack.scenes.T2,pack.scenes.T1);assert.equal(C.locate(catalog,'sc-q925-t2').scene.liveDialogue,true);assert.equal(pack.scenes.A1.actors[0].present,true);assert.notDeepEqual(pack.scenes.A1,pack.scenes.A2);
 assert.ok(Object.values(pack.scenes).every(s=>s.actors.length===9&&!s.plane.births.stage_9&&!s.plane.births.original));
});
test('imported graphics and environment references are entirely local and present',()=>{
 const paths=new Set();function visit(v){if(typeof v==='string'&&v.startsWith('/integration/scene-block/assets/'))paths.add(v);else if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')Object.values(v).forEach(visit);}visit(pack);
 const environment=fs.readFileSync(path.join(__dirname,'../integration/scene-block/environment-animation-data.js'),'utf8');for(const m of environment.matchAll(/"(\/integration\/scene-block\/assets\/[^"\n]+)"/g))paths.add(m[1]);
 assert.ok(paths.size>200);for(const p of paths)assert.ok(fs.statSync(path.join(__dirname,'..',p)).size>0,p);
});
test('scene block metadata round trips, bad identities are rejected and static fallback remains recoverable',()=>{
 const clone=C.normalize(catalog);assert.deepEqual(C.locate(clone,a.id).scene.sceneBlock,a.sceneBlock);assert.deepEqual(C.playbackAssets(a),[]);assert.ok(C.assets(a).includes(a.background));
 const s=C.locate(clone,a.id).scene;s.sceneBlock.enabled=false;assert.equal(C.visualScene(s),s);
 for(const patch of [{code:'../../config'},{revision:'bad'},{anchors:{0:{box:[5,5,1,1],head:[1,1]}}}]){const bad=structuredClone(catalog);Object.assign(bad.maps[1].scenes[0].sceneBlock,patch);assert.throws(()=>C.normalize(bad));}
});
test('dynamic speech head anchors exactly match visible scene coordinates',()=>{
 for(const raw of scenes){const s=C.visualScene(raw);for(const [id,anchor] of Object.entries(raw.sceneBlock.anchors)){const slot=s.actors[id],height=720*.285*slot.scale,f={x:1280*slot.x/100,foot:720*slot.y/100,width:height*slot.aspect,height},head=L.speechAnchor(f,slot);assert.ok(Math.abs(head.x-anchor.head[0]*12.8)<1e-6);assert.ok(Math.abs(head.y-anchor.head[1]*7.2)<1e-6);assert.ok(f.foot<=720.00001);}}
});
function blockFixture(){const {document}=require('linkedom').parseHTML('<main></main>'),host=document.querySelector('main'),listeners=new Map(),posted=[];const create=document.createElement.bind(document);document.createElement=t=>{const el=create(t);if(t==='iframe')el.contentWindow={postMessage:(m,o)=>posted.push({m,o})};return el;};const context=vm.createContext({document,location:{origin:'http://local'},Date,Math,URL,Promise,setTimeout,clearTimeout,addEventListener:(k,fn)=>listeners.set(k,fn),removeEventListener:k=>listeners.delete(k)});vm.runInContext(fs.readFileSync(path.join(__dirname,'../scene-block.js'),'utf8'),context);const block=new context.JinmenSceneBlock.Block(host,{timeout:15000});const message=(entry,type,extra={},origin='http://local',source=entry.frame.contentWindow)=>listeners.get('message')({origin,source,data:{scope:'jinmen-scene-block',version:1,token:entry.token,code:entry.code,type,...extra}});return {block,host,posted,message};}
test('graphics are prepared offscreen, messages are source/token/origin checked, commit is atomic',async()=>{
 const {block,host,posted,message}=blockFixture(),job=block.prepare(a),p=block.pending;message(p,'ready',{},'https://elsewhere');assert.equal(p.ready,false);message(p,'ready',{token:'stale'});assert.equal(p.ready,false);message(p,'ready',{},'http://local',{});assert.equal(p.ready,false);
 message(p,'ready',{anchors:a.sceneBlock.anchors});await job;assert.equal(p.frame.style.opacity,'0');block.commit(a);assert.equal(p.frame.style.opacity,'1');assert.equal(host.children.length,1);
 block.update([{id:0,phase:'speaking',captionBlocked:true,message:{text:'全句',secret:'not copied'}}],false);assert.equal(posted[0].m.actors[0].captionBlocked,true);assert.equal(posted[0].m.actors[0].message.secret,undefined);
 const next=block.prepare(b),q=block.pending;assert.equal(host.children.length,2);message(q,'ready',{anchors:b.sceneBlock.anchors});await next;block.commit(b);assert.equal(host.children.length,1);assert.equal(block.active.code,'A2');block.destroy();assert.equal(host.children.length,0);
});
test('failed or cancelled replacement preserves current picture and stale responses cannot revive it',async()=>{
 const {block,message,host}=blockFixture();let job=block.prepare(a);message(block.pending,'ready');await job;block.commit(a);
 job=block.prepare(b);const q=block.pending,failed=assert.rejects(job,/broken/);message(q,'error',{message:'broken'});await failed;assert.equal(block.active.code,'A1');assert.equal(host.children.length,1);
 job=block.prepare(b);const cancelled=assert.rejects(job,/取消/),old=block.pending;block.cancel();await cancelled;message(old,'ready');assert.equal(block.pending,null);assert.equal(block.active.code,'A1');block.destroy();
});
test('scene playback waits for graphics, deduplicates pending cuts and discards late completions',async()=>{
 const commits=[],jobs=[];const p=new Scenes({load:async()=>({revision:1,catalog}),preload:async()=>{},commit:s=>commits.push(s.id),busy:()=>false,prepareVisual:s=>new Promise((resolve,reject)=>jobs.push({id:s.id,resolve,reject}))});await p.prepare({revision:1,catalog});
 p.cut(a.id);p.cut(a.id);assert.equal(jobs.length,1);assert.equal(commits.length,0);p.cut(b.id);jobs[0].resolve();await flush();assert.equal(commits.length,0);jobs[1].resolve();await flush();assert.deepEqual(commits,[b.id]);
 p.cut(a.id);jobs[2].reject(Error('bad textures'));await flush();assert.equal(p.active.id,b.id);assert.equal(p.message,'bad textures');p.cut(a.id);p.cancel();jobs[3].resolve();await flush();assert.equal(p.active.id,b.id);
});
test('isolated frame cannot initiate speech, model calls or fullscreen and only its entry is frameable',()=>{
 const frame=fs.readFileSync(path.join(__dirname,'../integration/scene-block/frame.js'),'utf8'),html=fs.readFileSync(path.join(__dirname,'../integration/scene-block/frame.html'),'utf8');assert.doesNotMatch(frame,/getUserMedia|new WebSocket|new StageChannel|api\/respond|requestFullscreen/);assert.doesNotMatch(html,/director\.js|engine\.js|speech-capture/);assert.match(frame,/e.source!==parent\|\|e.origin!==origin/);
 const server=fs.readFileSync(path.join(__dirname,'../server.mjs'),'utf8');assert.match(server,/file==='integration\/scene-block\/frame.html'/);assert.match(server,/frame-ancestors 'none'/);
});
