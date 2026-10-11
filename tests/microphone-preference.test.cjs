const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {parseHTML}=require('linkedom');
const key='jinmen.microphone.preference.v1';
const mac={kind:'audioinput',deviceId:'mac',label:'MacBook Pro麦克风'};
const dji={kind:'audioinput',deviceId:'dji',label:'DJI MIC MINI'};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function fixture({devices=[mac,dji],storage=new Map(),enumerate}={}){
 const {document,window}=parseHTML(fs.readFileSync(path.join(__dirname,'../director.html'),'utf8'));
 Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return [...this.options].find(o=>o.hasAttribute('selected'))?.value||this.options[0]?.value||'';},set(value){for(const o of this.options){if(o.value===String(value))o.setAttribute('selected','');else o.removeAttribute('selected');}}});
 function Option(text,value){const option=document.createElement('option');option.textContent=text;option.value=value;return option;}
 let change;const starts=[];
 class Capture{
  constructor(options){this.options=options;this.active=false;this.starting=false;this.stopping=false;}
  start(deviceId,options={}){starts.push({deviceId,...options});this.active=true;this.monitorOnly=Boolean(options.monitorOnly);this.options.onState({mode:this.monitorOnly?'monitoring':'listening',message:'收音中'});}
  stop(){this.active=false;this.starting=false;this.stopping=false;this.options.onState({mode:'stopped',message:'已停止'});this.monitorOnly=false;}
  setProvider(){}
 }
 const scope={document,Option,SpeechCapture:Capture,AbortSignal,Date,setInterval(){},addEventListener(){},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},navigator:{mediaDevices:{enumerateDevices:async()=>enumerate?enumerate():devices,addEventListener(type,fn){if(type==='devicechange')change=fn;}}},fetch:async()=>({ok:true,json:async()=>({available:true})})};
 scope.performance=performance;scope.window=scope;vm.createContext(scope);
 for(const name of ['ui-patch.js','dictation-input.js','speech-director.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',name),'utf8'),scope,{filename:name});
 const controller=scope.setupSpeechDirector({send:()=>true,toast(){},getStatus:()=>({receivedAt:Date.now(),stageVersion:13}),getFinale:()=>false});
 const select=document.getElementById('microphone');await tick();
 return {controller,select,storage,starts,document,choose(value){select.value=value;select.onchange();},async devices(value){devices=value;await change();},change};
}

test('DJI is preferred, Mac remains selectable, and both capture buttons use the chosen device',async()=>{
 const f=await fixture();assert.equal(f.select.value,'dji');assert.deepEqual([...f.select.options].map(o=>o.value),['','mac','dji']);
 f.document.getElementById('microphone-test').onclick();assert.deepEqual(f.starts[0],{deviceId:'dji',monitorOnly:true});
 f.controller.capture.stop();await tick();f.document.getElementById('speech-toggle').onclick();assert.equal(f.starts[1].deviceId,'dji');
});
test('saved DJI survives a page reload and browser device ID changes',async()=>{
 const f=await fixture(),next=await fixture({storage:f.storage,devices:[mac,{...dji,deviceId:'reconnected-dji'}]});
 assert.equal(next.select.value,'reconnected-dji');
});
test('a reload with hidden device labels keeps the saved exact microphone instead of capturing the system default',async()=>{
 const f=await fixture(),next=await fixture({storage:f.storage,devices:[{kind:'audioinput',deviceId:'',label:''}]});
 assert.equal(next.select.value,'dji');assert.match(next.select.textContent,/待权限确认/);next.choose('dji');assert.equal(JSON.parse(next.storage.get(key)).label,'DJI MIC MINI');
 next.document.getElementById('microphone-test').onclick();assert.equal(next.starts[0].deviceId,'dji');
});
test('unplugged DJI uses Mac while idle, retains the preference, and restores DJI on reconnect',async()=>{
 const f=await fixture();await f.devices([mac]);assert.equal(f.select.value,'mac');assert.equal(JSON.parse(f.storage.get(key)).label,'DJI MIC MINI');
 await f.devices([mac,dji]);assert.equal(f.select.value,'dji');assert.equal(f.starts.length,0);
});
test('device changes do not switch, stop or restart an active capture',async()=>{
 const f=await fixture();f.document.getElementById('microphone-test').onclick();await f.devices([mac]);
 assert.equal(f.select.value,'dji');assert.equal(f.controller.capture.active,true);assert.equal(f.starts.length,1);
 f.controller.capture.stop();await tick();assert.equal(f.select.value,'mac');assert.equal(f.starts.length,1);
});
test('manual Mac backup and system-default choices persist instead of being overwritten by DJI',async()=>{
 const f=await fixture();f.choose('mac');await f.devices([mac,dji]);assert.equal(f.select.value,'mac');
 const next=await fixture({storage:f.storage});assert.equal(next.select.value,'mac');
 next.choose('');const last=await fixture({storage:f.storage});assert.equal(last.select.value,'');
});
test('a pending enumeration cannot override a later manual choice or start-time selection',async()=>{
 let resolve,slow=false;const f=await fixture({enumerate:()=>slow?new Promise(r=>resolve=r):[mac,dji]});
 slow=true;const pending=f.change();f.choose('mac');resolve([mac,dji]);await pending;assert.equal(f.select.value,'mac');
 const again=f.change();f.document.getElementById('microphone-test').onclick();resolve([dji]);await again;
 assert.equal(f.select.value,'mac');assert.equal(f.starts[0].deviceId,'mac');
});
test('permission-hidden device labels are refreshed after local testing without switching a running stream',async()=>{
 const f=await fixture({devices:[{kind:'audioinput',deviceId:'',label:''}]});assert.equal(f.select.value,'');
 f.document.getElementById('microphone-test').onclick();await f.devices([mac,dji]);assert.equal(f.select.value,'');
 f.controller.capture.stop();await tick();assert.equal(f.select.value,'dji');
});
test('blocked or invalid local storage does not prevent device selection or capture',async()=>{
 const invalid=new Map([[key,'not-json']]),f=await fixture({storage:invalid});assert.equal(f.select.value,'dji');
 const blocked={get(){throw Error('unavailable');},set(){throw Error('unavailable');}},g=await fixture({storage:blocked});
 g.choose('mac');g.document.getElementById('microphone-test').onclick();assert.equal(g.starts[0].deviceId,'mac');
});
