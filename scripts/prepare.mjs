import { mkdir, cp, writeFile, access } from 'node:fs/promises';
import { build } from 'esbuild';
await mkdir('public/vendor', { recursive: true });
await cp('node_modules/@mediapipe/tasks-vision/wasm', 'public/vendor/wasm', { recursive: true });
const model = 'public/vendor/face_landmarker.task';
try { await access(model); } catch {
  const response = await fetch('https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task');
  if (!response.ok) throw new Error(`Model download: ${response.status}`);
  await writeFile(model, Buffer.from(await response.arrayBuffer()));
}
// Classic worker: MediaPipe's WASM loader uses importScripts.
await build({ entryPoints: ['src/tracker.worker.ts'], outfile: 'public/tracker.js', bundle: true, format: 'iife', target: 'es2022', minify: true });
