import { faceShape } from './simulation';
// Explicit camera-free preview: a generated fictional adult, detected once in its own worker.
export async function loadFixture(){
 const image=new Image();image.src='/qa/face.png';await image.decode();
 const worker=new Worker('/tracker.js');
 try {
  const points=await new Promise<Float32Array>((resolve,reject)=>{
   const timeout=setTimeout(()=>reject(new Error('Test portresi modeli zaman aşımı.')),60000);
   worker.onerror=e=>{clearTimeout(timeout);reject(new Error(e.message));};
   worker.onmessage=async({data})=>{
    if(data.type==='ready'){
     try{const bitmap=await createImageBitmap(image,{resizeWidth:640,resizeHeight:360});worker.postMessage({type:'frame',bitmap,timestamp:1,width:640,height:360},[bitmap]);}catch(e){clearTimeout(timeout);reject(e);}
    }
    if(data.type==='error'){clearTimeout(timeout);reject(new Error(data.message));}
    if(data.type==='result'){clearTimeout(timeout);data.points?resolve(data.points):reject(new Error('Test portresinde yüz bulunamadı.'));}
   };
   worker.postMessage({type:'init',landmarks:true,wasm:new URL('/vendor/wasm',location.href).href,model:new URL('/vendor/face_landmarker.task',location.href).href});
  });
  const face=faceShape(points);if(!face)throw new Error('Test portresi geometrisi geçersiz.');
  return {image,points,face};
 }finally{worker.terminate();}
}
