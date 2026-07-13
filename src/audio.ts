// ===================================================================
//  AUDIO — a fully procedural deep-space drone (no asset files).
//  Detuned low oscillators + filtered brown noise + a faint shimmer
//  that opens up as you fall toward the horizon.  Off until the user
//  enables it (browsers block autoplay); a gesture resumes the context.
// ===================================================================

export function createAudio() {
  let ctx, master, lp, hi, hiGain, muted = true, built = false;

  function build() {
    if (built) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);

    // detuned low drone (root, fifth, octave)
    const base = 55; // A1
    [base, base * 1.5, base * 2.01].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = i === 0 ? "triangle" : "sine";
      o.frequency.value = f; o.detune.value = (i - 1) * 6;
      const g = ctx.createGain(); g.gain.value = i === 0 ? 0.5 : 0.2;
      o.connect(g); g.connect(master); o.start();
    });

    // filtered brown noise → low rumble
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0); let last = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
    lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 200;
    const ng = ctx.createGain(); ng.gain.value = 0.4;
    noise.connect(lp); lp.connect(ng); ng.connect(master); noise.start();

    // faint high shimmer that only appears very near the hole
    hi = ctx.createOscillator(); hi.type = "sine"; hi.frequency.value = 330;
    hiGain = ctx.createGain(); hiGain.gain.value = 0; hi.connect(hiGain); hiGain.connect(master); hi.start();
    built = true;
  }

  function resume() { if (ctx && ctx.state === "suspended") ctx.resume(); }

  let volume = 1;

  return {
    toggle() { build(); resume(); muted = !muted; return !muted; },
    get on() { return built && !muted; },
    setVolume(v) { volume = Math.max(0, Math.min(2, v)); },
    setIntensity(x) {
      if (!built || muted) { if (master) master.gain.setTargetAtTime(0, ctx.currentTime, 0.3); return; }
      const t = ctx.currentTime;
      master.gain.setTargetAtTime((0.05 + 0.20 * x) * volume, t, 0.4);   // level swells inward, scaled by user volume
      lp.frequency.setTargetAtTime(180 + 1000 * x, t, 0.4);      // rumble opens up
      hiGain.gain.setTargetAtTime(0.018 * Math.max(0, x - 0.55) * 2.2, t, 0.5);
      hi.frequency.setTargetAtTime(300 + 260 * x, t, 0.6);
    },
  };
}
