const {test}=require('node:test'),assert=require('node:assert/strict');
const {AudienceSubtitles}=require('../speech-sentences.js'),{normalizeSpeech}=require('../script-follow.js');
const script=require('../show/script.json').script,{stage}=require('./helpers/stage-fixture.cjs');
const pages=text=>new AudienceSubtitles({blocks:[{sentences:[{text}]}]}).rows.get('0:0');
test('the introduction and other normal-length sentences stay whole, without a one-word tail page',()=>{
 for(const text of ['今天，我特意请了8个AI智能体来和我一起发表今天的致辞。','李鸿章从1870年代开始以天津为基地筹划新建北洋水师和天津机器局。','感谢每一位在平凡而伟大的岗位上为天津美院奉献的师生员工们！']){
  assert.deepEqual(pages(text),[{text,end:normalizeSpeech(text).length}]);
 }
});
test('long sentences split at a natural middle pause and retain every authored word and punctuation',()=>{
 const first='他在这里拍发了中国历史上第一封电报，',second='北洋水师学堂则聘请了福州人严复作为总教习。';
 assert.deepEqual(pages(first+second).map(p=>p.text),[first,second]);
 for(const b of script.blocks)for(const s of b.sentences){const p=pages(s.text.trim());assert.equal(p.map(x=>x.text).join(''),s.text.trim());for(const page of p){assert.ok([...page.text].length<=36);if(p.length>1)assert.ok([...page.text].length>=8,page.text);assert.ok(!/^[，。、：；。！？!?…、”’」』）》】]/u.test(page.text));}}
});
test('unpunctuated and much longer sentences remain balanced, without changing speech-follow offsets',()=>{
 for(let length=37;length<=180;length++){
  const text='中华艺术教育'.repeat(30).slice(0,length),p=pages(text);assert.equal(p.map(x=>x.text).join(''),text);let prefix='';
  for(const page of p){assert.ok([...page.text].length>=8&&[...page.text].length<=36);prefix+=page.text;assert.equal(page.end,normalizeSpeech(prefix).length);}
 }
 const raw='今天我特意请了8个AI智能体来和我一起发表今天的致辞。';assert.equal(new AudienceSubtitles().caption(raw),raw);
});
test('stage displays the complete introduction from the first reliable match, including its original ending',async()=>{
 const f=stage(),text='今天，我特意请了8个AI智能体来和我一起发表今天的致辞。';f.command('speech-script',{script:{title:'字幕测试',text}});f.command('voice-state',{active:true,session:'balanced'});
 f.command('voice-transcript',{session:'balanced',seq:1,text:'今天我特意请了八个AI智能体',final:false});assert.equal(f.elements.get('live-caption').textContent,text);
 f.command('voice-transcript',{session:'balanced',seq:2,text:'今天我特意请了八个AI智能体来和我一起发表今天的致辞',final:true});assert.equal(f.elements.get('live-caption').textContent,text);f.command('clear');
});
