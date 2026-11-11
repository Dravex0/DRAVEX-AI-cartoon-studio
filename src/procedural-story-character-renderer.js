const TAU=Math.PI*2;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number.isFinite(Number(v))?Number(v):0));
const clean=v=>String(v??'').trim().slice(0,1200);
function colorFor(source,fallback,patterns){const text=clean(source).toLowerCase();for(const [re,color] of patterns)if(re.test(text))return color;return fallback;}
function nearestTraitColor(source,traitPattern,fallback,patterns){
 const text=clean(source).toLowerCase();
 const trait=text.search(traitPattern);
 if(trait<0)return fallback;
 let best=null;
 for(const [re,color] of patterns){
  const scanner=new RegExp(re.source,re.flags.includes('g')?re.flags:re.flags+'g');
  let match;
  while((match=scanner.exec(text))){
   const distance=Math.abs((match.index+match[0].length/2)-trait);
   if(!best||distance<best.distance)best={distance,color};
   if(!match[0])scanner.lastIndex++;
  }
 }
 return best?.color||fallback;
}
function getColors(profile={}){
 // Character Bible often stores the whole appearance in one visualDescription.
 // Resolve hair/eye colors by proximity to their own trait words so "red eyes"
 // cannot accidentally turn "black hair" red.
 const appearance=[clean(profile.visualDescription),clean(profile.distinctiveFeatures)].filter(Boolean).join(' ');
 const hairPatterns=[[/black|черн/i,'#17131f'],[/white|silver|бел|серебр/i,'#d9dce5'],[/blond|gold|золот|светл.*волос/i,'#d9ad58'],[/red|scarlet|рыж|красн|алый/i,'#9c342b'],[/blue|син/i,'#315a9b'],[/brown|каштан/i,'#55382f']];
 const eyePatterns=[[/blue|голуб|син/i,'#4c9bd5'],[/green|зелен/i,'#55a96a'],[/gold|yellow|желт/i,'#e4bd49'],[/brown|кар/i,'#79513a'],[/red|scarlet|алый|красн/i,'#d52843']];
 const hairSource=clean(profile.hair);
 const eyeSource=clean(profile.eyeColor)||clean(profile.eyes);
 const outfitSource=clean(profile.clothing)||clean(profile.outfit);
 const accentSource=clean(profile.colors)||clean(profile.accentColor);
 return {
  hair:hairSource?colorFor(hairSource,'#17131f',hairPatterns):nearestTraitColor(appearance,/hair|волос/i,'#17131f',hairPatterns),
  outfit:colorFor(outfitSource,'#171820',[[/white|бел/i,'#e5e2df'],[/blue|син/i,'#243d69'],[/green|зелен/i,'#28533f'],[/red|красн/i,'#641f2e']]),
  accent:colorFor(accentSource,'#a51d35',[[/gold|золот|yellow|желт/i,'#d7ad4b'],[/blue|син/i,'#4d78c7'],[/green|зелен/i,'#5a9b71'],[/purple|фиолет/i,'#8953b5']]),
  eyes:eyeSource?colorFor(eyeSource,'#d52843',eyePatterns):nearestTraitColor(appearance,/eyes?|глаз/i,'#d52843',eyePatterns),
  skin:'#d9a98f'
 };
}
/** Deterministic animated character fallback; generated sprites take precedence when attached. */
export function drawProceduralStoryCharacter(ctx,{x=0,y=0,time=0,action='idle',sceneIndex=0,characterId='Hero',profile={},storyText='',mouthOpenness=0,viseme='neutral'}={}){
 if(!ctx||typeof ctx.save!=='function'||typeof ctx.beginPath!=='function')throw new TypeError('A CanvasRenderingContext2D-like context is required.');
 const t=Number.isFinite(Number(time))?Number(time):0,c=getColors(profile),text=(clean(storyText)+' '+clean(profile.signatureAccessories)).toLowerCase(),kind=String(action);
 const stride=['run','walk','jump','attack','defend','dodge','team_magic','energy_clash'].includes(kind)?Math.sin(t*(kind==='run'?9:5)):Math.sin(t*2)*.12;
 const jump=kind==='jump'?Math.abs(Math.sin(t*3))*22:0,sway=Math.sin(t*2.1+sceneIndex*.4)*3,cx=Number(x)+sway+(kind==='run'?Math.sin(t*4)*12:0),cy=Number(y)-jump;
 const sword=/sword|blade|меч|клинок|katana/i.test(text),cloak=/cloak|cape|плащ|накидк/i.test(clean(profile.clothing)+' '+text);
 ctx.save();ctx.translate(cx,cy);ctx.scale(1.18,1.18);
 ctx.fillStyle='rgba(0,0,0,.25)';ctx.beginPath();ctx.ellipse(0,73,42,9,0,0,TAU);ctx.fill();
 for(const side of [-1,1]){ctx.save();ctx.translate(side*12,35);ctx.rotate(side*stride*.32);ctx.strokeStyle=c.outfit;ctx.lineWidth=13;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(side*2,29);ctx.lineTo(side*4,48);ctx.stroke();ctx.fillStyle='#17151a';ctx.fillRect(side*4-7,44,17,8);ctx.restore();}
 if(cloak){ctx.fillStyle=c.outfit;ctx.beginPath();ctx.moveTo(-18,-15);ctx.lineTo(-35,52);ctx.lineTo(0,38);ctx.lineTo(34,54);ctx.lineTo(19,-15);ctx.closePath();ctx.fill();ctx.strokeStyle=c.accent;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,-10);ctx.lineTo(0,40);ctx.stroke();}
 ctx.fillStyle=c.outfit;ctx.beginPath();ctx.moveTo(-18,-19);ctx.lineTo(18,-19);ctx.lineTo(25,27);ctx.lineTo(0,40);ctx.lineTo(-25,27);ctx.closePath();ctx.fill();
 ctx.strokeStyle=c.accent;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-15,-10);ctx.lineTo(15,20);ctx.stroke();
 for(const side of [-1,1]){ctx.save();ctx.translate(side*18,-10);const angle=['attack','defend','dodge','energy_clash'].includes(kind)?(side===1?(kind==='attack'?-1.05:kind==='defend'?-2.25:-.6):.45):side*(.2+stride*.22);ctx.rotate(angle);ctx.strokeStyle=c.outfit;ctx.lineWidth=11;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(side*4,26);ctx.stroke();ctx.fillStyle=c.skin;ctx.beginPath();ctx.arc(side*4,28,5,0,TAU);ctx.fill();if(sword&&side===1){ctx.strokeStyle='#b9c2d0';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(4,28);ctx.lineTo(4+(kind==='attack'?54:34),kind==='attack'?-38:-12);ctx.stroke();ctx.strokeStyle=c.accent;ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-1,19);ctx.lineTo(11,25);ctx.stroke();}ctx.restore();}
 ctx.fillStyle=c.skin;ctx.fillRect(-6,-34,12,18);ctx.beginPath();ctx.ellipse(0,-52,21,25,0,0,TAU);ctx.fill();
 ctx.fillStyle=c.hair;ctx.beginPath();ctx.moveTo(-21,-52);ctx.quadraticCurveTo(-26,-82,0,-81);ctx.quadraticCurveTo(27,-82,23,-49);ctx.lineTo(12,-57);ctx.lineTo(5,-39);ctx.lineTo(-3,-56);ctx.lineTo(-13,-42);ctx.closePath();ctx.fill();
 ctx.fillStyle=c.eyes;ctx.beginPath();ctx.ellipse(-8,-51,3.4,2.6,0,0,TAU);ctx.ellipse(8,-51,3.4,2.6,0,0,TAU);ctx.fill();
 ctx.strokeStyle='#241c25';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-11,-58);ctx.lineTo(-4,-60);ctx.moveTo(5,-60);ctx.lineTo(12,-58);ctx.stroke();
 const mouth=clamp(mouthOpenness,0,1);if(mouth>.05){ctx.fillStyle='#51232d';ctx.beginPath();ctx.ellipse(0,-37,viseme==='wide'?5:3,2+mouth*4,0,0,TAU);ctx.fill();}
 if(/crown|корон/i.test(text)){ctx.strokeStyle=c.accent;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-13,-77);ctx.lineTo(-11,-88);ctx.lineTo(-3,-80);ctx.lineTo(3,-91);ctx.lineTo(10,-80);ctx.lineTo(13,-86);ctx.stroke();}
 ctx.restore();return{x:cx,y:cy,characterId:String(characterId),action:kind,colors:c};
}
