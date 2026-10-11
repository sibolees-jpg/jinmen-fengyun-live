(function(root){
'use strict';
const scope='jinmen-scene-block';
function enabled(scene){return scene?.visualMode!=='static-cast'&&scene?.sceneBlock?.enabled===true&&!(scene?.composition?.enabled===true&&scene.composition.freeLayout===true);}
function validAnchors(value){const out={};for(const [id,a] of Object.entries(value||{})){if(!/^[0-8]$/.test(id)||!Array.isArray(a?.box)||a.box.length!==4||!Array.isArray(a.head)||a.head.length!==2||![...a.box,...a.head].every(n=>Number.isFinite(n)&&Math.abs(n)<1000)||a.box[2]<=a.box[0]||a.box[3]<=a.box[1])continue;out[id]={box:a.box.slice(),head:a.head.slice(),...(Array.isArray(a.silhouette)?{silhouette:a.silhouette.filter(b=>Array.isArray(b)&&b.length===4&&b.every(n=>Number.isFinite(n)&&Math.abs(n)<1000)&&b[2]>0&&b[3]>0).slice(0,64)}:{})};}return out;}
class Block{
 constructor(host,{preview=false,onAnchors=()=>{},timeout=18000}={}){this.host=host;this.preview=preview;this.onAnchors=onAnchors;this.timeout=timeout;this.active=null;this.pending=null;this.counter=0;this.listener=e=>this.receive(e);root.addEventListener('message',this.listener);}
 prepare(scene){
  if(!enabled(scene)){this.cancel();return Promise.resolve();}
  const key=scene.id+'|'+scene.sceneBlock.code+'|'+scene.sceneBlock.revision;
  if(this.active?.key===key)return Promise.resolve();if(this.pending?.key===key)return this.pending.promise;
  this.cancel();const frame=this.host.ownerDocument.createElement('iframe'),token=String(Date.now())+'-'+(++this.counter)+'-'+Math.random().toString(36).slice(2),code=scene.sceneBlock.code;
  frame.className='scene-block-frame';frame.title=code+' · 场景人物动画';frame.tabIndex=-1;frame.setAttribute('aria-hidden','true');frame.setAttribute('allow','camera \'none\'; microphone \'none\'; fullscreen \'none\'');Object.assign(frame.style,{position:'absolute',inset:'0',width:'100%',height:'100%',border:'0',pointerEvents:'none',opacity:'0',zIndex:'40'});
  const entry={key,sceneId:scene.id,code,token,frame,anchors:{},ready:false};entry.promise=new Promise((resolve,reject)=>{entry.resolve=resolve;entry.reject=reject;});entry.timer=setTimeout(()=>this.fail(entry,'动态场景加载超时，已保留原画面'),this.timeout);this.pending=entry;
  frame.src='/integration/scene-block/frame.html?code='+encodeURIComponent(code)+'&token='+encodeURIComponent(token);this.host.append(frame);return entry.promise;
 }
 fail(entry,message){if(this.pending!==entry)return;clearTimeout(entry.timer);entry.frame.remove();this.pending=null;entry.reject(Error(message));}
 receive(e){if(e.origin!==root.location.origin||e.data?.scope!==scope||e.data.version!==1)return;const m=e.data,entry=[this.pending,this.active].find(p=>p&&p.frame.contentWindow===e.source&&p.token===m.token&&p.code===m.code);if(!entry)return;
  if(m.type==='error'){if(entry===this.pending)this.fail(entry,m.message||'场景加载失败');return;}
  if(!['ready','anchors'].includes(m.type))return;entry.anchors=validAnchors(m.anchors);entry.frames=m.frames||entry.frames||0;entry.animation=m.animation||entry.animation;
  if(m.type==='ready'&&!entry.ready){entry.ready=true;clearTimeout(entry.timer);entry.resolve();}
  if(entry===this.active)this.onAnchors(entry.anchors);
 }
 commit(scene){if(!enabled(scene)){this.cancel();this.active?.frame.remove();this.active=null;return;}
  const key=scene.id+'|'+scene.sceneBlock.code+'|'+scene.sceneBlock.revision;if(this.active?.key===key)return;
  const next=this.pending;if(next?.key!==key||!next.ready)throw Error('动态场景尚未准备完成');this.active?.frame.remove();this.active=next;this.pending=null;next.frame.style.opacity='1';this.onAnchors(next.anchors);
 }
 layout(rect){for(const e of [this.active,this.pending])if(e)Object.assign(e.frame.style,{inset:'auto',left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px'});}
 update(actors,paused){if(!this.active)return;const e=this.active;e.frame.contentWindow.postMessage({scope:'jinmen-scene-host',version:1,type:'state',token:e.token,code:e.code,paused:paused||this.preview,actors:actors.map(a=>({id:a.id,phase:a.phase,captionBlocked:a.captionBlocked,message:a.message?{text:a.message.text,actionOnly:a.message.actionOnly}:null}))},root.location.origin);}
 snapshot(){return {activeCode:this.active?.code||'',pendingCode:this.pending?.code||'',frames:this.active?.frames||0,anchors:Object.keys(this.active?.anchors||{}).map(Number),animation:this.active?.animation};}
 cancel(){const p=this.pending;if(!p)return;this.pending=null;clearTimeout(p.timer);p.frame.remove();p.reject(Error('场景加载已取消'));}
 destroy(){this.cancel();this.active?.frame.remove();this.active=null;root.removeEventListener('message',this.listener);}
}
const api={Block,enabled,validAnchors};if(typeof module!=='undefined')module.exports=api;else root.JinmenSceneBlock=api;
})(globalThis);
