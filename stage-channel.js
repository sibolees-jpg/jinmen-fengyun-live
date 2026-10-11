(function(root){
'use strict';
// One local relay owns the active screen, including across browser windows.
class StageChannel{
 constructor(role){this.role=role;this.listeners=new Set();this.onmessage=null;this.connected=false;this.active=false;this.closed=false;this.retry=0;this.connect();}
 connect(){
  const url=new URL('/api/stage-channel',location.href);url.protocol=location.protocol==='https:'?'wss:':'ws:';url.searchParams.set('role',this.role);if(this.role==='stage'&&this.hasConnected&&!this.preferred)url.searchParams.set('standby','1');
  const socket=this.socket=new WebSocket(url);
  socket.onmessage=({data})=>{if(socket!==this.socket)return;let value;try{value=JSON.parse(data);}catch{return;}
   if(value.type==='channel-state'){this.connected=true;this.hasConnected=true;this.preferred=value.active;this.active=value.active;this.stageId=value.stageId;this.retry=0;document.documentElement.dataset.stageConnection=value.active?'active':'standby';}
   this.dispatch(value);
  };
  socket.onerror=()=>{};
  socket.onclose=()=>{if(socket!==this.socket)return;this.connected=false;this.active=false;this.dispatch({type:'channel-state',active:false,connected:false,stageId:null});if(!this.closed)this.timer=setTimeout(()=>this.connect(),Math.min(5000,500*2**this.retry++));};
 }
 dispatch(data){const event={data};this.onmessage?.(event);for(const fn of this.listeners)fn(event);}
 postMessage(message){if(!this.connected||this.socket.readyState!==1)return false;this.socket.send(JSON.stringify(message));return true;}
 addEventListener(type,fn){if(type==='message')this.listeners.add(fn);}
 removeEventListener(type,fn){if(type==='message')this.listeners.delete(fn);}
 close(){this.closed=true;clearTimeout(this.timer);this.socket.close();}
}
root.StageChannel=StageChannel;
})(globalThis);
