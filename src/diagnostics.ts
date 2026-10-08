type TrackStats = { totalFrames: number; deliveredFrames: number; discardedFrames: number };
export class CameraDiagnostics {
  callbacks = 0;
  presented = 0;
  submitted = 0;
  completed = 0;
  busySkipped = 0;
  intervalSkipped = 0;
  bitmapMs = 0;
  inferenceMs = 0;
  roundtripMs = 0;
  private lastPresented?: number;
  private lastTime = performance.now();
  private previous = { callbacks: 0, presented: 0, submitted: 0, completed: 0, source: 0, delivered: 0, decoded: 0 };
  frame(presentedFrames?: number) {
    this.callbacks++;
    if (presentedFrames !== undefined) {
      if (this.lastPresented !== undefined) this.presented += Math.max(0, presentedFrames - this.lastPresented);
      else this.presented++;
      this.lastPresented = presentedFrames;
    }
  }
  sample(video: HTMLVideoElement, track?: MediaStreamTrack) {
    const now = performance.now(), seconds = Math.max(.01, (now - this.lastTime) / 1000);
    const stats = (track as (MediaStreamTrack & { stats?: TrackStats }) | undefined)?.stats;
    const quality = video.getVideoPlaybackQuality?.();
    const current = { callbacks: this.callbacks, presented: this.presented, submitted: this.submitted, completed: this.completed,
      source: stats?.totalFrames ?? 0, delivered: stats?.deliveredFrames ?? 0, decoded: quality?.totalVideoFrames ?? 0 };
    const rate = (key: keyof typeof current) => Math.max(0, (current[key] - this.previous[key]) / seconds);
    const result = { callbackFps: rate('callbacks'), presentedFps: this.lastPresented === undefined ? null : rate('presented'),
      sourceFps: stats ? rate('source') : null, deliveredFps: stats ? rate('delivered') : null,
      decodedFps: quality ? rate('decoded') : null, submittedFps: rate('submitted'), detectionFps: rate('completed'),
      busySkipped: this.busySkipped, intervalSkipped: this.intervalSkipped, bitmapMs: this.bitmapMs,
      inferenceMs: this.inferenceMs, roundtripMs: this.roundtripMs, settings: track?.getSettings(),
      capabilities: track?.getCapabilities?.(), constraints: track?.getConstraints(),
      discardedFrames: stats?.discardedFrames ?? null, droppedVideoFrames: quality?.droppedVideoFrames ?? null };
    this.previous = current; this.lastTime = now;
    return result;
  }
}
