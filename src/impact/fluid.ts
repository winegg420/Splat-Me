import * as T from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { random, type Round } from './simulation';

function organicGeometry(){
  const marching=new MarchingCubes(48,new T.MeshBasicMaterial(),true,false,30000);
  marching.reset();
  for(let i=0;i<11;i++){const t=i/10;marching.addBall(.5+.075*Math.sin(t*7.5),.25+t*.46,.5+.055*Math.cos(t*5),.14+Math.sin(t*Math.PI)*.06,12);}
  marching.addBall(.38,.40,.53,.15,12);marching.addBall(.58,.55,.48,.10,12);marching.update();
  const source=marching.geometry,count=source.drawRange.count;
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute((source.getAttribute('position').array as Float32Array).slice(0,count*3),3));
  const p=geometry.getAttribute('position') as T.BufferAttribute,uv=new Float32Array(count*2);
  for(let i=0;i<count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),r=1+.035*Math.sin(x*23+y*11)*Math.sin(z*18-y*7);p.setXYZ(i,x*r*1.2,y*1.22,z*r);uv[i*2]=Math.atan2(z,x)/Math.PI*.5+.5;uv[i*2+1]=y*1.3;}
  geometry.setAttribute('uv',new T.BufferAttribute(uv,2));geometry.computeVertexNormals();source.dispose();(marching.material as T.Material).dispose();return geometry;
}
type Drop={angle:number;speed:number;up:number;vz:number;size:number;delay:number;split:number;parent:number;side:number};
export function fluidSeed(seed:number):Drop[]{
  const rng=random(seed),drops:Drop[]=[];
  for(let i=0;i<96;i++)drops.push({angle:rng()*Math.PI*2,speed:1.5+rng()*5.5,up:rng()*.8,vz:.3+rng()*4,size:i<18?.045+rng()*.075:.009+rng()*.032,delay:.04+rng()*.07,split:i<24?.18+rng()*.25:Infinity,parent:-1,side:0});
  for(let i=0;i<24;i++)for(const side of [-1,1])drops.push({...drops[i],parent:i,side,size:drops[i].size*.48,delay:drops[i].split,split:Infinity});
  return drops;
}
export class FluidScene {
  readonly root=new T.Group();
  readonly material:T.MeshPhysicalMaterial;
  private body:T.Mesh;
  private bodyMaterial:T.MeshPhysicalMaterial;
  private bodyBase:Float32Array;
  private sheet:T.Mesh;
  private sheetGeometry=new T.BufferGeometry();
  private sheetBase=new Float32Array(65*8*3);
  private drops:T.InstancedMesh;
  private threads:T.InstancedMesh;
  private scratch=new T.Object3D();
  private dropsData:Drop[]=[];
  private seed=-1;
  private noise:T.DataTexture;
  private origin=new T.Vector3();
  private position=new T.Vector3();
  private velocity=new T.Vector3();
  private axis=new T.Vector3(0,1,0);
  private time=0;
  get particleCount(){return this.drops.count;}
  constructor(){
    const rng=random(72),noise=new Uint8Array(128*128*4);for(let i=0;i<noise.length;i+=4){const n=110+rng()*75;noise[i]=noise[i+1]=noise[i+2]=n;noise[i+3]=255;}
    this.noise=new T.DataTexture(noise,128,128);this.noise.wrapS=this.noise.wrapT=T.RepeatWrapping;this.noise.magFilter=T.LinearFilter;this.noise.needsUpdate=true;
    this.material=new T.MeshPhysicalMaterial({color:0x623417,roughness:.3,metalness:0,clearcoat:.62,clearcoatRoughness:.2,envMapIntensity:.7,bumpMap:this.noise,bumpScale:.018});
    this.bodyMaterial=this.material.clone();this.bodyMaterial.transparent=true;
    this.body=new T.Mesh(organicGeometry(),this.bodyMaterial);this.bodyBase=(this.body.geometry.getAttribute('position').array as Float32Array).slice();this.root.add(this.body);
    const indices:number[]=[];
    for(let ring=0;ring<8;ring++)for(let j=0;j<=64;j++){if(ring<7&&j<64){const v=ring*65+j;indices.push(v,v+1,v+65,v+1,v+66,v+65);}}
    this.sheetGeometry.setAttribute('position',new T.BufferAttribute(this.sheetBase,3));this.sheetGeometry.setIndex(indices);this.sheetGeometry.computeVertexNormals();
    const sheetMaterial=this.material.clone();sheetMaterial.bumpMap=null;sheetMaterial.side=T.DoubleSide;sheetMaterial.transparent=true;
    this.sheet=new T.Mesh(this.sheetGeometry,sheetMaterial);this.sheet.frustumCulled=false;this.root.add(this.sheet);
    this.drops=new T.InstancedMesh(new T.SphereGeometry(1,16,10),this.material,144);this.drops.instanceMatrix.setUsage(T.DynamicDrawUsage);this.drops.frustumCulled=false;this.root.add(this.drops);
    this.threads=new T.InstancedMesh(new T.CylinderGeometry(1,1,1,8,1,true),this.material,14);this.threads.instanceMatrix.setUsage(T.DynamicDrawUsage);this.threads.frustumCulled=false;this.root.add(this.threads);
  }
  private world(point:{x:number;y:number},aspect:number){const h=2*6*Math.tan(T.MathUtils.degToRad(21));return this.origin.set((point.x-.5)*h*aspect,(.5-point.y)*h,0);}
  private path(drop:Drop,age:number,out:T.Vector3){const t=Math.max(0,age-drop.delay),drag=(1-Math.exp(-1.6*t))/1.6;return out.set(Math.cos(drop.angle)*drop.speed*drag,Math.sin(drop.angle)*drop.speed*drag+drop.up*t-2.9*t*t,drop.vz*drag);}
  update(time:number,round:Round,aspect:number){
    this.time=time;const elapsed=time-round.impact,hit=round.outcome==='hit'&&elapsed>=0,flight=time-round.start,inFlight=flight>=0&&flight<round.duration&&(elapsed<0||!round.outcome);
    if(round.seed!==this.seed){this.seed=round.seed;this.dropsData=fluidSeed(round.seed);}
    const origin=this.world(round.target,aspect);
    this.body.visible=inFlight||round.start===-Infinity||hit&&elapsed<.19||(round.outcome==='near'||round.outcome==='miss')&&elapsed<.4;
    this.bodyMaterial.opacity=hit?Math.max(0,1-elapsed/.19):1;
    if(inFlight){const t=flight/round.duration;this.body.position.set(origin.x+(1-t)*Math.sin(t*5)*1.2,origin.y+(1-t)*1.1,-16*(1-t));this.body.scale.setScalar(.72);this.body.rotation.set(.4+flight*1.8,flight*5,Math.sin(flight*4)*.4);}
    else if(hit){const squash=Math.min(1,elapsed/.085);this.body.position.copy(origin);this.body.scale.set(.72*(1+squash*1.8),.72*(1+squash*.9),.72*(1-squash*.91));this.body.rotation.set(.18,0,round.seed*.2);}
    else if(round.start===-Infinity){this.body.position.set(0,.05,0);this.body.scale.setScalar(1.5);this.body.rotation.set(.25,time*.35,-.32);}
    else {this.body.position.copy(origin);this.body.position.z=elapsed*18;}
    if(this.body.visible){const p=this.body.geometry.getAttribute('position') as T.BufferAttribute;for(let i=0;i<p.count;i++){const j=i*3,x=this.bodyBase[j],y=this.bodyBase[j+1],z=this.bodyBase[j+2];p.setXYZ(i,x*(1+.045*Math.sin(time*12+y*8)),y+.025*Math.sin(time*11+x*12),z*(1+.05*Math.cos(time*10+y*7)));}p.needsUpdate=true;}
    this.sheet.visible=hit&&elapsed<.48;
    if(this.sheet.visible){
      const expand=1-Math.exp(-elapsed*13),fade=Math.max(0,1-Math.max(0,elapsed-.18)/.3);
      (this.sheet.material as T.MeshPhysicalMaterial).opacity=fade;
      const p=this.sheetGeometry.getAttribute('position') as T.BufferAttribute;
      for(let ring=0;ring<8;ring++)for(let j=0;j<=64;j++){
        const a=j/64*Math.PI*2,r=ring/7;
        const edge=.82+.19*Math.sin(a*3+round.seed)+.13*Math.sin(a*7+round.seed*.3);
        const radius=(.15+expand*1.05)*r*edge;
        const curl=Math.pow(r,3)*(.26*Math.sin(a*5+time*8)+.22)*expand;
        p.setXYZ(ring*65+j,Math.cos(a)*radius*1.15,Math.sin(a)*radius*.84,.10+curl+Math.sin(r*Math.PI)*.12*(1-expand));
      }p.needsUpdate=true;this.sheetGeometry.computeVertexNormals();this.sheet.position.copy(origin);
    }
    this.drops.visible=hit&&elapsed<2.1;this.threads.visible=hit&&elapsed>.035&&elapsed<.4;
    if(this.drops.visible){
      for(let i=0;i<this.dropsData.length;i++){
        const d=this.dropsData[i],age=elapsed-d.delay;let scale=age>=0?Math.min(1,age/.025):0;
        if(d.parent<0){this.path(d,elapsed,this.position);if(elapsed>d.split)scale*=Math.max(0,1-(elapsed-d.split)/.06);}
        else {const parent=this.dropsData[d.parent];this.path(parent,d.delay,this.position);const t=Math.max(0,age);this.position.add(new T.Vector3(Math.cos(d.angle+d.side*.2)*d.speed*t*.7,Math.sin(d.angle+d.side*.2)*d.speed*t*.7-3*t*t,d.vz*t*.65));}
        scale*=Math.max(0,1-Math.max(0,age-.7)/1.25);
        this.velocity.set(Math.cos(d.angle)*d.speed,Math.sin(d.angle)*d.speed-5.8*Math.max(0,age),d.vz).normalize();
        this.scratch.position.copy(origin).add(this.position);this.scratch.quaternion.setFromUnitVectors(this.axis,this.velocity);
        const stretch=1+Math.min(3.2,d.speed*.35)*Math.exp(-Math.max(0,age)*2.5);
        this.scratch.scale.set(d.size*scale/Math.sqrt(stretch),d.size*scale*stretch,d.size*scale/Math.sqrt(stretch));this.scratch.updateMatrix();this.drops.setMatrixAt(i,this.scratch.matrix);
      }this.drops.instanceMatrix.needsUpdate=true;
    }
    if(this.threads.visible){for(let i=0;i<14;i++){const d=this.dropsData[i],t=Math.max(0,elapsed-d.delay);this.path(d,elapsed,this.position);const length=this.position.length(),radius=Math.max(0,.023*(1-elapsed/.4))*Math.min(1,t/.04);this.scratch.position.copy(origin).addScaledVector(this.position,.5);this.scratch.quaternion.setFromUnitVectors(this.axis,this.position.clone().normalize());this.scratch.scale.set(radius,length,radius);this.scratch.updateMatrix();this.threads.setMatrixAt(i,this.scratch.matrix);}this.threads.instanceMatrix.needsUpdate=true;}
  }
  dispose(){const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();this.root.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());this.noise.dispose();}
}
