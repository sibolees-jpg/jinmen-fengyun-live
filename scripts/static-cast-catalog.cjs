'use strict';
const C=require('../scene-catalog.js'),D=require('../dialogue-overlay.js');
const delivered=require('../integration/scene-block/scenes.json').scenes;
const imported=url=>url?.replace(/^\/integration\/scene-block\/assets\/(scene-assets|actor-animation-library)\//,'/api/scene-assets/');
function rewriteAssets(value){if(typeof value==='string')return imported(value);if(Array.isArray(value))return value.map(rewriteAssets);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,rewriteAssets(v)]));return value;}

function staticCastCatalog(source){
 const catalog=C.normalize(C.clone(source));
 for(const map of catalog.maps)for(const scene of map.scenes){
  const code=scene.id==='sc-doc924-standby'?'S0':scene.id.replace('sc-q925-','').toUpperCase(),native=delivered[code],anchors=scene.sceneBlock?.anchors||{};
  scene.visualMode='static-cast';scene.backgroundAspect=16/9;scene.foreground='';scene.sceneryLayers=[];scene.occluders=[];
  scene.backgroundTransform={x:0,y:0,scale:1};scene.fallbackStanding=false;
  if(scene.composition)scene.composition.enabled=false;if(scene.sceneBlock)scene.sceneBlock.enabled=false;
  scene.actors=scene.actors.map(old=>{
   const deliveredActor=native?.actors.find(a=>a.id===old.id&&a.present),a={...old};
   if(code!=='S0'&&deliveredActor){
    Object.assign(a,rewriteAssets(deliveredActor),{id:old.id,present:old.present||deliveredActor.present,bubble:old.bubble,bubbleCues:old.bubbleCues});
    const p=anchors[a.id];if(p){const [l,t,r,b]=p.box;C.fitActor(a,{x:(l+r)/2,y:b,height:b-t,layer:old.layer},16/9);}
   }else if(code!=='S0')a.visualHidden=true;
   a.motion={enabled:true,stationary:true,breathing:false,blinking:true,speaking:true,walking:false};
   a.roamRadius=0;a.step=0;a.entry='cut';a.entryPath=[];a.holdAfterSpeech=false;
   a.furniture=false;a.bodyClip=[];a.personMask='';a.maskDisabled=true;a.maskReview=false;
   if(a.animation){a.animation.clips.breath=[];a.animation.clips.walkLeft=[];a.animation.clips.walkRight=[];}
   const style=value=>D.normalize({...value,font:'kangxi'});a.bubble=style(a.bubble);for(const key of Object.keys(a.bubbleCues||{}))a.bubbleCues[key]=style(a.bubbleCues[key]);
   return a;
  });
 }
 return C.normalize(catalog);
}
module.exports={staticCastCatalog,rewriteAssets};
