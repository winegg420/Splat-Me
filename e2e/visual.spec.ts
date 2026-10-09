import { test,expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
test('fixed portrait: approach, contact, fluid, actual pixel warp, stains and moving drips',async({page})=>{
 test.setTimeout(180000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.setViewportSize({width:1440,height:1100});await page.goto('/impact-lab/?qa=1');
 await page.waitForFunction(()=>!!(window as any).__impactQA);
 const stages:[string,number][]=[['clean',-1.8],['approach',-.24],['contact',.045],['dispersal',.18],['elastic-return',.32],['stains',1.5],['drips',4]];
 const samples:any[]=[];
 for(const [name,age] of stages){
  const state=await page.evaluate(age=>(window as any).__impactQA.frame(age),age);
  await page.waitForTimeout(150);
  await page.locator('#scene').screenshot({path:`test-results/visual-${name}.png`});
  samples.push({name,age,effects:state.effects});
 }
 expect(samples.find(s=>s.name==='contact').effects.warp).toBeGreaterThan(.6);
 expect(samples.find(s=>s.name==='elastic-return').effects.warp).toBeLessThan(0);
 expect(samples.at(-1).effects.layers).toBe(1);
 const first=await page.locator('#scene').screenshot();
 await page.evaluate(()=>(window as any).__impactQA.frame(4,12345));
 await page.waitForTimeout(150);const second=await page.locator('#scene').screenshot({path:'test-results/visual-second-seed.png'});
 expect(Buffer.compare(first,second)).not.toBe(0);
 await writeFile('test-results/visual-states.json',JSON.stringify(samples,null,2));
 expect(errors).toEqual([]);
});
