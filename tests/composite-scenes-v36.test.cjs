const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),vm=require('node:vm');
const C=require('../scene-catalog.js'),L=require('../stage-layout.js'),D=require('../dialogue-overlay.js'),Caption=require('../caption-layout.js'),{stage}=require('./helpers/stage-fixture.cjs');
const catalog=structuredClone(require('../show/scenes.json').catalog);for(const m of catalog.maps)for(const s of m.scenes)delete s.sceneBlock;
const manifest=require('../integration/manuscript-20260925/visuals/finished-scenes-v36.json'),script=require('../speeches/2026-120周年校庆/津门风云-9.25-Q本.json');
test('ten finished images bind by table composition, A/B remain skipped, all full-resolution files verify',()=>{
 assert.deepEqual(manifest.matched.map(r=>r.sequenceCode).sort(),['E1','G1','H2','L1','M1','N1','O1','P2','S0','S1'].sort());
 assert.deepEqual(manifest.skipped.map(r=>r.sourceFile),['A.png','B.png']);
 for(const r of manifest.matched){const s=C.locate(catalog,r.sceneId).scene,b=fs.readFileSync(require.resolve('../show/scene-assets/'+r.asset.split('/').pop()));assert.equal(crypto.createHash('sha256').update(b).digest('hex'),r.assetSha256);assert.equal(b.readUInt32BE(16),r.width);assert.equal(b.readUInt32BE(20),r.height);assert.equal(s.composition.image,r.asset);if(r.sequenceCode==='S0'){assert.equal(s.composition.enabled,false);assert.ok(C.playbackAssets(s).includes(r.asset));}else assert.deepEqual(C.playbackAssets(s),[r.asset]);assert.ok(C.assets(s).includes(s.background),'restore assets stay portable');}
 for(const m of catalog.maps)for(const s of m.scenes)if(!manifest.matched.some(r=>r.sceneId===s.id))assert.equal(s.composition,undefined);
});
test('composition round-trips without mutating independent assets and disabling immediately restores them',()=>{
 const s=C.locate(C.normalize(catalog),'sc-q925-l1').scene,before=structuredClone(s),v=C.visualScene(s);
 assert.equal(v.background,s.composition.image);assert.equal(v.foreground,'');assert.equal(v.occluders.length,0);assert.equal(v.sceneryLayers.length,0);assert.ok(v.actors.every(a=>a.embedded&&!a.poses.idle&&!a.furniture&&!a.animation));assert.equal(v.actors[6].present,true);assert.deepEqual(s,before);
 s.composition.enabled=false;assert.equal(C.visualScene(s),s);assert.ok(C.playbackAssets(s).includes(s.actors[6].poses.idle));assert.ok(C.assets(s).includes(s.composition.image));
 for(const change of [{image:'https://example.org/x.png'},{anchors:{6:{box:[20,20,10,50],head:[25,30]}}},{width:0}]){const bad=structuredClone(catalog);Object.assign(C.locate(bad,s.id).scene.composition,change);assert.throws(()=>C.normalize(bad));}
});
test('embedded head anchors are exact and do not move when dialogue progress changes',()=>{
 const scene=C.visualScene(C.locate(catalog,'sc-q925-l1').scene),s=scene.actors[6],rect={left:60,top:25,width:1280,height:1280/scene.backgroundAspect};
 const a=L.scenePosition(s,s,{phase:'speaking'},0,rect,1400,850),b=L.scenePosition(s,s,{phase:'speaking'},1,rect,1400,850);assert.deepEqual(a,b);
 const h=rect.height*.285*s.scale,f={x:rect.left+s.x*rect.width/100,foot:rect.top+s.y*rect.height/100,width:h*s.aspect,height:h},anchor=L.speechAnchor(f,s),p=scene.composition.anchors[6].head;
 assert.ok(Math.abs(anchor.x-(rect.left+rect.width*p[0]/100))<1e-7);assert.ok(Math.abs(anchor.y-(rect.top+rect.height*p[1]/100))<1e-7);
});
test('whole-scene playback hides old portraits but still reveals preset dialogue and semantic actors',async()=>{
 const s=stage({width:1280,height:720,sceneCatalog:catalog});await new Promise(r=>setImmediate(r));s.command('speech-script',{script});const bi=script.blocks.findIndex(b=>b.sceneId==='sc-q925-l1');s.command('rehearsal-cue',{index:bi,sentenceIndex:0});await new Promise(r=>setImmediate(r));for(let i=0;i<60;i++)s.tick(100);
 assert.equal(s.posted.at(-1).scenery.activeId,'sc-q925-l1');assert.ok(s.elements.get('actors').children.every(n=>n.hidden));assert.ok(s.posted.at(-1).actors.some(a=>a.captionVisible));assert.equal(vm.runInContext('activeScenery.background',s.context),C.locate(catalog,'sc-q925-l1').scene.composition.image);s.command('clear');
});
test('an unpictured reply still appears with its name and without a misleading pointer',async()=>{
 const s=stage({width:1280,height:720,sceneCatalog:catalog});await new Promise(r=>setImmediate(r));s.command('speech-script',{script});const bi=script.blocks.findIndex(b=>b.sceneId==='sc-q925-e1'),si=script.blocks[bi].sentences.findIndex(q=>q.replies?.some(r=>r.actor===0));assert.ok(si>=0);
 s.command('rehearsal-cue',{index:bi,sentenceIndex:si});await new Promise(r=>setImmediate(r));for(let i=0;i<60;i++)s.tick(100);
 const card=s.elements.get('bubbles').children[0];assert.ok(card.dataset.text.startsWith('梁启超：'));assert.equal(card.querySelector('.bubble-tail').style.display,'none');assert.ok(s.posted.at(-1).actors[0].captionVisible);s.command('clear');
});
test('standalone overlay supports a named off-picture reply without leaking styles into the visual block',()=>{
 const {document}=require('linkedom').parseHTML('<div id="stage"><canvas id="colleague"></canvas></div>'),host=document.getElementById('stage'),canvas=host.firstElementChild,layer=D.mount(host,{Caption,place:L.placeBubbles});
 const result=layer.update({width:1280,height:720,items:[{id:0,key:'one',text:'梁启超：这是完整接话。',x:640,y:100,hideTail:true}]});assert.equal(result.blocked.length,0);assert.equal(layer.element.shadowRoot.querySelector('.bubble-tail').style.display,'none');assert.equal(host.firstElementChild,canvas);layer.destroy();assert.equal(host.children.length,1);
});
