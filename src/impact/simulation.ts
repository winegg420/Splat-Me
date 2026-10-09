export type FaceShape = { x: number; y: number; rx: number; ry: number; roll: number };
export type Outcome = 'hit' | 'near' | 'miss' | 'untracked';
export function faceShape(points: Float32Array): FaceShape | null {
  if (points.length < 455 * 3) return null;
  const x = (i: number) => 1 - points[i * 3], y = (i: number) => points[i * 3 + 1];
  return { x: (x(234) + x(454)) / 2, y: (y(10) + y(152)) / 2,
    rx: Math.max(.025, Math.abs(x(234) - x(454)) * .5), ry: Math.max(.04, Math.abs(y(152) - y(10)) * .5),
    roll: Math.atan2(y(33) - y(263), x(33) - x(263)) };
}
export function collision(target: { x: number; y: number }, face: FaceShape | null, aspect: number): Outcome {
  if (!face) return 'untracked';
  // Face-space ellipse plus the projectile footprint, not a screen-fixed box.
  const angle = face.roll, dx = target.x - face.x, dy = (target.y - face.y) / aspect;
  const x = dx * Math.cos(angle) + dy * Math.sin(angle), y = -dx * Math.sin(angle) + dy * Math.cos(angle);
  const distance = Math.hypot(x / (face.rx + .035), y / (face.ry / aspect + .035));
  return distance <= 1 ? 'hit' : distance < 1.65 ? 'near' : 'miss';
}
export function random(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export class Round {
  start = -Infinity;
  impact = -Infinity;
  target = { x: .5, y: .45 };
  outcome: Outcome | null = null;
  seed = 1;
  duration = 1.25;
  launch(time: number, face: FaceShape, seed: number) {
    this.start = time; this.impact = -Infinity; this.outcome = null;
    this.target = { x: face.x, y: face.y }; this.seed = seed;
  }
  advance(time: number, face: FaceShape | null, aspect: number) {
    if (this.start === -Infinity || this.outcome || time < this.start + this.duration) return null;
    this.impact = time; this.outcome = collision(this.target, face, aspect); return this.outcome;
  }
  reset() { this.start = this.impact = -Infinity; this.outcome = null; }
}
export function replayFrameIndex(times: number[], time: number) {
  let lo = 0, hi = times.length - 1;
  while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (times[mid] <= time) lo = mid; else hi = mid - 1; }
  return lo;
}
export function replayWindow(times:number[],impact:number){
  if(times.length<2)return null;
  const start=replayFrameIndex(times,impact-.28),end=replayFrameIndex(times,impact+.86);
  return end>start&&times[end]-times[start]>.15?{start,end}:null;
}
