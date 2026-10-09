import * as T from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { replayFrameIndex, type FaceShape, type Round } from './simulation';
import { FluidScene } from './fluid';
import { FaceDeposits } from './deposits';

const vertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
export function impactEnvelope(age:number){return age<0||age>.46?0:Math.sin(Math.min(1,age/.035)*Math.PI/2)*Math.exp(-age*7.8)*Math.cos(Math.max(0,age-.09)*14);}
const cameraFragment=`precision highp float;
varying vec2 vUv;uniform sampler2D cameraImage;uniform float live,impact,aspect,nearMiss,time;uniform vec4 face;uniform vec2 anchors[5];uniform float direction;
vec2 metric(vec2 p){return p*vec2(aspect,1.);}
vec2 bulge(vec2 uv,vec2 center,float radius,float amount){vec2 d=uv-center;float f=exp(-dot(metric(d),metric(d))/(radius*radius));return d*f*amount;}
void main(){
 vec2 uv=vUv;float radius=max(.04,face.w);
 // Inverse sampling deforms the actual source pixels, with independent anatomical controls.
 uv-=bulge(vUv,anchors[1],radius*.47,impact*.64);
 uv-=bulge(vUv,anchors[2],radius*.47,impact*.50);
 float nose=exp(-dot(metric(vUv-anchors[0]),metric(vUv-anchors[0]))/pow(radius*.36,2.));
 uv.x-=direction*radius*.23*impact*nose;
 vec2 mouth=(anchors[3]+anchors[4])*.5,d=metric(vUv-mouth);
 float lips=exp(-dot(d*vec2(.65,1.7),d*vec2(.65,1.7))/pow(radius*.38,2.));
 uv.x-=(vUv.x-mouth.x)*impact*.65*lips;uv.y+=impact*radius*.08*lips;
 float mask=exp(-dot(metric(vUv-face.xy),metric(vUv-face.xy))/pow(radius*.85,2.));
 uv.x-=direction*impact*.022*mask*(vUv.y-face.y)/radius;
 vec3 c=live>.5?texture2D(cameraImage,vec2(1.-clamp(uv.x,.001,.999),clamp(uv.y,.001,.999))).rgb:vec3(.055,.060,.052);
 c=mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));
 float vignette=smoothstep(.35,.85,length(vUv-.5));c*=1.-vignette*(.1+nearMiss*.4);
 if(nearMiss>.01){vec2 q=vUv-.5;float rays=pow(max(0.,sin(atan(q.y,q.x)*39.+time*5.)),18.);c+=rays*nearMiss*.12*smoothstep(.25,.7,length(q));}
 gl_FragColor=vec4(c,1.);
 #include <colorspace_fragment>
}`;
type ReplayFrame={target:T.WebGLRenderTarget;time:number;face:FaceShape|null;points:Float32Array|null;live:boolean};
export class ImpactRenderer {
 readonly renderer:T.WebGLRenderer;
 readonly camera=new T.PerspectiveCamera(42,16/9,.1,100);
 readonly scene=new T.Scene();
 readonly fluid=new FluidScene();
 readonly deposits=new FaceDeposits();
 readonly videoTexture:T.VideoTexture;
 private fixture?:T.Texture;
 private ortho=new T.Camera();
 private background=new T.Scene();
 private backgroundMaterial:T.ShaderMaterial;
 private copyScene=new T.Scene();
 private copyMaterial=new T.ShaderMaterial({uniforms:{image:{value:null}},vertexShader:vertex,fragmentShader:`varying vec2 vUv;uniform sampler2D image;void main(){gl_FragColor=texture2D(image,vUv);}`});
 private overlay=new T.Scene();
 private fx=new T.WebGLRenderTarget(960,540,{depthBuffer:true});
 private overlayMaterial=new T.ShaderMaterial({uniforms:{image:{value:this.fx.texture}},vertexShader:vertex,fragmentShader:`varying vec2 vUv;uniform sampler2D image;void main(){vec4 c=texture2D(image,vUv);gl_FragColor=vec4(c.rgb/max(c.a,.001),c.a);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`,transparent:true,depthTest:false,depthWrite:false});
 private environment:T.WebGLRenderTarget;
 private frames:ReplayFrame[]=[];
 private replayFrames:ReplayFrame[]=[];
 private writeIndex=0;
 private lastRecord=-Infinity;
 private replayStart=0;
 private impactTime=-Infinity;
 private depositedAt=-Infinity;
 private scale=1;
 private slow=0;
 private gpuExtension:any;
 private pendingGpu:WebGLQuery|null=null;
 replay=false;replayTime=0;replayRate=.35;replayMemoryMB=0;renderMs=0;recordMs=0;gpuMs:number|null=null;
 width=960;height=540;quality='FX %100 · kamera tam çözünürlük';
 useFixture=false;
 get effectState(){return {warp:this.backgroundMaterial.uniforms.impact.value,stain:this.deposits.scene.visible?Math.min(1,this.deposits.count):0,layers:this.deposits.count,anchors:this.deposits.anchors,particles:this.fluid.particleCount};}
 get replayCaptureFps(){const a=this.replayFrames;return a.length>1?(a.length-1)/(a.at(-1)!.time-a[0].time):0;}
 constructor(canvas:HTMLCanvasElement,video:HTMLVideoElement){
  this.renderer=new T.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'high-performance'});
  this.renderer.setPixelRatio(1);this.renderer.setSize(this.width,this.height,false);this.renderer.autoClear=false;
  this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;
  this.gpuExtension=this.renderer.getContext().getExtension('EXT_disjoint_timer_query_webgl2');
  this.camera.position.z=6;
  const room=new RoomEnvironment(),pmrem=new T.PMREMGenerator(this.renderer);this.environment=pmrem.fromScene(room,.04);this.scene.environment=this.environment.texture;room.dispose();pmrem.dispose();
  this.scene.add(this.fluid.root);
  const key=new T.DirectionalLight(0xffe5ce,3.1);key.position.set(-3,5,7);this.scene.add(key);
  const rim=new T.DirectionalLight(0xd9eeff,2.3);rim.position.set(4,2,-3);this.scene.add(rim);this.scene.add(new T.HemisphereLight(0xffebce,0x281208,.9));
  this.videoTexture=new T.VideoTexture(video);this.videoTexture.colorSpace=T.NoColorSpace;
  this.backgroundMaterial=new T.ShaderMaterial({uniforms:{cameraImage:{value:this.videoTexture},live:{value:0},impact:{value:0},aspect:{value:16/9},nearMiss:{value:0},time:{value:0},face:{value:new T.Vector4(.5,.5,.15,.22)},direction:{value:1},anchors:{value:Array.from({length:5},()=>new T.Vector2(.5,.5))}},vertexShader:vertex,fragmentShader:cameraFragment,depthTest:false,depthWrite:false,toneMapped:false});
  this.background.add(new T.Mesh(new T.PlaneGeometry(2,2),this.backgroundMaterial));this.copyScene.add(new T.Mesh(new T.PlaneGeometry(2,2),this.copyMaterial));this.overlay.add(new T.Mesh(new T.PlaneGeometry(2,2),this.overlayMaterial));
  this.allocateReplay();
 }
 setFixture(image:HTMLImageElement){this.fixture?.dispose();this.fixture=new T.Texture(image);this.fixture.colorSpace=T.NoColorSpace;this.fixture.needsUpdate=true;}
 private allocateReplay(){
  const w=innerWidth<700?480:768,h=Math.round(w/(this.width/this.height));
  this.frames.forEach(f=>f.target.dispose());this.frames=Array.from({length:36},()=>({target:new T.WebGLRenderTarget(w,h,{depthBuffer:false}),time:-Infinity,face:null,points:null,live:false}));
  this.replayMemoryMB=w*h*4*36/1048576;this.writeIndex=0;this.replayFrames=[];
 }
 resize(aspect:number){
  // Only the 3D effects target adapts. Live camera is shaded at display resolution.
  const width=Math.min(1920,Math.max(640,Math.round(this.renderer.domElement.clientWidth*Math.min(devicePixelRatio,1.5)))),height=Math.round(width/aspect);
  if(width===this.width&&height===this.height)return;
  const changed=Math.abs(this.width/this.height-aspect)>.01;this.width=width;this.height=height;this.camera.aspect=aspect;this.camera.updateProjectionMatrix();this.renderer.setSize(width,height,false);this.fx.setSize(Math.round(width*this.scale),Math.round(height*this.scale));
  if(changed){this.endReplay();this.allocateReplay();}
 }
 private copy(image:T.Texture,target:T.WebGLRenderTarget){this.copyMaterial.uniforms.image.value=image;this.renderer.setRenderTarget(target);this.renderer.setClearColor(0,1);this.renderer.clear();this.renderer.render(this.copyScene,this.ortho);}
 draw(time:number,round:Round,face:FaceShape|null,points:Float32Array|null,live:boolean,stain:boolean,record=true){
  const started=performance.now(),wall=time;
  let source:T.Texture=this.useFixture&&this.fixture?this.fixture:this.videoTexture;live=live||this.useFixture&&!!this.fixture;
  // Capture raw footage and its tracking sample, never the already-composited effects.
  this.recordMs=0;
  if(!this.replay&&record&&time-this.lastRecord>=1/15){const before=performance.now(),frame=this.frames[this.writeIndex];if(live)this.copy(source,frame.target);frame.time=time;frame.face=face?{...face}:null;frame.points=points?.slice()??null;frame.live=live;this.writeIndex=(this.writeIndex+1)%this.frames.length;this.lastRecord=time;this.recordMs=performance.now()-before;}
  if(round.outcome&&Number.isFinite(round.impact))this.impactTime=round.impact;
  if(stain&&round.outcome==='hit'&&round.impact!==this.depositedAt&&face&&points){this.deposits.add(round.seed,round.impact,points,face);this.depositedAt=round.impact;}
  if(this.replay&&this.replayFrames.length){
   this.replayTime=this.replayFrames[0].time+(wall-this.replayStart)*this.replayRate;
   if(this.replayTime>this.replayFrames.at(-1)!.time){this.endReplay();}
   else {time=this.replayTime;const frame=this.replayFrames[replayFrameIndex(this.replayFrames.map(f=>f.time),time)];source=frame.target.texture;face=frame.face;points=frame.points;live=frame.live;}
  }
  const elapsed=time-round.impact,hit=round.outcome==='hit'&&elapsed>=0,u=this.backgroundMaterial.uniforms;
  u.cameraImage.value=source;u.live.value=live?1:0;u.impact.value=face&&hit?impactEnvelope(elapsed):0;u.aspect.value=this.camera.aspect;u.nearMiss.value=round.outcome==='near'&&elapsed>=0?Math.exp(-elapsed*4):0;u.time.value=time;u.direction.value=round.seed%2?1:-1;
  if(face){u.face.value.set(face.x,1-face.y,face.rx,face.ry);[1,117,346,61,291].forEach((id,i)=>u.anchors.value[i].set(points?1-points[id*3]:face.x,points?1-points[id*3+1]:1-face.y));}
  this.fluid.update(time,round,this.camera.aspect);this.deposits.update(points,face,time);
  const gl=this.renderer.getContext() as WebGL2RenderingContext,ext=this.gpuExtension;
  if(ext&&this.pendingGpu&&gl.getQueryParameter(this.pendingGpu,gl.QUERY_RESULT_AVAILABLE)){if(!gl.getParameter(ext.GPU_DISJOINT_EXT))this.gpuMs=gl.getQueryParameter(this.pendingGpu,gl.QUERY_RESULT)/1e6;gl.deleteQuery(this.pendingGpu);this.pendingGpu=null;}
  const query=ext&&!this.pendingGpu?gl.createQuery():null;if(query)gl.beginQuery(ext.TIME_ELAPSED_EXT,query);
  this.renderer.info.autoReset=false;this.renderer.info.reset();
  this.renderer.setRenderTarget(this.fx);this.renderer.setClearColor(0,0);this.renderer.clear();this.renderer.render(this.scene,this.camera);
  this.renderer.setRenderTarget(null);this.renderer.setClearColor(0,1);this.renderer.clear();this.renderer.render(this.background,this.ortho);this.renderer.clearDepth();this.renderer.render(this.deposits.scene,this.ortho);this.renderer.render(this.overlay,this.ortho);
  if(query){gl.endQuery(ext.TIME_ELAPSED_EXT);this.pendingGpu=query;}
  this.renderMs=performance.now()-started;
  if(Math.max(this.renderMs,this.gpuMs??0)>22)this.slow++;else this.slow=Math.max(0,this.slow-1);
  if(this.slow>18&&this.scale>.45){this.scale=Math.max(.45,this.scale*.8);this.quality=`FX %${Math.round(this.scale*100)} · kamera tam çözünürlük`;this.fx.setSize(Math.round(this.width*this.scale),Math.round(this.height*this.scale));this.slow=0;}
 }
 beginReplay(time:number){this.replayFrames=this.frames.filter(f=>Number.isFinite(f.time)&&f.time>=this.impactTime-.28&&f.time<=this.impactTime+.86).sort((a,b)=>a.time-b.time);if(this.replayFrames.length<5)return false;this.replay=true;this.replayStart=time;this.replayTime=this.replayFrames[0].time;return true;}
 endReplay(){this.replay=false;}
 clearDeposits(){this.deposits.clear();this.depositedAt=-Infinity;}
 clearReplay(){this.endReplay();this.frames.forEach(f=>{f.time=-Infinity;f.points=null;f.face=null;});this.replayFrames=[];this.lastRecord=-Infinity;}
 dispose(){if(this.pendingGpu)(this.renderer.getContext() as WebGL2RenderingContext).deleteQuery(this.pendingGpu);this.frames.forEach(f=>f.target.dispose());this.fx.dispose();this.environment.dispose();this.videoTexture.dispose();this.fixture?.dispose();this.fluid.dispose();this.deposits.dispose();for(const scene of [this.background,this.copyScene,this.overlay])scene.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();o.material.dispose();}});this.renderer.dispose();}
}
