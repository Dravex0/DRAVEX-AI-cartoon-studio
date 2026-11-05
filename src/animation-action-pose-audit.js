import { createCharacterRigMotionPreset } from './character-rig-motion-presets.js';
import { sampleCharacterRigTimeline } from './character-rig-timeline.js';

const norm = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
function roleOf(id) {
  const key = norm(id);
  if (/root|hips|pelvis|torso|body|spine/.test(key)) return 'root';
  if (/head|neck/.test(key)) return 'head';
  if (/left.*(arm|hand|shoulder)|(arm|hand|shoulder).*left|l(arm|hand|upperarm|shoulder)|(arm|hand|upperarm|shoulder)l/.test(key)) return 'leftArm';
  if (/right.*(arm|hand|shoulder)|(arm|hand|shoulder).*right|r(arm|hand|upperarm|shoulder)|(arm|hand|upperarm|shoulder)r/.test(key)) return 'rightArm';
  if (/left.*(leg|thigh)|(leg|thigh).*left|l(leg|thigh)|(leg|thigh)l/.test(key)) return 'leftLeg';
  if (/right.*(leg|thigh)|(leg|thigh).*right|r(leg|thigh)|(leg|thigh)r/.test(key)) return 'rightLeg';
  if (/arm|hand|shoulder/.test(key)) return 'arm';
  if (/leg|thigh/.test(key)) return 'leg';
  return 'other';
}
const abs = value => Math.abs(Number(value) || 0);

/** Verify action-specific signatures in generated rig poses, not rendered pixels. */
export function auditCharacterActionPose(rigInput, presetName) {
  const generated = createCharacterRigMotionPreset(rigInput, presetName);
  if (generated.status !== 'ready') return {
    status: generated.status === 'invalid-rig' ? 'inconclusive' : 'failed',
    preset: presetName, checks: [], issues: generated.issues || [],
    limitation: 'No rendered-pixel or semantic-action verification is performed.'
  };
  const roles = new Map();
  for (const bone of generated.rig.bones) {
    const role = roleOf(bone.id);
    if (!roles.has(role)) roles.set(role, []);
    roles.get(role).push(bone.id);
  }
  const characterId = generated.rig.characterId;
  const pose = time => sampleCharacterRigTimeline(generated.timeline, time)[characterId] || {};
  const v = (time, role, field = 'rotation') => (roles.get(role) || [])
    .reduce((sum, id) => sum + (Number(pose(time)[id]?.[field]) || 0), 0);
  const has = role => (roles.get(role) || []).length > 0;
  const checks = [];
  const add = (code, passed, measured) => checks.push({ code, passed, measured });
  const missing = names => names.filter(name => !has(name));
  const inconclusive = names => ({
    status: 'inconclusive', preset: presetName, checks: [],
    issues: [{ code: 'action-rig-parts-missing', missingRoles: names }],
    limitation: 'Required rig roles are missing; no visual or semantic action claim is made.'
  });

  switch (presetName) {
    case 'idle': {
      if (missing(['root']).length) return inconclusive(['root']);
      const a = v(0.25, 'root', 'y'), b = v(0.75, 'root', 'y');
      add('idle-breathing-cycle', a > 0 && b < 0, { quarter: a, threeQuarter: b });
      break;
    }
    case 'walk':
    case 'run': {
      const req = ['leftLeg', 'rightLeg', 'leftArm', 'rightArm'];
      if (missing(req).length) return inconclusive(missing(req));
      const ll1=v(.25,'leftLeg'), rl1=v(.25,'rightLeg'), ll2=v(.75,'leftLeg'), rl2=v(.75,'rightLeg');
      const la1=v(.25,'leftArm'), ra1=v(.25,'rightArm'), la2=v(.75,'leftArm'), ra2=v(.75,'rightArm');
      add('gait-leg-alternation', ll1<0 && rl1>0 && ll2>0 && rl2<0, {ll1,rl1,ll2,rl2});
      add('gait-opposed-arm-swing', la1>0 && ra1<0 && la2<0 && ra2>0, {la1,ra1,la2,ra2});
      if (presetName === 'run') add('run-amplitude', abs(ll1)>=.5 && abs(rl1)>=.5, {left:abs(ll1),right:abs(rl1)});
      break;
    }
    case 'jump': {
      const req=['root','leftLeg','rightLeg']; if(missing(req).length)return inconclusive(missing(req));
      const y=v(.25,'root','y'), l=v(.25,'leftLeg'), r=v(.25,'rightLeg');
      add('jump-vertical-lift',y<-.1,{rootY:y}); add('jump-leg-tuck',l<-.2&&r>.2,{left:l,right:r}); break;
    }
    case 'dodge': {
      const req=['root','leftArm','rightArm','leftLeg','rightLeg']; if(missing(req).length)return inconclusive(missing(req));
      const y=v(.5,'root','y'), rot=v(.5,'root'), la=v(.5,'leftArm'),ra=v(.5,'rightArm'),ll=v(.5,'leftLeg'),rl=v(.5,'rightLeg');
      add('dodge-crouch',y>.03&&abs(rot)>.05,{rootY:y,rootRotation:rot});
      add('dodge-limb-tuck',abs(la)>.5&&abs(ra)>.5&&abs(ll)>.2&&abs(rl)>.2,{leftArm:la,rightArm:ra,leftLeg:ll,rightLeg:rl}); break;
    }
    case 'wave': {
      const role=has('rightArm')?'rightArm':has('arm')?'arm':null;
      if(!role)return inconclusive(['rightArm']);
      const a=v(.5,role); add('wave-raised-arm',a<-.5,{armRotation:a}); break;
    }
    case 'dance': {
      const req=['root','leftArm','rightArm','leftLeg','rightLeg']; if(missing(req).length)return inconclusive(missing(req));
      const y=v(.25,'root','y'),l1=v(.25,'leftLeg'),r1=v(.25,'rightLeg'),l2=v(.75,'leftLeg'),r2=v(.75,'rightLeg');
      add('dance-bounce',y<-.02,{rootY:y}); add('dance-alternating-limbs',l1<0&&r1>0&&l2>0&&r2<0,{l1,r1,l2,r2}); break;
    }
    case 'attack': {
      const req=['root','rightArm']; if(missing(req).length)return inconclusive(missing(req));
      const arm=v(.5,'rightArm'),x=v(.5,'root','x');
      add('attack-strike-arm',arm<-.8,{rightArm:arm}); add('attack-forward-shift',x>.04,{rootX:x}); break;
    }
    case 'defend': {
      const req=['root','leftArm','rightArm']; if(missing(req).length)return inconclusive(missing(req));
      const l=v(.5,'leftArm'),r=v(.5,'rightArm'),y=v(.5,'root','y');
      add('defend-guard-arms',l<-.5&&r>.5,{leftArm:l,rightArm:r}); add('defend-braced-body',y>.02,{rootY:y}); break;
    }
    default: return {status:'failed',preset:presetName,checks:[],issues:[{code:'action-preset-unsupported'}]};
  }
  const failed=checks.filter(item=>!item.passed).length;
  return {
    status: failed?'failed':'passed', preset:presetName, checkCount:checks.length,
    passedCheckCount:checks.length-failed, failedCheckCount:failed, checks,
    warnings:generated.warnings||[],
    limitation:'Pose signatures only: this does not prove rendered pixels, character identity, or semantic action in exported video.'
  };
}
