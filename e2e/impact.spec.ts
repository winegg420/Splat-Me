import { test,expect } from '@playwright/test';
test('GPU model, splat, audio scheduling, actual slow replay and near miss',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.setViewportSize({width:1440,height:1100});await page.goto('/impact-lab/');
  await expect(page.locator('h1')).toContainText('GET. SPLAT.');
  await page.waitForFunction(()=>!!(window as any).__impactDiagnostics);
  await page.screenshot({path:'test-results/impact-idle.png',fullPage:true});
  await page.locator('.preview-controls summary').click();
  await page.locator('#auto-replay').uncheck();
  await page.locator('#demo-hit').click();
  await expect.poll(()=>page.evaluate(()=>(window as any).__impactDiagnostics.outcome)).toBe('hit');
  await page.screenshot({path:'test-results/impact-hit.png',fullPage:true});
  expect(await page.evaluate(()=>(window as any).__impactDiagnostics.audioScheduledAt)).toBeGreaterThan(0);
  await page.waitForTimeout(600);await page.locator('#diagnostics summary').click();await page.locator('#replay').click();
  await expect(page.locator('#replay-label')).toBeVisible();
  const before=await page.evaluate(()=>(window as any).__impactDiagnostics.replayTime);
  await page.waitForTimeout(600);
  const after=await page.evaluate(()=>(window as any).__impactDiagnostics.replayTime);
  expect(after-before).toBeGreaterThan(.1);expect(after-before).toBeLessThan(.6);
  await page.screenshot({path:'test-results/impact-replay.png',fullPage:true});
  expect(await page.evaluate(()=>(window as any).__impactDiagnostics.replayMemoryMB)).toBeLessThan(50);
  await expect.poll(()=>page.evaluate(()=>(window as any).__impactDiagnostics.replay),{timeout:15000}).toBe(false);
  // Can replay the saved event again even after the original capture time is old.
  await page.locator('#replay').click();await expect(page.locator('#replay-label')).toBeVisible();
  await page.locator('#demo-near').click();
  await expect.poll(()=>page.evaluate(()=>(window as any).__impactDiagnostics.outcome)).toBe('near');
  await page.screenshot({path:'test-results/impact-near.png',fullPage:true});
  await page.screenshot({path:'test-results/impact-metrics.png',fullPage:true});
  const metrics=await page.evaluate(()=>(window as any).__impactDiagnostics);
  await test.info().attach('software-gpu-measurement',{body:JSON.stringify(metrics,null,2),contentType:'application/json'});
  expect(errors).toEqual([]);
});
test('real video pixels are warped and deposits follow simulated moving landmarks',async({page})=>{
  // Controlled landmarks isolate rendering/collision from detector accuracy. Camera remains a real synthetic MediaStream.
  await page.route('**/tracker.js',route=>route.fulfill({contentType:'application/javascript',body:`
    let frames=0;onmessage=({data})=>{if(data.type==='init'){postMessage({type:'ready'});return;}
    const shift=frames++>90?.12:0, points=new Float32Array(478*3);
    for(let i=0;i<478;i++){points[i*3]=.5+shift;points[i*3+1]=.5;}
    const put=(id,x,y)=>{points[id*3]=x+shift;points[id*3+1]=y;};
    put(234,.35,.5);put(454,.65,.5);put(10,.5,.25);put(152,.5,.75);put(33,.42,.4);put(263,.58,.4);
    put(117,.4,.53);put(346,.6,.53);put(50,.42,.62);put(280,.58,.62);
    data.bitmap.close();postMessage({type:'result',timestamp:data.timestamp,duration:1,pose:{x:.5+shift,y:.5,size:.16,roll:0},points},[points.buffer]);};` }));
  await page.goto('/impact-lab/');await page.locator('#auto-replay').uncheck();await page.locator('#start').click();
  await expect(page.locator('#throw')).toBeEnabled();await page.locator('#throw').click();
  await page.waitForFunction(()=>(window as any).__impactDiagnostics.effects.warp>.1);
  const before=await page.evaluate(()=>(window as any).__impactDiagnostics.effects.anchors[0][0]);
  await page.screenshot({path:'test-results/impact-camera-warp.png',fullPage:true});
  await expect.poll(()=>page.evaluate(()=>(window as any).__impactDiagnostics.effects.anchors[0][0]),{timeout:10000}).toBeLessThan(before-.08);
  expect(await page.evaluate(()=>(window as any).__impactDiagnostics.effects.stain)).toBe(1);
  await page.screenshot({path:'test-results/impact-camera-follow.png',fullPage:true});
  await page.locator('#clean').click();await expect.poll(()=>page.evaluate(()=>(window as any).__impactDiagnostics.effects.stain)).toBe(0);
});
test('impact camera uses real worker and preserves capture during tracking A/B',async({page})=>{
  await page.goto('/impact-lab/');await page.locator('#start').click();
  await expect(page.locator('#status')).toContainText('Yüzünü kadraja al',{timeout:60000});
  await expect.poll(()=>page.evaluate(()=>(window as any).__impactDiagnostics.metrics?.detectionFps??0),{timeout:20000}).toBeGreaterThan(0);
  await page.locator('#tracking-enabled').uncheck();await page.waitForTimeout(2200);
  const m=await page.evaluate(()=>(window as any).__impactDiagnostics.metrics);
  expect(m.callbackFps).toBeGreaterThan(0);expect(m.submittedFps).toBe(0);
  await expect(page.locator('#throw')).toBeDisabled();
  await page.locator('#stop').click();await expect(page.locator('#face-state')).toHaveText('KAMERA KAPALI');
});
test('mobile impact layout is usable',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/impact-lab/');
  await page.waitForFunction(()=>!!(window as any).__impactDiagnostics);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/impact-mobile.png',fullPage:true});
});
