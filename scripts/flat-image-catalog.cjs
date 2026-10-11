'use strict';
const C=require('../scene-catalog.js'),D=require('../dialogue-overlay.js');

// Create a separate visual variant. Cue IDs, logical cast, triggers, original
// assets and the source catalog remain intact; only this copy uses whole images.
function flatCatalog(source){
 const catalog=C.normalize(C.clone(source));
 for(const map of catalog.maps)for(const scene of map.scenes){
  const old=scene.composition,anchors=scene.sceneBlock?.anchors||old?.anchors||{};
  const present=scene.actors.filter(a=>a.present),ids=present.map(a=>a.id);
  for(const a of scene.actors){
   const i=Math.max(0,ids.indexOf(a.id)),head=anchors[a.id]?.head||[a.x,Math.max(0,a.y-28.5*a.scale)];
   const convert=value=>D.normalize({...value,font:'kangxi',...(!value?.manual?{manual:true,x:Math.min(84,6+i*78/Math.max(1,ids.length)),y:8+(i%3)*5}:{}),...(value?.tailMode!=='point'?{tailMode:'point',tailSide:'auto',tailX:Math.max(0,Math.min(100,head[0])),tailY:Math.max(0,Math.min(100,head[1]))}:{})});
   a.bubble=convert(a.bubble);for(const key of Object.keys(a.bubbleCues||{}))a.bubbleCues[key]=convert(a.bubbleCues[key]);
  }
  scene.composition={kind:'image',enabled:true,freeLayout:true,image:old?.image||scene.background||C.STOCK,width:old?.width||1600,height:old?.height||Math.round(1600/(scene.backgroundAspect||16/9)),sourceName:'临时占位 · '+(old?.sourceName||scene.name)+'（请替换本场完整图片）',anchors:{}};
 }
 return C.normalize(catalog);
}
module.exports={flatCatalog};
