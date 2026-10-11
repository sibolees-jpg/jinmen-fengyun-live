const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');const scope=vm.createContext({});scope.window=scope;vm.runInContext(fs.readFileSync(path.join(__dirname,'../data.js'),'utf8'),scope);const data=JSON.parse(JSON.stringify(scope.SHOW_DATA));const {normalizeDialogue}=require('../dialogue.js');
const expected=['梁启超','李鸿章','严复','李叔同','蔡元培','柏拉图','达芬奇','伽利略','愚公'];
test('Jinmen cast uses the nine final names without reassigning old portraits',()=>{
 assert.deepEqual(data.teachers.map(t=>t.name),expected);assert.deepEqual(data.stageOrder,[8,0,1,2,3,4,5,6,7]);
 assert.equal(data.title,'津门风云');assert.equal(data.castId,'jinmen-fengyun-v1');
 for(const topic of data.topics){assert.equal(topic.lines.length,9);assert.ok(topic.lines.every(line=>typeof line==='string'&&line.length>0&&line.length<=80));}
 assert.match(data.teachers[8].art,/yu-gong/);assert.match(data.teachers[7].art,/galileo/);assert.ok(data.teachers.slice(0,7).every(t=>!t.art));
});
test('dialogue accepts the last teacher while rejecting actors outside the new cast',()=>{
 assert.equal(normalizeDialogue([{actor:8,text:'先把今天这一筐土搬走。',replyTo:null}])[0].actor,8);
 assert.throws(()=>normalizeDialogue([{actor:9,text:'无效角色。',replyTo:null}]));
});
