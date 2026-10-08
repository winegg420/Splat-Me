import './style.css';
import { detectionSize, FrameGate, PoseFilter, type Pose } from './tracking';
import { CameraDiagnostics } from './diagnostics';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<header><a class="brand" href="./">splat<span>—</span>me</a><span class="tag">CAMERA LAB / 01</span></header>
<main><section class="intro"><p class="eyebrow">ÖNCE SAĞLAM BİR TEMEL.</p><h1>Hareketine<br><em>ayak uydurur.</em></h1><p>Yüksek çözünürlüklü kamera. Bağımsız kafa takibi.<br>Her şey cihazında işlenir.</p></section>
<section class="workspace"><div class="stage"><video id="camera" autoplay muted playsinline></video><canvas id="overlay"></canvas><div id="placeholder"><span class="cross">＋</span><p>Kamera seni bekliyor.</p><small>Başlatmak için aşağıdaki düğmeye dokun.</small></div><div class="stage-top"><span class="pill" id="state">KAMERA KAPALI</span><span class="pill">AYNA GÖRÜNTÜSÜ</span></div><div class="stage-bottom"><span id="tracking">Takip bekleniyor</span><span>1080p / 60 FPS HEDEF</span></div></div>
<aside><div class="panel-title"><span>CANLI TELEMETRİ</span><i id="live"></i></div><dl><div><dt>Render</dt><dd><b id="render">—</b><small>FPS</small></dd></div><div><dt>Kamera kare hızı</dt><dd><b id="camera-fps">—</b><small>FPS</small></dd></div><div><dt>Algılama</dt><dd><b id="detection-fps">—</b><small>FPS</small></dd></div><div><dt>Model işlem süresi</dt><dd><b id="inference">—</b><small>ms</small></dd></div><div><dt>Kare gönderimi → sonuç</dt><dd><b id="latency">—</b><small>ms</small></dd></div><div><dt>Sonucun yaşı</dt><dd><b id="age">—</b><small>ms</small></dd></div></dl><div class="details"><p>Kamera <strong id="resolution">—</strong></p><p>Algılama girdisi <strong id="input">—</strong></p><p>İşlemci <strong>Worker · WASM</strong></p></div><p class="note">Değerler oturum sırasında ölçülür. Kamera FPS’i render FPS’inden bağımsızdır. Gecikme, fiziksel hareketten ekrana toplam gecikme değildir.</p></aside></section>
<div class="controls"><button id="start">Kamerayı başlat <span>↗</span></button><button id="stop" disabled>Durdur</button><p id="message" role="status" aria-live="polite">Kamera izni yalnızca başlattığında istenir. Ses kaydedilmez.</p></div><footer><span>YALNIZCA KAMERA + KAFA TAKİBİ</span><span>Yerel işleme / Görüntü sunucuya gönderilmez</span></footer></main>`;
const el = (id: string) => document.getElementById(id)!;
const video = el('camera') as HTMLVideoElement;
const canvas = el('overlay') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const startButton = el('start') as HTMLButtonElement;
const stopButton = el('stop') as HTMLButtonElement;
let diagnostics = new CameraDiagnostics();
const telemetry = document.createElement('details');
telemetry.innerHTML = '<summary>Kamera / worker ayrıntıları</summary><pre id="capture-details" style="white-space:pre-wrap;font-size:11px;color:#9eafa5">Ölçüm bekleniyor.</pre>';
document.querySelector('main')!.append(telemetry);
const impactLink = document.createElement('a'); impactLink.href = '/impact-lab/'; impactLink.textContent = 'Impact Lab →'; impactLink.style.cssText = 'color:#cdff72;margin-left:20px;font-size:13px'; document.querySelector('header')!.append(impactLink);
let generation = 0, active = false, worker: Worker | undefined, stream: MediaStream | undefined;
let raf = 0, vfc = 0, fallback = 0, timeout = 0;
let pose: Pose | null = null, resultAt = 0, duration = 0, latency = 0;
let gate = new FrameGate(), filter = new PoseFilter();
let renderFrames = 0, cameraFrames = 0, detectionFrames = 0, sampleAt = 0, previousMedia = -1;
let settings: MediaTrackSettings = {};
function message(text: string) { el('message').textContent = text; }
function stop(text = 'Kamera durduruldu.') {
  ++generation; active = false; clearTimeout(timeout);
  cancelAnimationFrame(raf); cancelAnimationFrame(fallback);
  if ('cancelVideoFrameCallback' in video) video.cancelVideoFrameCallback(vfc);
  worker?.terminate(); worker = undefined;
  stream?.getTracks().forEach(track => track.stop()); stream = undefined;
  video.srcObject = null; pose = null; filter.reset(); ctx.clearRect(0, 0, canvas.width, canvas.height);
  startButton.disabled = false; stopButton.disabled = true;
  el('placeholder').hidden = false; el('live').classList.remove('on');
  el('state').textContent = 'KAMERA KAPALI'; el('tracking').textContent = 'Takip bekleniyor';
  for (const id of ['render','camera-fps','detection-fps','inference','latency','age','resolution','input']) el(id).textContent = '—';
  message(text);
}
function armTimeout(ms: number, text: string) { clearTimeout(timeout); timeout = window.setTimeout(() => stop(text), ms); }
async function submit(now: number) {
  if (!active || document.hidden || video.readyState < 2) return;
  // One frame in flight, including bitmap conversion; never queue stale frames.
  if (gate.busy) { diagnostics.busySkipped++; return; }
  if (!gate.acquire(now, Math.max(1000 / 30, duration * 1.1))) { diagnostics.intervalSkipped++; return; }
  const token = generation, target = worker, currentGate = gate;
  const size = detectionSize(video.videoWidth, video.videoHeight);
  armTimeout(10000, 'Takip yanıt vermedi. Kamerayı yeniden başlatabilirsin.');
  try {
    const bitmap = await createImageBitmap(video, { resizeWidth: size.width, resizeHeight: size.height, resizeQuality: 'low' });
    diagnostics.bitmapMs = performance.now() - now;
    if (token !== generation || !active || document.hidden) { bitmap.close(); currentGate.release(); if (token === generation) clearTimeout(timeout); return; }
    try { target!.postMessage({ type: 'frame', bitmap, timestamp: now, ...size }, [bitmap]); }
    catch (error) { bitmap.close(); throw error; }
    diagnostics.submitted++;
    el('input').textContent = `${size.width} × ${size.height}`;
  } catch (error) { if (token === generation) stop(`Kare işlenemedi: ${String(error)}`); }
}
function cameraLoop() {
  if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
    vfc = video.requestVideoFrameCallback((now, metadata) => {
      if (!active) return;
      cameraFrames++; previousMedia = metadata.mediaTime;
      diagnostics.frame(metadata.presentedFrames);
      void submit(now); cameraLoop();
    });
  } else {
    const tick = (now: number) => {
      if (!active) return;
      if (video.currentTime !== previousMedia) { previousMedia = video.currentTime; cameraFrames++; diagnostics.frame(); void submit(now); }
      fallback = requestAnimationFrame(tick);
    };
    fallback = requestAnimationFrame(tick);
  }
}
function render(now: number) {
  if (!active) return;
  renderFrames++;
  const width = video.videoWidth, height = video.videoHeight;
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  ctx.clearRect(0, 0, width, height);
  const fresh = pose && now - resultAt < 180 && !document.hidden;
  if (fresh && pose) {
    ctx.save(); ctx.translate((1 - pose.x) * width, pose.y * height); ctx.rotate(-pose.roll);
    ctx.strokeStyle = '#cdff72'; ctx.lineWidth = Math.max(2, width / 600);
    const radius = pose.size * width * 0.8;
    ctx.beginPath(); ctx.ellipse(0, 0, radius, radius * 1.25, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-10,0); ctx.lineTo(10,0); ctx.moveTo(0,-10); ctx.lineTo(0,10); ctx.stroke(); ctx.restore();
  }
  el('tracking').textContent = document.hidden ? 'Sekme gizli · takip beklemede' : fresh ? 'Kafa takibi aktif' : 'Yüz aranıyor';
  if (now - sampleAt >= 500) {
    const seconds = (now - sampleAt) / 1000;
    el('render').textContent = (renderFrames / seconds).toFixed(0);
    el('camera-fps').textContent = (cameraFrames / seconds).toFixed(0);
    el('detection-fps').textContent = (detectionFrames / seconds).toFixed(0);
    el('inference').textContent = duration ? duration.toFixed(1) : '—';
    el('latency').textContent = latency ? latency.toFixed(1) : '—';
    el('age').textContent = resultAt ? Math.max(0, now - resultAt).toFixed(0) : '—';
    el('resolution').textContent = `${width} × ${height} (${settings.frameRate?.toFixed(0) ?? '?'} fps ayar)`;
    const m = diagnostics.sample(video, stream?.getVideoTracks()[0]);
    el('capture-details').textContent = JSON.stringify({ note: 'Ana kamera FPS sayacı video callback hızıdır; doğrudan sensör ölçümü değildir. Kaynak FPS null ise tarayıcı desteklemiyor.', ...m }, null, 2);
    renderFrames = cameraFrames = detectionFrames = 0; sampleAt = now;
  }
  raf = requestAnimationFrame(render);
}
async function start() {
  stop('Kamera izni bekleniyor…');
  const token = generation;
  startButton.disabled = true; stopButton.disabled = false;
  try {
    if (!isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('Kamera için HTTPS veya localhost gerekiyor.');
    if (!globalThis.Worker || !globalThis.createImageBitmap) throw new Error('Bu tarayıcı arka planda takibi desteklemiyor. Güncel bir tarayıcı kullan.');
    const media = await navigator.mediaDevices.getUserMedia({ audio: false, video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60 }, facingMode: 'user' } });
    if (token !== generation) { media.getTracks().forEach(t => t.stop()); return; }
    stream = media; settings = media.getVideoTracks()[0].getSettings();
    media.getVideoTracks()[0].addEventListener('ended', () => { if (token === generation) stop('Kamera bağlantısı kesildi. Yeniden başlatabilirsin.'); });
    video.srcObject = media; await video.play();
    if (token !== generation) return;
    active = true; gate = new FrameGate(); filter = new PoseFilter(); pose = null;
    diagnostics = new CameraDiagnostics();
    duration = latency = resultAt = 0; previousMedia = -1;
    renderFrames = cameraFrames = detectionFrames = 0; sampleAt = performance.now();
    el('placeholder').hidden = true; el('live').classList.add('on'); el('state').textContent = 'KAMERA CANLI';
    message('Takip modeli yükleniyor…'); raf = requestAnimationFrame(render);
    worker = new Worker(`${import.meta.env.BASE_URL}tracker.js`);
    armTimeout(60000, 'Takip modeli yüklenemedi. Yeniden başlatabilirsin.');
    worker.onerror = event => { if (token === generation) stop(`Takip hatası: ${event.message}`); };
    worker.onmessage = ({ data }) => {
      if (token !== generation) return;
      clearTimeout(timeout);
      if (data.type === 'ready') { message('Kamera hazır. Başını hareket ettir; takip halkasını gözlemle.'); cameraLoop(); }
      if (data.type === 'error') stop(`Takip hatası: ${data.message}`);
      if (data.type === 'result') {
        gate.release(); duration = data.duration; latency = performance.now() - data.timestamp; detectionFrames++;
        diagnostics.completed++; diagnostics.inferenceMs = duration; diagnostics.roundtripMs = latency;
        if (document.hidden || latency > 180) { pose = null; filter.reset(); return; }
        resultAt = data.timestamp;
        pose = data.pose ? filter.update(data.pose, data.timestamp) : null;
        if (!pose) filter.reset();
      }
    };
    worker.postMessage({ type: 'init', wasm: new URL(`${import.meta.env.BASE_URL}vendor/wasm`, location.href).href, model: new URL(`${import.meta.env.BASE_URL}vendor/face_landmarker.task`, location.href).href });
  } catch (error) { if (token === generation) stop(`Kamera başlatılamadı: ${error instanceof Error ? error.message : String(error)}`); }
}
startButton.addEventListener('click', () => void start());
stopButton.addEventListener('click', () => stop());
document.addEventListener('visibilitychange', () => { pose = null; filter.reset(); resultAt = 0; renderFrames = cameraFrames = detectionFrames = 0; sampleAt = performance.now(); });
window.addEventListener('pagehide', () => stop());
