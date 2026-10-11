(function(root){
'use strict';
const norm=s=>String(s||'').normalize('NFKC').replace(/[^\p{L}\p{N}]/gu,'');
// The stage and the cue reader share sentence IDs. Old shot text is only a
// migration reference; it is never a second live manuscript.
function bind(catalog,script){
 const reference=catalog?.timeline||[];
 if(script?.stageBinding?.mode==='sequence-config'&&script.stageBinding.status==='pending')return {rows:[],warning:'新稿序号已启用；整套场景与人物待前端适配'};
 if(!script?.blocks?.length)return {rows:reference,warning:''};
 const units=script.blocks.flatMap((b,index)=>b.sentences.map((s,sentenceIndex)=>({index,sentenceIndex,id:s.id,text:s.text,sceneId:b.sceneId||''})));
 if(script.stageBinding?.mode==='sequence-config'&&script.stageBinding.status==='bound'){const missing=script.blocks.find(b=>!catalog.maps.some(m=>m.scenes.some(s=>s.id===b.sceneId)));if(missing)return {rows:[],warning:missing.sequenceCode+' 对应的场景与人物配置不存在'};return {rows:script.blocks.filter(b=>b.sequenceCode!=='起始幕').map(b=>({id:'bound-'+b.sequenceCode,sequenceCode:b.sequenceCode,sceneId:b.sceneId,name:b.title,visualTrigger:b.visualTrigger,text:b.source,units:units.filter(u=>u.sceneId===b.sceneId)})),warning:''};}
 const available=new Set(catalog.maps.flatMap(m=>m.scenes.map(s=>s.id)));
 if(catalog.bindingMode!=='timeline'&&units.every(u=>available.has(u.sceneId))){
  const rows=[];for(const unit of units){let row=rows.at(-1);if(row?.sceneId!==unit.sceneId){row={id:'bound-'+rows.length,sceneId:unit.sceneId,name:reference.find(r=>r.sceneId===unit.sceneId)?.name||script.blocks[unit.index].title,text:'',units:[]};rows.push(row);}row.text+=unit.text;row.units.push(unit);}
  return {rows,warning:''};
 }
 // Plain-text replacement keeps scene order by locating distinct starts in the
 // new speech. Updated endings always come from that speech, not the old file.
 const starts=[];let floor=0;
 for(const row of reference){
  const anchor=norm(row.text).slice(0,18);let at=-1;
  for(let i=floor;i<units.length;i++)if(norm(units.slice(i,i+4).map(u=>u.text).join('')).startsWith(anchor)){at=i;break;}
  if(at<0)return {rows:[],warning:'换稿后有景别边界未匹配，请在素材与站位中更新该景别讲话。'};
  starts.push(at);floor=at+1;
 }
 if(!starts.length)return {rows:[],warning:''};
 starts[0]=0;
 return {rows:reference.map((r,i)=>{const selected=units.slice(starts[i],starts[i+1]??units.length);return {...r,text:selected.map(u=>u.text).join(''),units:selected};}),warning:''};
}
function rowFor(rows,index,sentenceIndex){return rows.findIndex(r=>r.units?.some(u=>u.index===index&&u.sentenceIndex===sentenceIndex));}
function progress(catalog,rows,script,sceneId,presentation={},cues=[]){
 let found;for(const [mi,map] of (catalog?.maps||[]).entries()){const si=map.scenes.findIndex(s=>s.id===sceneId);if(si>=0){found={mi,si,map,scene:map.scenes[si]};break;}}
 if(!found)return null;
 const units=rows.filter(r=>r.sceneId===sceneId).flatMap(r=>r.units||[]),groups=units.filter(u=>{const s=script?.blocks?.[u.index]?.sentences?.[u.sentenceIndex];return s?.mode!=='silent'&&s?.replies?.length;}).map(u=>({...u,key:`${u.index}:${u.id}`}));
 const states=new Map(cues.map(c=>[c.key,c])),playing=groups.findIndex(u=>states.get(u.key)?.state==='playing'),queued=groups.findIndex(u=>states.get(u.key)?.state==='queued');
 let current=playing>=0?playing:queued>=0?queued:groups.findLastIndex(u=>u.index<presentation.index||u.index===presentation.index&&u.sentenceIndex<=(presentation.sentenceIndex??-1));
 current=groups.length?Math.max(0,current)+1:0;
 const standby=catalog.maps.findIndex(m=>m.scenes.some(s=>s.id===catalog.standbySceneId));
 return {code:`S${found.mi===standby?0:found.mi+1-(standby>=0&&standby<found.mi?1:0)}-M${found.si+1}`,sceneId,mapName:found.map.name,name:found.scene.name,current,total:groups.length,first:units[0]||null,groups};
}
const api={bind,rowFor,progress};if(typeof module!=='undefined')module.exports=api;else root.SceneScript=api;
})(globalThis);
