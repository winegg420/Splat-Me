import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const origin = process.argv[2];
assert(origin?.startsWith('https://'), 'Pass the HTTPS deployment URL');
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const response = await page.goto(origin);
  assert.equal(response.status(), 200);
  await page.locator('#start').waitFor();
  assert(await page.evaluate(() => isSecureContext && !!navigator.mediaDevices?.getUserMedia));
  assert.equal(await page.locator('video').evaluate(video => video.srcObject), null);
  for (const path of ['/tracker.js', '/vendor/face_landmarker.task', '/vendor/wasm/vision_wasm_internal.js', '/vendor/wasm/vision_wasm_internal.wasm']) {
    const asset = await page.request.get(new URL(path, origin).href);
    assert.equal(asset.status(), 200, path);
    const body = await asset.body();
    assert(body.length > 100, `Empty asset: ${path}`);
    assert(!asset.headers()['content-type']?.includes('text/html'), `HTML instead of asset: ${path}`);
    if (path.endsWith('.wasm')) {
      assert(asset.headers()['content-type'].includes('application/wasm'));
      assert.deepEqual([...body.subarray(0, 4)], [0, 97, 115, 109]);
    }
    console.log(`OK ${path} (${body.length} bytes)`);
  }
  await page.evaluate(() => {
    navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Permission denied', 'NotAllowedError'); };
  });
  await page.locator('#start').click();
  await page.waitForFunction(() => document.querySelector('#message').textContent.includes('Permission denied'));
  assert(await page.locator('#start').isEnabled());
  assert.deepEqual(errors, []);
  console.log('PASS: public HTTPS page, secure camera API, worker/model/WASM delivery, permission error recovery; no real camera used.');
} finally { await browser.close(); }
