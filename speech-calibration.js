(function(root){
'use strict';
// Context-bound repairs are used for locating cues, never as an unrestricted
// replacement of the speaker's transcript. Every target must occur in this稿.
const ALIASES={'百年老人':'百廿老人','百念老人':'百廿老人','百二十年':'百廿年','李红章':'李鸿章','李洪章':'李鸿章','梁起超':'梁启超','梁其超':'梁启超','严富':'严复','闫复':'严复','李书同':'李叔同','蔡源培':'蔡元培','蔡原培':'蔡元培','傅增祥':'傅增湘','吕碧成':'吕碧城','张伯林':'张伯苓','北洋女室':'北洋女师','金钢桥':'金刚桥','天伟路':'天纬路','天维路':'天纬路','地伟路':'地纬路','地维路':'地纬路','地位路':'地纬路','日伟路':'日纬路','日维路':'日纬路','月伟路':'月纬路','月维路':'月纬路'};
const NAMES=['李鸿章','严复','梁启超','李叔同','蔡元培','柏拉图','达芬奇','达·芬奇','伽利略','愚公','智叟','傅增湘','张伯苓','吕碧城','邓颖超','盛宣怀','严修','严智开','张相文','拉斐尔','丢勒','精卫','百廿','北洋女师','直隶','利顺德','力学力行','新艺科','饮冰室','天演论','群己权界论','天纬路','地纬路'];
function clean(text){return String(text||'').normalize('NFKC').replace(/[\p{P}\p{Z}\s]/gu,'');}
function signature(script){let hash=2166136261;for(const c of JSON.stringify([script?.text||'',...(script?.blocks||[]).flatMap(b=>(b.sentences||[]).map(s=>s.trigger||''))]))hash=Math.imul(hash^c.charCodeAt(0),16777619);return (hash>>>0).toString(16);}
function build(script){
 const text=script?.text||'',sentences=(script?.blocks||[]).flatMap(b=>b.sentences||[]),phrases=[...sentences.filter(s=>s.replies?.length),...sentences.filter(s=>!s.replies?.length)].map(s=>s.trigger||s.text);
 const anchors=phrases.flatMap(p=>p.split(/[，。！？；：、\s]+/).filter(Boolean).map(p=>Array.from(p).slice(-10).join('')));
 const terms=[...NAMES.slice(0,24).filter(word=>text.includes(word)),...anchors,...NAMES.slice(24).filter(word=>text.includes(word))];
 return {hotwords:[...new Set(terms)].filter(w=>Array.from(w).length>=2).slice(0,100),aliases:Object.fromEntries(Object.entries(ALIASES).filter(([,target])=>text.includes(target))),characters:Array.from(text).length};
}
function repair(text,script,index){
 const blocks=script?.blocks||[],reference=Number.isInteger(index)?blocks.slice(Math.max(0,index-1),index+2).map(b=>b.source).join(''):script?.text||'';
 let result=String(text||'');for(const [from,to] of Object.entries(ALIASES))if(reference.includes(to))result=result.split(from).join(to);return result;
}
const api={build,repair,clean,signature};if(typeof module!=='undefined')module.exports=api;else root.SpeechCalibration=api;
})(globalThis);
