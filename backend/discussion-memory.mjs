import {canRecallTogether} from './discussion-context.mjs';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
const ACTORS=new Map([[0,'梁启超'],[1,'李鸿章'],[2,'严复'],[3,'李叔同'],[4,'蔡元培'],[5,'柏拉图'],[6,'达芬奇'],[8,'愚公']]);
const dateFormat=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'});
const validId=v=>typeof v==='string'&&v.length>0&&v.length<=200;
function tokens(t){const s=String(t).toLowerCase();return new Set([...(s.match(/[a-z]{3,}/g)||[]),...Array.from({length:Math.max(0,s.length-1)},(_,i)=>s.slice(i,i+2)).filter(t=>/[\p{Script=Han}]{2}/u.test(t))]);}
export class DiscussionMemory {
 constructor(filename,{now=Date.now}={}){
  this.now=now;if(filename!==':memory:')mkdirSync(path.dirname(filename),{recursive:true,mode:0o700});
  this.db=new DatabaseSync(filename);this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=2000;
   CREATE TABLE IF NOT EXISTS events(seq INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT NOT NULL UNIQUE,session TEXT NOT NULL,round_id TEXT NOT NULL DEFAULT '',kind TEXT NOT NULL,actor INTEGER,text TEXT NOT NULL,topic TEXT NOT NULL DEFAULT '',at TEXT NOT NULL,day TEXT NOT NULL,saved_at TEXT NOT NULL,scene_id TEXT NOT NULL DEFAULT '',scene_name TEXT NOT NULL DEFAULT '',continuation INTEGER NOT NULL DEFAULT 0);
   CREATE INDEX IF NOT EXISTS memory_actor_day ON events(actor,day,seq);
   CREATE INDEX IF NOT EXISTS memory_day ON events(day,seq);
   CREATE INDEX IF NOT EXISTS memory_round ON events(session,round_id,kind);
   CREATE TRIGGER IF NOT EXISTS memory_no_update BEFORE UPDATE ON events BEGIN SELECT RAISE(ABORT,'Memory records are append-only'); END;
   CREATE TRIGGER IF NOT EXISTS memory_no_delete BEFORE DELETE ON events BEGIN SELECT RAISE(ABORT,'Memory records are append-only'); END;`);
 }
 add(value){
  if(!value||!validId(value.id)||!validId(value.session)||typeof value.text!=='string'||!value.text.trim()||value.text.length>2000||!['audience','role'].includes(value.kind)||value.kind==='role'&&(!ACTORS.has(value.actor)||!validId(value.roundId)||value.text.length>80))throw Error('记忆记录格式无效');
  const timestamp=value.at===undefined?this.now():Date.parse(value.at);if(!Number.isFinite(timestamp))throw Error('记录时间无效');
  const existing=this.db.prepare('SELECT session,kind,actor,text,round_id,topic FROM events WHERE id=?').get(value.id);
  if(existing&&(existing.session!==value.session||existing.kind!==value.kind||existing.actor!==(value.kind==='role'?value.actor:null)||existing.text!==value.text.trim()||existing.round_id!==(value.kind==='role'?value.roundId:'')||existing.topic!==String(value.topic||'').slice(0,2000)))throw Error('记录编号已用于不同内容');
  const at=new Date(timestamp).toISOString();
  this.db.prepare('INSERT OR IGNORE INTO events(id,session,round_id,kind,actor,text,topic,at,day,saved_at,scene_id,scene_name,continuation) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(value.id,value.session,value.kind==='role'?value.roundId:'',value.kind,value.kind==='role'?value.actor:null,value.text.trim(),String(value.topic||'').slice(0,2000),at,dateFormat.format(timestamp),new Date(this.now()).toISOString(),String(value.sceneId||'').slice(0,200),String(value.sceneName||'').slice(0,200),value.continuation===true?1:0);
 }
 filter({actor,date,from,to,before}={}){
  const parts=[],args=[];
  if(actor!==undefined&&actor!==''){const n=Number(actor);if(n===-1)parts.push("kind='audience'");else{if(!ACTORS.has(n))throw Error('人物无效');parts.push('actor=?');args.push(n);}}
  for(const [value,op] of [[date,'='],[from,'>='],[to,'<=']])if(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('日期格式无效');parts.push('day'+op+'?');args.push(value);}
  if(before!==undefined&&before!==''){const n=Number(before);if(!Number.isSafeInteger(n)||n<1)throw Error('分页位置无效');parts.push('seq<?');args.push(n);}
  return {where:parts.length?' WHERE '+parts.join(' AND '):'',args};
 }
 decorate(row){
  const peers=row.kind==='role'?this.db.prepare("SELECT actor,text,at FROM events WHERE session=? AND round_id=? AND kind='role' AND actor<>? ORDER BY seq").all(row.session,row.round_id,row.actor):[];
  return {seq:row.seq,id:row.id,session:row.session,roundId:row.round_id,kind:row.kind,actor:row.actor,speaker:ACTORS.get(row.actor)||'现场发言者（未识别身份）',text:row.text,topic:row.topic,at:row.at,date:row.day,savedAt:row.saved_at,sceneId:row.scene_id,sceneName:row.scene_name,continuation:Boolean(row.continuation),with:peers.map(p=>({actor:p.actor,name:ACTORS.get(p.actor),text:p.text,at:p.at}))};
 }
 list(options={}){const {where,args}=this.filter(options),limit=Math.min(100,Math.max(1,Math.floor(Number(options.limit)||50)));const rows=this.db.prepare('SELECT * FROM events'+where+' ORDER BY seq DESC LIMIT ?').all(...args,limit+1);return {entries:rows.slice(0,limit).map(r=>this.decorate(r)),next:rows.length>limit?rows[limit-1].seq:null};}
 *export(options={}){const {where,args}=this.filter(options);for(const row of this.db.prepare('SELECT * FROM events'+where+' ORDER BY seq').iterate(...args))yield this.decorate(row);}
 // Model callers receive a fixed owner-scoped reader, never the administrator
 // list/export API. Peers are included only from rounds this owner attended.
 recall(actor,text,{limit=3,participants=[actor]}={}){
  if(!ACTORS.has(actor))return [];
  const q=tokens(text),ranked=[],seen=new Set(),cap=Math.min(3,Math.max(1,Number(limit)||3));
  for(const row of this.db.prepare("SELECT * FROM events WHERE actor=? AND kind='role' ORDER BY seq DESC").iterate(actor)){
   const key=JSON.stringify([row.session,row.round_id]);if(seen.has(key))continue;seen.add(key);
   const e=this.decorate(row),members=[actor,...e.with.map(p=>p.actor)];
   // A private memory cannot be retold into a group containing a new listener.
   if(!canRecallTogether(actor,members,participants))continue;
   const score=[...tokens(e.topic+' '+e.text+' '+e.with.map(p=>p.text).join(' '))].filter(t=>q.has(t)).length;
   ranked.push({score,seq:e.seq,value:{date:e.date,actor,topic:e.topic,text:e.text,session:e.session,roundId:e.roundId,participants:members,companions:e.with.map(p=>p.name),exchange:[{actor,name:ACTORS.get(actor),text:e.text,at:e.at},...e.with].sort((a,b)=>a.at.localeCompare(b.at))}});
   ranked.sort((a,b)=>b.score-a.score||b.seq-a.seq);ranked.length=Math.min(cap,ranked.length);
  }
  const relevant=ranked.filter(r=>r.score>0);
  // A request to recall a previous conversation may have no exact topic words.
  return (relevant.length?relevant:ranked).map(r=>r.value);
 }
 historyFor(session,roundIds=[]){
  if(!validId(session))return [];
  const history=[];
  for(const id of [...new Set(roundIds.filter(validId))].slice(-8)){
   const rows=this.db.prepare("SELECT actor,text,topic FROM events WHERE session=? AND round_id=? AND kind='role' ORDER BY seq").all(session,id);
   if(rows.length)history.push({role:'user',content:rows[0].topic},{role:'assistant',memoryRoundId:id,content:JSON.stringify({messages:rows.map(({actor,text})=>({actor,text}))})});
  }
  return history;
 }

 status(){const s=this.db.prepare('SELECT COUNT(*) count,MAX(saved_at) lastSavedAt,MIN(day) firstDay,MAX(day) lastDay FROM events').get();return {...s,timezone:'Asia/Shanghai',persistent:true,isolation:'participants-v2',appendOnly:true};}
 close(){this.db.close();}
}
// Record a role only after the active stage reports its bubble visible. Merely
// generated, queued, cancelled or hidden replies never become personal memory.
export class MemoryRecorder {
 constructor(getStore,{now=Date.now}={}){this.getStore=getStore;this.now=now;this.rounds=new Map();this.pending=new Map();this.error='';}
 observe(direction,stageId,message){
  if(!message||typeof message!=='object')return;
  if(direction==='command'&&message.action==='live-present'&&validId(message.id)&&validId(message.session)&&Array.isArray(message.messages)&&message.messages.length<=2){
   const key=stageId+':'+message.session+':'+message.id;
   if(!this.rounds.has(key))this.rounds.set(key,{...message,seen:new Set()});
   if(this.rounds.size>500)this.rounds.delete(this.rounds.keys().next().value);
  }
  if(direction!=='status'||message.realtime?.loading||message.realtime?.error)return;
  const r=this.rounds.get(stageId+':'+message.realtime?.session+':'+message.realtime?.lastId);if(!r)return;
  for(const a of Array.isArray(message.actors)?message.actors:[]){if(!a||typeof a!=='object')continue;const m=r.messages.find(m=>m&&typeof m.text==='string'&&m.actor===a.id&&m.text.trim()===a.text);if(!m||a.phase!=='speaking'||a.captionVisible!==true||r.seen.has(a.id))continue;r.seen.add(a.id);
   const event={id:'role:'+r.session+':'+r.id+':'+a.id,session:validId(r.memorySession)?r.memorySession:r.session,roundId:r.id,kind:'role',actor:a.id,text:a.text,topic:r.input||'',continuation:r.continuation===true,sceneId:message.scenery?.activeId||r.sceneId,sceneName:message.scenery?.activeName||'',at:new Date(this.now()).toISOString()};this.pending.set(event.id,event);
  }
  this.flush();
 }
 flush(){if(!this.pending.size)return;try{const store=this.getStore();for(const [id,event] of this.pending){store.add(event);this.pending.delete(id);}this.error='';}catch{this.error='记忆尚未写入磁盘，正在重试；请勿关闭服务。';}}
 status(){try{return {...this.getStore().status(),pending:this.pending.size,error:this.error};}catch{return {persistent:false,pending:this.pending.size,error:'记忆数据库暂不可用，请检查磁盘空间与写入权限。'};}}
}
