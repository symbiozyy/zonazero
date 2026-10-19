'use strict';
// Som sintetizado (WebAudio): efeitos e ambiente de horror cósmico.
const SFX = (() => {
  let ac = null, master = null, amb = null, ambGain = null, rainG = null;
  const last = {};
  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = 0.38; master.connect(ac.destination);
      ambience();
    } catch (e) { ac = null; }
  }
  function noiseBuf(dur) {
    const n = Math.floor(ac.sampleRate * dur), buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  function noise(dur, f0, f1, vol, type, q) {
    if (!ac) return;
    const t = ac.currentTime;
    const src = ac.createBufferSource(); src.buffer = noiseBuf(dur);
    const flt = ac.createBiquadFilter(); flt.type = type || 'lowpass'; flt.Q.value = q || 1;
    flt.frequency.setValueAtTime(f0, t); flt.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(flt); flt.connect(g); g.connect(master); src.start();
  }
  function tone(dur, f0, f1, vol, type, delay) {
    if (!ac) return;
    const t = ac.currentTime + (delay || 0), o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function ambience() {
    ambGain = ac.createGain(); ambGain.gain.value = 0.0; ambGain.connect(master);
    const f = [41.2, 55, 61.7];
    f.forEach((fr, i) => {
      const o = ac.createOscillator(); o.type = i === 2 ? 'triangle' : 'sine'; o.frequency.value = fr;
      const lfo = ac.createOscillator(); lfo.frequency.value = 0.05 + i * 0.03; const lg = ac.createGain(); lg.gain.value = 2.5;
      lfo.connect(lg); lg.connect(o.frequency); lfo.start();
      const g = ac.createGain(); g.gain.value = 0.18 / (i + 1);
      o.connect(g); g.connect(ambGain); o.start();
    });
    const wind = ac.createBufferSource(); wind.buffer = noiseBuf(4); wind.loop = true;
    const wf = ac.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 400; wf.Q.value = 0.6;
    const wl = ac.createOscillator(); wl.frequency.value = 0.07; const wlg = ac.createGain(); wlg.gain.value = 200; wl.connect(wlg); wlg.connect(wf.frequency); wl.start();
    const wg = ac.createGain(); wg.gain.value = 0.05; wind.connect(wf); wf.connect(wg); wg.connect(ambGain); wind.start();
    const rain = ac.createBufferSource(); rain.buffer = noiseBuf(3); rain.loop = true;
    const rf = ac.createBiquadFilter(); rf.type = 'highpass'; rf.frequency.value = 1800;
    rainG = ac.createGain(); rainG.gain.value = 0; rain.connect(rf); rf.connect(rainG); rainG.connect(master); rain.start();
  }
  function setAmbience(level, rain) {
    if (!ac) return;
    ambGain.gain.setTargetAtTime(level, ac.currentTime, 1.5);
    rainG.gain.setTargetAtTime(rain ? 0.05 : 0, ac.currentTime, 2);
  }
  const P = {
    swing: () => noise(0.16, 3000, 500, 0.22, 'bandpass', 2),
    hit: () => { noise(0.12, 700, 120, 0.55); tone(0.1, 150, 60, 0.3, 'square'); },
    squish: () => { noise(0.18, 900, 200, 0.4, 'lowpass', 4); tone(0.12, 90, 40, 0.2, 'sawtooth'); },
    shot: () => { noise(0.3, 5000, 180, 0.85); tone(0.14, 200, 45, 0.5, 'square'); },
    shotgun: () => { noise(0.45, 4000, 100, 1); tone(0.2, 120, 35, 0.6, 'square'); },
    rifle: () => { noise(0.22, 6000, 300, 0.75); tone(0.1, 260, 60, 0.45, 'square'); },
    sniper: () => { noise(0.6, 3000, 60, 1); tone(0.3, 160, 30, 0.6, 'sawtooth'); },
    flame: () => noise(0.18, 600, 300, 0.25, 'lowpass', 0.5),
    click: () => tone(0.05, 1200, 900, 0.15, 'square'),
    reload: () => { tone(0.05, 500, 400, 0.2, 'square'); tone(0.06, 800, 700, 0.2, 'square', 0.25); },
    groan: () => tone(0.7 + Math.random() * 0.5, 95 + Math.random() * 40, 60, 0.12, 'sawtooth'),
    chitter: () => { for (let k = 0; k < 5; k++) tone(0.04, 1800 + Math.random() * 900, 1200, 0.07, 'square', k * 0.06); },
    hum: () => tone(1.2, 70, 72, 0.12, 'sine'),
    scream: () => { tone(1.4, 900, 300, 0.3, 'sawtooth'); noise(1.2, 3000, 800, 0.3, 'bandpass', 3); },
    hurt: () => { tone(0.22, 420, 170, 0.3, 'triangle'); noise(0.1, 800, 200, 0.25); },
    door: () => { tone(0.18, 130, 90, 0.25, 'square'); noise(0.1, 900, 300, 0.2); },
    glass: () => { for (let k = 0; k < 6; k++) tone(0.15, 2000 + Math.random() * 3000, 1500, 0.08, 'sine', k * 0.03); noise(0.25, 8000, 2000, 0.3, 'highpass'); },
    pickup: () => tone(0.08, 600, 1200, 0.15, 'triangle'),
    eat: () => { noise(0.08, 1500, 500, 0.2); setTimeout(() => noise(0.08, 1500, 500, 0.2), 120); },
    build: () => { tone(0.06, 300, 200, 0.4, 'square'); tone(0.06, 300, 200, 0.4, 'square', 0.14); },
    bloom: () => { for (let k = 0; k < 4; k++) tone(1.6, 110 + k * 3, 55, 0.22, 'sawtooth', k * 0.8); noise(4, 200, 60, 0.4); },
    bang: () => { noise(0.15, 400, 80, 0.5); tone(0.12, 90, 50, 0.4, 'square'); },
    boom: () => { noise(1.2, 1200, 30, 1.1); tone(0.8, 80, 25, 0.8, 'sine'); },
    pop: () => { noise(0.5, 600, 80, 0.7, 'lowpass', 3); tone(0.3, 200, 60, 0.3, 'sine'); },
    cough: () => { noise(0.18, 1200, 300, 0.25, 'bandpass', 2); noise(0.15, 1000, 250, 0.2, 'bandpass', 2); },
    whisper: () => noise(1.2, 3000 + Math.random() * 2000, 1500, 0.06, 'bandpass', 8),
    heart: () => { tone(0.12, 60, 40, 0.35, 'sine'); tone(0.12, 55, 38, 0.3, 'sine', 0.22); },
    spit: () => { noise(0.25, 2000, 400, 0.3, 'bandpass', 3); tone(0.2, 300, 120, 0.1, 'sawtooth'); },
    nest: () => { tone(0.8, 60, 40, 0.3, 'sine'); noise(0.6, 300, 80, 0.3); },
    win: () => { [262, 330, 392, 523].forEach((f, k) => tone(0.8, f, f, 0.2, 'triangle', k * 0.2)); },
  };
  function play(n, minGap) {
    if (!ac) return;
    const t = performance.now();
    if (minGap && last[n] && t - last[n] < minGap) return;
    last[n] = t;
    try { P[n] && P[n](); } catch (e) { /* som é opcional */ }
  }
  return { init, play, setAmbience };
})();
