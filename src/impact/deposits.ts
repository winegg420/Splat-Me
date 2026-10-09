import * as T from 'three';
import { faceWarpGLSL } from './warp';
import triangles from './face-triangles.json';
import { random, type FaceShape } from './simulation';

export type DepositSpec={seed:number;at:number;centers:{x:number;y:number;r:number}[];drips:{x:number;y:number;r:number;speed:number}[]};
export function depositSpec(seed:number,at:number):DepositSpec {
  const rng=random(seed),centers:DepositSpec['centers']=[],drips:DepositSpec['drips']=[];
  // One biased primary deposit, unequal secondary lobes, then sparse satellite droplets.
  const cx=.34+rng()*.3,cy=.32+rng()*.32;
  for(let i=0;i<9;i++){
    const a=rng()*Math.PI*2,r=Math.sqrt(rng())*.26;
    const x=Math.max(.13,Math.min(.87,cx+Math.cos(a)*r)),y=Math.max(.13,Math.min(.88,cy+Math.sin(a)*r));
    centers.push({x,y,r:(i<3?.065:.028)+rng()*.055});
    if(i<5)drips.push({x,y,r:.012+rng()*.017,speed:.035+rng()*.055});
  }
  for(let i=0;i<23;i++)centers.push({x:.1+rng()*.8,y:.12+rng()*.76,r:.008+rng()*.021});
  return {seed,at,centers,drips};
}
const vertex=`varying vec2 vUv;uniform float aspect,impact,direction;uniform vec4 face;uniform vec2 anchors[5];${faceWarpGLSL}
void main(){vUv=uv;vec2 source=position.xy*.5+.5,p=source;for(int i=0;i<4;i++){p+=source-faceSample(p);}gl_Position=vec4(p*2.-1.,position.z,1.);}`;
const fragment=`
precision highp float;
varying vec2 vUv;uniform sampler2D heightMap;uniform float age,opacity;uniform vec4 drips[5];
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
float field(vec2 uv){
 float h=texture2D(heightMap,uv).r;
 for(int i=0;i<5;i++){
   vec4 d=drips[i];float travel=min(.31,pow(max(0.,age-.24),1.25)*d.w);
   vec2 a=d.xy,b=a-vec2(.015*sin(age*1.1+float(i)),travel);
   vec2 pa=uv-a,ba=b-a;float t=clamp(dot(pa,ba)/max(dot(ba,ba),.00001),0.,1.);
   float radius=d.z*mix(.34,1.15,pow(t,4.));
   float body=1.-smoothstep(radius*.3,radius,length(pa-ba*t));
   h=max(h,body*.76*smoothstep(.01,.06,travel));
 }
 return h*(.78+.22*noise(uv*36.));
}
void main(){
 float h=field(vUv);float alpha=smoothstep(.14,.34,h)*opacity*smoothstep(0.,.095,age);
 if(alpha<.003)discard;
 vec2 e=vec2(.0025,0.);vec2 gradient=vec2(field(vUv+e)-field(vUv-e),field(vUv+e.yx)-field(vUv-e.yx));
 vec3 n=normalize(vec3(-gradient*4.5,1.));
 vec3 l=normalize(vec3(-.45,.65,1.));float diffuse=.25+.75*max(0.,dot(n,l));
 vec3 brown=mix(vec3(.029,.009,.0025),vec3(.14,.055,.014),clamp(h,0.,1.))*diffuse;
 float rim=1.-smoothstep(.18,.48,h);brown*=1.-rim*.18;
 float spec=pow(max(0.,dot(n,normalize(l+vec3(0.,0.,1.)))),42.);
 brown+=vec3(.8,.65,.42)*spec*.22*smoothstep(.3,.65,h);
 gl_FragColor=vec4(brown,alpha);
 #include <colorspace_fragment>
}`;

type Layer={mesh:T.Mesh;texture:T.CanvasTexture;spec:DepositSpec};
export class FaceDeposits {
  readonly scene=new T.Scene();
  readonly geometry=new T.BufferGeometry();
  private layers:Layer[]=[];
  private reference:Float32Array|null=null;
  private occluder:T.Mesh;
  private warmLayer?:Layer;
  private warp={aspect:{value:16/9},impact:{value:0},direction:{value:1},face:{value:new T.Vector4(.5,.5,.2,.3)},anchors:{value:Array.from({length:5},()=>new T.Vector2(.5,.5))}};
  anchors:number[][]=[];
  constructor(){this.geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(468*3),3));this.geometry.setAttribute('uv',new T.BufferAttribute(new Float32Array(468*2),2));this.geometry.setIndex(triangles);
    this.occluder=new T.Mesh(this.geometry,new T.ShaderMaterial({uniforms:this.warp,vertexShader:vertex,fragmentShader:'void main(){gl_FragColor=vec4(0.);}',colorWrite:false,depthWrite:true,side:T.DoubleSide}));this.occluder.frustumCulled=false;this.occluder.renderOrder=-1;this.scene.add(this.occluder);
  }
  get count(){return this.layers.length;}
  get specs(){return this.layers.map(l=>l.spec);}
  warm(renderer:T.WebGLRenderer,camera:T.Camera){
    this.add(-1,-1,null,{x:.5,y:.5,rx:.2,ry:.3,roll:0});renderer.compile(this.scene,camera);
    this.warmLayer=this.layers.pop()!;this.scene.remove(this.warmLayer.mesh);this.reference=null;
  }
  add(seed:number,at:number,points:Float32Array|null,face:FaceShape){
    if(!this.reference){
      this.reference=points?.slice()??null;
      const uv=this.geometry.getAttribute('uv') as T.BufferAttribute;
      for(let i=0;i<468;i++){
        const x=points?1-points[i*3]:face.x,y=points?points[i*3+1]:face.y;
        uv.setXY(i,(x-face.x)/(face.rx*2)+.5,.5-(y-face.y)/(face.ry*2));
      }uv.needsUpdate=true;
    }
    const spec=depositSpec(seed,at),canvas=document.createElement('canvas');canvas.width=canvas.height=512;
    const ctx=canvas.getContext('2d')!;ctx.fillStyle='#000';ctx.fillRect(0,0,512,512);ctx.globalCompositeOperation='lighter';
    const rng=random(seed+1);
    for(const center of spec.centers){
      const lobes=center.r>.04?6:1;
      for(let j=0;j<lobes;j++){
        const r=center.r*(j?(.45+rng()*.5):1),a=rng()*Math.PI*2;
        const x=(center.x+Math.cos(a)*center.r*(j?.6:0))*512,y=(1-center.y+Math.sin(a)*center.r*(j?.6:0))*512;
        const g=ctx.createRadialGradient(x,y,0,x,y,r*512);g.addColorStop(0,'rgba(255,255,255,0.32)');g.addColorStop(.55,'rgba(255,255,255,0.23)');g.addColorStop(1,'rgba(255,255,255,0)');
        ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(x,y,r*512,r*512,0,0,Math.PI*2);ctx.fill();
      }
    }
    const texture=new T.CanvasTexture(canvas);texture.generateMipmaps=false;texture.minFilter=T.LinearFilter;
    const material=new T.ShaderMaterial({uniforms:{...this.warp,heightMap:{value:texture},age:{value:0},opacity:{value:1},drips:{value:spec.drips.map(d=>new T.Vector4(d.x,d.y,d.r,d.speed))}},vertexShader:vertex,fragmentShader:fragment,transparent:true,depthTest:true,depthWrite:false,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
    const mesh=new T.Mesh(this.geometry,material);mesh.frustumCulled=false;mesh.renderOrder=this.layers.length;this.scene.add(mesh);this.layers.push({mesh,texture,spec});
    // Bound texture/overdraw cost, while retaining multiple asymmetric hits.
    if(this.layers.length>4){const old=this.layers.shift()!;this.scene.remove(old.mesh);(old.mesh.material as T.Material).dispose();old.texture.dispose();}
  }
  update(points:Float32Array|null,face:FaceShape|null,time:number,impact=0,aspect=16/9,direction=1){
    this.scene.visible=!!points&&!!face&&this.layers.length>0;
    if(!points||!face||!this.layers.length)return;
    this.warp.impact.value=impact;this.warp.aspect.value=aspect;this.warp.direction.value=direction;this.warp.face.value.set(face.x,1-face.y,face.rx,face.ry);[1,117,346,61,291].forEach((id,i)=>this.warp.anchors.value[i].set(1-points[id*3],1-points[id*3+1]));
    const position=this.geometry.getAttribute('position') as T.BufferAttribute;
    for(let i=0;i<468;i++)position.setXYZ(i,1-points[i*3]*2,1-points[i*3+1]*2,points[i*3+2]);
    position.needsUpdate=true;
    this.anchors=[1,117,346,61,291].map(i=>[1-points[i*3],1-points[i*3+1]]);
    for(const layer of this.layers){layer.mesh.visible=time>=layer.spec.at;const m=layer.mesh.material as T.ShaderMaterial;m.uniforms.age.value=time-layer.spec.at;m.uniforms.opacity.value=1;}
  }
  clear(){for(const l of this.layers){this.scene.remove(l.mesh);(l.mesh.material as T.Material).dispose();l.texture.dispose();}this.layers=[];this.reference=null;}
  dispose(){this.clear();this.geometry.dispose();(this.occluder.material as T.Material).dispose();if(this.warmLayer){(this.warmLayer.mesh.material as T.Material).dispose();this.warmLayer.texture.dispose();}}
}
