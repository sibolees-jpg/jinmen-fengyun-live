const Script=require('../speech-script.js'),CuePlan=require('../cue-plan.js');
// Merge the existing name cards without rewriting the manuscript or dialogue IDs.
function mergeOpeningNames(input){
 const next=structuredClone(input),block=next.blocks[0];
 if(next.stageBinding?.openingCue!=='named-cast')throw Error('本稿不是逐名开场，停止迁移');
 const first=block.sentences.findIndex(s=>s.text.includes('他们是'));
 const last=block.sentences.findIndex((s,i)=>i>=first&&s.text.includes('那位愚公'));
 if(first<0||last<first)throw Error('未找到完整开场名单，停止迁移');
 const names=block.sentences.slice(first,last+1);
 if(names.some(s=>s.replies.length))throw Error('开场名单仍有接话，停止迁移');
 block.sentences.splice(first,names.length,{...names.at(-1),text:names.map(s=>s.text).join(''),trigger:'他们是李鸿章',mode:'silent',replies:[],silenceReason:'opening'});
 const script=Script.create(next);CuePlan.assert(script);return script;
}
module.exports={mergeOpeningNames};
