(function(root){
'use strict';
const teachers=(typeof module!=='undefined'?require('./data.js'):root.SHOW_DATA).teachers;
function normalizeDialogue(messages){
 if(!Array.isArray(messages)||messages.length<1||messages.length>4)throw new Error('invalid_response');
 const actors=new Set();
 return messages.map((item,index)=>{
  const text=typeof item?.text==='string'?item.text.trim():'';
  const replyTo=item?.replyTo===undefined?(index?index-1:null):item.replyTo;
  if(!Number.isInteger(item?.actor)||item.actor<0||!teachers[item.actor]||!text||Array.from(text).length>80)throw new Error('invalid_response');
  if(index===0?replyTo!==null:(!Number.isInteger(replyTo)||replyTo<0||replyTo>=index||messages[replyTo].actor===item.actor||messages[index-1].actor===item.actor))throw new Error('invalid_response');
  actors.add(item.actor);if(actors.size>3)throw new Error('invalid_response');
  return {actor:item.actor,text,replyTo};
 });
}
function normalizeImprov(messages,allowedActors,maxMessages=2){
 if(!Array.isArray(messages))throw new Error('invalid_response');
 if(!messages.length)return [];
 const normalized=normalizeDialogue(messages),allowed=new Set(allowedActors);
 if(normalized.some(m=>!allowed.has(m.actor)||Array.from(m.text).length>40))throw new Error('invalid_response');
 return normalized.slice(0,Math.min(2,maxMessages)).map(m=>({...m,improv:true,presentation:'background',action:'idle'}));
}
if(typeof module!=='undefined')module.exports={normalizeDialogue,normalizeImprov};else Object.assign(root,{normalizeDialogue,normalizeImprov});
})(globalThis);
