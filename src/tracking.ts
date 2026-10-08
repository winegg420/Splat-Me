export type Pose = { x: number; y: number; size: number; roll: number };
export class OneEuro {
  private value?: number;
  private previous = 0;
  private derivative = 0;
  private time = 0;
  filter(value: number, time: number) {
    if (this.value === undefined) { this.value = this.previous = value; this.time = time; return value; }
    const dt = Math.max(0.001, (time - this.time) / 1000);
    const alpha = (cutoff: number) => 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));
    this.derivative += alpha(1) * ((value - this.previous) / dt - this.derivative);
    this.value += alpha(2 + 1.5 * Math.abs(this.derivative)) * (value - this.value);
    this.previous = value; this.time = time;
    return this.value;
  }
}
export class PoseFilter {
  private filters = Array.from({ length: 4 }, () => new OneEuro());
  private last = -Infinity;
  update(p: Pose, time: number): Pose {
    if (time - this.last > 180) this.reset();
    this.last = time;
    const v = [p.x, p.y, p.size, p.roll].map((n, i) => this.filters[i].filter(n, time));
    return { x: v[0], y: v[1], size: v[2], roll: v[3] };
  }
  reset() { this.filters = Array.from({ length: 4 }, () => new OneEuro()); this.last = -Infinity; }
}
export class FrameGate {
  busy = false;
  private last = -Infinity;
  acquire(time: number, interval: number) {
    // Callback timestamps jitter around 33.33ms. A strict boundary can halve 30fps input.
    if (this.busy || time - this.last < interval - Math.min(2, interval * .06)) return false;
    this.busy = true; this.last = time; return true;
  }
  release() { this.busy = false; }
}
export function detectionSize(width: number, height: number) {
  const ratio = Math.min(1, 640 / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}
