const {test}=require('node:test');const assert=require('node:assert/strict');
const {RoundPipeline}=require('../round-pipeline.js');
function fixture(){let resolve,calls=0;const client={busy:false,cancel(){this.busy=false;},request(){calls++;this.busy=true;return new Promise(r=>resolve=round=>{this.busy=false;r(round);});}};return {p:new RoundPipeline(client),resolve:round=>resolve(round),calls:()=>calls};}
test('prepares a following round during presentation but buffers only one result',async()=>{
 const f=fixture(),round={messages:[{actor:0,text:'下一句'}]};
 const request=f.p.request('下一句',{});assert.equal(f.p.canRequest(),false);assert.equal(await f.p.request('第三句',{}),null);assert.equal(f.calls(),1);
 f.resolve(round);await request;assert.equal(f.p.canRequest(),false);assert.equal(f.p.take({presenting:true}),null);
 assert.equal(f.p.take({presenting:false}),round);assert.equal(f.p.canRequest(),true);assert.equal(f.p.take({presenting:false}),null);
});
test('pause holds buffered playback and clear rejects late responses',async()=>{
 const f=fixture();assert.equal(f.p.canRequest(true),false);
 const pending=f.p.request('过时的句子',{});f.p.clear();f.resolve({messages:[]});await pending;assert.equal(f.p.take({presenting:false}),null);
 const next=f.p.request('新句子',{});f.resolve({messages:['new']});await next;assert.equal(f.p.take({paused:true}),null);assert.deepEqual(f.p.take({paused:false}),{messages:['new']});f.p.clear();assert.equal(f.p.pending,null);
});
