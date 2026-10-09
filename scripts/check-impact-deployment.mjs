import assert from 'node:assert/strict';
const input=new URL(process.argv[2]||'https://splat-me.vercel.app'),base=input.origin;
let cookie='';
if(input.searchParams.has('_vercel_share')){
 const access=await fetch(input,{redirect:'manual'});
 assert([200,307,302].includes(access.status),'Share link rejected');
 cookie=access.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
 assert(cookie,'Share link did not establish access');
}
const headers=cookie?{cookie}:{};
for(const path of ['/','/impact-lab','/impact-lab/']){
 const response=await fetch(base+path,{headers}),html=await response.text();
 assert.equal(response.status,200,path);assert.equal(new URL(response.url).origin,base,'Unexpected login redirect');
 assert(html.includes(path==='/'?'Kamera Laboratuvarı':'Impact Lab'),`Wrong page for ${path}`);
 console.log(`OK ${path} 200`);
 for(const match of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)){
  const asset=await fetch(base+match[1],{headers});assert.equal(asset.status,200,match[1]);assert.equal(new URL(asset.url).origin,base);console.log(`OK ${match[1]}`);
 }
}
for(const path of ['/tracker.js','/vendor/face_landmarker.task','/vendor/wasm/vision_wasm_internal.wasm']){
 const response=await fetch(base+path,{method:'HEAD',headers});assert.equal(response.status,200,path);assert.equal(new URL(response.url).origin,base);console.log(`OK ${path} 200`);
}
