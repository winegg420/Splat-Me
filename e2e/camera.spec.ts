import { test, expect } from '@playwright/test';
test('real worker/model processes a synthetic camera; stop and restart release tracks', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Kamerayı başlat' }).click();
  await expect(page.locator('#message')).toContainText('Kamera hazır', { timeout: 60000 });
  await expect(page.locator('#inference')).not.toHaveText('—', { timeout: 20000 });
  await expect(page.locator('#input')).toHaveText('640 × 360');
  await expect(page.locator('#tracking')).toHaveText('Yüz aranıyor');
  await page.evaluate(() => { (window as any).testTracks = ((document.querySelector('video')!.srcObject) as MediaStream).getTracks(); });
  await page.getByRole('button', {name:'Durdur',exact:true}).click();
  expect(await page.evaluate(() => (window as any).testTracks.every((t: MediaStreamTrack) => t.readyState === 'ended'))).toBe(true);
  await expect(page.locator('#render')).toHaveText('—');
  await page.getByRole('button', { name: 'Kamerayı başlat' }).click();
  await expect(page.locator('#message')).toContainText('Kamera hazır', {timeout:60000});
  await expect(page.locator('#inference')).not.toHaveText('—', {timeout:20000});
  expect(errors).toEqual([]);
});
test('permission refusal recovers controls', async ({page}) => {
  await page.addInitScript(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Permission denied', 'NotAllowedError'); }; });
  await page.goto('/'); await page.getByRole('button',{name:'Kamerayı başlat'}).click();
  await expect(page.locator('#message')).toContainText('Permission denied');
  await expect(page.locator('#start')).toBeEnabled();
  await expect(page.locator('#stop')).toBeDisabled();
});
test('mobile layout fits and no camera is requested before consent', async ({page}) => {
  await page.setViewportSize({width:390,height:844}); await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('video').evaluate(v => (v as HTMLVideoElement).srcObject)).toBe(null);
  await page.screenshot({path:'test-results/mobile.png',fullPage:true});
});
test('stop during pending camera permission releases the late stream', async ({page}) => {
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async constraints => {
      const stream = await original(constraints);
      (window as any).lateTracks = stream.getTracks();
      await new Promise<void>(resolve => { (window as any).resolvePermission = resolve; });
      return stream;
    };
  });
  await page.goto('/'); await page.locator('#start').click();
  await page.waitForFunction(() => (window as any).resolvePermission);
  await page.locator('#stop').click();
  await page.evaluate(() => (window as any).resolvePermission());
  await expect.poll(() => page.evaluate(() => (window as any).lateTracks.every((t: MediaStreamTrack) => t.readyState === 'ended'))).toBe(true);
  await expect(page.locator('#state')).toHaveText('KAMERA KAPALI');
});
