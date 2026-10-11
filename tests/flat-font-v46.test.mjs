import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {SceneStore} from '../backend/scene-store.mjs';
import D from '../dialogue-overlay.js';
import {createAppServer} from '../server.mjs';

test('font asset survives scene save, export and import, with strict local references and MIME checks',async t=>{
 const folder=mkdtempSync(path.join(tmpdir(),'flat-font-'));t.after(()=>rmSync(folder,{recursive:true,force:true}));
 const a=new SceneStore(path.join(folder,'a','scenes.json')),b=new SceneStore(path.join(folder,'b','scenes.json'));
 const bytes=Buffer.from([0,1,0,0,0,0,0,0,0,0,0,0]);
 assert.throws(()=>a.upload(bytes,'image/png'));assert.throws(()=>a.upload(Buffer.from('<html>wrong</html>'),'font/ttf'));
 const {url}=a.upload(bytes,'font/ttf'),r=a.get();r.catalog.maps[1].scenes[0].actors[0].bubble=D.normalize({font:'kangxi',fontAsset:url});
 a.save(r.catalog,0);b.import(a.export(),0);
 assert.equal(b.get().catalog.maps[1].scenes[0].actors[0].bubble.fontAsset,url);
 assert.deepEqual(b.readAsset(url.split('/').pop()).data,bytes);
 assert.throws(()=>D.normalize({fontAsset:'https://untrusted.example/font.ttf'}));
 assert.throws(()=>a.readAsset('../../config.json'));
 const server=createAppServer({scenes:b,scripts:{get:()=>({script:null})},rehearsal:{get:()=>null},speech:{close(){}}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const response=await fetch('http://127.0.0.1:'+server.address().port+url);
 assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'font/ttf');
});
