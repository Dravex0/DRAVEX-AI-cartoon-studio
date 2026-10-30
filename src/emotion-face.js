const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

/** Small, deterministic facial pose values for the procedural 2D renderer. */
export function getEmotionFacePose(emotion='neutral', timeSeconds=0) {
  const mood=String(emotion||'neutral').toLowerCase();
  const time=Number.isFinite(Number(timeSeconds))?Math.max(0,Number(timeSeconds)):0;
  const pulse=Math.sin(time*2.4);
  const poses={
    neutral:{eyeScale:1,browLift:0,browTilt:0,mouthCurve:0,mouthOpen:0,cheek:0,tear:0},
    happy:{eyeScale:.9,browLift:.12,browTilt:0,mouthCurve:1,mouthOpen:0,cheek:.22,tear:0},
    sad:{eyeScale:.82,browLift:-.28,browTilt:.5,mouthCurve:-1,mouthOpen:0,cheek:0,tear:.72},
    fear:{eyeScale:1.2,browLift:.55,browTilt:-.35,mouthCurve:0,mouthOpen:.34+Math.max(0,pulse)*.08,cheek:0,tear:0},
    anger:{eyeScale:.86,browLift:-.2,browTilt:-1,mouthCurve:-.65,mouthOpen:0,cheek:0,tear:0},
    surprised:{eyeScale:1.28,browLift:.7,browTilt:0,mouthCurve:0,mouthOpen:.62+Math.max(0,pulse)*.08,cheek:0,tear:0}
  };
  const pose=poses[mood]||poses.neutral;
  return {...pose,eyeScale:clamp(pose.eyeScale,.65,1.35),mouthOpen:clamp(pose.mouthOpen,0,.8),cheek:clamp(pose.cheek,0,.4),tear:clamp(pose.tear,0,1)};
}

/** Blend the previous and current sentence emotion near a timeline boundary. */
export function sampleEmotionFaceTimeline(timeline,timeSeconds=0,transitionSeconds=.22,fallback='neutral') {
  const time=Number.isFinite(Number(timeSeconds))?Math.max(0,Number(timeSeconds)):0;
  const transition=Number.isFinite(Number(transitionSeconds))?clamp(Number(transitionSeconds),0,.75):.22;
  const valid=(Array.isArray(timeline)?timeline:[]).filter(item=>item&&Number.isFinite(Number(item.startSeconds))&&Number.isFinite(Number(item.endSeconds))&&Number(item.endSeconds)>Number(item.startSeconds)&&typeof item.emotion==='string').sort((a,b)=>Number(a.startSeconds)-Number(b.startSeconds));
  if(!valid.length)return getEmotionFacePose(fallback,time);
  for(let index=1;index<valid.length;index++){
    const current=valid[index],boundary=Number(current.startSeconds);
    if(transition>0&&time>=boundary-transition&&time<boundary){
      const p0=clamp((time-(boundary-transition))/transition,0,1),p=p0*p0*(3-2*p0);
      const previousPose=getEmotionFacePose(valid[index-1].emotion,time),currentPose=getEmotionFacePose(current.emotion,time),blended={};
      for(const key of Object.keys(currentPose))blended[key]=previousPose[key]+(currentPose[key]-previousPose[key])*p;
      return blended;
    }
  }
  let index=valid.findIndex(item=>time>=Number(item.startSeconds)&&time<Number(item.endSeconds));
  if(index<0)index=time>=Number(valid[valid.length-1].endSeconds)?valid.length-1:0;
  return getEmotionFacePose(valid[index].emotion,time);
}
