(function(root){
'use strict';
// Deterministic local preview provider. This is not model inference.
const topicRules=[
 [['天津',3],['洋务',6],['现代化',4],['变革',3],['漕运',4],['翻译',3]],
 [['艺术教育',6],['教育',3],['课堂',3],['学生',2],['教学',3],['大学',5],['学园',5],['美育',5],['通识',4]],
 [['创造力',6],['艺术创作',6],['创作',3],['图像',2],['作品',2],['实验',6],['观察',3],['验证',4],['望远镜',4],['新艺科',6]],
 [['人工智能',4],['ai',2],['愚公',5],['移山',6],['劳动',5],['围裙',6],['力学力行',8],['坚持',3],['理想',2]]
];
function planRound(input,topics,cursor=0,currentTopic=0){
 const text=String(input||'').trim().toLowerCase();
 const scores=topicRules.map(rule=>rule.reduce((sum,[word,weight])=>sum+(text.includes(word)?weight:0),0));
 const score=Math.max(...scores),topic=scores.indexOf(score);
 if(!text)return {matched:false,topic:null,messages:[],nextCursor:cursor};
 if(score===0||!topics[topic]){
  const fallbackTopic=topics[currentTopic]?currentTopic:0,count=topics[fallbackTopic]?.lines.length||0;
  if(!count)return {matched:false,topic:null,messages:[],nextCursor:cursor};
  const actor=cursor%count;
  return {matched:false,topic:fallbackTopic,messages:[{actor,topic:fallbackTopic,text:'这句话我收到了，暂时还没有准备好的回答。',source:'本地兜底提示'}],nextCursor:(actor+1)%count};
 }
 const count=topics[topic].lines.length,roundSize=Math.min(3,count);
 const messages=Array.from({length:roundSize},(_,i)=>{const actor=(cursor+i)%count;return {actor,topic,text:topics[topic].lines[actor],source:'本地主题匹配'};});
 return {matched:true,topic,messages,nextCursor:(cursor+roundSize)%count};
}
if(typeof module!=='undefined')module.exports={planRound};else root.LocalContent={planRound};
})(globalThis);
