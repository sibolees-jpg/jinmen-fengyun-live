import {WebSocketServer,WebSocket} from 'ws';
import {randomUUID} from 'node:crypto';
export function attachStageChannel(server,{observe=()=>{}}={}){
 const relay=new WebSocketServer({noServer:true,maxPayload:30*1024*1024}),peers=new Set();let primary=null;
 const send=(peer,value)=>{if(peer.readyState===WebSocket.OPEN)peer.send(JSON.stringify(value));};
 const directors=value=>{for(const peer of peers)if(peer.role==='director')send(peer,value);};
 function announce(){for(const peer of peers)send(peer,{type:'channel-state',connected:true,active:peer.role==='director'?Boolean(primary):peer===primary,stageId:primary?.id||null});}
 function promote(peer){primary=peer;announce();send(peer,{type:'command',action:'hello'});directors({type:'stage-ready',stageId:peer.id});}
 server.on('upgrade',(req,socket,head)=>{
  const host=req.headers.host||'',origin=req.headers.origin;let url;try{url=new URL(req.url,'http://'+(host||'localhost'));}catch{socket.destroy();return;}
  if(url.pathname!=='/api/stage-channel'||!['stage','director'].includes(url.searchParams.get('role'))||! /^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)||origin!==`http://${host}`){socket.destroy();return;}
  relay.handleUpgrade(req,socket,head,peer=>{peer.role=url.searchParams.get('role');peer.id=randomUUID();peer.alive=true;peers.add(peer);
   peer.on('pong',()=>peer.alive=true);
   peer.on('message',raw=>{let value;try{value=JSON.parse(raw);}catch{return;}if(!value||typeof value!=='object')return;
    if(peer.role==='stage'){
     if(value.type==='stage-takeover'){promote(peer);return;}
     if(peer!==primary)return;
     if(value.type==='status')observe('status',peer.id,value);
     if(['status','stage-ready','finale-status','finale-error','voice-overflow'].includes(value.type))directors({...value,stageId:peer.id});
    }else if(value.type==='command'&&primary){
     // Commands tied to a disconnected screen must never reach its replacement.
     if(value.stageId&&value.stageId!==primary.id)return;
     observe('command',primary.id,value);send(primary,value);
    }else if(value.type==='rehearsal-sync'){for(const other of peers)if(other!==peer)send(other,value);}
   });
   peer.on('close',()=>{peers.delete(peer);if(peer===primary){primary=null;announce();} });
   peer.on('error',()=>{});
   if(peer.role==='stage'&&!primary&&url.searchParams.get('standby')!=='1')promote(peer);else{send(peer,{type:'channel-state',connected:true,active:peer.role==='director'?Boolean(primary):false,stageId:primary?.id||null});if(peer.role==='director'&&primary)send(primary,{type:'command',action:'hello'});}
  });
 });
 const pulse=setInterval(()=>{if(primary)send(primary,{type:'command',action:'stage-pulse'});},1000);pulse.unref();
 const heartbeat=setInterval(()=>{for(const peer of peers){if(!peer.alive){peer.terminate();continue;}peer.alive=false;peer.ping();}},3000);heartbeat.unref();
 server.on('close',()=>{clearInterval(heartbeat);clearInterval(pulse);for(const peer of peers)peer.terminate();relay.close();});
 return {close(){clearInterval(heartbeat);clearInterval(pulse);for(const peer of peers)peer.terminate();relay.close();}};
}
