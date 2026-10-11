(function(root){
'use strict';
const SceneCatalog=typeof module!=='undefined'?require('./scene-catalog.js'):root.SceneCatalog;
class ScenePlayback{
 constructor({load,preload,commit,busy,prepareVisual=null,cancelVisual=()=>{},changed=()=>{}}){Object.assign(this,{load,preload,commit,busy,prepareVisual,cancelVisual,changed});this.generation=0;this.active=null;this.pending=null;this.message='';this.prepared=null;this.prepareGeneration=0;}
 async prepare(record){const token=++this.prepareGeneration,catalog=SceneCatalog.normalize(record.catalog),assets=[...new Set(catalog.maps.flatMap(m=>m.scenes.flatMap(SceneCatalog.playbackAssets)))],results=await Promise.allSettled(assets.map(src=>Promise.resolve().then(()=>this.preload(src))));const failed=new Set(assets.filter((_,i)=>results[i].status==='rejected'));if(token===this.prepareGeneration)this.prepared={...record,catalog,failed};}
 cut(id){const found=this.prepared&&SceneCatalog.locate(this.prepared.catalog,id);if(!found)return false;if(SceneCatalog.playbackAssets(found.scene).some(src=>this.prepared.failed?.has(src))){this.message='本景素材加载失败，正在重试；其他景别可继续';this.report();return false;}if(SceneCatalog.missing(found.scene).length){this.message='素材未齐，保留当前画面';this.report();return false;}if(this.prepareVisual&&SceneCatalog.isDynamic(found.scene)){if(this.pending?.id===id)return true;const token=++this.generation;this.pending={id,ready:false};this.message='正在准备动态场景';this.report();this.prepareVisual(found.scene).then(()=>{if(token!==this.generation)return;this.pending={id,ready:true,immediate:true,scene:found.scene,name:found.map.name+' / '+found.scene.name};this.tick();}).catch(e=>{if(token!==this.generation)return;this.pending=null;this.message=e.message;this.report();});return true;}
this.generation++;this.cancelVisual();this.pending=null;this.commit(found.scene);this.active={id,name:found.map.name+' / '+found.scene.name};this.message='已切入';this.report();return true;}
 snapshot(){return {activeId:this.active?.id||'',activeName:this.active?.name||'',pendingId:this.pending?.id||'',message:this.message};}
 report(){this.changed();}
 async take(id,revision,{immediate=false}={}){const token=++this.generation;this.pending={id,ready:false};this.message='正在预加载';this.report();try{const value=await this.load();if(token!==this.generation)return;if(revision!==undefined&&value.revision!==revision)throw Error('场次库已更新，请重新载入后切入');const found=SceneCatalog.locate(SceneCatalog.normalize(value.catalog),id);if(!found)throw Error('场次已不存在');const missing=SceneCatalog.missing(found.scene);if(missing.length)throw Error('素材未齐：'+missing.join('、'));await Promise.all(SceneCatalog.playbackAssets(found.scene).map(this.preload));if(token!==this.generation)return;if(this.prepareVisual)await this.prepareVisual(found.scene);if(token!==this.generation)return;this.pending={id,ready:true,immediate,scene:found.scene,name:found.map.name+' / '+found.scene.name};this.message='等待当前接话结束';this.tick();this.report();}catch(e){if(token!==this.generation)return;this.pending=null;this.message=e.message||'场次加载失败，保留原画面';this.report();}}
 tick(){if(!this.pending?.ready||(!this.pending.immediate&&this.busy()))return;const p=this.pending;try{this.commit(p.scene);for(const src of SceneCatalog.playbackAssets(p.scene))this.prepared?.failed?.delete(src);this.active={id:p.id,name:p.name};this.pending=null;this.message='已切入';}catch(e){this.pending=null;this.message='切换失败，保留原画面';}this.report();}
 cancel(){this.generation++;this.cancelVisual();this.pending=null;this.message='待切已取消';this.report();}
}
// Freeze one complete visual frame above the new scene. Controls, captions and
// dialogue are deliberately excluded: an old reply must never cross a scene.
class SceneDissolve{
 constructor(host,{duration=550,reduced=()=>root.matchMedia?.('(prefers-reduced-motion: reduce)').matches}={}){this.host=host;this.duration=duration;this.reduced=reduced;this.overlay=null;this.animation=null;}
 clear(){this.animation?.cancel();this.animation=null;this.overlay?.remove();this.overlay=null;}
 capture(){
  this.clear();if(this.reduced()||typeof this.host?.cloneNode!=='function')return false;
  const doc=this.host.ownerDocument,layer=doc.createElement('div');layer.className='scene-dissolve';layer.setAttribute('aria-hidden','true');
  for(const node of this.host.children){
   if(!node.matches('.scenery,#actors,#labels,.scene-static-layer,.scene-static-furniture,.scene-foreground,.scene-auto-occlusion'))continue;
   const copy=node.cloneNode(true),sourceCanvases=node.querySelectorAll('canvas'),copies=copy.querySelectorAll('canvas');
   for(let i=0;i<sourceCanvases.length;i++){if(sourceCanvases[i].closest('[hidden]'))continue;try{copies[i].getContext('2d').drawImage(sourceCanvases[i],0,0);}catch{}}
   copy.removeAttribute('id');for(const child of copy.querySelectorAll('[id]'))child.removeAttribute('id');
   layer.append(copy);
  }
  if(!layer.children.length)return false;this.host.append(layer);this.overlay=layer;return true;
 }
 reveal(){
  const layer=this.overlay;if(!layer)return;
  if(typeof layer.animate!=='function'){this.clear();return;}
  const animation=layer.animate([{opacity:1},{opacity:0}],{duration:this.duration,easing:'ease-in-out',fill:'forwards'});this.animation=animation;
  animation.finished.then(()=>{if(this.overlay===layer)this.clear();},()=>{});
 }
}
ScenePlayback.Dissolve=SceneDissolve;
if(typeof module!=='undefined')module.exports=ScenePlayback;else root.ScenePlayback=ScenePlayback;
})(globalThis);
