const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const P=require('../actor-pet-motion.js'),L=require('../stage-layout.js'),C=require('../scene-catalog.js');
const catalog=require('../speeches/2026-120周年校庆/津门风云-9.24-v28-场次.json');
const overlaps=(a,b)=>a.left<b.left+b.width&&a.left+a.width>b.left&&a.top<b.top+b.height&&a.top+a.height>b.top;
test('every current static pose has calibrated facial landmarks; idle/queued actors never open their mouths',()=>{
 for(const m of catalog.maps.slice(1))for(const a of m.scenes[0].actors){assert.ok(P.footprintFor(a.poses.idle));if(!a.animation)assert.ok(P.profileFor(a.poses.idle),a.poses.idle);}
 const a={id:0,motion:{}};let open=false,blink=false,breath=false;
 for(let t=0;t<6000;t+=20){for(const phase of ['idle','thinking','entering','leaving'])assert.equal(P.stateAt(a,{phase},t).mouth,0);assert.equal(P.stateAt(a,{phase:'speaking',actionOnly:true},t).mouth,0);const s=P.stateAt(a,{phase:'speaking'},t);open||=s.mouth>0;blink||=s.blink;breath||=Math.abs(s.breathe)>.8;assert.deepEqual(s,P.stateAt(a,{phase:'speaking'},t));}
 assert.ok(open&&blink&&breath);assert.notEqual(P.stateAt(a,{phase:'idle'},4600).blink,P.stateAt({...a,id:1},{phase:'idle'},4600).blink);
 assert.deepEqual(P.stateAt({...a,motion:{enabled:false}},{phase:'speaking'},4600),{blink:false,mouth:0,breathe:0});
 assert.equal(P.profileFor('/api/scene-assets/unrecognized-replacement.png'),null);
});
test('all 13 compositions keep nine names attached to their own lower silhouette without covering other people or names',()=>{
 for(const fullscreen of [false,true])for(const [w,h] of [[768,886],[1200,800],[1920,1080],[1024,768]])for(const map of catalog.maps.slice(1)){
  const s=map.scenes[0],scene=L.sceneRect(w,h,s.backgroundAspect,fullscreen),figures=s.actors.map(a=>{const p=L.scenePosition(a,a,{id:a.id,phase:'idle'},0,scene,w,h),height=scene.height*.285*p.scale,width=height*a.aspect,x=scene.left+p.x*scene.width,foot=scene.top+p.y*scene.height,k=s.nameplateScale,font=Math.max(9,Math.min(15,w*.0085)*k);return {...L.nameplateFigure({id:a.id,x,foot,width,height},a),labelWidth:Math.ceil((font+4*k+2)*1.15),labelHeight:Math.ceil((font*1.15*C.NAMES[a.id].length+8*k+2+C.NAMES[a.id].length*.5)*1.15)};});
  const zone=s.presenter,reserved={left:scene.left+scene.width*zone.x/100,top:scene.top+scene.height*zone.y/100,width:scene.width*zone.width/100,height:scene.height*zone.height/100},labels=L.placeNameplates(figures,w,h,{reserved});
  if(map===catalog.maps[7]){const plate=labels.find(l=>l.id===5),body=figures.find(f=>f.id===5).body;assert.ok(plate.ownerY>body.top+body.height*.8,'visible foot must win over presenter-zone preference');}
  assert.equal(labels.length,9,`${map.title} ${w}x${h}`);assert.equal(new Set(labels.map(l=>l.side)).size,2,'left/right must be chosen per actor');
  for(const l of labels){const own=figures.find(f=>f.id===l.id);assert.ok(l.left>=0&&l.top>=0&&l.left+l.width<=w&&l.top+l.height<=h);assert.ok(l.ownerY>own.body.top+own.body.height*.25);assert.ok(Math.min(Math.abs(l.left-l.ownerX),Math.abs(l.left+l.width-l.ownerX))<=l.width*.5+2.01,'horizontal attachment');assert.ok(l.top<=l.ownerY+l.height*.23,'vertical attachment');for(const other of figures.filter(f=>f.id!==l.id))assert.ok(!other.bands.some(b=>overlaps(l,b)),`name ${l.id} on actor ${other.id}`);for(const other of labels.filter(o=>o.id!==l.id))assert.ok(!overlaps(l,other));}
 }
});
test('shadows use the actual silhouette feet and mirror with the actor, not the transparent canvas edge',()=>{
 for(const m of catalog.maps.slice(1))for(const a of m.scenes[0].actors){const s=P.shadowGeometry({...a,facing:'right'}),f=P.shadowGeometry({...a,facing:'left'});assert.ok(s.y>.5&&s.y<=1);assert.ok(Math.abs(s.x+f.x-1)<1e-10);assert.ok(s.width>=.2&&s.width<=1);assert.equal(s.y,f.y);}
});
test('static-pose renderer keeps masks, yields to explicitly assigned poses, freezes at a stable time, and cleans up',()=>{
 const classes=new Set(),draws=[],ctx={clearRect(){},save(){},restore(){},translate(){},scale(){},drawImage:img=>draws.push(img),beginPath(){},ellipse(){},fill(){},stroke(){},moveTo(){},quadraticCurveTo(){}};
 const src='/api/scene-assets/'+Object.keys(P.PROFILES)[0],original={style:{transform:'scaleX(-1)',maskImage:'url(mask)',webkitMaskImage:'url(mask)',clipPath:'polygon(0% 0%,100% 0%,100% 100%)'},getAttribute:()=>src};
 const container={append(){},querySelector:()=>original,classList:{add:k=>classes.add(k),remove:k=>classes.delete(k)}},scope={document:{createElement:()=>({style:{},setAttribute(){},getContext:()=>ctx,remove(){}})}};scope.globalThis=scope;vm.runInNewContext(fs.readFileSync(require.resolve('../actor-pet-motion.js'),'utf8'),scope);
 const image={naturalWidth:1024,naturalHeight:1536},player=new scope.ActorPetPlayer(container,{id:0,poses:{idle:src},motion:{}},{imageFactory:()=>image});
 player.drawState({phase:'idle'},100);assert.equal(draws.length,0);image.onload();player.drawState({phase:'idle'},100);assert.ok(classes.has('has-actor-pet'));assert.equal(player.canvas.style.maskImage,original.style.maskImage);assert.equal(player.canvas.style.clipPath,original.style.clipPath);assert.equal(player.canvas.style.transform,'scaleX(-1)');
 let count=draws.length;player.drawState({phase:'idle'},100);assert.equal(draws.length,count);original.getAttribute=()=>'/other-speaking.png';player.drawState({phase:'speaking'},100);assert.equal(classes.has('has-actor-pet'),false);
 player.destroy();count=draws.length;player.drawState({phase:'speaking'},200);assert.equal(draws.length,count);assert.equal(image.onload,null);
});
test('joint-finale uses the same pose players, footprint shadows, and attached nameplates',()=>{
 const {parseHTML}=require('linkedom'),{document}=parseHTML('<html><body><div id="stage"></div></body></html>'),scenery=catalog.maps[3].scenes[0],players=[];
 class MockPlayer{constructor(container,actor){this.actor=actor;this.container=container;players.push(this);}destroy(){this.dead=true;}drawState(state,time){this.state=state;this.time=time;}}
 const scope={document,localStorage:{getItem(){}},JointFinale:require('../finale.js'),PetMotion:P,ActorAnimation:require('../actor-animation.js'),ActorAnimationPlayer:MockPlayer,ActorPetPlayer:MockPlayer,UIPatch:{text:(el,text)=>el.textContent=text},...L};scope.globalThis=scope;
 vm.runInNewContext(fs.readFileSync(require.resolve('../finale-stage.js'),'utf8'),scope);
 const controller=scope.setupFinaleStage({channel:{postMessage(){}},beforeEnter(){},getScene:()=>scenery,getPortrait:id=>scenery.actors[id].poses.idle,getPositions:()=>Object.fromEntries(scenery.actors.map(a=>[a.id,{x:a.x/100,y:a.y/100,scale:a.scale}]))});
 controller.command({action:'finale-start'});controller.render(1200,800,6000);
 const labels=[...document.querySelectorAll('.finale-labels .nameplate')];assert.equal(labels.length,9);assert.ok(labels.every(n=>n.style.visibility==='visible'&&!n.hidden));assert.equal(players.filter(p=>!p.dead).length,9);assert.ok(players.filter(p=>!p.dead).every(p=>p.state));
 for(const node of document.querySelectorAll('.finale-person'))assert.ok(node.querySelector('.actor-shadow').style.top.endsWith('%'));
});
