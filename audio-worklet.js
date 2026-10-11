class SpeechPCM extends AudioWorkletProcessor{
 constructor(){super();this.samples=new Float32Array(4096);this.used=0;this.port.onmessage=({data})=>{if(data==='flush'){this.flush();this.port.postMessage({flushed:true});}};}
 flush(){if(!this.used)return;const buffer=this.samples.slice(0,this.used),rms=Math.sqrt(buffer.reduce((sum,n)=>sum+n*n,0)/buffer.length);this.port.postMessage({audio:buffer.buffer,rms,peak:buffer.reduce((peak,n)=>Math.max(peak,Math.abs(n)),0)},[buffer.buffer]);this.used=0;}
 process(inputs){const channels=inputs[0];if(!channels?.length)return true;for(let i=0;i<channels[0].length;i++){let value=0;for(const channel of channels)value+=channel[i];this.samples[this.used++]=value/channels.length;if(this.used===this.samples.length)this.flush();}return true;}
}
registerProcessor('speech-pcm',SpeechPCM);
