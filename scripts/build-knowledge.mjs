import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=f=>JSON.parse(readFileSync('knowledge/'+f,'utf8'));
const sources=read('sources.json'),profiles=read('profiles.json'),cards=read('study-cards.json');
const chunks=[];
for(const s of sources.filter(s=>s.enabled)){
 const text=readFileSync('knowledge/'+s.file,'utf8');
 if(createHash('sha256').update(text).digest('hex')!==s.sha256)throw Error('Source checksum changed: '+s.id);
 const size=s.language==='en'?1300:650;
 let offset=0,n=0;
 while(offset<text.length){
  let end=Math.min(text.length,offset+size);
  if(end<text.length){const part=text.slice(offset,end),boundary=Math.max(part.lastIndexOf('\n\n'),part.lastIndexOf('。')+1,part.lastIndexOf('. ')+1);if(boundary>size*.5)end=offset+boundary;}
  const passage=text.slice(offset,end).trim();
  if(passage)chunks.push({id:s.id+'#'+(++n),sourceId:s.id,actorId:s.actorId,scope:s.scope,offset,end,text:passage});
  offset=end;
 }
}
for(const c of cards)if(!sources.some(s=>s.id===c.sourceId&&s.enabled))throw Error('Unbound study card: '+c.id);
for(const p of profiles)if(!sources.some(s=>s.actorId===p.actorId&&s.enabled))throw Error('Missing role sources: '+p.name);
const version='knowledge-20260927-v1';
const manifest={version,createdAt:'2026-09-27',mode:'retrieval-not-finetuning',domain:'新医科',actors:profiles.length,sources:sources.filter(s=>s.enabled).length,works:new Set(sources.filter(s=>s.enabled).map(s=>s.parent)).size,chunks:chunks.length,characters:sources.reduce((n,s)=>n+(s.enabled?s.characters:0),0),indexSha256:createHash('sha256').update(JSON.stringify(chunks)).digest('hex')};
writeFileSync('knowledge/index.json',JSON.stringify(chunks)+'\n');
writeFileSync('knowledge/manifest.json',JSON.stringify(manifest,null,2)+'\n');
const catalog=read('candidates.json');catalog.status='已按用户授权选择，接入实时知识版；演讲终版不变';catalog.domain_confirmation='按用户原词启用新医科；新艺科资料暂缓，不混入。';
for(const item of catalog.items){const ingested=sources.filter(s=>s.parent===item.id&&s.enabled);item.enabled=!!ingested.length;item.ingested=!!ingested.length;item.decision=ingested.length?'已接入':'暂缓';item.ingestion=ingested.map(s=>({id:s.id,section:s.section,kind:s.kind,file:s.file}));if(!ingested.length)item.reason=item.id.startsWith('NA')?'新艺科与原请求新医科不同，暂不混入':item.id==='NM02'?'本批先用已核实的国务院新医科指导意见':'原文、具体篇目或现代版权版本尚未核妥，不以目录或简介冒充全文';}
writeFileSync('knowledge/candidates.json',JSON.stringify(catalog,null,2)+'\n');
console.log(manifest);
