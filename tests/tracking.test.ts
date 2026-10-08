import { describe, expect, it } from 'vitest';
import { detectionSize, FrameGate, OneEuro, PoseFilter } from '../src/tracking';
describe('frame scheduling', () => {
  it('never queues frames and respects the target interval', () => {
    const gate = new FrameGate();
    expect(gate.acquire(0, 33)).toBe(true);
    expect(gate.acquire(100, 33)).toBe(false);
    gate.release();
    expect(gate.acquire(20, 33)).toBe(false);
    expect(gate.acquire(100, 33)).toBe(true);
  });
  it('preserves aspect ratio and never upscales', () => {
    expect(detectionSize(1920,1080)).toEqual({width:640,height:360});
    expect(detectionSize(1080,1920)).toEqual({width:360,height:640});
    expect(detectionSize(320,240)).toEqual({width:320,height:240});
  });
});
describe('adaptive smoothing', () => {
  it('reduces stationary jitter while following a large movement', () => {
    const filter = new OneEuro(); filter.filter(.5, 0);
    const small = filter.filter(.51, 33);
    expect(small).toBeLessThan(.51); expect(small).toBeGreaterThan(.5);
    for (let i=2; i<10; i++) filter.filter(.9,i*33);
    expect(filter.filter(.9,330)).toBeGreaterThan(.87);
  });
  it('reacquires without blending stale positions', () => {
    const f = new PoseFilter(); f.update({x:0,y:0,size:.2,roll:0},0);
    expect(f.update({x:1,y:1,size:.4,roll:1},200).x).toBe(1);
    f.reset(); expect(f.update({x:.3,y:.3,size:.2,roll:0},220).x).toBe(.3);
  });
});
