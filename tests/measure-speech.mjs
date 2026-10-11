import {spawn} from 'node:child_process';
import {SpeechService} from '../backend/speech.mjs';
import {readFileSync} from 'node:fs';
const rate=48000,step=4096,source=readFileSync(process.argv[2]);
const speech=new SpeechService({spawnImpl:(binary,args,options)=>spawn(process.argv[3]||binary,args,options)});const events=[];
try{
 const session=await speech.start(rate);const start=performance.now();
 speech.subscribe(session.id,e=>{if(e.type==='transcript')events.push({ms:Math.round(performance.now()-start),...e});});
 const pcm=Buffer.concat([source,Buffer.alloc(rate*4*4)]);
 for(let i=0;i<pcm.length;i+=step){speech.audio(session.id,pcm.subarray(i,i+step));const wait=(i+step)/4/rate*1000-(performance.now()-start);if(wait>0)await new Promise(r=>setTimeout(r,wait));}
 speech.stop(session.id);await new Promise(r=>setTimeout(r,1500));
 const partials=events.filter(e=>!e.final&&e.text.trim()),finals=events.filter(e=>e.final);
 console.log(JSON.stringify({audioMs:Math.round(source.length/4/rate*1000),firstPartialMs:partials[0]?.ms,partialCount:partials.length,firstFinalMs:finals[0]?.ms,finals:finals.map(e=>({ms:e.ms,text:e.text}))},null,2));
 if(!partials.length||!finals.length)process.exitCode=1;
}finally{speech.close();}
