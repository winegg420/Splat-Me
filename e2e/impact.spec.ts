import { test,expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
test('GPU model, splat, audio scheduling, actual slow replay and near miss',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&!m.text().startsWith('INFO: Created TensorFlow Lite XNNPACK delegate'))errors.push(m.text());});
  await page.setViewportSize({width:1440,height:1100});await page.goto('/impact-lab/');
  await expect(page.locator('h1')).toContainText('GET. SPLAT.');
  await page.waitForFunction(()=>!!(window as any).__impactDiagnostics);
  await page.screenshot({path:'test-results/impact-idle.png',fullPage:true});
  await page.locator('.preview-controls summary').click();
  await page.locator('#auto-replay').uncheck();
  await page.locator('#demo-hit').click();
  await expect.poll(()=>page.evaluate(()=>(window as any).__impactDiagnostics.outcome),{timeout:60000}).toBe('hit');
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
  await writeFile('test-results/impact-measurements.json',JSON.stringify(metrics,null,2));
  await page.locator('#demo-hit').click();
  await expect.poll(()=>page.evaluate(()=>(window as any).__impactDiagnostics.effects.layers),{timeout:15000}).toBe(2);
  await page.locator('#clean').click();
  await expect.poll(()=>page.evaluate(()=>(window as any).__impactDiagnostics.effects.layers)).toBe(0);
  await expect(page.locator('#replay')).toBeDisabled();
  expect(errors).toEqual([]);
});
test('deposits follow simulated moving landmarks and clear on request',async({page})=>{
  await page.setViewportSize({width:700,height:900});
  await page.addInitScript(()=>{
    const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia=()=>original({audio:false,video:{width:{exact:640},height:{exact:360},frameRate:20}});
  });
  // Controlled landmarks isolate rendering/collision from detector accuracy. Camera remains a real synthetic MediaStream.
  await page.route('**/tracker.js',route=>route.fulfill({contentType:'application/javascript',body:`
    let frames=0;onmessage=({data})=>{if(data.type==='init'){postMessage({type:'ready'});return;}
    const shift=frames++>160?.12:0, points=new Float32Array(478*3);
    for(let i=0;i<478;i++){points[i*3]=.5+shift;points[i*3+1]=.5;}
    const put=(id,x,y)=>{points[id*3]=x+shift;points[id*3+1]=y;};
    put(234,.35,.5);put(454,.65,.5);put(10,.5,.25);put(152,.5,.75);put(33,.42,.4);put(263,.58,.4);
    put(117,.4,.53);put(346,.6,.53);put(50,.42,.62);put(280,.58,.62);
    data.bitmap.close();postMessage({type:'result',timestamp:data.timestamp,duration:1,pose:{x:.5+shift,y:.5,size:.16,roll:0},points},[points.buffer]);};` }));
  await page.goto('/impact-lab/');await page.locator('#auto-replay').uncheck();await page.locator('#start').click();
  await expect(page.locator('#throw')).toBeEnabled({timeout:20000});await page.locator('#throw').click();
  await page.waitForFunction(()=>(window as any).__impactDiagnostics.effects.stain===1,{},{timeout:15000});
  const before=await page.evaluate(()=>(window as any).__impactDiagnostics.effects.anchors[0][0]);
  await page.screenshot({path:'test-results/impact-camera-warp.png',fullPage:true});
  await expect.poll(()=>page.evaluate(()=>(window as any).__impactDiagnostics.effects.anchors[0][0]),{timeout:30000}).toBeLessThan(before-.08);
  expect(await page.evaluate(()=>(window as any).__impactDiagnostics.effects.stain)).toBe(1);
  await page.screenshot({path:'test-results/impact-camera-follow.png',fullPage:true});
  await page.locator('#clean').click();await expect.poll(()=>page.evaluate(()=>(window as any).__impactDiagnostics.effects.stain)).toBe(0);
});
test('impact camera uses real worker and preserves capture during tracking A/B',async({page})=>{
  await page.goto('/impact-lab/');await page.locator('#start').click();
  await expect(page.locator('#status')).toContainText('Yüzünü kadraja al',{timeout:60000});
  await expect.poll(()=>page.evaluate(()=>(window as any).__impactDiagnostics.metrics?.detectionFps??0),{timeout:20000}).toBeGreaterThan(0);
  const trackingOn=await page.evaluate(()=>(window as any).__impactDiagnostics);
  await page.locator('#tracking-enabled').uncheck();await page.waitForTimeout(2200);
  const m=await page.evaluate(()=>(window as any).__impactDiagnostics.metrics);
  await writeFile('test-results/capture-ab.json',JSON.stringify({environment:'Linux CI, synthetic camera, SwiftShader; not physical camera performance',trackingOn,trackingOff:m},null,2));
  expect(m.callbackFps).toBeGreaterThan(0);expect(m.submittedFps).toBe(0);
  await expect(page.locator('#throw')).toBeDisabled();
  await page.locator('#stop').click();await expect(page.locator('#face-state')).toHaveText('KAMERA KAPALI');
});
test('layered impact audio produces bounded non-silent stereo waveform',async({page})=>{
  await page.setViewportSize({width:700,height:900});
  await page.addInitScript(()=>{
    Object.defineProperty(window,'AudioContext',{value:function(){
      const ctx=new OfflineAudioContext(2,96000,48000);
      Object.defineProperty(ctx,'resume',{value:()=>Promise.resolve()});
      (window as any).offlineAudio=ctx;return ctx;
    }});
  });
  await page.goto('/impact-lab/');await page.locator('#auto-replay').uncheck();await page.locator('.preview-controls summary').click();await page.locator('#demo-hit').click();
  await page.waitForFunction(()=>(window as any).__impactDiagnostics.outcome==='hit');
  const sample=await page.evaluate(async()=>{
    const buffer=await (window as any).offlineAudio.startRendering() as AudioBuffer;
    const left=buffer.getChannelData(0),right=buffer.getChannelData(1);let peak=0,power=0,difference=0;
    for(let i=0;i<left.length;i++){peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));power+=left[i]*left[i];difference+=Math.abs(left[i]-right[i]);}
    return {peak,rms:Math.sqrt(power/left.length),stereoDifference:difference/left.length,sampleRate:buffer.sampleRate,seconds:buffer.duration};
  });
  expect(sample.peak).toBeLessThan(1);expect(sample.rms).toBeGreaterThan(.005);expect(sample.stereoDifference).toBeGreaterThan(.001);
  await writeFile('test-results/audio-measurements.json',JSON.stringify(sample,null,2));
});
test('mobile impact layout is usable',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/impact-lab/');
  await page.waitForFunction(()=>!!(window as any).__impactDiagnostics);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/impact-mobile.png',fullPage:true});
});
