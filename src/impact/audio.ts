import { random } from './simulation';
// Original procedural Foley. No external recordings, microphone input or network audio.
export class ImpactAudio {
  context?: AudioContext;
  muted = false;
  private master?: GainNode;
  private noise?: AudioBuffer;
  private voices = new Set<AudioScheduledSourceNode>();
  lastScheduledAt = 0;
  async unlock() {
    if (!this.context) {
      const ctx = this.context = new AudioContext({ latencyHint: 'interactive' });
      const master = this.master = ctx.createGain(); master.gain.value = .65;
      const compressor = ctx.createDynamicsCompressor(); compressor.threshold.value = -14; compressor.ratio.value = 5;
      master.connect(compressor); compressor.connect(ctx.destination);
      this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = this.noise.getChannelData(0), rng = random(482);
      let brown = 0;
      for (let i = 0; i < data.length; i++) { const white = rng() * 2 - 1; brown = (brown + white * .04) / 1.04; data[i] = white * .65 + brown * 2; }
    }
    await this.context.resume(); this.setMuted(this.muted);
  }
  setMuted(value: boolean) { this.muted = value; if (this.master && this.context) this.master.gain.setTargetAtTime(value ? 0 : .65, this.context.currentTime, .015); }
  private voice(source: AudioScheduledSourceNode, end: number) { this.voices.add(source); source.onended = () => { this.voices.delete(source); source.disconnect(); }; source.stop(end); }
  private pop(at: number, freq: number, length: number, volume: number, pan: number, rate = 1) {
    const ctx = this.context!;
    const osc = ctx.createOscillator(), gain = ctx.createGain(), stereo = ctx.createStereoPanner();
    osc.type = 'sine'; osc.frequency.setValueAtTime(freq * rate, at); osc.frequency.exponentialRampToValueAtTime(28 * rate, at + length / rate);
    gain.gain.setValueAtTime(.001, at); gain.gain.exponentialRampToValueAtTime(volume, at + .005); gain.gain.exponentialRampToValueAtTime(.001, at + length / rate);
    stereo.pan.value = pan; osc.connect(gain); gain.connect(stereo); stereo.connect(this.master!);
    osc.start(at); this.voice(osc, at + length / rate + .03);
  }
  private spray(at: number, length: number, freq: number, volume: number, pan: number, rate = 1) {
    const ctx = this.context!, source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain(), stereo = ctx.createStereoPanner();
    source.buffer = this.noise!; source.playbackRate.value = rate;
    filter.type = 'bandpass'; filter.frequency.setValueAtTime(freq, at); filter.frequency.exponentialRampToValueAtTime(Math.max(80, freq * .18), at + length / rate); filter.Q.value = .7;
    gain.gain.setValueAtTime(.001, at); gain.gain.exponentialRampToValueAtTime(volume, at + .008); gain.gain.exponentialRampToValueAtTime(.001, at + length / rate);
    stereo.pan.value = pan; source.connect(filter); filter.connect(gain); gain.connect(stereo); stereo.connect(this.master!);
    source.start(at); this.voice(source, at + length / rate + .03);
  }
  whoosh(duration: number, pan: number) {
    if (!this.context) return;
    const ctx = this.context, at = ctx.currentTime + .01;
    const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain(), stereo = ctx.createStereoPanner();
    source.buffer = this.noise!; source.loop = true; filter.type = 'bandpass'; filter.Q.value = 1.1;
    filter.frequency.setValueAtTime(180, at); filter.frequency.exponentialRampToValueAtTime(2400, at + duration);
    gain.gain.setValueAtTime(.001, at); gain.gain.exponentialRampToValueAtTime(.38, at + duration * .9); gain.gain.exponentialRampToValueAtTime(.001, at + duration + .12);
    stereo.pan.setValueAtTime(-pan, at); stereo.pan.linearRampToValueAtTime(pan, at + duration);
    source.connect(filter); filter.connect(gain); gain.connect(stereo); stereo.connect(this.master!);
    source.start(at); this.voice(source, at + duration + .15);
  }
  impact(kind: string, pan: number, rate = 1) {
    if (!this.context) return;
    const at = this.context.currentTime + .008; this.lastScheduledAt = performance.now() + 8;
    if (kind === 'hit') {
      this.pop(at, 135, .22, .9, 0, rate); // body / thud
      this.spray(at, .2, 1650, 1.1, pan, rate); // wet crack
      this.pop(at + .018, 440, .12, .35, pan, rate); // elastic squelch
      const rng = random(91);
      for (let i = 0; i < 12; i++) {
        const t = at + .025 + rng() * .38 / rate;
        this.pop(t, 220 + rng() * 620, .025 + rng() * .065, .06 + rng() * .1, rng() * 2 - 1, rate);
        if (i % 3 === 0) this.spray(t, .09, 2800, .12, rng() * 2 - 1, rate);
      }
      this.spray(at + .07, .42, 480, .18, -pan, rate); // viscous tail
    } else if (kind === 'near') { this.spray(at, .35, 3100, .6, pan, rate); this.pop(at, 62, .28, .35, 0, rate); }
    else this.spray(at, .13, 850, .18, pan, rate);
  }
  stop() { for (const voice of this.voices) { try { voice.stop(); } catch { /* already ended */ } } this.voices.clear(); }
  dispose() { this.stop(); void this.context?.close(); }
}
