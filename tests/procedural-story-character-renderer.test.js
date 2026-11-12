import test from 'node:test';
import assert from 'node:assert/strict';
import { drawProceduralStoryCharacter, shouldDrawProceduralStoryCharacter } from '../src/procedural-story-character-renderer.js';
function mockContext(){const noop=()=>{};return new Proxy({save:noop,restore:noop,beginPath:noop,ellipse:noop,fill:noop,stroke:noop,moveTo:noop,lineTo:noop,quadraticCurveTo:noop,closePath:noop,fillRect:noop,arc:noop,translate:noop,rotate:noop,scale:noop},{get:(target,key)=>key in target?target[key]:noop,set:(target,key,value)=>(target[key]=value,true)});}
test('draws a named character from its text profile without a sprite',()=>{const result=drawProceduralStoryCharacter(mockContext(),{x:100,y:200,characterId:'Kael Vorran',profile:{hair:'messy black hair',eyeColor:'scarlet red',clothing:'black tactical cloak',signatureAccessories:'broken crown'},storyText:'He draws his Shadow Blade and attacks.'});assert.equal(result.characterId,'Kael Vorran');assert.equal(result.colors.hair,'#17131f');assert.equal(result.colors.eyes,'#d52843');});
test('animates a named character while retaining identity',()=>{const a=drawProceduralStoryCharacter(mockContext(),{x:100,y:200,time:0,action:'run',characterId:'Hero'}),b=drawProceduralStoryCharacter(mockContext(),{x:100,y:200,time:1,action:'run',characterId:'Hero'});assert.equal(a.characterId,b.characterId);assert.notEqual(a.x,b.x);assert.equal(b.action,'run');});
test('rejects an invalid canvas context',()=>assert.throws(()=>drawProceduralStoryCharacter(null),/CanvasRenderingContext2D/));

test('keeps hair, eyes, clothing and accent colors independent',()=>{const result=drawProceduralStoryCharacter(mockContext(),{characterId:'Kael Vorran',profile:{hair:'messy black hair',eyeColor:'scarlet red',clothing:'black tactical cloak',colors:'crimson accents',signatureAccessories:'broken gold crown'}});assert.equal(result.colors.hair,'#17131f');assert.equal(result.colors.eyes,'#d52843');assert.equal(result.colors.outfit,'#171820');assert.equal(result.colors.accent,'#a51d35');});

test('infers hair and eye colors independently from a combined appearance description',()=>{const result=drawProceduralStoryCharacter(mockContext(),{characterId:'Kael Vorran',profile:{visualDescription:'Tall young man with messy black hair and bright scarlet red eyes, wearing a black tactical cloak.'}});assert.equal(result.colors.hair,'#17131f');assert.equal(result.colors.eyes,'#d52843');});
test('supports non-red eye colors in a combined appearance description',()=>{const result=drawProceduralStoryCharacter(mockContext(),{characterId:'Blue-eyed hero',profile:{visualDescription:'A young woman with long blonde hair and bright blue eyes.'}});assert.equal(result.colors.hair,'#d9ad58');assert.equal(result.colors.eyes,'#4c9bd5');});

test('renders Kael as a visible full-body character with his black hair, scarlet eyes, cloak and Shadow Blade',()=>{
 const calls={ellipse:0,quadraticCurveTo:0,lineTo:0,fill:0,stroke:0,fillRect:0};
 const noop=()=>{};
 const context=new Proxy({
  save:noop,restore:noop,beginPath:noop,closePath:noop,moveTo:noop,arc:noop,
  translate:noop,rotate:noop,scale:noop,
  ellipse(){calls.ellipse++},quadraticCurveTo(){calls.quadraticCurveTo++},
  lineTo(){calls.lineTo++},fill(){calls.fill++},stroke(){calls.stroke++},
  fillRect(){calls.fillRect++}
 },{get:(target,key)=>key in target?target[key]:noop,set:(target,key,value)=>(target[key]=value,true)});
 const result=drawProceduralStoryCharacter(context,{
  x:180,y:492,time:0.8,action:'attack',sceneIndex:0,characterId:'Kael',
  profile:{
   visualDescription:'Tall slim athletic young man with messy black hair and bright scarlet red eyes.',
   hair:'messy black hair',eyeColor:'scarlet red',clothing:'black tactical cloak with red accents',
   signatureAccessories:'broken crown'
  },
  storyText:'Kael draws his glowing red Shadow Blade and attacks.'
 });
 assert.equal(result.characterId,'Kael');
 assert.equal(result.action,'attack');
 assert.equal(result.colors.hair,'#17131f');
 assert.equal(result.colors.eyes,'#d52843');
 assert.ok(calls.ellipse>=3,'head and body shadow geometry should be drawn');
 assert.ok(calls.quadraticCurveTo>=1,'hair silhouette should be drawn');
 assert.ok(calls.lineTo>=12,'body, cloak and weapon geometry should be drawn');
 assert.ok(calls.fill>0&&calls.stroke>0,'visible filled and stroked shapes should be rendered');
});


test('uses the procedural character only when no generated media or character art is available', () => {
 assert.equal(shouldDrawProceduralStoryCharacter({ characterId: 'Kael' }), true);
 assert.equal(shouldDrawProceduralStoryCharacter({ characterId: 'Kael', profile: { visualDescription: 'a young man with dark hair' } }), true);
 assert.equal(shouldDrawProceduralStoryCharacter({ characterId: 'Kael', hasGeneratedMedia: true }), false);
 assert.equal(shouldDrawProceduralStoryCharacter({ characterId: 'Kael', hasReadyCharacterLayer: true }), false);
 assert.equal(shouldDrawProceduralStoryCharacter({ characterId: 'Kael', hasReadyCharacterRig: true }), false);
 assert.equal(shouldDrawProceduralStoryCharacter({ characterId: '' }), false);
});

test('does not draw a human procedural stand-in for an explicitly non-human character', () => {
 assert.equal(shouldDrawProceduralStoryCharacter({ characterId: 'Foxy', profile: { species: 'fox' } }), false);
 assert.equal(shouldDrawProceduralStoryCharacter({ characterId: 'Foxy', profile: { visualDescription: 'a small orange fox' } }), false);
 assert.equal(shouldDrawProceduralStoryCharacter({ characterId: 'Blue Robot', profile: { species: 'robot' } }), false);
 assert.equal(shouldDrawProceduralStoryCharacter({ characterId: 'Bluebird', profile: { visualDescription: 'a small blue bird' } }), false);
 assert.equal(shouldDrawProceduralStoryCharacter({ characterId: 'Foxy' }), false);
 assert.equal(shouldDrawProceduralStoryCharacter({ characterId: 'Лисёнок' }), false);
});

test('uses explicit human species as the authoritative fallback type', () => {
 assert.equal(shouldDrawProceduralStoryCharacter({
  characterId: 'Wolf',
  profile: { species: 'human', visualDescription: 'wearing a wolf costume' }
 }), true);
});
