import { describe,it,expect } from 'vitest';
import { collision, Round, random, replayFrameIndex } from '../src/impact/simulation';
import { FrameGate } from '../src/tracking';
const face={x:.5,y:.5,rx:.12,ry:.25,roll:0};
describe('impact decisions',()=>{
  it('separates hit, near miss, clean miss, and unknown tracking',()=>{
    expect(collision({x:.5,y:.5},face,16/9)).toBe('hit');
    expect(collision({x:.72,y:.5},face,16/9)).toBe('near');
    expect(collision({x:.95,y:.5},face,16/9)).toBe('miss');
    expect(collision({x:.5,y:.5},null,16/9)).toBe('untracked');
  });
  it('locks aim at launch and decides only once at the impact plane',()=>{
    const r=new Round();r.launch(10,face,71);expect(r.advance(11,face,16/9)).toBe(null);
    expect(r.advance(12,{...face,x:.9},16/9)).toBe('miss');
    expect(r.target.x).toBe(.5);expect(r.advance(13,face,16/9)).toBe(null);
  });
  it('a lost face is not awarded a successful dodge',()=>{
    const r=new Round();r.launch(0,face,1);expect(r.advance(2,null,16/9)).toBe('untracked');
  });
  it('particle seeds are deterministic for reproducibility',()=>{
    const a=random(41),b=random(41);expect(Array.from({length:50},a)).toEqual(Array.from({length:50},b));
  });
});
describe('real replay and cadence',()=>{
  it('selects recorded frames by timestamp, including uneven capture gaps',()=>{
    expect(replayFrameIndex([1,1.04,1.1,1.14],1.09)).toBe(1);
    expect(replayFrameIndex([1,1.04,1.1,1.14],1.2)).toBe(3);
    expect(replayFrameIndex([1,1.04,1.1,1.14],.9)).toBe(0);
  });
  it('does not halve a jittering 30fps camera because of a strict 33.33ms threshold',()=>{
    const gate=new FrameGate();for(const t of [0,33,67,100,133,167]){expect(gate.acquire(t,1000/30)).toBe(true);gate.release();}
  });
});
