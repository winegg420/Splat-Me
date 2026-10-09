import { describe,it,expect } from 'vitest';
import { depositSpec } from '../src/impact/deposits';
import { fluidSeed } from '../src/impact/fluid';
import { impactEnvelope } from '../src/impact/renderer';
describe('seeded fluid and surface deposits',()=>{
 it('varies asymmetric hits while preserving identical replay seeds',()=>{
  const a=depositSpec(19,2),b=depositSpec(20,2);
  expect(a).toEqual(depositSpec(19,2));expect(a.centers).not.toEqual(b.centers);
  const centroid=a.centers.reduce((n,p)=>n+p.x,0)/a.centers.length;
  expect(Math.abs(centroid-.5)).toBeGreaterThan(.01);
  expect(a.drips.every(d=>d.speed>0&&d.r>0)).toBe(true);
 });
 it('children appear exactly when their parent starts to split',()=>{
  const drops=fluidSeed(19);expect(drops).toHaveLength(144);
  for(const d of drops.filter(d=>d.parent>=0)){expect(d.delay).toBe(drops[d.parent].split);expect(d.size).toBeLessThan(drops[d.parent].size);}
  expect(new Set(drops.map(d=>d.size)).size).toBeGreaterThan(90);
 });
 it('has a fast visible compression, elastic overshoot and bounded return',()=>{
  expect(impactEnvelope(-.1)).toBe(0);expect(impactEnvelope(.04)).toBeGreaterThan(.65);
  expect(impactEnvelope(.3)).toBeLessThan(0);expect(impactEnvelope(.47)).toBe(0);
  expect(Math.abs(impactEnvelope(.45))).toBeLessThan(.025);
 });
});
