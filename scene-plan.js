(function(root){
'use strict';
const scenes=[{id:'jinmen-blue',name:'津门街景 · 青蓝',image:'assets/backgrounds/jinmen-street-blue-v1.png'},{id:'jinmen-ink',name:'津门街景 · 水墨',image:'assets/backgrounds/jinmen-ink-v1.png'},{id:'courtyard',name:'庭院',image:'assets/backgrounds/courtyard.png'}];
const api={scenes,resolve:id=>scenes.find(v=>v.id===id)||scenes[0]};
if(typeof module!=='undefined')module.exports=api;else root.ScenePlan=api;
})(globalThis);
