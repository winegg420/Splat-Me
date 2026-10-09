import { test,expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
test('fixed portrait: approach, contact, fluid, actual pixel warp, stains and moving drips',async({page})=>{
 test.setTimeout(180000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().startsWith('INFO: Created TensorFlow Lite XNNPACK delegate'))errors.push(m.text());});
 await page.setViewportSize({width:1440,height:1100});await page.goto('/impact-lab/?qa=1');
 await page.waitForFunction(()=>!!(window as any).__impactQA);
 const stages:[string,number][]=[['clean',-1.8],['approach',-.24],['contact',.045],['dispersal',.18],['elastic-return',.32],['stains',1.5],['drips',4]];
 const samples:any[]=[];
 for(const [name,age] of stages){
  const state=await page.evaluate(age=>(window as any).__impactQA.frame(age),age);
  await page.waitForTimeout(150);
  await page.locator('#scene').screenshot({path:`test-results/visual-${name}.png`});
  await expect(page.locator('#scene')).toHaveScreenshot(`${name}.png`,{threshold:.12,maxDiffPixelRatio:.003});
  samples.push({name,age,effects:state.effects});if(name==='clean')await writeFile('test-results/fixture-landmarks.json',JSON.stringify(state.points));
 }
 expect(samples.find(s=>s.name==='contact').effects.warp).toBeGreaterThan(.6);
 expect(samples.find(s=>s.name==='elastic-return').effects.warp).toBeLessThan(0);
 expect(samples.at(-1).effects.layers).toBe(1);
 const first=await page.locator('#scene').screenshot();
 await page.evaluate(()=>(window as any).__impactQA.frame(4,12345));
 await page.waitForTimeout(150);const second=await page.locator('#scene').screenshot({path:'test-results/visual-second-seed.png'});
 expect(Buffer.compare(first,second)).not.toBe(0);
 // Isolate the camera shader: all 3D particles and deposited layers are hidden in both images.
 await page.evaluate(()=>(window as any).__impactQA.frame(.045,7919,true,true));await page.waitForTimeout(150);
 const unwarped=await page.locator('#scene').screenshot({path:'test-results/visual-warp-before.png'});
 await page.evaluate(()=>(window as any).__impactQA.frame(.045,7919,true,false));await page.waitForTimeout(150);
 const warped=await page.locator('#scene').screenshot({path:'test-results/visual-warp-after.png'});
 await expect(page.locator('#scene')).toHaveScreenshot('warp-after.png',{threshold:.12,maxDiffPixelRatio:.003});
 expect(Buffer.compare(unwarped,warped)).not.toBe(0);
 const measurements=[];
 for(const age of [-1.8,.18]){
  await page.evaluate(age=>(window as any).__impactQA.frame(age),age);await page.waitForTimeout(300);
  const sample=await page.evaluate(()=>new Promise(resolve=>{
   const intervals:number[]=[],cpu:number[]=[],gpu:(number|null)[]=[];let before=performance.now();
   function step(now:number){intervals.push(now-before);before=now;const d=(window as any).__impactDiagnostics;cpu.push(d.drawCpuMs);gpu.push(d.drawGpuMs);if(intervals.length<30)requestAnimationFrame(step);else{const sorted=[...intervals].sort((a,b)=>a-b);resolve({fps:1000/(intervals.reduce((a,b)=>a+b)/intervals.length),p95:sorted[Math.floor(sorted.length*.95)],cpu,gpu,quality:d.quality,resolution:[document.querySelector('canvas')!.width,document.querySelector('canvas')!.height],drawCalls:d.drawCalls});}}
   requestAnimationFrame(step);
  }));measurements.push({age,sample});
 }
 await writeFile('test-results/visual-performance.json',JSON.stringify({environment:'Linux CI SwiftShader, fixed generated portrait; not real-device performance',measurements},null,2));
 await writeFile('test-results/visual-states.json',JSON.stringify(samples,null,2));
 expect(errors).toEqual([]);
});
