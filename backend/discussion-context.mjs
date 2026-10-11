// Only complete, actually displayed rounds are passed here by the realtime
// server. A scene's cast and a generated draft never grant memory access.
const actors=new Set([0,1,2,3,4,5,6,8]);
export function discussionRounds(history=[]){
 const rounds=[];let input='';
 for(const entry of (Array.isArray(history)?history:[]).slice(-16)){
  if(entry?.role==='user'&&typeof entry.content==='string'){input=entry.content.slice(0,2000);continue;}
  if(entry?.role!=='assistant'||typeof entry.content!=='string')continue;
  try{
   const value=JSON.parse(entry.content);
   if(!Array.isArray(value.messages))continue;
   const messages=value.messages.filter(m=>actors.has(m?.actor)&&typeof m.text==='string'&&m.text.trim()).map(m=>({actor:m.actor,text:m.text.slice(0,80)}));
   if(messages.length)rounds.push({input,messages,participants:[...new Set(messages.map(m=>m.actor))]});
  }catch{}finally{input='';}
 }
 return rounds;
}
export function canRecallTogether(owner,participants,current=[owner]){
 return actors.has(owner)&&Array.isArray(participants)&&participants.includes(owner)&&Array.isArray(current)&&current.includes(owner)&&current.every(id=>participants.includes(id));
}
