// Original user artwork is referenced unchanged; SVG viewBox normalizes transparent margins.
// Simple SVG stand-ins remain available when a character has no artwork.
window.makeAvatar=function(t,i){
if(t.art)return `<div class="portrait-motion"><svg class="portrait-art" viewBox="${t.viewBox||'0 0 1024 1536'}" preserveAspectRatio="xMidYMax meet" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><image href="${t.art}" x="0" y="0" width="${t.artWidth||1024}" height="${t.artHeight||1536}"/></svg></div>`;

const extras=[
 '<g fill="none"><circle cx="56" cy="47" r="8"/><circle cx="79" cy="47" r="8"/><path d="M64 46L71 46M46 44L42 42M88 44L92 42"/></g>',
 '<path d="M46 30Q63 14 88 32M49 26L45 21M60 23L58 17" fill="none"/>',
 '<path d="M40 63Q31 16 66 15Q102 17 94 62M42 33Q61 39 82 24" fill="none"/>',
 '<g fill="none"><path d="M43 30Q50 11 61 22Q76 10 91 34"/><circle cx="56" cy="47" r="8"/><circle cx="79" cy="47" r="8"/><path d="M64 46L71 46"/></g>',
 '<g fill="none"><circle cx="68" cy="14" r="9"/><path d="M44 34Q53 23 64 26L89 34"/></g>',
 '<g fill="none"><path d="M42 31Q32 23 46 19Q44 9 59 16Q68 5 77 17Q94 11 92 28"/><path d="M58 61Q68 54 78 61"/></g>',
 '<path d="M43 33Q45 9 75 20Q94 22 92 40M47 30L80 23" fill="none"/>'
][i%7];
return `<svg class="avatar" viewBox="0 0 136 211" preserveAspectRatio="xMidYMax meet" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g fill="none" stroke="#484943" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round">
<g class="leg leg-left"><path d="M57 147L53 204L41 209"/></g><g class="leg leg-right"><path d="M77 147L82 204L96 209"/></g>
<g class="body-motion"><path d="M55 82Q66 78 79 82L86 146Q69 156 48 147Z" fill="#faf9f3"/>
<path d="M61 84L67 97L74 83M67 97L68 140" stroke-width="1.5"/>
<g class="arm arm-left"><path d="M52 88Q36 109 38 136L42 141"/></g><g class="arm arm-right"><path d="M81 88Q96 106 97 134L92 141"/></g>
<path d="M62 72L62 82M74 72L75 82"/>
<g class="head-motion"><path d="M42 43Q39 20 66 19Q92 20 94 42L91 58Q85 75 67 76Q47 73 43 57Z" fill="#faf9f3"/>
<g class="eyes" stroke-width="3"><path d="M56 46L56 48M79 46L79 48"/></g><path d="M67 48L65 56L69 57M61 65Q69 69 76 64" stroke-width="1.4"/>${extras}</g>
${i===0?'<path d="M49 112L62 116L61 143L47 139Z" fill="#e7e6de" stroke-width="1.5"/>':''}
${i===2?'<path d="M55 84Q66 98 80 84L76 107" stroke-width="4"/>':''}
</g></g></svg>`;
};
