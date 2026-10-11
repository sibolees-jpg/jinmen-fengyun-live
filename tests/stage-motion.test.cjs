const {test}=require('node:test'),assert=require('node:assert/strict');
const {motionPose}=require('../motion.js');
test('walking alternates legs, gaze faces the other actor, and idle blinks',()=>{
 const a={id:0,phase:'entering',elapsed:0,message:null};
 assert.equal(motionPose(a,{time:0,travel:-1}).frame,5);
 assert.equal(motionPose(a,{time:200,travel:-1}).frame,6);
 assert.equal(motionPose(a,{time:200,travel:1}).flip,true);
 a.phase='speaking';a.message={action:'auto'};
 assert.equal(motionPose(a,{time:0,look:-1}).frame,3);
 assert.equal(motionPose(a,{time:0,look:1}).frame,4);
 a.message.action='seated';assert.equal(motionPose(a,{time:0}).frame,7);
 a.phase='idle';assert.equal(motionPose(a,{time:0}).frame,0);
 assert.equal(motionPose(a,{time:4200}).frame,1);
});
