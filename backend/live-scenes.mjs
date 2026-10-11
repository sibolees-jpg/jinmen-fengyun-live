// Scene eligibility is based on the saved visible cast, never on manuscript rows.
export const LIVE_ACTOR_IDS=[0,1,2,3,4,5,6,8];
export function liveScenes(catalog){
 return (catalog?.maps||[]).flatMap(map=>(map.scenes||[]).map(scene=>({id:scene.id,name:scene.name,background:scene.background,actors:(scene.actors||[]).filter(a=>a.present&&!a.visualHidden&&LIVE_ACTOR_IDS.includes(a.id)).map(a=>a.id)}))).filter(s=>s.actors.length);
}
export function chooseLiveScene(scenes,actors,{lockedSceneId,currentSceneId,text='',recentScenes=[]}={}){
 const eligible=scenes.filter(s=>(!lockedSceneId||s.id===lockedSceneId)&&actors.every(id=>s.actors.includes(id)));
 if(!eligible.length)throw Object.assign(new Error('没有同时包含所选人物的场景，请换人物或解除场景锁定。'),{code:'invalid_response'});
 const score=s=>{
  let n=-(s.actors.length-actors.length)*3+(s.id===currentSceneId?5:0);
  // Change composition between rounds, while requiring every speaker to be visible.
  if(recentScenes.length){n-=recentScenes.filter(id=>id===s.id).length*18;if(s.id===recentScenes.at(-1))n-=18;}
  // Prefer a focused composition over the all-cast waiting/finale shots.
  if(/standby|-t[12]$/.test(s.id))n-=18;
  for(const word of ['书房','校园','公园','庭院','广场','天津','教育','艺术','科学'])if(text.includes(word)&&s.name.includes(word))n+=12;
  return n;
 };
 return [...eligible].sort((a,b)=>score(b)-score(a)||a.id.localeCompare(b.id))[0];
}
