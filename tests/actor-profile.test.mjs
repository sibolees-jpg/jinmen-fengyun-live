import {test} from 'node:test';
import assert from 'node:assert/strict';
import {actorProfile} from '../backend/actor-profiles.mjs';
import {backgroundProfile} from '../backend/background-profiles.mjs';
import {readFileSync} from 'node:fs';
const catalog=JSON.parse(readFileSync(new URL('../speeches/2026-120周年校庆/文档场次-9.23-v18.json',import.meta.url)));
test('known seated material retains the reviewed body-only clip and immobile pose when replaced',()=>{const actor=catalog.maps[3].scenes[0].actors[0],profile=actorProfile(actor.poses.idle.split('/').pop());assert.equal(profile.mobility,'seated');assert.deepEqual(profile.bodyClip,actor.bodyClip);assert.equal(profile.personMask,actor.personMask);assert.equal(actorProfile('f'.repeat(64)+'.png'),null);});
test('each new background matches only its own reviewed feet, depth and furniture profile',()=>{for(const m of catalog.maps){const s=m.scenes[0],profile=backgroundProfile(s.background.split('/').pop());assert.equal(profile.anchors.length,9);assert.deepEqual(profile.occluders,s.occluders);assert.ok(Math.abs(profile.width/profile.height-s.backgroundAspect)<1e-9);}assert.equal(backgroundProfile('f'.repeat(64)+'.png'),null);});
