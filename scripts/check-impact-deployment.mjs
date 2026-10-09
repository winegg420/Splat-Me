import assert from 'node:assert/strict';
const base=process.argv[2]||'https://splat-me.vercel.app';
for(const path of ['/','/impact-lab','/impact-lab/']){
  const response=await fetch(base+path),html=await response.text();
  assert.equal(response.status,200,path);
  if(path!=='/')assert(html.includes('Impact Lab'),`Wrong page for ${path}`);
  console.log(`OK ${path} 200`);
  for(const match of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)){
    const asset=await fetch(base+match[1]);assert.equal(asset.status,200,match[1]);console.log(`OK ${match[1]}`);
  }
}
