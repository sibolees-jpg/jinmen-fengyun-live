(function(root){
'use strict';
class RoundPipeline{
 constructor(client){this.client=client;this.pending=null;this.generation=0;this.inFlight=false;}
 canRequest(paused=false){return !paused&&!this.inFlight&&!this.client.busy&&!this.pending;}
 async request(text,options){
  if(!this.canRequest())return null;
  const generation=this.generation;this.inFlight=true;
  try{const round=await this.client.request(text,options);if(generation!==this.generation)return null;this.pending=round;return round;}
  finally{if(generation===this.generation)this.inFlight=false;}
 }
 take({presenting=false,paused=false}={}){if(presenting||paused)return null;const round=this.pending;this.pending=null;return round;}
 clear(){this.generation++;this.pending=null;this.inFlight=false;this.client.cancel();}
}
if(typeof module!=='undefined')module.exports={RoundPipeline};else root.RoundPipeline=RoundPipeline;
})(globalThis);
