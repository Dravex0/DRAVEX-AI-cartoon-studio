import test from 'node:test';
import assert from 'node:assert/strict';
import { getEmotionFacePose, sampleEmotionFaceTimeline } from '../src/emotion-face.js';

test('returns bounded, deterministic facial pose values for known emotions',()=>{
  for(const emotion of ['neutral','happy','sad','fear','anger','surprised']){
    const pose=getEmotionFacePose(emotion,1.25);
    for(const key of ['eyeScale','browLift','browTilt','mouthCurve','mouthOpen','cheek','tear']) assert.ok(Number.isFinite(pose[key]));
    assert.ok(pose.eyeScale>=.65&&pose.eyeScale<=1.35);
    assert.ok(pose.mouthOpen>=0&&pose.mouthOpen<=.8);
  }
});
test('maps unknown emotions to neutral and sanitizes invalid time',()=>{
  assert.deepEqual(getEmotionFacePose('unknown',NaN),getEmotionFacePose('neutral',0));
});
test('sad and happy expressions have distinct mouth and tear cues',()=>{
  const sad=getEmotionFacePose('sad'),happy=getEmotionFacePose('happy');
  assert.ok(sad.tear>0);
  assert.ok(happy.cheek>0);
  assert.notEqual(sad.mouthCurve,happy.mouthCurve);
});

test('smoothly blends facial pose across sentence emotion boundaries',()=>{
  const timeline=[{startSeconds:0,endSeconds:1,emotion:'happy'},{startSeconds:1,endSeconds:2,emotion:'sad'}];
  const before=sampleEmotionFaceTimeline(timeline,.78);
  const middle=sampleEmotionFaceTimeline(timeline,.89);
  const after=sampleEmotionFaceTimeline(timeline,1);
  assert.ok(before.mouthCurve>middle.mouthCurve);
  assert.ok(middle.mouthCurve>after.mouthCurve);
  assert.equal(after.tear>0,true);
});
test('uses a neutral fallback for an empty timeline',()=>{
  assert.deepEqual(sampleEmotionFaceTimeline([],0),getEmotionFacePose('neutral',0));
});
