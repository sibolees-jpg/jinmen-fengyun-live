const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const Script=require('../speech-script.js'),C=require('../scene-catalog.js'),Bind=require('../scene-script.js');
const {stage}=require('./helpers/stage-fixture.cjs');
const script=Script.create(require('../speeches/2026-120周年校庆/津门风云-9.23-v18.json'));
const catalog=C.normalize(require('../speeches/2026-120周年校庆/文档场次-9.23-v18.json'));
const old=Script.create(require('../speeches/2026-120周年校庆/津门风云-9.22-v12.json'));
const sentences=script.blocks.flatMap(b=>b.sentences),rows=Bind.bind(catalog,script).rows;
const endings=['李叔同任教之中学现在叫美术中学，离我们这里直线距离500米。','在南洋公学，李叔同成为蔡元培的学生。','几经辗转，终成天津美院。','以重塑民族精神，推进国民之思想启蒙和国家之现代性转型。','一言以蔽之，新艺科之实验场。','这场新艺科实验一旦成功，则抱残守旧之门派，敝帚自珍之技能，必能转而成科技创新、产业焕新、城市更新、文化传承之生力军。','天地大美，其命维新。','祝我们的校友们身体健康，事业发达！'];
async function fixture(){const s=stage({sceneCatalog:catalog,width:239});s.command('speech-script',{script});await new Promise(r=>setImmediate(r));s.command('voice-state',{active:true,session:'doc923'});let seq=0;return {s,send(text,final=true){s.command('voice-transcript',{session:'doc923',seq:++seq,text,final,source:'doubao-api'});}};}
test('9.23 preserves all 140 speech units and 141 authored replies while replacing all eight section boundaries',()=>{
 assert.equal(script.blocks.length,8);assert.equal(sentences.length,140);assert.equal(sentences.flatMap(s=>s.replies).length,141);
 assert.equal(script.text.replace(/\s/g,''),old.text.replace(/\s/g,''));
 const replies=s=>s.blocks.flatMap(b=>b.sentences.flatMap(u=>u.replies.map(r=>[r.actor,r.text.replace(/\s/g,'')])));
 assert.deepEqual(replies(script),replies(old));assert.equal(rows.length,8);
 for(const [i,row] of rows.entries()){assert.ok(row.text.endsWith(endings[i]));assert.equal(row.sceneId,`sc-doc923-${i+1}`);assert.equal(C.missing(C.locate(catalog,row.sceneId).scene).length,0);}
 assert.equal(new Set(catalog.maps.flatMap(m=>m.scenes.map(s=>s.background))).size,8);assert.equal(catalog.maps.flatMap(m=>m.scenes).length,8);
 assert.deepEqual(rows.flatMap(r=>r.units.map(u=>u.id)),sentences.map(s=>s.id));assert.equal(sentences.filter(s=>s.replies.length).length,77);
});
test('9.23 confirmed and stable interim endings traverse all document images without duplicate cuts',async()=>{
 for(const final of [true,false]){const {s,send}=await fixture();send(sentences[0].text);for(let i=0;i<3;i++)s.tick(1000);assert.equal(s.posted.at(-1).scenery.activeId,rows[0].sceneId);
 for(let i=0;i<rows.length;i++){const end=script.blocks[i].sentences.at(-1).text;send(end,final);s.tick(final?1:170);const expected=rows[Math.min(i+1,rows.length-1)].sceneId;assert.equal(s.posted.at(-1).scenery.activeId,expected,`boundary ${i}, final ${final}`);send(end,true);s.tick(1);assert.equal(s.posted.at(-1).scenery.activeId,expected);}
 assert.equal(s.posted.at(-1).scenery.shot.ended,true);s.command('clear');}
});
test('9.23 220 cpm rehearsal visits exactly eight images and keeps the final image',async()=>{
 const {s}=await fixture();s.command('voice-state',{active:false,session:'doc923'});s.command('rehearsal-start');const seen=new Set();let ended=false;
 for(let i=0;i<6000;i++){s.tick(1000);const status=s.posted.at(-1);seen.add(status.scenery.activeId);if(!status.rehearsal.active){ended=true;break;}}
 assert.equal(ended,true);assert.deepEqual([...seen],rows.map(r=>r.sceneId));assert.equal(s.posted.at(-1).scenery.shot.ended,true);s.command('clear');
});
test('9.23 all authored reply groups play exactly once across the new scene boundaries',async()=>{
 const {s,send}=await fixture();for(const sentence of sentences){send(sentence.text);s.tick(1000);}
 let remaining;for(let i=0;i<4000;i++){s.tick(1000);remaining=vm.runInContext('manualCues.length+engine.queue.length+engine.actors.filter(a=>a.phase!=="idle").length',s.context);if(!remaining)break;}
 assert.equal(remaining,0);const ledger=vm.runInContext('cueLedger.snapshot()',s.context);assert.equal(ledger.filter(c=>c.state==='played').length,sentences.filter(s=>s.replies.length).length);assert.equal(ledger.reduce((n,c)=>n+c.completed,0),141);assert.equal(s.posted.at(-1).scenery.activeId,'sc-doc923-8');s.command('clear');
});
test('9.23 manual next-scene advances both scenery and the speech cursor',async()=>{
 const {s}=await fixture();for(let i=0;i<rows.length;i++){s.command('scene-next');s.tick(900);const status=s.posted.at(-1);assert.equal(status.scenery.activeId,rows[i].sceneId);assert.equal(status.presentation.index,i);assert.equal(status.presentation.sentenceIndex,0);}s.command('clear');
});
test('new red captions name eight independent scenes; opening is white and every actor reference is scene-local',()=>{assert.deepEqual(catalog.maps.map(m=>m.name),['总督府花园','西式室内','北洋女师','中式室内','金刚公园','意式风情区','海浪中式室内','女贞学堂']);assert.equal(catalog.openingMode,'white');const refs=catalog.maps.flatMap(m=>m.scenes.flatMap(s=>s.actors.slice(0,9).map(a=>a.poses.idle)));assert.equal(refs.length,72);assert.equal(new Set(refs).size,72);assert.ok(catalog.maps.every(m=>!m.sharedAssets&&m.scenes.length===1));assert.ok(!script.text.includes('上图'));});
test('white opening stays hidden until recognized speech and reset restores it',async()=>{const {s,send}=await fixture();assert.equal(vm.runInContext('openingLayer.style.opacity',s.context),'1');send('测试麦克风');s.tick(800);assert.equal(vm.runInContext('openingLayer.style.opacity',s.context),'1');send(sentences[0].text);s.tick(800);assert.equal(vm.runInContext('openingLayer.style.opacity',s.context),'0');s.command('scene-reset');assert.equal(vm.runInContext('openingLayer.style.opacity',s.context),'1');s.command('scene-next');assert.equal(vm.runInContext('openingLayer.style.opacity',s.context),'0');});
test('replacement with different transparent margins preserves visible feet and height',()=>{const a={x:50,y:90,scale:1,aspect:.6,layer:25,contentBounds:[.1,.1,.9,.9]},before=C.actorAnchor(a,1.78);a.aspect=.9;a.contentBounds=[.3,.2,.7,.8];C.fitActor(a,before,1.78);const after=C.actorAnchor(a,1.78);for(const key of ['x','y','height'])assert.ok(Math.abs(before[key]-after[key])<1e-9,key);});
