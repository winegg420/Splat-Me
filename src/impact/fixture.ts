import { faceShape } from './simulation';
// Fixed generated portrait with landmarks captured once from our real MediaPipe worker.
// This dataset is used only by the explicitly labeled camera-free preview.
export async function loadFixture(){
 const image=new Image();image.src='/qa/face.png';
 const [,response]=await Promise.all([image.decode(),fetch('/qa/face-landmarks.json')]);
 if(!response.ok)throw new Error('Test portresi geometrisi yüklenemedi.');
 const data:unknown=await response.json();
 if(!Array.isArray(data)||data.length!==1434||!data.every(n=>typeof n==='number'&&Number.isFinite(n)))throw new Error('Test portresi geometrisi geçersiz.');
 const points=new Float32Array(data),face=faceShape(points);
 if(!face)throw new Error('Test portresi geometrisi geçersiz.');
 return {image,points,face};
}
