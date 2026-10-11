(function(root){
'use strict';
// A recognised cue is not a played cue. Keep cancellation and presentation separate.
class CueLedger{
 constructor(){this.records=new Map();}
 has(key){return ['queued','playing','played','interrupted','skipped'].includes(this.records.get(key)?.state);}
 reserve(key,count,{force=false}={}){if(!force&&this.has(key))return false;this.records.set(key,{key,state:'queued',count,started:[],finished:[]});return true;}
 start(key,line){const r=this.records.get(key);if(!r||r.state!=='queued'&&r.state!=='playing')return;if(!r.started.includes(line))r.started.push(line);r.state='playing';}
 finish(key,line){const r=this.records.get(key);if(!r||r.state!=='playing')return;if(!r.finished.includes(line))r.finished.push(line);if(r.finished.length>=r.count)r.state='played';}
 cancel(){for(const r of this.records.values()){if(r.state==='queued')r.state='cancelled';else if(r.state==='playing')r.state='interrupted';}}
 clear(){this.records.clear();}
 snapshot(){return [...this.records.values()].map(r=>({key:r.key,state:r.state,completed:r.finished.length,total:r.count}));}
}
if(typeof module!=='undefined')module.exports={CueLedger};else root.CueLedger=CueLedger;
})(globalThis);
