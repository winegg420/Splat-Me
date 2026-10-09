import * as T from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { random, replayFrameIndex, type FaceShape, type Round } from './simulation';

const vertex = `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const cameraFragment = `
precision highp float;
varying vec2 vUv;
uniform sampler2D cameraImage;
uniform float live, time, impact, stain, nearMiss, aspect;
uniform vec4 face;
uniform float roll;
uniform vec2 anchors[5];
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
vec3 footage(vec2 uv){
 if(live>.5) return texture2D(cameraImage,vec2(1.-clamp(uv.x,.001,.999),clamp(uv.y,.001,.999))).rgb;
 vec2 q=uv-.5;float grid=step(.985,fract(uv.x*28.))+step(.985,fract(uv.y*16.));
 return vec3(.008,.010,.007)+vec3(.008,.012,.006)*(1.-length(q))+grid*.003;
}
void main(){
 vec2 uv=vUv;
 vec2 pixel=(uv-face.xy)*vec2(aspect,1.);
 float c=cos(roll),s=sin(roll);
 vec2 local=mat2(c,-s,s,c)*pixel/max(face.w,.03);
 float mask=1.-smoothstep(.55,1.2,length(local));
 // Warp source UVs, so these are the actual camera pixels, not an overlaid sticker.
 float squash=impact*mask;
 vec2 warped=pixel;
 warped.x*=1.-squash*.28;
 warped.y*=1.+squash*.24;
 vec2 nose=uv-anchors[0];float noseMask=exp(-dot(nose*vec2(aspect,1.),nose*vec2(aspect,1.))/max(.0002,face.w*face.w*.18));
 uv=face.xy+warped/vec2(aspect,1.)-nose*squash*noseMask*.6;
 uv.x+=sin(local.y*7.+time*28.)*.008*squash;
 vec3 color=footage(uv);
 // Organic face-local deposits: landmark anchors, irregular boundaries, hanging rivulets,
 // directional highlights and a dark meniscus. Hidden immediately when tracking is lost.
 if(stain>.001){for(int i=0;i<5;i++){
   vec2 d=(vUv-anchors[i])*vec2(aspect,1.)/max(face.w,.035);
   d=mat2(c,-s,s,c)*d;
   if(abs(d.x)<.55&&abs(d.y)<.75){
   float a=atan(d.y,d.x);
   float radius=.20+float(i)*.014+.035*sin(a*3.+float(i)*2.)+.024*sin(a*7.+float(i))+.025*noise(d*18.);
   float body=length(d*vec2(.85,1.15));
   float drip=length(vec2(d.x*3.6,(d.y+.19)*.8));
   float field=min(body,drip+.07);
   float edge=1.-smoothstep(radius-.012,radius+.008,field);
   float grain=noise(d*35.+float(i)*8.);
   float light=clamp(.55+d.y*.8-d.x*.7,0.,1.);
   vec3 mud=mix(vec3(.018,.006,.002),vec3(.14,.052,.015),light)+grain*.007;
   float glint=exp(-pow((d.x+.055)*15.,2.)-pow((d.y-.085)*22.,2.));
   mud+=vec3(.8,.55,.27)*glint*.23;
   float rim=smoothstep(radius-.055,radius,field);
   mud*=1.-rim*.4;
   color=mix(color,mud,edge*stain);
 }}}
 float vignette=smoothstep(.3,.8,length((vUv-.5)*vec2(1.,.8)));
 color*=1.-vignette*(.16+nearMiss*.28);
 // Short warm impact exposure; no full white strobe.
 color+=impact*.045*vec3(1.,.75,.45);
 if(nearMiss>.01){vec2 q=vUv-.5;float rays=pow(max(0.,sin(atan(q.y,q.x)*39.+time*5.)),18.);color+=rays*nearMiss*.18*smoothstep(.25,.7,length(q));}
 gl_FragColor=vec4(color,1.);
}`;

function coilGeometry() {
  const centers: T.Vector3[] = [], n = 220, sides = 14;
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = t * Math.PI * 5.6, r = .64 * Math.pow(1 - t, .8);
    centers.push(new T.Vector3(Math.cos(a) * r + .15 * Math.pow(t, 8), 1.3 * (1-Math.pow(1-t,1.2)) - .56, Math.sin(a) * r));
  }
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  for (let i = 0; i <= n; i++) {
    const tangent = centers[Math.min(n, i + 1)].clone().sub(centers[Math.max(0, i - 1)]).normalize();
    const normal = new T.Vector3(0,1,0).cross(tangent).normalize(), binormal = tangent.clone().cross(normal).normalize();
    const radius = .32 * Math.pow(1 - i / n, .4) + .007;
    for (let j = 0; j <= sides; j++) {
      const a = j / sides * Math.PI * 2;
      const p = centers[i].clone().addScaledVector(normal, Math.cos(a) * radius).addScaledVector(binormal, Math.sin(a) * radius);
      positions.push(p.x,p.y,p.z); uv.push(i / n * 6, j / sides);
      if (i < n && j < sides) { const v = i * (sides + 1) + j; indices.push(v,v+1,v+sides+1,v+1,v+sides+2,v+sides+1); }
    }
  }
  for(const end of [0,n]){const index=positions.length/3;positions.push(...centers[end].toArray());uv.push(0,0);for(let j=0;j<sides;j++){const v=end*(sides+1)+j;if(end===0)indices.push(index,v+1,v);else indices.push(index,v,v+1);}}
  const geo = new T.BufferGeometry(); geo.setAttribute('position',new T.Float32BufferAttribute(positions,3)); geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2)); geo.setIndex(indices); geo.computeVertexNormals(); return geo;
}

type ReplayFrame = { target: T.WebGLRenderTarget; time: number };
export class ImpactRenderer {
  readonly renderer: T.WebGLRenderer;
  readonly videoTexture: T.VideoTexture;
  readonly scene = new T.Scene();
  readonly camera = new T.PerspectiveCamera(42, 16/9, .1, 100);
  private background = new T.Scene();
  private ortho = new T.Camera();
  private backgroundMaterial: T.ShaderMaterial;
  private blitMaterial = new T.ShaderMaterial({ uniforms: { image: { value: null } }, vertexShader: vertex, fragmentShader: `varying vec2 vUv;uniform sampler2D image;void main(){gl_FragColor=texture2D(image,vUv);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }` });
  private blit = new T.Scene();
  private full = new T.WebGLRenderTarget(960,540,{ depthBuffer:true });
  private model = new T.Group();
  private drops: T.InstancedMesh;
  private splash: T.Mesh;
  private shadow: T.Mesh;
  private scratch = new T.Object3D();
  private particles: { vx:number;vy:number;vz:number;size:number;stretch:number }[] = [];
  private frames: ReplayFrame[] = [];
  private writeIndex = 0;
  private lastRecord = -Infinity;
  private replayFrames: ReplayFrame[] = [];
  private replayStart = 0;
  private lastSeed = -1;
  private environment: T.WebGLRenderTarget;
  private detailsTexture: T.DataTexture;
  private gpuExtension: any;
  private pendingGpu: WebGLQuery | null = null;
  gpuMs: number | null = null;
  replay = false;
  replayTime = 0;
  replayRate = .35;
  replayMemoryMB = 0;
  renderMs = 0;
  recordMs = 0;
  width = 960;
  height = 540;
  quality = 'Yüksek';
  get effectState(){return {warp:this.backgroundMaterial.uniforms.impact.value,stain:this.backgroundMaterial.uniforms.stain.value,anchors:this.backgroundMaterial.uniforms.anchors.value.map((a:T.Vector2)=>[a.x,a.y])};}
  private slowFrames = 0;
  private qualityScale = 1;
  constructor(canvas: HTMLCanvasElement, video: HTMLVideoElement) {
    this.renderer = new T.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1); this.renderer.setSize(this.width,this.height,false);
    this.renderer.autoClear = false; this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1;
    const gl = this.renderer.getContext(); this.gpuExtension = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    const room = new RoomEnvironment(), pmrem = new T.PMREMGenerator(this.renderer);
    this.environment = pmrem.fromScene(room,.04); this.scene.environment = this.environment.texture; room.dispose(); pmrem.dispose();
    this.camera.position.z = 6;
    this.videoTexture = new T.VideoTexture(video); this.videoTexture.colorSpace = T.SRGBColorSpace;
    this.backgroundMaterial = new T.ShaderMaterial({ uniforms: {
      cameraImage:{value:this.videoTexture}, live:{value:0}, time:{value:0}, impact:{value:0}, stain:{value:0}, nearMiss:{value:0}, aspect:{value:16/9},
      face:{value:new T.Vector4(.5,.5,.15,.22)}, roll:{value:0}, anchors:{value:Array.from({length:5},()=>new T.Vector2(.5,.5))},
    }, vertexShader:vertex, fragmentShader:cameraFragment, depthTest:false, depthWrite:false });
    this.background.add(new T.Mesh(new T.PlaneGeometry(2,2),this.backgroundMaterial));
    this.blit.add(new T.Mesh(new T.PlaneGeometry(2,2),this.blitMaterial));
    const data = new Uint8Array(128*128*4), rng = random(741);
    for(let i=0;i<data.length;i+=4){const value=100+rng()*75;data[i]=data[i+1]=data[i+2]=value;data[i+3]=255;}
    this.detailsTexture = new T.DataTexture(data,128,128); this.detailsTexture.wrapS = this.detailsTexture.wrapT = T.RepeatWrapping; this.detailsTexture.needsUpdate=true;
    const material = new T.MeshPhysicalMaterial({ color:0x50250f, roughness:.4, metalness:0, clearcoat:.4, clearcoatRoughness:.26, bumpMap:this.detailsTexture, bumpScale:.014, envMapIntensity:.65 });
    this.model.add(new T.Mesh(coilGeometry(),material));
    const base = new T.Mesh(new T.SphereGeometry(.67,32,16),material); base.scale.set(1,.4,.88); base.position.y=-.55; this.model.add(base);
    this.scene.add(this.model);
    const key = new T.DirectionalLight(0xffdcb3,2.5); key.position.set(-3,5,7); this.scene.add(key);
    const rim = new T.DirectionalLight(0xc3e9ff,1.7); rim.position.set(4,2,-3); this.scene.add(rim);
    this.scene.add(new T.HemisphereLight(0xffebce,0x281208,.7));
    this.drops = new T.InstancedMesh(new T.SphereGeometry(1,10,8),material,160); this.drops.instanceMatrix.setUsage(T.DynamicDrawUsage); this.drops.frustumCulled=false; this.scene.add(this.drops);
    const shape=new T.Shape(), randomShape=random(241);
    for(let i=0;i<96;i++){const a=i/96*Math.PI*2,r=.75+randomShape()*.18+(i%6===0?.5:0);const x=Math.cos(a)*r,y=Math.sin(a)*r;if(i===0)shape.moveTo(x,y);else shape.lineTo(x,y);} shape.closePath();
    this.splash=new T.Mesh(new T.ExtrudeGeometry(shape,{depth:.055,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.025,bevelThickness:.025}),material); this.scene.add(this.splash);
    this.shadow = new T.Mesh(new T.PlaneGeometry(1,1),new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{opacity:{value:0}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec2 vUv;uniform float opacity;void main(){float a=exp(-dot(vUv-.5,vUv-.5)*18.)*opacity;gl_FragColor=vec4(.025,.009,.002,a);}`}));
    this.scene.add(this.shadow);
    this.allocateReplay();
  }
  private allocateReplay() {
    // 52 x 640x360 RGBA = 45.7 MiB. Mobile 52 x 480x270 = 25.7 MiB.
    const budget=innerWidth<700?480*270:640*360,aspect=this.width/this.height;
    const w=Math.round(Math.sqrt(budget*aspect)),h=Math.round(w/aspect);
    for(const f of this.frames) f.target.dispose();
    this.frames=Array.from({length:52},()=>({target:new T.WebGLRenderTarget(w,h,{depthBuffer:false}),time:-Infinity}));
    this.replayMemoryMB=w*h*4*52/1048576;this.writeIndex=0;this.replayFrames=[];
  }
  resize(aspect:number) {
    const budget=innerWidth<700?960*540:1280*720;
    const width=Math.min(1280,Math.round(Math.sqrt(budget*aspect)),Math.max(640,Math.round(this.renderer.domElement.clientWidth)));
    const height=Math.round(width/aspect);
    if(width===this.width&&height===this.height)return;
    const aspectChanged=Math.abs(this.width/this.height-aspect)>.01;
    this.width=width;this.height=height;this.camera.aspect=aspect;this.camera.updateProjectionMatrix();
    this.renderer.setSize(width,height,false);this.full.setSize(Math.round(width*this.qualityScale),Math.round(height*this.qualityScale));
    if(aspectChanged){this.endReplay();this.allocateReplay();}
  }
  private world(point:{x:number;y:number}) { const h=2*6*Math.tan(T.MathUtils.degToRad(21)); return new T.Vector3((point.x-.5)*h*this.camera.aspect,(.5-point.y)*h,0); }
  private seed(seed:number) {const rng=random(seed);this.particles=Array.from({length:160},()=>{const a=rng()*Math.PI*2,s=1+rng()*5;return{vx:Math.cos(a)*s,vy:Math.sin(a)*s+1,vz:rng()*4-1,size:.018+rng()*.075,stretch:1+rng()*2};});this.lastSeed=seed;}
  draw(time:number, round:Round, face:FaceShape|null, points:Float32Array|null, live:boolean, stain:boolean, record=true) {
    if(this.replay&&this.replayFrames.length){
      const started=performance.now();
      this.replayTime=this.replayFrames[0].time+(time-this.replayStart)*this.replayRate;
      const index=replayFrameIndex(this.replayFrames.map(f=>f.time),this.replayTime);
      this.copy(this.replayFrames[index].target.texture,null);
      this.renderMs=performance.now()-started;this.recordMs=0;this.gpuMs=null;
      if(this.replayTime>this.replayFrames.at(-1)!.time+.08)this.endReplay();
      return;
    }
    const started=performance.now(), u=this.backgroundMaterial.uniforms, elapsed=time-round.impact;
    const hit=round.outcome==='hit'&&elapsed>=0;
    const punch=hit&&elapsed<.6?Math.sin(Math.min(1,elapsed/.035)*Math.PI/2)*Math.exp(-elapsed*7):0;
    const near=round.outcome==='near'&&elapsed<.8?Math.exp(-elapsed*4):0;
    u.live.value=live?1:0;u.time.value=time;u.impact.value=face?punch:0;u.nearMiss.value=near;u.aspect.value=this.camera.aspect;u.stain.value=face&&stain?1:0;
    if(face){
      u.face.value.set(face.x,1-face.y,face.rx,face.ry);u.roll.value=-face.roll;
      const ids=[1,117,346,50,280];
      ids.forEach((id,i)=>{const x=points?1-points[id*3]:face.x+(i%2?-.5:.5)*face.rx;const y=points?1-points[id*3+1]:1-face.y+(i<3?.05:-.05);u.anchors.value[i].set(x,y);});
    }
    const flight=time-round.start, inFlight=flight>=0&&flight<round.duration&&!round.outcome;
    const passing=(round.outcome==='near'||round.outcome==='miss')&&elapsed>=0&&elapsed<.4;
    this.model.visible=inFlight||passing||round.start===-Infinity;
    if(inFlight){
      const t=Math.min(1,flight/round.duration), world=this.world(round.target), z=-22+22*t;
      this.model.position.set(world.x+(1-t)*Math.sin(t*9)*1.3,world.y+(1-t)*2.2,z);
      this.model.scale.setScalar(.42);this.model.rotation.set(.15+Math.sin(t*7)*.15,flight*4,Math.sin(t*6)*.25);
    } else if(passing){this.model.position.copy(this.world(round.target));this.model.position.z=elapsed*18;this.model.rotation.y=time*5;}
    else if(round.start===-Infinity){this.model.position.set(0,.15,0);this.model.scale.setScalar(1.1);this.model.rotation.set(.05,time*.3,Math.sin(time)*.035);}
    const origin=this.world(round.target);
    this.shadow.visible=inFlight;this.shadow.position.copy(origin);this.shadow.position.z=-.1;this.shadow.scale.set(1.6,1.6,1);
    (this.shadow.material as T.ShaderMaterial).uniforms.opacity.value=inFlight?.22*Math.pow(flight/round.duration,4):0;
    this.splash.visible=hit&&elapsed<.24;
    if(this.splash.visible){this.splash.position.copy(origin);this.splash.position.z=.15;this.splash.scale.setScalar(.2+elapsed*3.5);this.splash.rotation.z=round.seed;}
    this.drops.visible=hit&&elapsed<1.8;
    if(this.drops.visible){
      if(this.lastSeed!==round.seed)this.seed(round.seed);
      const life=Math.max(0,1-elapsed/1.8);
      for(let i=0;i<this.particles.length;i++){
        const p=this.particles[i],d=this.scratch;d.position.copy(origin).add(new T.Vector3(p.vx*elapsed,p.vy*elapsed-3.4*elapsed*elapsed,p.vz*elapsed));
        d.rotation.set(elapsed*4+i,elapsed*6,i);d.scale.set(p.size*life,p.size*p.stretch*life,p.size*life);d.updateMatrix();this.drops.setMatrixAt(i,d.matrix);
      }this.drops.instanceMatrix.needsUpdate=true;
    }
    const gl=this.renderer.getContext() as WebGL2RenderingContext, ext=this.gpuExtension;
    if(ext&&this.pendingGpu&&gl.getQueryParameter(this.pendingGpu,gl.QUERY_RESULT_AVAILABLE)){
      if(!gl.getParameter(ext.GPU_DISJOINT_EXT))this.gpuMs=gl.getQueryParameter(this.pendingGpu,gl.QUERY_RESULT)/1e6;
      gl.deleteQuery(this.pendingGpu);this.pendingGpu=null;
    }
    const query=ext&&!this.pendingGpu?gl.createQuery():null;
    if(query)gl.beginQuery(ext.TIME_ELAPSED_EXT,query);
    this.renderer.setRenderTarget(this.full);this.renderer.clear();this.renderer.render(this.background,this.ortho);this.renderer.clearDepth();this.renderer.render(this.scene,this.camera);
    this.recordMs=0;
    if(record&&!this.replay&&time-this.lastRecord>=1/24){
      const before=performance.now(), frame=this.frames[this.writeIndex];this.copy(this.full.texture,frame.target);frame.time=time;this.writeIndex=(this.writeIndex+1)%this.frames.length;this.lastRecord=time;this.recordMs=performance.now()-before;
    }
    this.copy(this.full.texture,null);
    if(query){gl.endQuery(ext.TIME_ELAPSED_EXT);this.pendingGpu=query;}
    this.renderMs=performance.now()-started;
    if(Math.max(this.renderMs,this.gpuMs??0)>22)this.slowFrames++;else this.slowFrames=Math.max(0,this.slowFrames-1);
    if(this.slowFrames>12&&this.qualityScale>.4){this.qualityScale=Math.max(.4,this.qualityScale*.75);this.quality=`Adaptif · %${Math.round(this.qualityScale*100)}`;this.full.setSize(Math.round(this.width*this.qualityScale),Math.round(this.height*this.qualityScale));this.slowFrames=0;}
  }
  private copy(texture:T.Texture,target:T.WebGLRenderTarget|null){this.blitMaterial.uniforms.image.value=texture;this.renderer.setRenderTarget(target);this.renderer.clear();this.renderer.render(this.blit,this.ortho);}
  beginReplay(time:number) {
    const newest=Math.max(...this.frames.map(f=>f.time));
    this.replayFrames=this.frames.filter(f=>Number.isFinite(f.time)&&newest-f.time<2.3).sort((a,b)=>a.time-b.time);
    if(this.replayFrames.length<6)return false;
    this.replay=true;this.replayStart=time;this.replayTime=this.replayFrames[0].time;return true;
  }
  endReplay(){this.replay=false;}
  clearReplay(){this.endReplay();this.frames.forEach(f=>f.time=-Infinity);this.lastRecord=-Infinity;}
  dispose(){
    if(this.pendingGpu)(this.renderer.getContext() as WebGL2RenderingContext).deleteQuery(this.pendingGpu);
    for(const frame of this.frames)frame.target.dispose();this.full.dispose();this.environment.dispose();this.videoTexture.dispose();this.detailsTexture.dispose();
    const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();
    for(const scene of [this.scene,this.background,this.blit])scene.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());this.renderer.dispose();
  }
}
