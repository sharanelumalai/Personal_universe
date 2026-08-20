import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

// Real mobile browsers change the usable viewport when their address/navigation bars move.
// Use visualViewport when available so the 3D camera matches the actual visible phone area.
function getViewport(){
  const vv=window.visualViewport;
  return {
    w:Math.max(1,Math.round(vv?.width||window.innerWidth)),
    h:Math.max(1,Math.round(vv?.height||window.innerHeight))
  };
}
let VIEW=getViewport();
const MOBILE_GPU_MODE = VIEW.w < 760 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);


const canvas=document.querySelector('#world');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});
renderer.setPixelRatio(Math.min(devicePixelRatio,getViewport().w<760?1.25:1.55)); renderer.setSize(VIEW.w,VIEW.h); renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=.84; renderer.shadowMap.enabled=!MOBILE_GPU_MODE; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene(); scene.background=new THREE.Color(0x050416); scene.fog=new THREE.FogExp2(0x070513,.0095);
const camera=new THREE.PerspectiveCamera(48,VIEW.w/VIEW.h,.1,500); camera.position.set(0,3.8,14.2);
const composer=new EffectComposer(renderer); composer.addPass(new RenderPass(scene,camera)); const bloomPass=new UnrealBloomPass(new THREE.Vector2(VIEW.w,VIEW.h),.42,.62,.90); composer.addPass(bloomPass); composer.addPass(new OutputPass());
// Deep fantasy-night gradient dome: keeps every vertically stacked chapter inside the same cinematic sky.
const skyDome=new THREE.Mesh(new THREE.SphereGeometry(460,40,24),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{top:{value:new THREE.Color(0x15103c)},mid:{value:new THREE.Color(0x0a0a27)},bottom:{value:new THREE.Color(0x030313)}},vertexShader:`varying vec3 vP; void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,fragmentShader:`uniform vec3 top;uniform vec3 mid;uniform vec3 bottom;varying vec3 vP;void main(){float h=clamp(vP.y/460.0+.5,0.0,1.0);vec3 c=h<.52?mix(bottom,mid,h/.52):mix(mid,top,(h-.52)/.48);gl_FragColor=vec4(c,1.0);}`}));skyDome.position.y=-185;scene.add(skyDome);
const clock=new THREE.Clock(); const raycaster=new THREE.Raycaster(); const mouse=new THREE.Vector2();
let current=0, transitioning=false, pointerTarget=null, hoverObj=null, audioUnlocked=false;
const interactives=[]; const animations=[]; const chapterGroups=[];
const sceneGap=34;

const copy=document.querySelector('#copy'),titleEl=document.querySelector('#title'),subEl=document.querySelector('#subtitle'),eyeEl=document.querySelector('#eyebrow'),actions=document.querySelector('#actions'),chapterEl=document.querySelector('#chapter');
const flash=document.querySelector('#flash'), heartLabel=document.createElement('div');
const realTalkCards=document.querySelector('#realTalkCards'), compatibilityPanel=document.querySelector('#compatibilityPanel'); heartLabel.className='heart-label'; document.body.appendChild(heartLabel);

// Back button: available on every chapter except the first.
// It is injected here so you do not need to edit index.html or style.css.
const backBtn=document.createElement('button');
backBtn.type='button';
backBtn.id='backBtn';
backBtn.textContent='← Back';
Object.assign(backBtn.style,{
  position:'fixed',
  left:'22px',
  top:'66px',
  zIndex:'10020',
  padding:'9px 14px',
  border:'1px solid rgba(255,170,215,.28)',
  borderRadius:'999px',
  background:'rgba(11,7,31,.72)',
  color:'#fff4fb',
  font:'600 13px system-ui, sans-serif',
  backdropFilter:'blur(10px)',
  WebkitBackdropFilter:'blur(10px)',
  boxShadow:'0 0 16px rgba(255,79,155,.12)',
  cursor:'pointer',
  display:'none'
});
document.body.appendChild(backBtn);


const AUDIO_BASE=new URL('audio/',document.baseURI).href;
const sounds={};
function play(name){ if(!audioUnlocked)return; try{if(!sounds[name]){sounds[name]=new Audio(AUDIO_BASE+name);sounds[name].volume=.44} sounds[name].currentTime=0;sounds[name].play().catch(err=>console.warn('Audio failed:',name,sounds[name]?.src,err));}catch{}}
function unlockAudio(){audioUnlocked=true;}
let bgMusic=null,musicOn=false;
const MUSIC_VOLUME=.18; // soft but clearly audible; lower to .12 or raise to .24 if you prefer
function ensureBackgroundMusic({fromGesture=false}={}){
 if(!bgMusic){
   bgMusic=new Audio(AUDIO_BASE+'ambient-love.wav');
   bgMusic.loop=true;
   bgMusic.volume=MUSIC_VOLUME;
   bgMusic.preload='auto';
   bgMusic.playsInline=true;
 }

 bgMusic.volume=MUSIC_VOLUME;

 // A genuine user gesture is allowed to start audible media.
 if(fromGesture){
   bgMusic.muted=false;
   const p=bgMusic.play();
   if(p){
     p.then(()=>{
       musicOn=true;
       document.querySelector('#soundBtn').textContent='♫ Music On';
     }).catch(err=>{
       console.warn('Music could not start:',bgMusic?.src,err);
       musicOn=false;
       document.querySelector('#soundBtn').textContent='♫ Tap for Music';
     });
   }
   return;
 }

 // First try normal audible autoplay.
 bgMusic.muted=false;
 const attempt=bgMusic.play();
 if(attempt){
   attempt.then(()=>{
     musicOn=true;
     document.querySelector('#soundBtn').textContent='♫ Music On';
   }).catch(async err=>{
     console.warn('Audible autoplay blocked:',bgMusic?.src,err);

     // Muted autoplay is normally permitted. Prime the file so the first
     // user interaction can make it audible instantly without loading delay.
     try{
       bgMusic.muted=true;
       await bgMusic.play();
       musicOn=false;
       document.querySelector('#soundBtn').textContent='♫ Tap for Music';
     }catch(primeErr){
       console.warn('Muted music preload also failed:',primeErr);
       musicOn=false;
       document.querySelector('#soundBtn').textContent='♫ Tap for Music';
     }
   });
 }
}
document.querySelector('#soundBtn').onclick=()=>{
 unlockAudio();
 if(!bgMusic){
   ensureBackgroundMusic({fromGesture:true});
   return;
 }
 if(musicOn){
   bgMusic.pause();
   bgMusic.muted=false;
   musicOn=false;
   document.querySelector('#soundBtn').textContent='♫ Music Off';
 }else{
   ensureBackgroundMusic({fromGesture:true});
 }
};

// Try to start the romantic background music immediately.
// Chrome/Safari on some phones may block audible autoplay; if so,
// the very first user interaction starts it automatically.
setTimeout(()=>ensureBackgroundMusic(),80);

const startMusicOnFirstInteraction=()=>{
  unlockAudio();
  if(!musicOn){
    ensureBackgroundMusic({fromGesture:true});
  }
  document.removeEventListener('pointerdown',startMusicOnFirstInteraction,true);
  document.removeEventListener('touchstart',startMusicOnFirstInteraction,true);
  document.removeEventListener('click',startMusicOnFirstInteraction,true);
};
document.addEventListener('pointerdown',startMusicOnFirstInteraction,true);
document.addEventListener('touchstart',startMusicOnFirstInteraction,true);
document.addEventListener('click',startMusicOnFirstInteraction,true);


const chapters=[
 {n:'01',e:'WELCOME PAGE',t:'Hey You!',s:'I made something really special for you.',b:'Start Your Journey',a:()=>advance()},
 {n:'02',e:'OUR STORY BEGINS',t:'Two different worlds…',s:'…until somehow, our paths crossed.',b:'Connect our worlds',a:connectWorlds},
 {n:'04',e:'CATCH MY HEART',t:'Catch my heart if you can!',s:'It has wings. It also has terrible self-control.',b:'Catch my heart ❤️',a:catchHeartSequence},
 {n:'03',e:'MEMORY LANE',t:'Look how far we’ve come',s:'Your photos live inside these hanging frames. Touch any one of them.',b:'Walk through our memories',a:()=>advance()},
 {n:'06',e:'THE REAL TALK',t:'Some things I want you to know…',s:'Thank you for being in my life. You mean more to me than words can say.',b:'How I would describe us',a:()=>advance()},
 {n:'05',e:'FUNNY MOMENT',t:'Relationship Compatibility Test',s:'A highly scientific machine with absolutely questionable methods.',b:'Start scan',a:runScan},
 {n:'07',e:'HEART GARDEN',t:'Your thoughts about me',s:'Every heart is alive. Hover to make it glow. Touch one to hear its message.',b:'Let’s start',a:()=>advance()},
 {n:'08',e:'QUESTIONS ABOUT ME',t:'Be honest with me ❤️',s:'I want to learn how I can care for you better.',b:'Open the questions',a:()=>openFeedback(0)},
 {n:'09',e:'MORE QUESTIONS',t:'Tell me what I should do better',s:'No perfect answers. Just your real feelings.',b:'Continue questions',a:()=>openFeedback(1)},
 {n:'10',e:'THANK YOU',t:'Thank you for being honest.',s:'Touch a heart. I’ll show you the one I mean — and each one can play your own audio.',b:'Continue',a:()=>advance()},
 {n:'11',e:'OUR FOREVER',t:'I’ll always choose you.',s:'Not because everything will always be easy. Because you are worth choosing.',b:'One last thing…',a:()=>advance()},
 {n:'12',e:'THE END — OR JUST THE BEGINNING',t:'I Love You ♡',s:'This is not the end. It’s just the beginning of our forever.',b:'Come here, idiot! 😘',a:finale}
];

function mat(color,emissive=0x000000,ei=0,rough=.58,metal=.03){return new THREE.MeshStandardMaterial({color,emissive,emissiveIntensity:ei,roughness:rough,metalness:metal});}
function toon(color,emissive=0x000000,ei=0){return new THREE.MeshToonMaterial({color,emissive,emissiveIntensity:ei});}
const pink=mat(0xe95f99,0x8c1647,.22,.44), purple=mat(0x7651d8,0x6c42cf,.35,.48), dark=mat(0x171029,0x0f082d,.18,.72), skin=mat(0xf2b08d), hair=mat(0x241324), white=mat(0xfff5fb,0xffd2e8,.18,.45), gold=mat(0xe8bd6a,0x9b5d22,.48,.42,.08);
const rose=mat(0xc94f87,0x7a173f,.2,.55), grass=mat(0x315b49,0x163b2e,.25,.78), rock=mat(0x332c47,0x160f2b,.12,.9), wood=mat(0x6e3d4d,0x351329,.14,.82), ropeMat=mat(0x6f4d5f,0x2d142a,.05,.9);

function addMesh(g,geo,m,p=[0,0,0],r=[0,0,0],s=[1,1,1]){const o=new THREE.Mesh(geo,m);o.position.set(...p);o.rotation.set(...r);o.scale.set(...s);o.castShadow=o.receiveShadow=true;g.add(o);return o;}
function curveTube(points,r=.035,material=ropeMat,segments=32){const c=new THREE.CatmullRomCurve3(points);return new THREE.Mesh(new THREE.TubeGeometry(c,segments,r,7,false),material);}
function heartGeometry(size=.55){const sh=new THREE.Shape();sh.moveTo(0,.24);sh.bezierCurveTo(-.58,.76,-1.14,.24,-.64,-.34);sh.lineTo(0,-.92);sh.lineTo(.64,-.34);sh.bezierCurveTo(1.14,.24,.58,.76,0,.24);return new THREE.ExtrudeGeometry(sh,{depth:.22*size,bevelEnabled:true,bevelSize:.09*size,bevelThickness:.08*size,bevelSegments:8,curveSegments:30});}
function makeHeart(size=.55,colorMat=pink){const h=new THREE.Mesh(heartGeometry(size),colorMat.clone());h.geometry.center();h.scale.setScalar(size);h.castShadow=true;return h;}
function glowLight(parent,color=0xff6cab,intensity=2,distance=8){
 const l=new THREE.PointLight(color,intensity,distance,2);
 l.userData.decorativeGlow=true;
 l.userData.baseIntensity=intensity;
 parent.add(l);
 return l;
}
function sphere(g,r,m,p,s=[1,1,1]){return addMesh(g,new THREE.SphereGeometry(r,24,18),m,p,[0,0,0],s)}

function makeCharacter({feminine=false,scale=1,shirt=0x7a5ab8,hairColor=0x241324}={}){
 const g=new THREE.Group();g.scale.setScalar(scale);
 const hm=mat(hairColor,0x100914,.025,.82), outfit=mat(shirt,shirt,.055,.66), skinM=mat(0xe7a17f,0x4b201c,.02,.74);
 // Storybook-human proportions: longer limbs, narrower torso, smaller oval head and anatomically small features.
 for(const sx of [-1,1]){
   addMesh(g,new THREE.CapsuleGeometry(.088,.78,8,14),dark,[sx*.155,.43,0]);
   addMesh(g,new THREE.SphereGeometry(.135,18,12),mat(0x221b2c),[sx*.155,-.055,.15],[0,0,0],[1.25,.38,1.75]);
 }
 if(feminine){
   addMesh(g,new THREE.CapsuleGeometry(.255,.72,9,20),outfit,[0,1.46,0]);
   addMesh(g,new THREE.ConeGeometry(.46,.76,36),mat(0x95457f,0x421d39,.07,.7),[0,.86,0]);
   addMesh(g,new THREE.TorusGeometry(.27,.018,8,28),white,[0,1.72,.25],[Math.PI/2,0,0]);
   addMesh(g,new THREE.TorusGeometry(.38,.018,8,30),mat(0xe7c1d7),[0,.69,0],[Math.PI/2,0,0]);
 }else{
   addMesh(g,new THREE.CapsuleGeometry(.27,.92,9,20),outfit,[0,1.42,0]);
   addMesh(g,new THREE.BoxGeometry(.46,.036,.03),white,[0,1.67,.29]);
   addMesh(g,new THREE.BoxGeometry(.034,.23,.03),white,[0,1.54,.29]);
 }
 // neck + oval head/jaw removes the toy/cat silhouette
 addMesh(g,new THREE.CylinderGeometry(.085,.10,.23,16),skinM,[0,1.99,0]);
 const head=sphere(g,.325,skinM,[0,2.31,0],[.82,1.10,.86]);
 sphere(g,.255,skinM,[0,2.16,.015],[.88,.70,.82]);
 // tiny human ears
 sphere(g,.021,skinM,[-.275,2.29,0],[.65,1,.58]);sphere(g,.021,skinM,[.275,2.29,0],[.65,1,.58]);
 const eyeM=mat(0x241823);
 for(const sx of [-1,1]){
   sphere(g,.019,eyeM,[sx*.102,2.34,.286],[.75,1.04,.50]);
   sphere(g,.0045,white,[sx*.098,2.347,.300]);
 }
 // subtle nose, cheeks and mouth
 const cheekM=mat(0xd97883,0,0,.60);sphere(g,.029,cheekM,[-.17,2.22,.275],[1.2,.28,.20]);sphere(g,.029,cheekM,[.17,2.22,.275],[1.2,.28,.20]);
 sphere(g,.014,mat(0xb96e5e),[0,2.245,.302],[.62,.9,.42]);
 const smile=new THREE.Mesh(new THREE.TorusGeometry(.052,.0075,6,18,Math.PI),mat(0x8d4051));smile.position.set(0,2.16,.294);smile.rotation.z=Math.PI;g.add(smile);
 for(const sx of [-1,1]){const brow=addMesh(g,new THREE.CapsuleGeometry(.0065,.062,4,8),hm,[sx*.102,2.405,.292],[0,0,sx*.08],[1,.75,.5]);brow.rotation.z=sx*.10;}
 // Hair wraps the skull and falls naturally instead of forming ears/spikes.
 sphere(g,.345,hm,[0,2.48,-.045],[.98,.64,.92]);
 if(feminine){
   sphere(g,.18,hm,[-.20,2.39,-.04],[.75,1.15,.74]);sphere(g,.18,hm,[.20,2.39,-.04],[.75,1.15,.74]);
   addMesh(g,new THREE.CapsuleGeometry(.125,.98,8,16),hm,[-.235,1.91,-.09],[0,0,.02],[.9,1,1]);
   addMesh(g,new THREE.CapsuleGeometry(.125,.98,8,16),hm,[.235,1.91,-.09],[0,0,-.02],[.9,1,1]);
   for(let i=0;i<7;i++)sphere(g,.078,hm,[-.23+i*.077,2.60,.09],[1.05,.48,.7]);
 }else{
   for(let i=0;i<8;i++){const lock=sphere(g,.075,hm,[-.25+i*.072,2.60+(i%2)*.025,.02],[1.1,.62,.9]);lock.rotation.z=(-.3+i*.085);}
 }
 // Articulated shoulders, forearms and smaller hands. These pivots remain compatible with catch/point actions.
 const makeArm=(side)=>{
   const shoulder=new THREE.Group();shoulder.position.set(side*.315,1.66,0);g.add(shoulder);
   addMesh(shoulder,new THREE.CapsuleGeometry(.061,.46,8,12),outfit,[0,-.25,0]);
   const elbow=new THREE.Group();elbow.position.set(0,-.54,0);shoulder.add(elbow);
   addMesh(elbow,new THREE.CapsuleGeometry(.052,.43,8,12),skinM,[0,-.235,0]);
   const hand=sphere(elbow,.068,skinM,[0,-.50,0],[.74,1.05,.66]);
   // hint of fingers makes the silhouette less mitten-like
   for(let i=-1;i<=1;i++) addMesh(elbow,new THREE.CapsuleGeometry(.010,.055,4,7),skinM,[i*.018,-.57,.012],[0,0,i*.06],[.8,1,.75]);
   shoulder.rotation.z=-side*.035;return {shoulder,elbow,hand};
 };
 const L=makeArm(-1),R=makeArm(1);
 const faceLight=new THREE.PointLight(feminine?0xff9bc8:0xa7bdff,.24,2.7,2);faceLight.userData.decorativeGlow=true;faceLight.userData.baseIntensity=.24;faceLight.position.set(0,2.25,.88);g.add(faceLight);
 const rimLight=new THREE.PointLight(0xbd83ec,.22,2.8,2);rimLight.userData.decorativeGlow=true;rimLight.userData.baseIntensity=.22;rimLight.position.set(0,1.9,-.9);g.add(rimLight);
 // very small breathing/weight shift gives the characters life without looking like toys bouncing
 const phase=Math.random()*6.28;animations.push(t=>{if(!transitioning){g.rotation.z=Math.sin(t*.55+phase)*.004;head.rotation.y=Math.sin(t*.42+phase)*.025;}});
 g.userData={armLP:L.shoulder,armRP:R.shoulder,elbowL:L.elbow,elbowR:R.elbow,handL:L.hand,handR:R.hand,head,feminine,faceLight};return g;
}
function makeFlower(g,x,z,c=0xd96b9b,s=.12){
 const stem=addMesh(g,new THREE.CylinderGeometry(.012,.018,.34,7),mat(0x315f43),[x,.34,z]);
 // two leaves make flowers readable even at medium camera distance
 for(const side of [-1,1]){const leaf=addMesh(g,new THREE.SphereGeometry(s*.55,10,7),mat(0x3b7450),[x+side*.085,.36,z],[0,0,side*.62],[1.7,.32,.72]);}
 for(let i=0;i<6;i++){const a=i*Math.PI*2/6;const pet=addMesh(g,new THREE.SphereGeometry(s,12,8),mat(c,0x5c1537,.05),[x+Math.cos(a)*s*.92,.61,z+Math.sin(a)*s*.92],[0,0,-a],[1.15,.38,.78]);}
 sphere(g,s*.43,mat(0xe8b967,0x8b5520,.18),[x,.61,z],[1,.65,1]);
}
function makeIsland(scale=1){
 const g=new THREE.Group();
 // Only this child group rotates. Characters, trees, robots and other scene objects
 // are siblings of it, so they stay facing the same direction while the island turns.
 const surface=new THREE.Group();
 g.add(surface);
 g.userData.rotatingSurface=surface;
 g.userData.rotationSpeed=.0105;
 const core=addMesh(surface,new THREE.ConeGeometry(2.7*scale,3.25*scale,10),rock,[0,-1.72*scale,0],[0,Math.PI/10,0],[1,1,1]);core.material=core.material.clone();
 for(let i=0;i<15;i++){const a=i/15*Math.PI*2,r=(i%2?.95:1.28)*scale;const rr=.82+Math.sin(i*2.4)*.16;const b=addMesh(surface,new THREE.DodecahedronGeometry(rr,1),rock,[Math.cos(a)*r,-.58*scale+Math.sin(i)*.10,Math.sin(a)*r],[Math.random()*.18,Math.random(),Math.random()*.16],[1.15*scale,.92*scale,1.2*scale]);b.material=b.material.clone();}
 for(let i=0;i<8;i++){const a=i/8*Math.PI*2;addMesh(surface,new THREE.DodecahedronGeometry(.48+Math.random()*.22,0),mat(0x292239,0x110a22,.08),[Math.cos(a)*1.15*scale,-1.75*scale-Math.random()*.55,Math.sin(a)*1.15*scale],[Math.random(),Math.random(),Math.random()],[.8,1.4,.8]);}
 addMesh(surface,new THREE.CylinderGeometry(3.05*scale,2.7*scale,.48*scale,48),grass,[0,.02,0]);
 addMesh(surface,new THREE.TorusGeometry(2.88*scale,.13*scale,10,48),mat(0x55a36e,0x1f4a34,.25),[0,.17,0],[Math.PI/2,0,0]);
 for(let i=0;i<54;i++){const a=Math.random()*Math.PI*2,r=.5+Math.random()*2.35*scale;makeFlower(surface,Math.cos(a)*r,Math.sin(a)*r,i%3===0?0xb67cff:0xff75b5,.055+Math.random()*.035);}
 for(let i=0;i<9;i++){const a=Math.random()*Math.PI*2,r=1.1+Math.random()*1.55*scale;const mg=new THREE.Group();addMesh(mg,new THREE.CylinderGeometry(.025,.04,.22,7),white,[0,.1,0]);sphere(mg,.10,mat(0xff8bc7,0xff3f99,1.2),[0,.23,0],[1,.45,1]);mg.position.set(Math.cos(a)*r,.25,Math.sin(a)*r);surface.add(mg);}
 for(let i=0;i<8;i++){const a=i/8*Math.PI*2;const gem=sphere(surface,.055,mat(i%2?0xff76b8:0xb67fff,i%2?0xff2f8d:0x7446ff,2.2),[Math.cos(a)*2.78*scale,.28,Math.sin(a)*2.78*scale]);animations.push(t=>gem.scale.setScalar(.85+Math.sin(t*2+i)*.22));}
 // Every island rotates by default. Only the visual surface rotates, never scene occupants.
 const phase=Math.random()*Math.PI*2;
 animations.push(t=>{
  surface.rotation.y=t*(g.userData.rotationSpeed||.0105)+phase;
 });
 return g;
}

function allowEmptyIslandRotation(island,speed=.0105){if(island?.userData?.rotatingSurface)island.userData.rotationSpeed=speed;}
function lantern(){
 const g=new THREE.Group();
 addMesh(g,new THREE.CylinderGeometry(.038,.052,.92,10),mat(0x211925),[0,.45,0]);
 addMesh(g,new THREE.BoxGeometry(.52,.66,.52),mat(0x30212f),[0,.94,0]);
 const glass=new THREE.MeshPhysicalMaterial({color:0xffe1b5,emissive:0xff8b45,emissiveIntensity:1.45,transparent:true,opacity:.80,roughness:.22,transmission:.10});
 addMesh(g,new THREE.BoxGeometry(.34,.47,.34),glass,[0,.94,0]);
 for(const sx of [-1,1])for(const sz of [-1,1])addMesh(g,new THREE.CylinderGeometry(.012,.012,.5,6),mat(0x211925),[sx*.21,.94,sz*.21]);
 addMesh(g,new THREE.ConeGeometry(.38,.25,4),mat(0x211925),[0,1.36,0],[0,Math.PI/4,0]);
 const handle=new THREE.Mesh(new THREE.TorusGeometry(.22,.025,7,20,Math.PI),mat(0x211925));handle.position.set(0,1.49,0);handle.rotation.x=Math.PI/2;g.add(handle);
 const l=glowLight(g,0xffa15f,2.15,6.8);l.position.y=.95;
 const flame=addMesh(g,new THREE.SphereGeometry(.065,10,8),mat(0xffd184,0xff7a32,2.15),[0,.95,0],[0,0,0],[.68,1.60,.68]);
 const phase=Math.random()*6.28;animations.push(t=>{
   flame.scale.y=1.18+Math.sin(t*7+phase)*.20;
   l.intensity=1.75+Math.sin(t*8+phase)*.22;
 });
 return g;
}
function makeCandle(g,p=[0,0,0],scale=1){
 const c=new THREE.Group();c.position.set(...p);c.scale.setScalar(scale);g.add(c);
 addMesh(c,new THREE.CylinderGeometry(.07,.08,.42,14),mat(0xf0dfcf),[0,.21,0]);
 const wick=addMesh(c,new THREE.CylinderGeometry(.008,.008,.07,5),mat(0x2a1c25),[0,.46,0]);
 const flame=addMesh(c,new THREE.SphereGeometry(.075,10,8),mat(0xffd58b,0xff6d24,2.25),[0,.56,0],[0,0,0],[.68,1.58,.68]);
 const l=glowLight(c,0xffa05b,1.85,5.2);l.position.y=.55;const ph=Math.random()*6;
 animations.push(t=>{
   flame.scale.y=1.18+Math.sin(t*9+ph)*.22;
   flame.rotation.z=Math.sin(t*5+ph)*.09;
   l.intensity=1.45+Math.sin(t*8+ph)*.18;
 });return c;
}
function radialGlowTexture(inner='#fff8df',mid='rgba(255,222,170,.34)',outer='rgba(255,190,220,0)'){
 const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');const g=x.createRadialGradient(128,128,0,128,128,128);g.addColorStop(0,inner);g.addColorStop(.18,'rgba(255,242,210,.34)');g.addColorStop(.46,mid);g.addColorStop(1,outer);x.fillStyle=g;x.fillRect(0,0,256,256);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
const moonGlowTex=radialGlowTexture();
function moon(r=2){
 const g=new THREE.Group();
 const moonBody=new THREE.Group();
 g.add(moonBody);
 const surface=new THREE.MeshStandardMaterial({color:0xe2cfaa,roughness:.96,metalness:0,emissive:0x5f482d,emissiveIntensity:.075});
 const m=new THREE.Mesh(new THREE.SphereGeometry(r,64,48),surface);m.castShadow=false;m.receiveShadow=true;moonBody.add(m);
 const craters=[[ -.38,.34,.19],[.23,.39,.12],[.46,.06,.16],[-.2,-.08,.13],[.18,-.32,.20],[-.48,-.28,.11],[.05,.08,.08]];
 craters.forEach(([nx,ny,sz],i)=>{const rr=r*sz,x=nx*r,y=ny*r,z=Math.sqrt(Math.max(.02,r*r-x*x-y*y))+0.012;const c=new THREE.Mesh(new THREE.CircleGeometry(rr,28),new THREE.MeshBasicMaterial({color:i%2?0xa78e6c:0xb59b76,transparent:true,opacity:.16,depthWrite:false}));c.position.set(x,y,z);moonBody.add(c);});
 const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:moonGlowTex,color:0xffdfb5,transparent:true,opacity:.30,depthWrite:false,blending:THREE.AdditiveBlending}));halo.scale.set(r*4.35,r*4.35,1);halo.position.z=-.55;g.add(halo);
 const light=new THREE.PointLight(0xffd9aa,.62,20,2);light.position.set(0,0,1.2);g.add(light);
 for(let i=0;i<20;i++){const a=Math.random()*Math.PI*2,rad=r*(1.4+Math.random()*.65);const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:moonGlowTex,color:i%3?0xffe8c9:0xffa7d3,transparent:true,opacity:.18+Math.random()*.18,depthWrite:false,blending:THREE.AdditiveBlending}));sp.scale.set(.10+Math.random()*.14,.10+Math.random()*.14,1);sp.position.set(Math.cos(a)*rad,Math.sin(a)*rad,(Math.random()-.5)*.4);g.add(sp);const ph=Math.random()*6;animations.push(t=>{sp.material.opacity=.12+(.16*(.5+.5*Math.sin(t*1.5+ph)));sp.position.y+=Math.sin(t*.45+ph)*.00035;});}
 // Very slow cinematic moon rotation. Change .0045 if you want it slower/faster.
 animations.push(t=>{moonBody.rotation.y=t*.0045;});
 return g;
}

function starField(g,count=700,spread=100){const pos=new Float32Array(count*3);for(let i=0;i<count;i++){pos[i*3]=(Math.random()-.5)*spread;pos[i*3+1]=(Math.random()-.5)*spread;pos[i*3+2]=-8-Math.random()*55;}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));const pts=new THREE.Points(geo,new THREE.PointsMaterial({color:0xffffff,size:.065,transparent:true,opacity:.9}));g.add(pts);animations.push(t=>{pts.rotation.y=t*.004;pts.material.opacity=.78+Math.sin(t*.6)*.1;});}
function fireflies(g,count=55,rad=9){for(let i=0;i<count;i++){const s=sphere(g,.018,mat(i%3?0xe8a0bc:0x9e8ad0,i%3?0x7f2e55:0x524183,.55),[(Math.random()-.5)*rad,Math.random()*5,(Math.random()-.5)*rad]);const base=s.position.clone(),sp=.55+Math.random()*.7,ph=Math.random()*6;animations.push(t=>{s.position.y=base.y+Math.sin(t*sp+ph)*.18;s.position.x=base.x+Math.cos(t*sp*.7+ph)*.10;});}}
function makeTree(){const g=new THREE.Group();
 const trunkMat=mat(0x633653,0x3b1738,.34,.78);addMesh(g,new THREE.CylinderGeometry(.58,1.05,5.4,24),trunkMat,[0,2.45,0],[0,0,.035]);for(let r=0;r<7;r++){const a=r/7*Math.PI*2;g.add(curveTube([new THREE.Vector3(0,.25,0),new THREE.Vector3(Math.cos(a)*.85,.08,Math.sin(a)*.85),new THREE.Vector3(Math.cos(a)*1.65,-.02,Math.sin(a)*1.65)],.11,trunkMat,20));}
 const branchEnds=[];for(let i=0;i<13;i++){const ang=-1.25+i*(2.5/12),len=2.5+(i%3)*.42,base=new THREE.Vector3(0,4.0+(i%2)*.22,0),end=new THREE.Vector3(Math.sin(ang)*len,4.8+Math.cos(ang)*1.8,(i%2?.48:-.45));const tube=curveTube([base,new THREE.Vector3(end.x*.45,4.5+Math.random()*.35,end.z*.4),end],.12-(i%3)*.012,trunkMat,18);g.add(tube);branchEnds.push(end);}
 // dense canopy clusters like reference
 for(let i=0;i<72;i++){const a=Math.random()*Math.PI*2,r=1.25+Math.random()*3.1;const y=4.7+Math.random()*1.9-Math.abs(Math.cos(a))*.25;sphere(g,.52+Math.random()*.42,mat(i%3===0?0x9f426d:i%3===1?0x74345d:0xb55279,0x481232,.28),[Math.cos(a)*r,y,Math.sin(a)*r*.42],[1.15,.9,1]);}
 for(let i=0;i<24;i++){const a=Math.random()*Math.PI*2,r=1.3+Math.random()*2.9;makeFlower(g,Math.cos(a)*r,Math.sin(a)*r,0xff93c9,.045);}
 return g;}
function makeCloud(){const g=new THREE.Group();for(let i=0;i<8;i++)sphere(g,.72+Math.random()*.72,new THREE.MeshStandardMaterial({color:0x46325f,transparent:true,opacity:.34,roughness:1}),[(i-3.5)*.72,Math.sin(i)*.22,(Math.random()-.5)],[1.2,.72,1]);return g;}
function ropeBetween(g,a,b,sag=.35){const mid=a.clone().lerp(b,.5);mid.y-=sag;const t=curveTube([a,mid,b],.025,ropeMat,22);g.add(t);return t;}
function makePolaroid(i){
 const fr=new THREE.Group();
 const frame=addMesh(fr,new THREE.BoxGeometry(1.42,1.72,.12),mat(0xfff0e7,0xff8fbd,.62,.48),[0,0,0]);
 const frameGlow=glowLight(fr,0xff9d6f,.65,3.0);frameGlow.position.set(0,.05,.35);
 const glowPhase=i*.9;
 animations.push(t=>{frameGlow.intensity=.58+Math.sin(t*1.15+glowPhase)*.12;});const loader=new THREE.TextureLoader();const pm=new THREE.MeshBasicMaterial({color:i%2?0x6f4063:0x34546c});const memoryUrl=(window.MEMORY_IMAGES&&window.MEMORY_IMAGES[i])||new URL(`memories/memory-${i+1}.svg`,document.baseURI).href;loader.load(memoryUrl,tex=>{tex.colorSpace=THREE.SRGBColorSpace;pm.map=tex;pm.color.set(0xffffff);pm.needsUpdate=true;},undefined,()=>{});addMesh(fr,new THREE.PlaneGeometry(1.16,1.12),pm,[0,.18,.067]);addMesh(fr,new THREE.BoxGeometry(.8,.035,.03),mat(0xd7a9ba),[0,-.61,.075]);return fr;}
function makeLoveMachine(){
 const r=new THREE.Group();
 // Retro love-bot inspired by the approved reference: rounded head, real body, limbs and animated controls.
 const shell=mat(0x34315d,0x221a46,.22,.42,.24);
 const edge=mat(0x574774,0x2a2148,.18,.34,.18);
 const joint=mat(0x25203f,0x151128,.12,.42,.35);
 const metal=mat(0x403753,0x1d1730,.10,.48,.42);

 // head + soft corner pods give a rounded cartoon silhouette
 const head=new THREE.Group();head.position.set(0,2.62,0);r.add(head);
 addMesh(head,new THREE.BoxGeometry(2.75,2.15,1.35),shell,[0,0,0]);
 for(const x of [-1.25,1.25])for(const y of [-.86,.86])sphere(head,.30,edge,[x,y,.02],[1.05,1.05,1.0]);
 for(const sx of [-1,1]){sphere(head,.43,edge,[sx*1.56,0,0],[.78,1.02,.78]);sphere(head,.23,joint,[sx*1.63,0,.03],[.75,1,.75]);}
 // screen bezel and LED name display
 addMesh(head,new THREE.BoxGeometry(2.18,1.43,.17),mat(0x171528,0x171528,.08,.30,.15),[0,.02,.76]);

 // Change this from config.js if needed:
 // window.ROBOT_LED_NAME = "Her Name ❤️";
 const ledCanvas=document.createElement('canvas');
 ledCanvas.width=1024;
 ledCanvas.height=512;
 const ledCtx=ledCanvas.getContext('2d');

 function drawRobotLed(){
   const rawName=(window.ROBOT_LED_NAME||window.HER_NAME||'Name').toString().trim();
   const label=rawName.includes('❤️')||rawName.includes('♥') ? rawName : rawName+' ❤️';

   ledCtx.clearRect(0,0,ledCanvas.width,ledCanvas.height);

   const bg=ledCtx.createLinearGradient(0,0,ledCanvas.width,ledCanvas.height);
   bg.addColorStop(0,'#071729');
   bg.addColorStop(.5,'#12384b');
   bg.addColorStop(1,'#071729');
   ledCtx.fillStyle=bg;
   ledCtx.fillRect(0,0,ledCanvas.width,ledCanvas.height);

   // Subtle LED scan lines.
   ledCtx.globalAlpha=.12;
   ledCtx.fillStyle='#bcecff';
   for(let y=12;y<ledCanvas.height;y+=24)ledCtx.fillRect(0,y,ledCanvas.width,2);
   ledCtx.globalAlpha=1;

   // Soft pink LED glow.
   ledCtx.textAlign='center';
   ledCtx.textBaseline='middle';
   ledCtx.font='700 105px Arial, sans-serif';
   ledCtx.shadowColor='#ff4f9d';
   ledCtx.shadowBlur=34;
   ledCtx.fillStyle='#ffe6f4';
   ledCtx.fillText(label,ledCanvas.width/2,ledCanvas.height/2);
   ledCtx.shadowBlur=0;
 }

 drawRobotLed();
 const ledTexture=new THREE.CanvasTexture(ledCanvas);
 ledTexture.colorSpace=THREE.SRGBColorSpace;

 const screenMat=new THREE.MeshBasicMaterial({
   map:ledTexture,
   toneMapped:false
 });
 const screen=addMesh(head,new THREE.PlaneGeometry(1.82,1.10),screenMat,[0,.02,.87]);

 // Gentle glow around the LED display.
 const screenGlow=glowLight(head,0xff5b9f,.72,3.2);
 screenGlow.position.set(0,.02,1.04);

 const glint=sphere(head,.06,mat(0xffe8ba,0xffc96d,1.4),[-.72,.35,.94]);
 // antenna
 addMesh(head,new THREE.CylinderGeometry(.045,.055,.76,10),metal,[0,1.36,0],[0,0,-.18]);
 const antenna=sphere(head,.13,mat(0xffa0c5,0xff4f92,1.4),[.13,1.73,0]);

 // torso with top chest, lower cabinet and glowing label strip
 const torso=new THREE.Group();torso.position.set(0,.35,0);r.add(torso);
 addMesh(torso,new THREE.BoxGeometry(2.15,2.35,1.22),shell,[0,.55,0]);
 for(const x of [-.72,0,.72])sphere(torso,.18,mat(x<0?0xff6d93:x>0?0xffca63:0x785ec7,x<0?0xff3d77:x>0?0xff9a36:0x4d3f8a,.65),[x,1.18,.70]);
 for(const x of [-.56,.05,.62])sphere(torso,.15,metal,[x,.62,.70]);
 addMesh(torso,new THREE.BoxGeometry(1.45,.30,.10),mat(0x1c1631,0x7a264f,.38),[0,.04,.69]);
 // tiny glowing letters/indicator blocks on the belly
 for(let i=0;i<5;i++){const b=addMesh(torso,new THREE.BoxGeometry(.16,.08,.045),mat(i%2?0xff6e9d:0xffb14d,i%2?0xff326f:0xff8b32,.72),[-.55+i*.28,.04,.76]);animations.push(t=>{b.material.emissiveIntensity=.38+.34*(.5+.5*Math.sin(t*2.4+i));});}
 addMesh(torso,new THREE.BoxGeometry(2.38,.88,1.38),edge,[0,-.94,0]);
 for(const x of [-.62,0,.62]){const lamp=sphere(torso,.13,mat(x<0?0xffb15c:x>0?0xff735c:0xff799f,x<0?0xff8127:x>0?0xff402f:0xff3b75,.65),[x,-.93,.75]);animations.push(t=>lamp.scale.setScalar(.92+.10*Math.sin(t*3+x*3)));}

 // articulated arms and mitten-like hands
 const arms=[];
 for(const sx of [-1,1]){
   const shoulder=new THREE.Group();shoulder.position.set(sx*1.26,1.05,0);torso.add(shoulder);
   sphere(shoulder,.31,joint,[0,0,0]);
   const upper=addMesh(shoulder,new THREE.CapsuleGeometry(.20,.74,8,12),shell,[0,-.58,0]);upper.rotation.z=sx*.10;
   const elbow=new THREE.Group();elbow.position.set(0,-1.10,0);shoulder.add(elbow);sphere(elbow,.22,joint,[0,0,0]);
   const fore=addMesh(elbow,new THREE.CapsuleGeometry(.19,.68,8,12),shell,[0,-.54,0]);
   const hand=new THREE.Group();hand.position.set(0,-1.03,0);elbow.add(hand);sphere(hand,.31,shell,[0,0,0],[1.05,.86,.90]);
   for(let f=0;f<3;f++){const finger=addMesh(hand,new THREE.CapsuleGeometry(.045,.19,5,7),shell,[(f-1)*.10,-.20,.10],[0,0,(f-1)*.18]);}
   arms.push({shoulder,elbow,sx});
 }

 // short sturdy legs + feet make it read as a real robot, not a box
 const legs=[];
 for(const sx of [-1,1]){
   const hip=new THREE.Group();hip.position.set(sx*.65,-1.23,0);torso.add(hip);sphere(hip,.22,joint,[0,0,0]);
   addMesh(hip,new THREE.CapsuleGeometry(.20,.70,8,12),shell,[0,-.55,0]);
   const knee=sphere(hip,.20,joint,[0,-1.03,0]);
   addMesh(hip,new THREE.CapsuleGeometry(.18,.58,8,12),shell,[0,-1.43,0]);
   addMesh(hip,new THREE.BoxGeometry(.62,.28,.86),edge,[sx*.05,-1.83,.14]);
   legs.push(hip);
 }

 // idle motion: head nod, arms sway, antenna blink and screen-heart pulse
 animations.push(t=>{
   head.rotation.z=Math.sin(t*.75)*.022;
   head.position.y=2.62+Math.sin(t*1.05)*.045;
   torso.rotation.z=Math.sin(t*.55)*.008;
   arms[0].shoulder.rotation.z=.10+Math.sin(t*.9)*.09;
   arms[1].shoulder.rotation.z=-.10-Math.sin(t*.9+.6)*.09;
   arms[0].elbow.rotation.z=-.08+Math.sin(t*1.1)*.05;
   arms[1].elbow.rotation.z=.08-Math.sin(t*1.1+.4)*.05;
   antenna.scale.setScalar(.92+.18*(.5+.5*Math.sin(t*3.5)));
   glint.material.emissiveIntensity=.7+.55*(.5+.5*Math.sin(t*2.8));
   screen.material.color.setHSL(.59+Math.sin(t*.2)*.015,.48,.16+.015*Math.sin(t*.8));
 });
 r.userData.robot={head,torso,screen,antenna,arms};
 return r;
}

// global moving sky
const sky=new THREE.Group();scene.add(sky);starField(sky,1250,145);
// Calm cinematic aurora ribbons: extremely low opacity, slow drift, no hard brightness.
for(let i=0;i<4;i++){
 const geo=new THREE.PlaneGeometry(28,4.2,24,4);
 const mm=new THREE.MeshBasicMaterial({color:i%2?0x704990:0x3e5f83,transparent:true,opacity:.028,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
 const ribbon=new THREE.Mesh(geo,mm);ribbon.position.set((i-1.5)*7,8-i*96,-20-i*2);ribbon.rotation.set(-.12,.05*(i-1.5),-.08);sky.add(ribbon);
 const baseX=ribbon.position.x,ph=i*1.7;animations.push(t=>{ribbon.position.x=baseX+Math.sin(t*.08+ph)*2.2;ribbon.rotation.z=-.08+Math.sin(t*.06+ph)*.025;mm.opacity=.022+.014*(.5+.5*Math.sin(t*.09+ph));});
}
for(let i=0;i<9;i++){const c=makeCloud();c.position.set((Math.random()-.5)*38,10-Math.random()*390,-13-Math.random()*13);c.scale.setScalar(1.5+Math.random()*2.5);sky.add(c);animations.push(()=>{c.position.x+=.0012*(i%2?1:-1);});}
function rootAt(i){
 const g=new THREE.Group();g.position.y=-i*sceneGap+1.95;scene.add(g);chapterGroups[i]=g;
 // sparse magical heart-sparkles: decorative, low brightness, never overpowering the scene
 for(let k=0;k<9;k++){
  const hm=mat(k%2?0xc66b98:0x8b6bbd,k%2?0x6f2448:0x47316f,.13,.6);
  const h=makeHeart(.10+Math.random()*.07,hm);h.position.set((Math.random()-.5)*18,1.2+Math.random()*6.5,-4.5-Math.random()*5);h.rotation.z=(Math.random()-.5)*.6;h.material.transparent=true;h.material.opacity=.28+Math.random()*.20;g.add(h);
  const base=h.position.clone(),ph=Math.random()*6.28,sp=.22+Math.random()*.22;
  animations.push(t=>{h.position.y=base.y+Math.sin(t*sp+ph)*.22;h.rotation.y=t*.15+ph;h.material.opacity=.22+(.16*(.5+.5*Math.sin(t*.45+ph)));});
 }
 return g;
}

// 1 Welcome — richer moon garden
{const g=rootAt(0);const isl=makeIsland(1.18);isl.position.set(2,-1.15,0);g.add(isl);const girl=makeCharacter({feminine:true,scale:1.16,shirt:0xa25391});girl.position.set(2,.18,.35);girl.rotation.y=-.62;g.add(girl);const m=moon(1.85);m.position.set(5.6,5.5,-5);g.add(m);for(let i=0;i<7;i++){const l=lantern();l.position.set(-3.8+i*1.25,-.55,1.45+Math.sin(i)*.55);g.add(l)}fireflies(g,70,13);animations.push(t=>{girl.rotation.z=Math.sin(t*.75)*.012;});}

// 2 Two sculpted floating islands that MERGE into one island (no bridge)
let islandA,islandB,mergedIsland,joinHearts=[],boy2,girl2;
{const g=rootAt(1);
 islandA=makeIsland(1.03);islandB=makeIsland(1.03);islandA.position.set(-4.25,-.35,0);islandB.position.set(4.25,-.35,0);g.add(islandA,islandB);
 mergedIsland=makeIsland(1.42);mergedIsland.position.set(0,-.28,0);mergedIsland.scale.set(.01,.01,.01);mergedIsland.visible=false;g.add(mergedIsland);
 boy2=makeCharacter({scale:1.24,shirt:0x496da6});girl2=makeCharacter({feminine:true,scale:1.24,shirt:0x9a4c83});
 boy2.position.set(-4.25,.85,.35);girl2.position.set(4.25,.85,.35);boy2.rotation.y=.72;girl2.rotation.y=-.72;g.add(boy2,girl2);
 // warm edge lanterns + candles on each world
 for(const x of [-5.4,-3.2,3.2,5.4]){const l=lantern();l.scale.setScalar(.72);l.position.set(x,-.2,1.2);g.add(l);} 
 for(const x of [-4.9,-3.7,3.7,4.9])makeCandle(g,[x,.05,-.8],.75);
 for(let i=0;i<42;i++){const h=makeHeart(.055+Math.random()*.055,pink);h.position.set((Math.random()-.5)*5.1,.4+Math.random()*4,-1-Math.random()*2);h.visible=false;g.add(h);joinHearts.push(h);const by=h.position.y;animations.push(t=>{if(h.visible){h.position.y=by+Math.sin(t*1.1+i)*.18;h.rotation.y=t*.55+i;}});}fireflies(g,48,13);
}

// 4 Catch my heart — feathered wings and reaching girl
let catchHeart,heartCatchMode=false,girlCatch;
{const g=rootAt(2);const ground=makeIsland(.88);ground.position.set(-1.5,-1.35,0);g.add(ground);girlCatch=makeCharacter({feminine:true,scale:1.18,shirt:0xa74e91});girlCatch.position.set(-2.0,-.15,.35);girlCatch.rotation.y=.35;g.add(girlCatch);
catchHeart=makeHeart(1.65,pink);catchHeart.position.set(2.25,2.45,0);g.add(catchHeart);
const catchGlow=glowLight(catchHeart,0xff5f9d,4.2,10);
catchHeart.userData.catchGlow=catchGlow;
catchHeart.userData.baseGlow=4.2;
 for(const sx of [-1,1]){const wing=new THREE.Group();wing.position.set(sx*1.02,.14,0);catchHeart.add(wing);for(let j=0;j<6;j++){const feather=addMesh(wing,new THREE.CapsuleGeometry(.12,.78-j*.065,6,10),new THREE.MeshStandardMaterial({color:0xffedf8,emissive:0xffa7d0,emissiveIntensity:.75,transparent:true,opacity:.92}),[sx*(.28+j*.18),.16-j*.10,0],[0,0,sx*(1.05+j*.08)],[1,1,.36]);}animations.push(t=>{wing.rotation.z=sx*(.08+Math.sin(t*7)*.18);});}
 catchHeart.userData.type='catch';animations.push(t=>{
 if(!heartCatchMode){
  catchHeart.position.y=2.5+Math.sin(t*2.2)*.42;
  catchHeart.position.x=2.25+Math.cos(t*.9)*.18;
  catchHeart.rotation.y=Math.sin(t)*.2;
  girlCatch.userData.armRP.rotation.z=-1.08+Math.sin(t*2)*.10;
  girlCatch.userData.elbowR.rotation.z=-.28+Math.sin(t*2)*.06;
 }
});fireflies(g,45,12);}

// 3 Memory lane — cinematic suspended walkway, hanging Polaroids, lantern tunnel
const memoryFrames=[];
{const g=rootAt(3);
 // deep wooden walkway beginning near the camera and vanishing into the garden
 const walkway=new THREE.Group();g.add(walkway);
 const N=24;
 for(let i=0;i<N;i++){
   const z=6.6-i*.53;
   const width=4.65-(i*.025);
   const plank=addMesh(walkway,new THREE.BoxGeometry(width,.16,.43),wood,[1.6,-1.08,z],[0,0,(i%3-1)*.006]);
   plank.material=plank.material.clone();plank.material.color.offsetHSL(0,0,(i%2?-.025:.02));
 }
 // posts, hanging lanterns and side ropes create the same tunnel feeling as the reference
 for(const side of [-1,1]){
   const railPts=[];
   for(let i=0;i<11;i++){
     const z=6-i*1.08, x=1.6+side*2.25;
     addMesh(g,new THREE.CylinderGeometry(.065,.085,2.75,10),wood,[x,.15,z]);
     railPts.push(new THREE.Vector3(x,1.18,z));
     const l=lantern();l.scale.setScalar(.74);l.position.set(x,.98,z+.06);g.add(l);
   }
   const smooth=[];for(let i=0;i<railPts.length-1;i++){smooth.push(railPts[i]);const mid=railPts[i].clone().lerp(railPts[i+1],.5);mid.y-=.24;smooth.push(mid);}smooth.push(railPts.at(-1));g.add(curveTube(smooth,.034,ropeMat,80));
 }
 // overhead clothes-line stretches across the walkway. Photos hang at different depths, not in one flat row.
 const anchors=[
   new THREE.Vector3(-2.9,4.25,-.1),new THREE.Vector3(-1.55,4.55,-.55),new THREE.Vector3(-.15,4.34,-.9),
   new THREE.Vector3(1.25,4.62,-1.2),new THREE.Vector3(2.65,4.36,-1.55),new THREE.Vector3(4.05,4.55,-1.9),new THREE.Vector3(5.35,4.25,-2.25)
 ];
 for(let i=0;i<anchors.length-1;i++)ropeBetween(g,anchors[i],anchors[i+1],.25);
 anchors.forEach((a,i)=>{
   const fr=makePolaroid(i);fr.scale.setScalar(1.28);fr.position.set(a.x,a.y-1.22,a.z);fr.rotation.z=(i%2?.06:-.055);fr.rotation.y=(i-3)*-.035;
   fr.userData={type:'memory',index:i};g.add(fr);memoryFrames.push(fr);interactives.push(fr);
   const cord1=curveTube([new THREE.Vector3(a.x-.42,a.y,a.z),new THREE.Vector3(a.x-.42,a.y-.55,a.z),new THREE.Vector3(a.x-.42,a.y-.72,a.z)],.017,ropeMat,10);
   const cord2=curveTube([new THREE.Vector3(a.x+.42,a.y,a.z),new THREE.Vector3(a.x+.42,a.y-.55,a.z),new THREE.Vector3(a.x+.42,a.y-.72,a.z)],.017,ropeMat,10);g.add(cord1,cord2);
   // tiny wooden clips
   addMesh(g,new THREE.BoxGeometry(.12,.2,.08),gold,[a.x-.42,a.y-.05,a.z]);addMesh(g,new THREE.BoxGeometry(.12,.2,.08),gold,[a.x+.42,a.y-.05,a.z]);
   const baseY=fr.position.y;
   animations.push(t=>{fr.rotation.z=(i%2?.055:-.05)+Math.sin(t*.9+i)*.025;fr.rotation.y=(i-3)*-.035+Math.sin(t*.55+i)*.035;fr.position.y=baseY+Math.sin(t*.7+i)*.035;});
 });
 // blossom banks on both sides of the walkway
 for(let i=0;i<72;i++){const z=6.2-Math.random()*12.2;const side=i%2?-1:1;makeFlower(g,1.6+side*(2.65+Math.random()*1.5),z,i%3?0xff77ba:0xb778ff,.065+Math.random()*.045);}
 for(let i=0;i<9;i++){const l=lantern();l.scale.setScalar(.55);l.position.set(-4.8+i*1.25,-.62,-4.2+Math.sin(i)*.45);g.add(l);}
 for(let i=0;i<24;i++){const x=-2.9+i*(8.2/23),y=4.35+Math.sin(i*.8)*.2,z=-.6-i*.055;const bulb=sphere(g,.045,mat(i%2?0xff9ac7:0xffd58a,i%2?0xff3c9b:0xffa23b,3.2),[x,y,z]);glowLight(bulb,i%2?0xff62ad:0xffbd64,.28,1.6);}
 for(let i=0;i<10;i++)makeCandle(g,[i%2?-3.0:3.0,-.55,5.2-i*1.05],.72);
 fireflies(g,165,22);
}

// 6 Real talk — reference-like moon overlook with couple and four message cards
{const g=rootAt(4);const isl=makeIsland(1.32);isl.position.set(2,-1.72,-.2);g.add(isl);
 // shoreline/bench composition
 addMesh(g,new THREE.BoxGeometry(3.55,.17,.8),wood,[2,.40,.65]);addMesh(g,new THREE.BoxGeometry(3.38,.95,.13),wood,[2,.88,.27]);
 const b=makeCharacter({scale:1.08,shirt:0x4d668e}),f=makeCharacter({feminine:true,scale:1.08,shirt:0x9c4d89});b.position.set(1.15,.05,1.08);f.position.set(2.85,.05,1.08);b.rotation.y=.10;f.rotation.y=-.10;g.add(b,f);
 // make them lean gently toward one another
 b.rotation.z=-.025;f.rotation.z=.025;
 const m=moon(2.7);m.position.set(2.0,5.9,-5.8);g.add(m);
 // reflective moon path made of soft emissive discs
 for(let i=0;i<12;i++){const q=addMesh(g,new THREE.CircleGeometry(.36+i*.07,28),new THREE.MeshBasicMaterial({color:0xffdca7,transparent:true,opacity:.10}),[2,-.77,-.2-i*.36],[ -Math.PI/2,0,0]);q.scale.x=1+i*.08;}
 for(let i=0;i<9;i++){const l=lantern();l.position.set(-3.9+i*1.32,-.66,2.2+Math.sin(i*.8)*.48);g.add(l)}
 for(let i=0;i<20;i++){const a=Math.random()*Math.PI*2,r=.5+Math.random()*4.5;makeFlower(g,2+Math.cos(a)*r,Math.sin(a)*r,i%2?0xff78b8:0xb876ff,.06+Math.random()*.035);}
 fireflies(g,105,17);
}

// 5 Funny moment — full retro love laboratory with readable machine activity
let scanBars=[];
{const g=rootAt(5);const platform=makeIsland(1.12);platform.position.set(2.1,-1.72,0);g.add(platform);const robot=makeLoveMachine();robot.scale.setScalar(1.14);robot.position.set(-3.0,-.45,-.15);g.add(robot);
 const b=makeCharacter({scale:.98,shirt:0x596fac}),f=makeCharacter({feminine:true,scale:.98,shirt:0xaa5592});b.visible=false;f.visible=false;b.position.set(-.35,-.23,.65);f.position.set(1.08,-.23,.65);b.rotation.y=.12;f.rotation.y=-.12;g.add(b,f);
 // floating science-ish hearts, bulbs and particles around machine
 for(let i=0;i<20;i++){const h=makeHeart(.11+Math.random()*.07,pink);h.position.set(-2.4+i*.72,3.8+Math.sin(i)*.35,-.5-Math.random());g.add(h);animations.push(t=>{h.position.y=3.8+Math.sin(t*1.25+i)*.2;h.rotation.y=t*.8+i;});}
 for(let i=0;i<6;i++){const l=lantern();l.scale.setScalar(.66);l.position.set(-3.2+i*1.5,-.66,2.0+Math.sin(i)*.3);g.add(l);}fireflies(g,85,17);
}

// 7 Heart Garden — dense blossom tree + hanging interactive heart lamps
const gardenHearts=[];
{const g=rootAt(6);const base=makeIsland(1.08);base.position.set(1.6,-1.55,0);g.add(base);const tree=makeTree();tree.position.set(2,-1.18,0);g.add(tree);const b=makeCharacter({scale:.82,shirt:0x566e9e});b.position.set(.8,-.4,1.0);g.add(b);const gardenAnchors=[
[-2.70,2.10,1.55],
[-1.55,3.05,1.60],
[-.35,3.65,1.65],
[.90,3.55,1.65],
[2.10,3.00,1.60],
[2.85,2.05,1.55]
];
for(let i=0;i<6;i++){
 const p=gardenAnchors[i];
 const anchor=new THREE.Vector3(2+p[0],2.25+p[1],p[2]);
 const h=makeHeart(.68,pink);h.position.copy(anchor);
 h.userData={type:'gardenHeart',index:i,base:h.scale.clone()};
 g.add(h);gardenHearts.push(h);interactives.push(h);
 h.material.emissiveIntensity=.68;
 const l=glowLight(h,0xff5a9f,1.85,4.7);l.position.z=.2;
 h.userData.glowLight=l;h.userData.baseGlow=1.85;h.userData.baseEI=.68;
 const cord=curveTube([new THREE.Vector3(anchor.x,anchor.y+.55,anchor.z),new THREE.Vector3(anchor.x,anchor.y+.15,anchor.z)],.015,ropeMat,6);
 g.add(cord);
 animations.push(t=>{
   h.rotation.y=Math.sin(t*.8+i)*.22;
   h.position.y=anchor.y+Math.sin(t*1.05+i)*.055;
   if(hoverObj!==h){
     h.material.emissiveIntensity=.68+Math.sin(t*1.05+i)*.08;
     l.intensity=1.85+Math.sin(t*.95+i)*.25;
   }
 });
}
const gardenCandlePos=[
 [-1.15,-.62,.55],[-.30,-.62,.82],[.55,-.62,.98],[1.40,-.62,1.06],
 [2.25,-.62,1.02],[3.10,-.62,.88],[3.95,-.62,.68],[4.45,-.62,.38]
];
gardenCandlePos.forEach(p=>makeCandle(g,p,.72));
fireflies(g,72,15);}

// 8/9 Question portals — richer fantasy gate
for(let idx=7;idx<=8;idx++){const g=rootAt(idx);const base=makeIsland(.93);base.position.set(1,-1.55,0);g.add(base);allowEmptyIslandRotation(base,.0105);for(let i=0;i<2;i++){addMesh(g,new THREE.CylinderGeometry(.36,.54,6,18),mat(0x5d3a68,0x6b2f87,.65),[(i?1:-1)*3,1.8,0]);const l=lantern();l.position.set((i?1:-1)*3,4.4,.2);g.add(l);}const arch=new THREE.Mesh(new THREE.TorusGeometry(3,.34,14,44,Math.PI),mat(0x68407d,0xff66b3,.65));arch.position.set(0,4.7,0);g.add(arch);for(let i=0;i<9;i++){const h=makeHeart(.31,pink);h.position.set((i-4)*.72,1.1+Math.sin(i)*.45,.35);g.add(h);animations.push(t=>{h.rotation.y=t*(.35+i*.018);h.position.y=1.1+Math.sin(t+i)*.08;});}fireflies(g,65,13);}

// 10 Thank-you tree + properly attached pointing arm
const thanksHearts=[];let thanksBoy,thanksGirl;
{const g=rootAt(9);const base=makeIsland(1.12);base.position.set(1.6,-1.55,0);g.add(base);const tree=makeTree();tree.position.set(2,-1.12,0);g.add(tree);thanksBoy=makeCharacter({scale:.94,shirt:0x536da0});thanksGirl=makeCharacter({feminine:true,scale:.94,shirt:0xa25090});thanksBoy.position.set(.45,-.38,1.15);thanksGirl.position.set(2.15,-.38,1.15);thanksBoy.rotation.y=.08;thanksGirl.rotation.y=-.08;g.add(thanksBoy,thanksGirl);const thanksAnchors=[
[-2.65,2.05,1.60],
[-1.45,3.00,1.65],
[-.25,3.60,1.70],
[1.00,3.55,1.70],
[2.15,2.95,1.65],
[2.80,2.00,1.60]
];
for(let i=0;i<6;i++){
 const p=thanksAnchors[i];
 const anchor=new THREE.Vector3(2+p[0],2.25+p[1],p[2]);
 const h=makeHeart(.66,pink);h.position.copy(anchor);
 h.userData={type:'thanksHeart',index:i,base:h.scale.clone()};
 g.add(h);thanksHearts.push(h);interactives.push(h);
 h.material.emissiveIntensity=.82;
 const thankGlow=glowLight(h,0xff5a9f,2.35,5.0);
 h.userData.glowLight=thankGlow;h.userData.baseGlow=2.35;h.userData.baseEI=.82;
 const cord=curveTube([new THREE.Vector3(anchor.x,anchor.y+.5,anchor.z),new THREE.Vector3(anchor.x,anchor.y+.12,anchor.z)],.014,ropeMat,6);
 g.add(cord);
 animations.push(t=>{
   h.rotation.y=Math.sin(t*.72+i)*.20;
   h.position.y=anchor.y+Math.sin(t*.95+i)*.045;
   if(hoverObj!==h){
     h.material.emissiveIntensity=.82+Math.sin(t*1.15+i)*.10;
     thankGlow.intensity=2.35+Math.sin(t*1.05+i)*.32;
   }
 });
}
const thanksCandlePos=[
 [-1.10,-.62,.48],[-.25,-.62,.76],[.60,-.62,.95],[1.45,-.62,1.05],
 [2.30,-.62,1.02],[3.15,-.62,.90],[4.00,-.62,.70],[4.48,-.62,.42]
];
thanksCandlePos.forEach(p=>makeCandle(g,p,.72));
fireflies(g,78,15);}

// 11 Forever moon meadow
{const g=rootAt(10);const isl=makeIsland(1.2);isl.position.set(1,-1.35,0);g.add(isl);const b=makeCharacter({scale:1.03,shirt:0x566fa5}),f=makeCharacter({feminine:true,scale:1.03,shirt:0xa24f90});b.position.set(.25,.0,.3);f.position.set(1.8,.0,.3);b.rotation.y=.08;f.rotation.y=-.08;g.add(b,f);const m=moon(2.45);m.position.set(1.1,5.55,-5.3);g.add(m);for(let i=0;i<24;i++){const h=makeHeart(.13,pink);h.position.set((Math.random()-.5)*10,Math.random()*7-1,(Math.random()-.5)*4);g.add(h);animations.push(t=>{h.position.y+=.0025;if(h.position.y>7)h.position.y=-1;h.rotation.y=t;});}fireflies(g,70,14);}

// 12 Finale
let finalHeart;
{const g=rootAt(11);finalHeart=makeHeart(3.15,pink);finalHeart.position.set(2,2,-1);g.add(finalHeart);glowLight(finalHeart,0xff2f87,6.5,19);const m=moon(2.0);m.position.set(-3.7,4.8,-6);g.add(m);for(let i=0;i<90;i++){const h=makeHeart(.065+Math.random()*.06,pink);h.position.set((Math.random()-.5)*15,(Math.random()-.5)*9,(Math.random()-.5)*8);g.add(h);animations.push(t=>{h.rotation.x=t*.45+i;h.rotation.y=t*.65;});}animations.push(t=>finalHeart.scale.setScalar(1+Math.sin(t*2.4)*.05));fireflies(g,80,16);}

scene.add(new THREE.HemisphereLight(0x746b9d,0x06040d,.48));
const rim=new THREE.DirectionalLight(0x9b86d2,.75);rim.position.set(-8,6,-6);scene.add(rim);
const warmRim=new THREE.DirectionalLight(0xd783a8,.62);warmRim.position.set(8,3,4);scene.add(warmRim);
const dl=new THREE.DirectionalLight(0xffd7e8,.82);dl.position.set(5,10,8);dl.castShadow=!MOBILE_GPU_MODE;if(!MOBILE_GPU_MODE)dl.shadow.mapSize.set(2048,2048);dl.shadow.camera.left=-16;dl.shadow.camera.right=16;dl.shadow.camera.top=16;dl.shadow.camera.bottom=-16;scene.add(dl);const moonFill=new THREE.PointLight(0x8e83bd,.30,70,2);moonFill.position.set(0,8,-8);moonFill.visible=!MOBILE_GPU_MODE;scene.add(moonFill);const romanticFill=new THREE.PointLight(0xd86998,.22,55,2);romanticFill.position.set(7,3,6);romanticFill.visible=!MOBILE_GPU_MODE;scene.add(romanticFill);



// Real phones have much lower fragment-shader light limits than laptop GPUs.
// The complete experience contains many decorative PointLights across all 12 chapters.
// On mobile, enable only a small number belonging to the CURRENT chapter.
// Emissive materials + bloom remain active, so candles/hearts still visibly glow.
function applyMobileLightBudget(){
 if(!MOBILE_GPU_MODE)return;

 // Turn off all decorative point lights first (including chapters currently off-camera).
 scene.traverse(o=>{
   if(o.isPointLight && o.userData?.decorativeGlow){
     o.visible=false;
   }
 });

 const group=chapterGroups[current];
 if(!group)return;

 // Keep only a modest number of real point lights in the active chapter.
 // This avoids mobile shader compilation/uniform-limit failures.
 const active=[];
 group.traverse(o=>{
   if(o.isPointLight && o.userData?.decorativeGlow) active.push(o);
 });

 const MAX_CHAPTER_POINT_LIGHTS=7;
 active.slice(0,MAX_CHAPTER_POINT_LIGHTS).forEach(l=>{
   l.visible=true;
   if(l.userData.baseIntensity!==undefined && (!Number.isFinite(l.intensity)||l.intensity<=0)){
     l.intensity=l.userData.baseIntensity;
   }
 });
}

// Fine mobile-only group offsets. They do not alter desktop positions.
function applyMobileSceneOffsets(){
 const mobile=getViewport().w<760;
 chapterGroups.forEach((g,i)=>{
  if(!g)return;
  if(g.userData.baseX===undefined)g.userData.baseX=g.position.x;
  if(g.userData.baseY===undefined)g.userData.baseY=g.position.y;
  g.position.x=g.userData.baseX;
  g.position.y=g.userData.baseY;
 });
 if(!mobile)return;
 // Memory lane: center the walkway/frames.
 if(chapterGroups[3])chapterGroups[3].position.x-=.35;
 // Heart Garden: move the complete tree downward so all hanging hearts
 // stay below the text and inside a tall phone screen.
 if(chapterGroups[6]){chapterGroups[6].position.x-=.30;chapterGroups[6].position.y-=1.55;}
 // Question arches: center arch and island together.
 if(chapterGroups[7])chapterGroups[7].position.x+=.05;
 if(chapterGroups[8])chapterGroups[8].position.x+=.05;
 // Thank-you tree: same downward correction as the Heart Garden.
 if(chapterGroups[9]){chapterGroups[9].position.x-=.25;chapterGroups[9].position.y-=1.55;}
 // Finale: balance moon on left and large heart on right.
 if(chapterGroups[11])chapterGroups[11].position.x+=.20;
}

function showCopy(){applyMobileLightBudget();const c=chapters[current];copy.classList.add('out');
 document.body.className=`scene-${current+1}`;
 backBtn.style.display=current>0?'block':'none';
 realTalkCards.classList.toggle('hidden',current!==4);
 compatibilityPanel.classList.toggle('hidden',current!==5);
 if(current!==7 && current!==8)fbPanel?.classList.add('hidden');
 setTimeout(()=>{eyeEl.textContent=`${c.n}. ${c.e}`;titleEl.textContent=c.t;subEl.textContent=c.s;chapterEl.textContent=c.n;actions.innerHTML='';const b=document.createElement('button');b.className='action';b.textContent=c.b;b.onclick=()=>{unlockAudio();c.a()};actions.appendChild(b);copy.classList.remove('out');},280);
}
function magicBurst(x=getViewport().w/2,y=getViewport().h/2){flash.animate([{opacity:0},{opacity:.18,offset:.32},{opacity:.08,offset:.62},{opacity:0}],{duration:1250,easing:'cubic-bezier(.22,.61,.36,1)'});for(let i=0;i<40;i++){const p=document.createElement('span');p.className='petal';p.textContent=i%3?'✦':'♥';p.style.left=x+'px';p.style.top=y+'px';p.style.setProperty('--dx',`${(Math.random()-.5)*320}px`);p.style.setProperty('--dy',`${(Math.random()-.5)*260}px`);p.style.color=i%2?'#ff83bd':'#b98aff';document.querySelector('#petalLayer').appendChild(p);setTimeout(()=>p.remove(),1550);}play('magic.mp3');}
const cameraZ=[14.2,13.2,13.4,11.8,12.7,12.2,12.8,13.6,13.6,12.5,13.2,14.0];

// Mobile-only composition targets. Desktop continues to use the original framing.
// Order: Welcome, Story, Catch, Memory, Real Talk, Funny, Garden, Q1, Q2, Thanks, Forever, Finale.
const mobileExtraZ=[5.3,5.2,5.1,6.0,5.5,5.6,6.2,6.2,6.2,6.0,5.5,7.2];
const mobileLookX=[1.15,0.00,-.15,1.05,1.10,-.55,1.55,0.00,0.00,1.45,.55,-.65];
const mobileLookYOffset=[
 -1.10, // 01 welcome
 -1.00, // 02 story
 -.95,  // 03 catch
 -.85,  // 04 memory
 -.95,  // 05 real talk
 -.95,  // 06 funny
 -.65,  // 07 garden
 -.90,  // 08 questions
 -.90,  // 09 more questions
 -.60,  // 10 thank you
 -.80,  // 11 forever
 -.75   // 12 finale
];
const mobileCameraX=[.20,0,-.05,.15,.15,-.18,.25,0,0,.20,.10,-.20];

function targetCameraZ(i){
  const {w,h}=getViewport();
  const portrait=w<760,narrow=w<1050;
  const ratio=h/w;
  const tallExtra=0;
  return (cameraZ[i]||13.2)+(portrait?(mobileExtraZ[i]||5.6)+tallExtra:narrow?1.5:0);
}
function targetFov(){
 const {w}=getViewport();
 if(w<430)return 63;
 if(w<760)return 60;
 return w<1050?52:48;
}
function tweenCamera(toIndex,dur=2750){
 if(transitioning)return;
 transitioning=true;
 const mobile=getViewport().w<760;
 const fromY=camera.position.y,toY=3.8-toIndex*sceneGap;
 const fromZ=camera.position.z,toZ=targetCameraZ(toIndex);
 const fromX=camera.position.x,toX=mobile?(mobileCameraX[toIndex]||0):0;
 const start=performance.now();
 copy.classList.add('out');magicBurst();
 setTimeout(()=>magicBurst(getViewport().w*.52,getViewport().h*.48),720);
 function step(now){
  const p=Math.min(1,(now-start)/dur),e=p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;
  camera.position.x=THREE.MathUtils.lerp(fromX,toX,e);
  camera.position.y=THREE.MathUtils.lerp(fromY,toY,e);
  camera.position.z=THREE.MathUtils.lerp(fromZ,toZ,e)-Math.sin(Math.PI*p)*(mobile?.52:.82);
  camera.rotation.z=Math.sin(Math.PI*p)*(mobile?.004:.012);
  if(p<1)requestAnimationFrame(step);
  else{camera.position.x=toX;camera.position.z=toZ;camera.rotation.z=0;transitioning=false;showCopy();}
 }
 requestAnimationFrame(step);
}
function resetCatchForBackNavigation(){
 if(!catchHeart||!girlCatch)return;
 catchHeart.visible=true;
 heartCatchMode=false;
 catchHeart.position.set(2.25,2.45,0);
 catchHeart.scale.setScalar(1);
 catchHeart.rotation.set(0,0,0);
 catchHeart.material.emissiveIntensity=.85;
 const glow=catchHeart.userData.catchGlow;
 if(glow){
   glow.visible=true;
   glow.intensity=catchHeart.userData.baseGlow||4.2;
   glow.distance=10;
 }
 // Return the girl's arms to the normal reaching/idle pose.
 if(girlCatch.userData.armRP)girlCatch.userData.armRP.rotation.z=-1.08;
 if(girlCatch.userData.elbowR)girlCatch.userData.elbowR.rotation.z=-.28;
 if(girlCatch.userData.armLP)girlCatch.userData.armLP.rotation.z=0;
 if(girlCatch.userData.elbowL)girlCatch.userData.elbowL.rotation.z=0;
}

function goBack(){
 if(transitioning || current<=0)return;

 const target=current-1;

 // If returning to Catch My Heart after it was already completed,
 // restore the heart so the scene is usable again.
 if(target===2)resetCatchForBackNavigation();

 current=target;
 tweenCamera(current);
}

backBtn.onclick=()=>{
 unlockAudio();
 goBack();
};

function advance(){if(current<chapters.length-1){current++;tweenCamera(current)}}
function connectWorlds(){
 if(transitioning)return;const start=performance.now();copy.classList.add('out');magicBurst();
 mergedIsland.visible=true;
 function f(n){
  const p=Math.min(1,(n-start)/2300),e=p<.5?2*p*p:1-Math.pow(-2*p+2,2)/2;
  // islands move inward and overlap while the larger shared island grows underneath them
  islandA.position.x=THREE.MathUtils.lerp(-4.25,-.55,e);islandB.position.x=THREE.MathUtils.lerp(4.25,.55,e);
  islandA.position.y=THREE.MathUtils.lerp(-.35,-.34,e);islandB.position.y=THREE.MathUtils.lerp(-.35,-.34,e);
  const fade=Math.max(.01,1-Math.max(0,(p-.60)/.36));islandA.scale.setScalar(fade);islandB.scale.setScalar(fade);
  const grow=Math.min(1,p/.72);mergedIsland.scale.setScalar(THREE.MathUtils.smoothstep(grow,0,1));
  boy2.position.x=THREE.MathUtils.lerp(-4.25,-.72,e);girl2.position.x=THREE.MathUtils.lerp(4.25,.72,e);
  boy2.position.y=girl2.position.y=THREE.MathUtils.lerp(.85,.92,e);
  boy2.rotation.y=THREE.MathUtils.lerp(.72,.18,e);girl2.rotation.y=THREE.MathUtils.lerp(-.72,-.18,e);
  if(p>.56)joinHearts.forEach(h=>h.visible=true);
  if(p<1)requestAnimationFrame(f);else{islandA.visible=false;islandB.visible=false;mergedIsland.scale.setScalar(1);setTimeout(()=>advance(),850)}
 }
 requestAnimationFrame(f)
}
function catchHeartSequence(){
 if(heartCatchMode||!catchHeart?.visible)return;
 heartCatchMode=true;unlockAudio();

 const glow=catchHeart.userData.catchGlow;
 if(glow){glow.intensity=7.6;glow.distance=13.5;}
 catchHeart.material.emissiveIntensity=2.6;
 magicBurst(getViewport().w*.68,getViewport().h*.48);

 const st=performance.now();
 const from=catchHeart.position.clone();

 const armR=girlCatch.userData.armRP, elbowR=girlCatch.userData.elbowR;
 const armL=girlCatch.userData.armLP, elbowL=girlCatch.userData.elbowL;

 const armR0=armR.rotation.z, armL0=armL.rotation.z;
 const elbowR0=elbowR.rotation.z, elbowL0=elbowL.rotation.z;

 const catchParent=catchHeart.parent;

 function getChestTarget(){
   // Move the heart to the girl's chest so BOTH arms can hug around it.
   girlCatch.updateMatrixWorld(true);
   catchParent.updateMatrixWorld(true);
   const chestWorld=new THREE.Vector3(0,1.28,.72);
   girlCatch.localToWorld(chestWorld);
   const local=catchParent.worldToLocal(chestWorld.clone());
   local.z+=.18;
   return local;
 }

 function step(n){
   const p=Math.min(1,(n-st)/1950);

   // Heart starts glowing immediately and pulses while flying.
   if(glow){
     glow.intensity=7.0+Math.sin(p*Math.PI*8)*1.4;
     glow.distance=13.2;
   }
   catchHeart.material.emissiveIntensity=2.4+Math.sin(p*Math.PI*8)*.45;

   // Girl opens/reaches first, then wraps BOTH arms around the heart.
   const reach=Math.min(1,p/.45);
   const re=1-Math.pow(1-reach,3);

   const hug=Math.max(0,(p-.40)/.60);
   const he=1-Math.pow(1-Math.min(1,hug),3);

   // reach
   armR.rotation.z=THREE.MathUtils.lerp(armR0,-1.35,re);
   armL.rotation.z=THREE.MathUtils.lerp(armL0, 1.10,re);
   elbowR.rotation.z=THREE.MathUtils.lerp(elbowR0,-.58,re);
   elbowL.rotation.z=THREE.MathUtils.lerp(elbowL0, .48,re);

   // hug inward around chest
   armR.rotation.z=THREE.MathUtils.lerp(armR.rotation.z,-1.02,he);
   armL.rotation.z=THREE.MathUtils.lerp(armL.rotation.z, 1.02,he);
   elbowR.rotation.z=THREE.MathUtils.lerp(elbowR.rotation.z,-1.10,he);
   elbowL.rotation.z=THREE.MathUtils.lerp(elbowL.rotation.z, 1.10,he);

   const fly=Math.max(0,(p-.12)/.88);
   const fe=1-Math.pow(1-Math.min(1,fly),3);
   const target=getChestTarget();

   // Magical curved flight into her arms.
   catchHeart.position.set(
     THREE.MathUtils.lerp(from.x,target.x,fe),
     THREE.MathUtils.lerp(from.y,target.y,fe)+Math.sin(Math.PI*fe)*.62,
     THREE.MathUtils.lerp(from.z,target.z,fe)
   );
   catchHeart.rotation.z=Math.sin(fe*Math.PI*3)*.08;
   catchHeart.rotation.y=THREE.MathUtils.lerp(catchHeart.rotation.y,0,fe);
   catchHeart.scale.setScalar(1-.46*fe);

   if(p<1)requestAnimationFrame(step);
   else{
     const held=getChestTarget();
     catchHeart.position.copy(held);
     catchHeart.rotation.set(0,0,0);
     catchHeart.scale.setScalar(.54);

     // Final hugging pose.
     armR.rotation.z=-1.02;
     armL.rotation.z= 1.02;
     elbowR.rotation.z=-1.10;
     elbowL.rotation.z= 1.10;

     if(glow){glow.intensity=8.4;glow.distance=14.5;}
     catchHeart.material.emissiveIntensity=3.0;

     magicBurst(getViewport().w*.42,getViewport().h*.56);
     play('success.mp3');
     subEl.textContent='Got it… ❤️ It was always yours.';

     // Hold the hug long enough to clearly see it.
     setTimeout(()=>{
       // Keep the hugged heart from returning to its old flying/idle path.
       // Hide it exactly as the next chapter starts.
       if(glow){glow.intensity=catchHeart.userData.baseGlow||4.2;glow.distance=10;}
       catchHeart.material.emissiveIntensity=.85;
       catchHeart.visible=false;
       advance();
       // Leave catch mode locked for this chapter so the idle animator
       // can never bring the same heart back during the camera transition.
     },1800);
   }
 }
 requestAnimationFrame(step);
}

function runScan(){
 magicBurst();
 const targets=[110,87,120,98,1000];
 const metricEls=[...compatibilityPanel.querySelectorAll('.metric strong')];
 const metricFills=[...compatibilityPanel.querySelectorAll('.metric-fill')];
 const result=compatibilityPanel.querySelector('.compat-result');
 result.classList.add('pending');
 metricEls.forEach((el,i)=>{el.dataset.emoji=['❤️','😅','❤️','🍪','😍'][i];el.textContent='0% '+el.dataset.emoji;});
 metricFills.forEach(b=>b.style.width='0%');
 const total=1850,st=performance.now();
 function tick(n){
  const p=Math.min(1,(n-st)/total),e=1-Math.pow(1-p,3);
  metricEls.forEach((el,i)=>{const local=Math.max(0,Math.min(1,(p-i*.055)/(1-i*.055)));el.textContent=Math.round(targets[i]*(1-Math.pow(1-local,3)))+'% '+el.dataset.emoji;});
  metricFills.forEach((b,i)=>{const local=Math.max(0,Math.min(1,(p-i*.06)/(1-i*.06)));const fill=Math.min(1,targets[i]/120);b.style.width=(fill*(1-Math.pow(1-local,3))*100).toFixed(1)+'%';});
  if(p<1)requestAnimationFrame(tick);else{
   metricEls.forEach((el,i)=>el.textContent=targets[i]+'% '+el.dataset.emoji);
   result.classList.remove('pending');subEl.textContent='Result: You are perfect for me! ❤️';play('success.mp3');
   const b=actions.querySelector('button');if(b){b.textContent='Continue to the garden ✨';b.onclick=()=>advance();}
  }
 }
 requestAnimationFrame(tick);
}
function finale(){magicBurst();play('success.mp3');const st=performance.now();function a(n){const p=Math.min(1,(n-st)/2000);finalHeart.rotation.y=p*Math.PI*2;finalHeart.scale.setScalar(1+p*.5+Math.sin(p*Math.PI*8)*.04);if(p<1)requestAnimationFrame(a)}requestAnimationFrame(a)}

const memoryPanel=document.querySelector('#memoryPanel');document.querySelectorAll('.close').forEach(b=>b.onclick=()=>{const host=b.closest('.panel, .feedback-dock');if(host)host.classList.add('hidden');});
function openMemory(i){document.querySelector('#memoryImg').src=(window.MEMORY_IMAGES&&window.MEMORY_IMAGES[i])||new URL(`memories/memory-${i+1}.svg`,document.baseURI).href;document.querySelector('#memoryTitle').textContent=`Memory ${i+1}`;document.querySelector('#memoryText').textContent=['One tiny moment that became important to me.','One of those days I would happily live again.','A picture, but also a whole feeling.','Somehow ordinary days became memories with you.','I remember how I felt here more than anything else.','One for the forever folder.','Still one of my favourite chapters.'][i];memoryPanel.classList.remove('hidden');play('memory.mp3')}

const feedback=[
 ['Do you feel cared for by me?','select',['Not enough','Sometimes','Most of the time','Very much']],
 ['When you’re upset, do you feel I understand you properly?','select',['Not really','Sometimes','Usually','Always']],
 ['Do you feel safe telling me anything without worrying about my reaction?','select',['No','Sometimes','Yes']],
 ['Is there anything I do that hurts you even if I don’t realize it?','text'],
 ['Do I give you enough attention and time?','select',['Not really','Sometimes','Yes','More than enough']],
 ['Do you feel I respect your feelings even when we disagree?','select',['Not enough','Sometimes','Usually','Always']],
 ['What is one thing I do that makes you feel loved the most?','text'],
 ['What is one thing I should improve as your partner?','text'],
 ['When we fight, what do you wish I handled differently?','text'],
 ['Do I support your goals and decisions?','select',['Not really','Sometimes','Yes, always']],
 ['Is there something you need more from me emotionally?','text'],
 ['If you could change one thing about the way I take care of you, what would it be?','text'],
 ['What is something you have been afraid to tell me because you didn’t know how I would take it?','text']
];
const fbPanel=document.querySelector('#feedbackPanel'), fields=document.querySelector('#feedbackFields');const answers={};
function openFeedback(part){fields.innerHTML='';const list=part===0?feedback.slice(0,7):feedback.slice(7);list.forEach(([q,type,opts],j)=>{const idx=(part===0?0:7)+j;const lab=document.createElement('label');lab.textContent=`${idx+1}. ${q}`;fields.appendChild(lab);let el;if(type==='select'){el=document.createElement('select');el.innerHTML='<option value="">Choose…</option>'+opts.map(o=>`<option>${o}</option>`).join('')}else{el=document.createElement('textarea');el.placeholder='Write your answer…'}el.value=answers[idx]||'';el.oninput=()=>answers[idx]=el.value;el.onchange=()=>{answers[idx]=el.value;const next=fields.children[(j+1)*2];if(next)setTimeout(()=>next.scrollIntoView({behavior:'smooth',block:'start'}),180)};el.onfocus=()=>setTimeout(()=>el.scrollIntoView({behavior:'smooth',block:'center'}),120);fields.appendChild(el)});fbPanel.dataset.part=part;
 fbPanel.classList.remove('hidden');
 // The same dock is reused for Q1-7 and Q8-13. Reset its previous scroll
 // position so part two always starts visibly at Question 8.
 requestAnimationFrame(()=>{
  fields.scrollTop=0;
  fbPanel.scrollTop=0;
  const scroller=fbPanel.querySelector('.feedback-scroll');
  if(scroller)scroller.scrollTop=0;
  const first=fields.querySelector('label');
  first?.scrollIntoView({block:'start',behavior:'auto'});
 });
}
document.querySelector('#submitFeedback').onclick=async()=>{const part=+fbPanel.dataset.part;if(part===0){fbPanel.classList.add('hidden');advance();return;} const status=document.querySelector('#feedbackStatus');status.textContent='Saving…';const endpoint=window.GOOGLE_SCRIPT_URL||'';try{if(endpoint)await fetch(endpoint,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain'},body:JSON.stringify({submittedAt:new Date().toISOString(),answers:feedback.map((q,i)=>({question:q[0],answer:answers[i]||''}))})});status.textContent=endpoint?'Saved ❤️':'Saved locally for demo. Add your Google Apps Script URL before publishing.';localStorage.setItem('love-feedback',JSON.stringify(answers));setTimeout(()=>{fbPanel.classList.add('hidden');advance()},900)}catch(e){status.textContent='Could not send. Your answers are kept on this device.';localStorage.setItem('love-feedback',JSON.stringify(answers));}}

function pointBoyAt(target){
 const arm=thanksBoy.userData.armRP;
 const worldTarget=new THREE.Vector3();target.getWorldPosition(worldTarget);
 const shoulderWorld=new THREE.Vector3();arm.getWorldPosition(shoulderWorld);
 const parent=arm.parent;const localTarget=parent.worldToLocal(worldTarget.clone());
 const dir=localTarget.sub(arm.position).normalize();
 // arm mesh is authored down the local -Y axis, so rotate that axis exactly toward the selected heart in 3D
 const targetQ=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,-1,0),dir);
 const fromQ=arm.quaternion.clone(),st=performance.now();
 const elbow=thanksBoy.userData.elbowR,elbowFrom=elbow.rotation.z;
 function a(n){const p=Math.min(1,(n-st)/720),e=1-Math.pow(1-p,3);arm.quaternion.slerpQuaternions(fromQ,targetQ,e);elbow.rotation.z=THREE.MathUtils.lerp(elbowFrom,-.06,e);if(p<1)requestAnimationFrame(a)}requestAnimationFrame(a)
}
function handleObject(o,event){if(o.userData.type==='memory'){magicBurst(event.clientX,event.clientY);openMemory(o.userData.index)}else if(o.userData.type==='gardenHeart'){
 magicBurst(event.clientX,event.clientY);
 if(o.userData.glowLight){
   o.userData.glowLight.intensity=7.5;o.userData.glowLight.distance=7.2;
   o.material.emissiveIntensity=2.8;
   const base=o.userData.base?.clone();
   if(base)o.scale.copy(base).multiplyScalar(1.34);
   setTimeout(()=>{
     o.userData.glowLight.intensity=o.userData.baseGlow||1.85;
     o.userData.glowLight.distance=4.7;
     o.material.emissiveIntensity=o.userData.baseEI||.68;
     if(base)o.scale.copy(base);
   },700);
 }
 play(`heart-${String(o.userData.index+1).padStart(2,'0')}.mp3`);
}else if(o.userData.type==='thanksHeart'){
 magicBurst(event.clientX,event.clientY);
 pointBoyAt(o);
 if(o.userData.glowLight){
   o.userData.glowLight.intensity=7.2;
   o.userData.glowLight.distance=7.0;
   const base=o.userData.base?.clone();
   if(base)o.scale.copy(base).multiplyScalar(1.38);
   setTimeout(()=>{
     if(o.userData.glowLight){
       o.userData.glowLight.intensity=o.userData.baseGlow||1.55;
       o.userData.glowLight.distance=4.1;
     }
     if(base)o.scale.copy(base);
   },700);
 }
 play(`thanks-${String(o.userData.index+1).padStart(2,'0')}.mp3`);
}else if(o.userData.type==='catch'){if(!heartCatchMode)return;magicBurst(event.clientX,event.clientY);heartCatchMode=false;const st=performance.now(),from=catchHeart.position.clone();function a(n){const p=Math.min(1,(n-st)/700);catchHeart.scale.setScalar(1+p*.8);catchHeart.rotation.z=p*Math.PI*2;if(p<1)requestAnimationFrame(a);else{catchHeart.visible=false;subEl.textContent='Fine… it was already yours anyway. ❤️';setTimeout(()=>advance(),1300)}}requestAnimationFrame(a)}}
function pick(e){const vp=getViewport();mouse.x=e.clientX/vp.w*2-1;mouse.y=-(e.clientY/vp.h)*2+1;raycaster.setFromCamera(mouse,camera);const hit=raycaster.intersectObjects(interactives,true).find(h=>h.object.visible);let root=hit?.object;while(root && !root.userData.type)root=root.parent;if(hoverObj && hoverObj!==root){
 if(hoverObj.userData.base)hoverObj.scale.copy(hoverObj.userData.base);
 if(hoverObj.material&&hoverObj.userData.baseEI!==undefined)hoverObj.material.emissiveIntensity=hoverObj.userData.baseEI;
 if((hoverObj.userData.type==='thanksHeart'||hoverObj.userData.type==='gardenHeart')&&hoverObj.userData.glowLight){
   hoverObj.userData.glowLight.intensity=hoverObj.userData.baseGlow||1.85;
   hoverObj.userData.glowLight.distance=hoverObj.userData.type==='thanksHeart'?5.0:4.7;
 }
}hoverObj=root||null;if(root){canvas.style.cursor='pointer';if(root.userData.base){
 root.scale.copy(root.userData.base).multiplyScalar(1.28);
 if(root.material&&root.material.emissive){
   if(root.userData.baseEI===undefined)root.userData.baseEI=root.material.emissiveIntensity||0;
   root.material.emissiveIntensity=Math.max(2.2,root.userData.baseEI*2.6);
 }
 if(root.userData.type==='thanksHeart'&&root.userData.glowLight){
   root.userData.glowLight.intensity=4.9;
   root.userData.glowLight.distance=5.8;
 }
}if(root.userData.type?.includes('Heart')){heartLabel.style.opacity=1;heartLabel.style.left=(e.clientX+12)+'px';heartLabel.style.top=(e.clientY-12)+'px';heartLabel.textContent='♥ Touch me';}}else{canvas.style.cursor='default';heartLabel.style.opacity=0;}}
addEventListener('pointermove',e=>{pick(e);const vp=getViewport();pointerTarget={x:e.clientX/vp.w-.5,y:e.clientY/vp.h-.5};});addEventListener('pointerdown',e=>{unlockAudio();pick(e);if(hoverObj)handleObject(hoverObj,e)});

// subtle drag/look parallax and scroll safeguard
addEventListener('wheel',e=>{if(transitioning||document.querySelector('.panel:not(.hidden)'))return;if(Math.abs(e.deltaY)>80){const b=actions.querySelector('button');b?.animate([{transform:'scale(1)'},{transform:'scale(1.06)'},{transform:'scale(1)'}],{duration:420});}}, {passive:true});
addEventListener('keydown',e=>{if(e.key==='Enter')actions.querySelector('button')?.click()});

let nextShootingStar=2.5,shootingStar=null;
function spawnShootingStar(t){
 if(shootingStar)scene.remove(shootingStar);
 const g=new THREE.Group();
 const head=new THREE.Mesh(new THREE.SphereGeometry(.055,10,8),new THREE.MeshBasicMaterial({color:0xfff3df}));
 const tail=new THREE.Mesh(new THREE.CylinderGeometry(.012,.045,2.8,8),new THREE.MeshBasicMaterial({color:0xffc5e3,transparent:true,opacity:.45}));
 tail.rotation.z=Math.PI/2.8;tail.position.set(-1.05,.78,0);g.add(head,tail);
 const y=3.8-current*sceneGap+5.5+Math.random()*3.2;g.position.set(7.5+Math.random()*2.5,y,-5.5);scene.add(g);shootingStar={g,start:t};
}
function updateShootingStar(t){
 if(t>=nextShootingStar){spawnShootingStar(t);nextShootingStar=t+4.7+Math.random()*1.2;}
 if(shootingStar){const p=(t-shootingStar.start)/1.35;if(p>=1){scene.remove(shootingStar.g);shootingStar=null;}else{shootingStar.g.position.x=8.5-p*17;shootingStar.g.position.y+=.018;shootingStar.g.children.forEach(o=>{if(o.material?.opacity!==undefined)o.material.opacity=Math.max(0,.55*(1-p));});}}
}

function animate(){
 requestAnimationFrame(animate);
 const shootT=clock.getElapsedTime();updateShootingStar(shootT);
 const t=shootT;animations.forEach(fn=>fn(t));
 const vp=getViewport(),mobile=vp.w<760,baseY=3.8-current*sceneGap;
 if(!transitioning){
  if(mobile){
   const desiredX=mobileCameraX[current]||0;
   camera.position.x=THREE.MathUtils.lerp(camera.position.x,desiredX,.045);
   const parY=pointerTarget?-pointerTarget.y*.08:0;
   // Keep the camera slightly ABOVE the scene and deliberately look downward.
   // This is stable on real phones even when browser chrome changes viewport height.
   camera.position.y=THREE.MathUtils.lerp(camera.position.y,baseY+1.05+parY,.055);
   camera.lookAt(
     mobileLookX[current]||0,
     baseY+(mobileLookYOffset[current]??-.9),
     -4.2
   );
  }else if(pointerTarget){
   camera.position.x=THREE.MathUtils.lerp(camera.position.x,pointerTarget.x*1.15,.035);
   camera.position.y=THREE.MathUtils.lerp(camera.position.y,baseY-pointerTarget.y*.55,.035);
   camera.lookAt(camera.position.x*.04,baseY+2.55,-4.2);
  }else camera.lookAt(0,baseY+2.55,-4.2);
 }
 composer.render();
}
showCopy();animate();

function syncViewport(){
 VIEW=getViewport();
 if(backBtn){
   if(VIEW.w<760){
     // Mobile: keep Back away from headings and modal close buttons.
     backBtn.style.left='auto';
     backBtn.style.right='18px';
     backBtn.style.top='auto';
     backBtn.style.bottom='26px';
     backBtn.style.padding='9px 14px';
     backBtn.style.fontSize='12px';
   }else{
     backBtn.style.bottom='auto';
     backBtn.style.right='auto';
     backBtn.style.left='22px';
     backBtn.style.top='66px';
     backBtn.style.padding='9px 14px';
     backBtn.style.fontSize='13px';
   }
 }
 applyMobileSceneOffsets();
 applyMobileLightBudget();
 camera.aspect=VIEW.w/VIEW.h;
 camera.fov=targetFov();
 camera.position.z=targetCameraZ(current);
 if(VIEW.w<760)camera.position.x=mobileCameraX[current]||0;
 camera.updateProjectionMatrix();
 renderer.setSize(VIEW.w,VIEW.h,false);
 composer.setSize(VIEW.w,VIEW.h);
 bloomPass.setSize(VIEW.w,VIEW.h);
}
addEventListener('resize',syncViewport);
addEventListener('orientationchange',()=>setTimeout(syncViewport,180));
if(window.visualViewport){
 window.visualViewport.addEventListener('resize',syncViewport);
 window.visualViewport.addEventListener('scroll',syncViewport);
}
syncViewport();
setTimeout(syncViewport,250);
setTimeout(syncViewport,900);
