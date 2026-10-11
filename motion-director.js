(function(){
'use strict';
const actor=document.getElementById('motion-person'),pose=document.getElementById('motion-pose');
SHOW_DATA.teachers.forEach((teacher,i)=>actor.append(new Option(teacher.name,String(i))));
document.getElementById('motion-play').onclick=()=>send('pose-preview',{actor:Number(actor.value),pose:pose.value});
document.getElementById('motion-stop').onclick=()=>send('rehearsal-stop');
})();
