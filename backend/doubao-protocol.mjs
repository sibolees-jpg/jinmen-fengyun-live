import {gzipSync,gunzipSync} from 'node:zlib';
export function packet(type,payload,{last=false,json=false,sequence}={}){
 const compressed=gzipSync(json?Buffer.from(JSON.stringify(payload)):payload),flags=(last?2:0)+(Number.isInteger(sequence)?1:0),head=Buffer.from([0x11,(type<<4)|flags,(json?0x10:0)|1,0]);
 const prefix=Buffer.alloc(Number.isInteger(sequence)?8:4);let offset=0;if(Number.isInteger(sequence)){prefix.writeInt32BE(last?-Math.abs(sequence):sequence);offset=4;}prefix.writeUInt32BE(compressed.length,offset);
 return Buffer.concat([head,prefix,compressed]);
}
export function decode(buffer){
 const b=Buffer.from(buffer);if(b.length<8||(b[0]>>4)!==1)throw new Error('Invalid ASR frame');
 const type=b[1]>>4,flags=b[1]&15,serialization=b[2]>>4,compression=b[2]&15;let offset=(b[0]&15)*4,sequence=null,code=null;
 if(offset<4||offset+4>b.length)throw new Error('Invalid ASR header');
 if(type===15){code=b.readUInt32BE(offset);offset+=4;}else if(flags&1){sequence=b.readInt32BE(offset);offset+=4;}
 if(offset+4>b.length)throw new Error('Missing ASR payload');const size=b.readUInt32BE(offset);offset+=4;
 if(size>1024*1024||offset+size!==b.length)throw new Error('Invalid ASR payload size');
 let data=b.subarray(offset);if(compression===1)data=gunzipSync(data,{maxOutputLength:1024*1024});else if(compression!==0)throw new Error('Unsupported ASR compression');
 return {type,last:Boolean(flags&2),sequence,code,data:serialization===1?JSON.parse(data.toString('utf8')):data.toString('utf8')};
}
// A streaming box-filter resampler retains fractional sample weights between
// browser chunks. It never resets the phase at chunk boundaries.
export class PCM16Resampler{
 constructor(rate){if(![16000,24000,44100,48000].includes(rate))throw new Error('Unsupported sample rate');this.ratio=rate/16000;this.weight=0;this.sum=0;}
 push(buffer){
  if(!buffer.length||buffer.length%4)throw new Error('Invalid float PCM');const out=[];
  for(let i=0;i<buffer.length;i+=4){let value=buffer.readFloatLE(i),remaining=1;if(!Number.isFinite(value))value=0;value=Math.max(-1,Math.min(1,value));
   while(remaining>1e-8){const part=Math.min(remaining,this.ratio-this.weight);this.sum+=value*part;this.weight+=part;remaining-=part;if(this.weight>=this.ratio-1e-8){const sample=this.sum/this.ratio;out.push(Math.round(sample*(sample<0?32768:32767)));this.weight=0;this.sum=0;}}
  }
  const pcm=Buffer.alloc(out.length*2);out.forEach((v,i)=>pcm.writeInt16LE(v,i*2));return pcm;
 }
}
// Full responses repeat earlier utterances. Timestamp identity prevents replay,
// and definite utterances (not the end-of-WebSocket flag) commit each sentence.
export class TranscriptAssembler{
 constructor(){this.done=new Set();this.lastInterim='';this.committed='';}
 accept(payload,last=false){
  const result=payload.result||{},utterances=Array.isArray(result.utterances)?result.utterances:[],events=[];let draft='';
  for(const u of utterances){if(typeof u.text!=='string')continue;const key=Number.isFinite(u.start_time)?String(u.start_time):`${u.end_time}:${u.text}`;
   if(this.done.has(key))continue;if(u.definite===true||last){this.done.add(key);this.committed+=u.text;events.push({text:u.text,final:true});}else draft+=u.text;
  }
  if(!utterances.length&&typeof result.text==='string'){draft=result.text.startsWith(this.committed)?result.text.slice(this.committed.length):result.text;if(last&&draft){events.push({text:draft,final:true});this.committed+=draft;draft='';}}
  if(draft&&draft!==this.lastInterim)events.push({text:draft,final:false});this.lastInterim=draft;
  return events;
 }
}
