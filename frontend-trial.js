(function(root){
'use strict';
const storageKey='jinmen-front-end-trial-bubbles';let mode='colleague';try{mode=localStorage.getItem(storageKey)==='v42'?'v42':'colleague';}catch{}
let sceneKey='',history=new Map();
function clear(){history.clear();}
function set(value){if(!['v42','colleague'].includes(value))return false;mode=value;try{localStorage.setItem(storageKey,value);}catch{}clear();return true;}
function prepare(items,scene){if(sceneKey!==scene){sceneKey=scene;clear();}return items.map(item=>{if(mode!=='colleague'||item.message.chorus)return item;const old=history.get(item.id),m=item.message;
 if(old?.message!==m){const same=m.cueKey&&m.cueKey===old?.message.cueKey;history.set(item.id,{message:m,parts:same?[...old.parts,{text:item.text}]:[{text:item.text}]});}
 const parts=history.get(item.id).parts;return {...item,text:parts.map(p=>p.text).join('\n'),parts};});}
const api={mode:()=>mode,colleague:()=>mode==='colleague',set,prepare,clear,source:'6b029d24c321df2fa91bf40a4aaf0d528f3ea440',baseline:'v42-20260925-1817'};
if(typeof module!=='undefined')module.exports=api;else root.FrontendTrial=api;
})(globalThis);
