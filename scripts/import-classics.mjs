// Explicit, reproducible import. Never runs during a performance or server startup.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {parseHTML} from 'linkedom';
const run=promisify(execFile), sources=JSON.parse(readFileSync('knowledge/sources.json','utf8'));
mkdirSync('tmp/knowledge-import',{recursive:true});mkdirSync('knowledge/texts',{recursive:true});
const normalize=s=>s.replace(/\r/g,'').replace(/[ \t\u00a0]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim();
async function ingest(s){
 if(s.kind==='editorial_brief')return;
 const cache=`tmp/knowledge-import/${s.id}.html`;
 if(!existsSync(cache))await run('curl',['-fsSL','--retry','1','--max-time','40',...(process.env.HTTPS_PROXY?['--proxy',process.env.HTTPS_PROXY]:[]),new URL(s.url).href,'-o',cache],{maxBuffer:2e6});
 const {document}=parseHTML(new TextDecoder(s.parser==='bfnn'?'gb18030':'utf-8').decode(readFileSync(cache)));
 let el=(s.parser==='gutenberg'||s.parser==='bfnn'?document.body:[...document.querySelectorAll('.mw-parser-output')].sort((a,b)=>b.textContent.length-a.textContent.length)[0]);
 if(!el)throw Error(s.id+': missing article');
 el.querySelectorAll('script,style,nav,.licenseContainer,.mw-editsection,.ws-header,.headertemplate,.printfooter,.metadata,.noprint,.catlinks,header,footer,#pg-header,#pg-footer').forEach(n=>n.remove());
 let text;
 if(s.parser==='gutenberg'){
  if(s.startHeading){
   const hs=[...el.querySelectorAll('h1,h2,h3')];
   const start=hs.filter(n=>normalize(n.textContent)===s.startHeading).at(-1);
   if(!start)throw Error(s.id+': missing body heading '+s.startHeading);
   const range=[];let keep=false;
   for(const n of el.querySelectorAll('h1,h2,h3,h4,p')){if(n===start)keep=true;if(keep)range.push(n.textContent);}
   text=range.join('\n\n');
  }else text=[...el.querySelectorAll('h1,h2,h3,h4,p')].map(n=>n.textContent).join('\n\n');
 }else if(s.parser==='bfnn'){
  text=el.textContent;
  const first=text.indexOf('１、');
  if(first<0)throw Error('LS03 numbered text not found');
  text=text.slice(first); // strip site navigation; end selected after inspection
 }else{
  el.querySelectorAll('table.headertemplate,table.header-container').forEach(n=>n.remove());
  text=[...el.querySelectorAll('p,h2,h3,.poem')].filter(n=>!n.closest('.poem')||n.classList.contains('poem')).map(n=>n.textContent).join('\n\n');
 }
 text=normalize(text).split('THE FULL PROJECT GUTENBERG')[0].trim();
 if(s.start){const a=text.indexOf(s.start),b=text.indexOf(s.end,a);if(a<0||b<a)throw Error(s.id+': selection anchors absent');text=text.slice(a,b+s.end.length);}
 if(text.length<60||/There is currently no text in this page/.test(text))throw Error(s.id+': empty article');
 const file=`texts/${s.id}.txt`;writeFileSync('knowledge/'+file,text+'\n');
 Object.assign(s,{file,characters:text.length,sha256:createHash('sha256').update(text+'\n').digest('hex'),retrievedAt:'2026-09-27',enabled:true,ingested:true,language:s.parser==='gutenberg'?'en':'zh'});
 console.log(s.id,text.length,text.slice(0,55).replace(/\n/g,' '));
}
let failed=false;
for(let i=0;i<sources.length;i+=3){const results=await Promise.allSettled(sources.slice(i,i+3).map(ingest));for(const r of results)if(r.status==='rejected'){failed=true;console.error(r.reason.message);}}
writeFileSync('knowledge/sources.json',JSON.stringify(sources,null,2)+'\n');
if(failed)process.exitCode=1;
