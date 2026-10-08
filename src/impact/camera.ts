import { CameraDiagnostics } from '../diagnostics';
import { detectionSize, FrameGate, PoseFilter, type Pose } from '../tracking';
export type Face = { pose: Pose; points: Float32Array; at: number };
export class CameraPipeline {
  readonly video = document.createElement('video');
  metrics = new CameraDiagnostics();
  stream?: MediaStream;
  face: Face | null = null;
  tracking = true;
  ready = false;
  onState: (text: string) => void = () => {};
  onError: (text: string) => void = () => {};
  private worker?: Worker;
  private gate = new FrameGate();
  private filter = new PoseFilter();
  private token = 0;
  private vfc = 0;
  private raf = 0;
  private watchdog = 0;
  private lastMedia = -1;
  constructor() { this.video.muted = true; this.video.autoplay = true; this.video.playsInline = true; }
  async start(profile: string, deviceId?: string) {
    this.stop(); const token = this.token;
    this.metrics = new CameraDiagnostics();
    this.onState('Kamera izni bekleniyor…');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: {
        width: { ideal: profile === 'speed' ? 1280 : 1920 }, height: { ideal: profile === 'speed' ? 720 : 1080 },
        frameRate: { ideal: 60 }, ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user' }),
      } });
      if (token !== this.token) { stream.getTracks().forEach(t => t.stop()); return; }
      this.stream = stream; this.video.srcObject = stream;
      stream.getVideoTracks()[0].addEventListener('ended', () => { if (token === this.token) this.fail('Kamera bağlantısı kesildi.'); });
      await this.video.play(); if (token !== this.token) return;
      this.loop(); // Measure capture immediately, independently of model loading and inference.
      this.onState('Kamera açık · takip modeli yükleniyor…');
      this.worker = new Worker(`${import.meta.env.BASE_URL}tracker.js`);
      this.watchdog = window.setTimeout(() => this.fail('Takip modeli yükleme zaman aşımı.'), 60000);
      this.worker.onerror = e => { if (token === this.token) this.fail(e.message); };
      this.worker.onmessage = ({ data }) => {
        if (token !== this.token) return;
        clearTimeout(this.watchdog);
        if (data.type === 'ready') { this.ready = true; this.onState('Yüzünü kadraja al. Hazır olduğunda fırlat.'); }
        if (data.type === 'error') this.fail(data.message);
        if (data.type === 'result') {
          this.gate.release(); this.metrics.completed++;
          this.metrics.inferenceMs = data.duration; this.metrics.roundtripMs = performance.now() - data.timestamp;
          if (data.pose && data.points && !document.hidden && this.tracking && this.metrics.roundtripMs < 220) {
            this.face = { pose: this.filter.update(data.pose, data.timestamp), points: data.points, at: data.timestamp };
          } else { this.face = null; this.filter.reset(); }
        }
      };
      this.worker.postMessage({ type: 'init', landmarks: true,
        wasm: new URL(`${import.meta.env.BASE_URL}vendor/wasm`, location.href).href,
        model: new URL(`${import.meta.env.BASE_URL}vendor/face_landmarker.task`, location.href).href });
    } catch (error) { if (token === this.token) this.fail(error instanceof Error ? error.message : String(error)); }
  }
  get freshFace() { return this.face && performance.now() - this.face.at < 220 && !document.hidden ? this.face : null; }
  private loop() {
    if (!this.stream) return;
    if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
      this.vfc = this.video.requestVideoFrameCallback((time, meta) => {
        this.metrics.frame(meta.presentedFrames); void this.submit(time); this.loop();
      });
    } else {
      this.raf = requestAnimationFrame(time => {
        if (this.video.currentTime !== this.lastMedia) { this.lastMedia = this.video.currentTime; this.metrics.frame(); void this.submit(time); }
        this.loop();
      });
    }
  }
  private async submit(time: number) {
    if (!this.ready || !this.tracking || document.hidden || this.video.readyState < 2) return;
    if (this.gate.busy) { this.metrics.busySkipped++; return; }
    if (!this.gate.acquire(time, Math.max(1000 / 30, this.metrics.inferenceMs))) { this.metrics.intervalSkipped++; return; }
    const token = this.token, gate = this.gate;
    const size = detectionSize(this.video.videoWidth, this.video.videoHeight);
    const started = performance.now();
    this.watchdog = window.setTimeout(() => this.fail('Takip yanıt vermiyor. Yeniden başlatabilirsin.'), 10000);
    try {
      const bitmap = await createImageBitmap(this.video, { resizeWidth: size.width, resizeHeight: size.height, resizeQuality: 'low' });
      if (token !== this.token || document.hidden) { bitmap.close(); gate.release(); if (token === this.token) clearTimeout(this.watchdog); return; }
      this.metrics.bitmapMs = performance.now() - started;
      try { this.worker!.postMessage({ type: 'frame', bitmap, timestamp: time, ...size }, [bitmap]); }
      catch (e) { bitmap.close(); throw e; }
      this.metrics.submitted++;
    } catch (e) { if (token === this.token) this.fail(String(e)); }
  }
  private fail(text: string) { this.stop(); this.onError(text); }
  stop() {
    this.token++; this.ready = false; clearTimeout(this.watchdog);
    if ('cancelVideoFrameCallback' in this.video) this.video.cancelVideoFrameCallback(this.vfc);
    cancelAnimationFrame(this.raf); this.worker?.terminate(); this.worker = undefined;
    this.stream?.getTracks().forEach(t => t.stop()); this.stream = undefined;
    this.video.srcObject = null; this.face = null; this.filter.reset(); this.gate = new FrameGate(); this.lastMedia = -1;
  }
}
