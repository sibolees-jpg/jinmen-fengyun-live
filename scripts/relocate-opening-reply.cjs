const Script=require('../speech-script.js'),CuePlan=require('../cue-plan.js');

// Reassign the existing dialogue without changing speech text, character text,
// scene assets or the user's A1 bubble placement. Safe to run more than once.
function relocateOpeningReply(input,catalog){
 const script=structuredClone(input),nextCatalog=structuredClone(catalog);
 const opening=script.blocks.find(b=>b.sequenceCode==='起始幕'),a1=script.blocks.find(b=>b.sequenceCode==='A1');
 const intro=opening?.sentences.find(s=>s.id==='q925-r02-s01'),question=a1?.sentences.find(s=>s.text.includes('何来少年心气'));
 if(!intro||!question)throw Error('未找到原开场介绍和少年心气提问，停止自动迁移。');
 const transition=a1.sentences[0];
 if(intro.replies.length){
  if(intro.replies.length!==1||intro.replies[0].actor!==1||!intro.replies[0].text.includes('丈夫只手把吴钩'))throw Error('原开场接话已变更，请重新核对。');
  if(question.replies.length||transition.replies.some(r=>r.actor!==0))throw Error('A1 已有不同接话安排，请重新核对。');
  question.replies=[...intro.replies,...transition.replies].map((r,i)=>({...r,replyTo:i?i-1:null}));
  intro.replies=[];intro.mode='silent';intro.silenceReason='opening';delete intro.dialogueLead;
  transition.replies=[];transition.mode='silent';transition.silenceReason='opening-transition';delete transition.dialogueLead;
  question.mode=question.replies.length>1?'discussion':'reply';question.trigger='少年心气';question.cuePolicy='after-phrase';delete question.dialogueLead;delete question.silenceReason;
 }
 const scene=nextCatalog?.maps.flatMap(m=>m.scenes).find(s=>s.id===a1.sceneId),warmup=nextCatalog?.maps.flatMap(m=>m.scenes).find(s=>s.id===opening.sceneId);
 for(const [actor,oldId]of [[1,intro.id],[0,transition.id]]){
  const slot=scene?.actors.find(a=>a.id===actor);if(!slot)continue;
  if(slot.bubbleCues?.[oldId]&&!slot.bubbleCues[question.id])slot.bubbleCues[question.id]=structuredClone(slot.bubbleCues[oldId]);
 }
 const warm=warmup?.actors.find(a=>a.id===1);if(warm?.bubbleCues)delete warm.bubbleCues[intro.id];
 const normalized=Script.create(script);CuePlan.assert(normalized,nextCatalog);
 return {script:normalized,catalog:nextCatalog};
}
module.exports={relocateOpeningReply};
