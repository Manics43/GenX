// GenX engine: every module runs inside this one AudioWorkletProcessor with
// fixed internal routing (no patch cables). See js/credits.js for the VCV Rack
// modules each block is modeled on.
//
//  Clock ─┬─ Bernoulli Seq ─ Quantizer ─ Glide ─ Triple VCO + Noise ─ VCF ─ VCA(ENV1) ─┐
//         │                                        (ENV2 → VCF)                         │
//         ├─ Entropy Seq ── Quantizer ─ Macro VCO ─ LPG(ENV3) ─────────────────────────┤ Mixer ─ Chorus ─┐
//         └─ Progression ─ root ─ Drone (cloud) ─ SVF ──────────────────────────────────┘   sends: Delay ─ Reverb
//  LFO 1, LFO 2, Lorenz, Random Walk → fixed modulation amounts (Modifications tab)        Master (drive, width, volume)

const TAU = Math.PI * 2;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const DIVS = [1, 2, 3, 4, 6, 8];
const DELAY_SYNC = [0, 1, 2, 3, 4, 6, 8];

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function polyblep(t, dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}

// ---------- building blocks ----------
class Osc {
  constructor() { this.ph = Math.random(); }
  // wave: 0 sin .. 1 tri .. 2 saw .. 3 square (continuous morph)
  tick(freq, sr, wave, pw, fmHz = 0) {
    const f = freq + fmHz;
    let dt = f / sr;
    this.ph += dt;
    let wrapped = false;
    if (this.ph >= 1) { this.ph -= Math.floor(this.ph); wrapped = true; }
    else if (this.ph < 0) { this.ph -= Math.floor(this.ph); }
    dt = Math.abs(dt);
    const p = this.ph;
    const w = clamp(wave, 0, 3);
    const i = Math.min(2, Math.floor(w));
    const x = w - i;
    const val = (k) => {
      switch (k) {
        case 0: return Math.sin(TAU * p);
        case 1: return 1 - 4 * Math.abs(p - 0.5);
        case 2: return 2 * p - 1 - polyblep(p, dt);
        default: {
          let s = p < pw ? 1 : -1;
          s += polyblep(p, dt);
          let q = p - pw; if (q < 0) q += 1;
          s -= polyblep(q, dt);
          return s;
        }
      }
    };
    this.wrapped = wrapped;
    return x < 0.001 ? val(i) : val(i) * (1 - x) + val(i + 1) * x;
  }
}

class ADSR {
  constructor() { this.v = 0; this.stage = 0; this.gate = false; }
  on() { this.gate = true; this.stage = 1; }
  off() { this.gate = false; this.stage = 4; }
  tick(a, d, s, r, sr) {
    switch (this.stage) {
      case 1: this.v += (1.25 - this.v) * (1 - Math.exp(-1 / (a * sr * 0.6 + 1))); if (this.v >= 1) { this.v = 1; this.stage = 2; } break;
      case 2: this.v += (s - this.v) * (1 - Math.exp(-1 / (d * sr * 0.3 + 1))); break;
      case 4: this.v += (0 - this.v) * (1 - Math.exp(-1 / (r * sr * 0.3 + 1))); if (this.v < 1e-5) { this.v = 0; this.stage = 0; } break;
    }
    return this.v;
  }
}

// Zero-delay-feedback 4-pole ladder with mode mixing.
class Ladder {
  constructor() { this.s = new Float64Array(4); }
  tick(x, fc, res, drive, mode, sr) {
    const g = Math.tan(Math.PI * clamp(fc, 10, sr * 0.45) / sr);
    const G = g / (1 + g);
    const k = res * 4.2;
    const s = this.s;
    const S = (G * G * G * s[0] + G * G * s[1] + G * s[2] + s[3]) / (1 + g);
    const G4 = G * G * G * G;
    const y4est = (G4 * x + S) / (1 + k * G4);
    let u = (x - k * y4est) * (1 + drive * 3);
    u = Math.tanh(u) / (1 + drive * 1.2);
    let inp = u;
    const ys = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
      const v = (inp - s[i]) * G;
      const y = v + s[i];
      s[i] = y + v;
      ys[i] = y; inp = y;
    }
    const comp = 1 + res * 1.5;
    switch (mode) {
      case 1: return ys[1] * comp;
      case 2: return (ys[1] - ys[3]) * 2.2 * comp;
      case 3: return (u - 4 * ys[0] + 6 * ys[1] - 4 * ys[2] + ys[3]) * comp;
      default: return ys[3] * comp;
    }
  }
}

// TPT state-variable filter
class SVF {
  constructor() { this.ic1 = 0; this.ic2 = 0; this.lp = 0; this.bp = 0; this.hp = 0; }
  tick(x, fc, q, sr) {
    const g = Math.tan(Math.PI * clamp(fc, 10, sr * 0.45) / sr);
    const k = 2 - 2 * clamp(q, 0, 0.98);
    const a1 = 1 / (1 + g * (g + k)), a2 = g * a1, a3 = g * a2;
    const v3 = x - this.ic2;
    const v1 = a1 * this.ic1 + a2 * v3;
    const v2 = this.ic2 + a2 * this.ic1 + a3 * v3;
    this.ic1 = 2 * v1 - this.ic1; this.ic2 = 2 * v2 - this.ic2;
    this.lp = v2; this.bp = v1; this.hp = x - k * v1 - v2;
    return v2;
  }
}

class DelayLine {
  constructor(n) { this.buf = new Float32Array(n); this.n = n; this.w = 0; }
  write(x) { this.buf[this.w] = x; this.w = (this.w + 1) % this.n; }
  // d samples behind the most recent write (d >= 1)
  read(d) {
    d = clamp(d, 1, this.n - 2);
    let r = this.w - d; while (r < 0) r += this.n;
    const i = Math.floor(r), f = r - i;
    const a = this.buf[i], b = this.buf[(i + 1) % this.n];
    return a + (b - a) * f;
  }
}

class Allpass {
  constructor(n) { this.line = new DelayLine(n); }
  tick(x, len, g) {
    const d = this.line.read(len);
    const w = x + g * d;
    this.line.write(w);
    return d - g * w;
  }
}

// Dattorro plate (modeled on Valley Plateau's topology)
class Plate {
  constructor(sr) {
    this.k = sr / 29761;
    const L = (n) => Math.ceil(n * this.k * 2.2) + 64;
    this.pre = new DelayLine(Math.ceil(sr * 0.3));
    this.inAP = [142, 107, 379, 277].map((n) => new Allpass(L(n)));
    this.inLen = [142, 107, 379, 277];
    this.apL1 = new Allpass(L(672 + 40)); this.dL1 = new DelayLine(L(4453));
    this.apL2 = new Allpass(L(1800)); this.dL2 = new DelayLine(L(3720));
    this.apR1 = new Allpass(L(908 + 40)); this.dR1 = new DelayLine(L(4217));
    this.apR2 = new Allpass(L(2656)); this.dR2 = new DelayLine(L(3163));
    this.lpIn = 0; this.dampL = 0; this.dampR = 0; this.fbL = 0; this.fbR = 0; this.ph = 0;
  }
  tick(xin, size, decay, damp, preS, mod, sr) {
    const k = this.k * size;
    this.pre.write(xin);
    let x = preS > 0.0005 ? this.pre.read(preS * sr) : xin;
    this.lpIn += 0.7 * (x - this.lpIn); x = this.lpIn;
    const ig = [0.75, 0.75, 0.625, 0.625];
    for (let i = 0; i < 4; i++) x = this.inAP[i].tick(x, this.inLen[i] * k, ig[i]);
    this.ph += 0.9 / sr; if (this.ph > 1) this.ph -= 1;
    const exc = 16 * this.k * mod;
    const m1 = Math.sin(TAU * this.ph) * exc, m2 = Math.cos(TAU * this.ph) * exc;
    // left tank
    let l = x + this.fbR * decay;
    l = this.apL1.tick(l, 672 * k + m1 + exc + 1, -0.7);
    this.dL1.write(l);
    l = this.dL1.read(4453 * k);
    this.dampL += (1 - damp) * (l - this.dampL); l = this.dampL * decay;
    l = this.apL2.tick(l, 1800 * k, 0.5);
    this.dL2.write(l);
    const outL2 = this.dL2.read(3720 * k);
    // right tank
    let r = x + this.fbL * decay;
    r = this.apR1.tick(r, 908 * k + m2 + exc + 1, -0.7);
    this.dR1.write(r);
    r = this.dR1.read(4217 * k);
    this.dampR += (1 - damp) * (r - this.dampR); r = this.dampR * decay;
    r = this.apR2.tick(r, 2656 * k, 0.5);
    this.dR2.write(r);
    const outR2 = this.dR2.read(3163 * k);
    this.fbL = outL2; this.fbR = outR2;
    const t = (line, n) => line.read(Math.max(1, n * k));
    const yl = t(this.dR1, 266) + t(this.dR1, 2974) - t(this.apR2.line, 1913) + t(this.dR2, 1996)
      - t(this.dL1, 1990) - t(this.apL2.line, 187) - t(this.dL2, 1066);
    const yr = t(this.dL1, 353) + t(this.dL1, 3627) - t(this.apL2.line, 1228) + t(this.dL2, 2673)
      - t(this.dR1, 2111) - t(this.apR2.line, 335) - t(this.dR2, 121);
    return [yl * 0.6, yr * 0.6];
  }
}

// Macro oscillator: VA / FM / Additive / Pluck
class Macro {
  constructor(sr) {
    this.sr = sr; this.ph = 0; this.ph2 = 0; this.mph = 0; this.fb = 0;
    this.ks = new DelayLine(Math.ceil(sr / 20) + 4); this.ksLp = 0; this.excite = 0; this.exLp = 0;
    this.rng = Math.random;
  }
  trigger(rng, freq, timbre) {
    this.excite = Math.floor(this.sr / Math.max(20, freq));
    this.exBright = timbre;
    this.rng = rng;
  }
  tick(freq, model, harm, timbre, morph) {
    const sr = this.sr;
    const dt = freq / sr;
    this.ph += dt; if (this.ph >= 1) this.ph -= 1;
    switch (model) {
      case 0: { // VA: saw/pulse blend + detuned saw
        this.ph2 += dt * (1 + harm * 0.012); if (this.ph2 >= 1) this.ph2 -= 1;
        const pw = 0.5 + timbre * 0.45;
        const saw = 2 * this.ph - 1 - polyblep(this.ph, dt);
        let q = this.ph - pw; if (q < 0) q += 1;
        const sq = (this.ph < pw ? 1 : -1) + polyblep(this.ph, dt) - polyblep(q, dt);
        const saw2 = 2 * this.ph2 - 1 - polyblep(this.ph2, dt);
        return (saw * (1 - morph) + sq * morph) * 0.6 + saw2 * harm * 0.4;
      }
      case 1: { // 2-op FM
        const ratios = [0.5, 1, 1.5, 2, 3, 3.5, 4, 5, 7];
        const ratio = ratios[Math.round(harm * (ratios.length - 1))];
        this.mph += dt * ratio; if (this.mph >= 1) this.mph -= 1;
        const mod = Math.sin(TAU * this.mph + this.fb * morph * 2.5);
        this.fb = mod;
        return Math.sin(TAU * this.ph + mod * timbre * 5) * 0.8;
      }
      case 2: { // additive, 16 partials
        let s = 0, norm = 0;
        const tilt = 0.4 + (1 - timbre) * 2.2;
        const peak = 1 + morph * 15;
        for (let n = 1; n <= 16; n++) {
          if (freq * n > sr * 0.45) break;
          let a = 1 / Math.pow(n, tilt);
          if (n % 2 === 0) a *= 1 - harm;
          a *= 1 + 2 * Math.exp(-((n - peak) * (n - peak)) / 4) * morph;
          s += a * Math.sin(TAU * this.ph * n);
          norm += a;
        }
        return (s / Math.max(1, norm)) * 1.1;
      }
      default: { // Karplus-Strong pluck
        const len = clamp(sr / freq, 2, this.ks.n - 3);
        let ex = 0;
        if (this.excite > 0) {
          this.excite--;
          const n = this.rng() * 2 - 1;
          this.exLp += (0.08 + this.exBright * 0.9) * (n - this.exLp);
          ex = this.exLp;
        }
        const d = this.ks.read(len);
        const damp = 0.15 + timbre * 0.8;
        this.ksLp += damp * (d - this.ksLp);
        const decay = 0.985 + morph * 0.0149 - (1 - harm) * 0.01;
        this.ks.write(ex + this.ksLp * decay);
        return d * 1.4;
      }
    }
  }
}

// ---------- Eternal Eclipse family (modeled on 7337Productions/eternaleclipsemodular) ----------

// Cosmic Clock: geocentric ecliptic longitudes from J2000 Keplerian elements
// [a, e, L0, Ldot (deg/century), peri0, peridot]
const KEPLER = {
  Mercury: [0.38709927, 0.20563593, 252.2503235, 149472.67411175, 77.45779628, 0.16047689],
  Venus: [0.72333566, 0.00677672, 181.9790995, 58517.81538729, 131.60246718, 0.00268329],
  Earth: [1.00000261, 0.01671123, 100.46457166, 35999.37244981, 102.93768193, 0.32327364],
  Mars: [1.52371034, 0.0933941, -4.55343205, 19140.30268499, -23.94362959, 0.44441088],
  Jupiter: [5.202887, 0.04838624, 34.39644051, 3034.74612775, 14.72847983, 0.21252668],
  Saturn: [9.53667594, 0.05386179, 49.95424423, 1222.49362201, 92.59887831, -0.41897216],
  Uranus: [19.18916464, 0.04725744, 313.23810451, 428.48202785, 170.9542763, 0.40805281],
  Neptune: [30.06992276, 0.00859048, -55.12002969, 218.45945325, 44.96476227, -0.32241464],
};
const PLANETS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'];
// LFO speed ratio per planet: sqrt of mean geocentric motion relative to the Sun
const PLANET_RATE = [1, 3.66, 2.04, 1.27, 0.73, 0.29, 0.18, 0.108, 0.077];
const ASPECTS = [[0, 1], [60, 0.4], [90, 0.7], [120, 0.6], [180, 0.8]]; // angle, weight
const D2R = Math.PI / 180;
const wrap360 = (x) => ((x % 360) + 360) % 360;

function helio(el, T) {
  const [a, e, L0, Ld, w0, wd] = el;
  const L = L0 + Ld * T, w = w0 + wd * T;
  const M = wrap360(L - w) * D2R;
  let E = M;
  for (let i = 0; i < 6; i++) E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const xv = a * (Math.cos(E) - e), yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const lon = Math.atan2(yv, xv) + w * D2R;
  const r = Math.hypot(xv, yv);
  return [r * Math.cos(lon), r * Math.sin(lon)];
}

// d = days since J2000.0. Returns geocentric ecliptic longitudes (deg) for PLANETS.
function skyAt(d) {
  const T = d / 36525;
  const [ex, ey] = helio(KEPLER.Earth, T);
  const out = new Array(9);
  out[0] = wrap360(Math.atan2(-ey, -ex) / D2R);
  const Mm = (134.963 + 13.064993 * d) * D2R;
  const Ms = (357.529 + 0.98560028 * d) * D2R;
  const D = (297.85 + 12.190749 * d) * D2R;
  out[1] = wrap360(218.316 + 13.176396 * d + 6.289 * Math.sin(Mm) - 1.274 * Math.sin(Mm - 2 * D) + 0.658 * Math.sin(2 * D) - 0.186 * Math.sin(Ms));
  for (let i = 2; i < 9; i++) {
    const [x, y] = helio(KEPLER[PLANETS[i]], T);
    out[i] = wrap360(Math.atan2(y - ey, x - ex) / D2R);
  }
  return out;
}

class CosmicClock {
  constructor() { this.ph = new Float64Array(9); this.lon = skyAt(0); this.signs = this.lon.map((l) => Math.floor(l / 30)); this.aspects = []; this.weights = new Array(9).fill(1); this.out = 0; this.events = []; }
  updateSky(d) {
    this.lon = skyAt(d);
    const signs = this.lon.map((l) => Math.floor(l / 30));
    for (let i = 0; i < 9; i++) if (signs[i] !== this.signs[i]) this.events.push(i);
    this.signs = signs;
    const w = new Array(9).fill(0.3);
    const asp = [];
    for (let i = 0; i < 9; i++) for (let j = i + 1; j < 9; j++) {
      let sep = Math.abs(this.lon[i] - this.lon[j]); if (sep > 180) sep = 360 - sep;
      for (let k = 0; k < ASPECTS.length; k++) {
        const diff = Math.abs(sep - ASPECTS[k][0]);
        if (diff < 8) { const s = (1 - diff / 8) * ASPECTS[k][1]; w[i] += s; w[j] += s; asp.push([i, j, k, +s.toFixed(2)]); }
      }
    }
    this.weights = w; this.aspects = asp;
    // moon phase: elongation of the Moon from the Sun (0 new, 0.5 full)
    this.moonPhase = wrap360(this.lon[1] - this.lon[0]) / 360;
  }
  // advance planetary LFO voices; each voice's shape follows the element of its sign
  tick(rate, dt) {
    let s = 0, ws = 0;
    for (let i = 0; i < 9; i++) {
      this.ph[i] += rate * PLANET_RATE[i] * dt;
      this.ph[i] -= Math.floor(this.ph[i]);
      const p = (this.ph[i] + this.lon[i] / 360) % 1;
      let v;
      switch (this.signs[i] % 4) { // fire, earth, air, water
        case 0: v = 2 * p - 1; break;
        case 1: v = Math.tanh(Math.sin(2 * Math.PI * p) * 4); break;
        case 2: v = 1 - 4 * Math.abs(p - 0.5); break;
        default: v = Math.sin(2 * Math.PI * p);
      }
      s += v * this.weights[i]; ws += this.weights[i];
    }
    this.out = s / ws;
    return this.out;
  }
}

// Liminal Vast: 8-line feedback delay network with a Householder matrix
class LiminalVast {
  constructor(sr) {
    this.sr = sr;
    this.base = [29.7, 37.1, 41.1, 43.7, 53.9, 59.3, 67.1, 79.3].map((ms) => (ms / 1000) * sr);
    this.lines = this.base.map(() => new DelayLine(Math.ceil(sr * 0.32)));
    this.lp = new Float64Array(8);
    this.diff = [4.7, 3.6, 12.7, 9.3].map((ms) => ({ ap: new Allpass(Math.ceil(sr * 0.02)), len: (ms / 1000) * sr }));
    this.ph = 0;
    this.y = new Float64Array(8);
  }
  tick(inL, inR, size, decaySec, damp, mod, freeze) {
    const sr = this.sr;
    let x = (inL + inR) * 0.5;
    if (freeze) x = 0;
    for (const d of this.diff) x = d.ap.tick(x, d.len * Math.min(size, 1.5), 0.6);
    this.ph += 0.37 / sr; if (this.ph > 1) this.ph -= 1;
    let sum = 0;
    const out = this.y;
    for (let i = 0; i < 8; i++) {
      const m = Math.sin(TAU * (this.ph + i / 8)) * mod * 0.0016 * sr;
      const v = this.lines[i].read(this.base[i] * size + m + 2);
      this.lp[i] += (freeze ? 1 : 1 - damp * 0.85) * (v - this.lp[i]);
      out[i] = this.lp[i]; sum += this.lp[i];
    }
    const h = (2 / 8) * sum;
    let l = 0, r = 0;
    for (let i = 0; i < 8; i++) {
      const len = this.base[i] * size;
      const g = freeze ? 1 : Math.pow(10, (-3 * len) / (decaySec * sr));
      const fb = (out[i] - h) * g;
      const inj = (i & 1 ? inR : inL) * (freeze ? 0 : 1) * (i & 2 ? -1 : 1) * 0.5 + x * 0.35;
      const w = fb + inj;
      this.lines[i].write(Math.abs(w) > 1.5 ? Math.tanh(w / 1.5) * 1.5 : w);
      if (i & 1) r += out[i] * (i & 4 ? -1 : 1); else l += out[i] * (i & 2 ? -1 : 1);
    }
    return [l * 0.45, r * 0.45];
  }
}

// Litany Engine: tape loop of the GenX mix with a granular / varispeed reader
class LitanyEngine {
  constructor(sr) {
    this.sr = sr;
    this.buf = new Float32Array(sr * 8);
    this.w = 0; this.head = 0; this.spawn = 0;
    this.voices = Array.from({ length: 8 }, () => ({ on: false, pos: 0, ph: 0, len: 1, rate: 1, pan: 0 }));
    this.rng = Math.random;
  }
  read(pos, L) {
    pos = ((pos % L) + L) % L;
    const i = Math.floor(pos), f = pos - i;
    const a = this.buf[i], b = this.buf[(i + 1) % L];
    return a + (b - a) * f;
  }
  tick(input, p, scanMod) {
    const sr = this.sr;
    const L = Math.max(sr * 0.5, Math.floor(p.lt_len * sr));
    if (!p.lt_hold) { this.buf[this.w] = this.buf[this.w] * 0.25 + input * p.lt_in; }
    this.w = (this.w + 1) % L;
    const speed = p.lt_speed;
    this.head += speed; if (this.head >= L) this.head -= L; else if (this.head < 0) this.head += L;
    const minG = 0.015 * sr;
    const gsz = minG * Math.pow(L / minG, p.lt_size);
    const tape = p.lt_size > 0.97;
    const pitch = Math.pow(2, p.lt_pitch / 12);
    const rate = tape ? speed * pitch : pitch * (speed < 0 ? -1 : 1);
    this.spawn -= 1;
    if (this.spawn <= 0) {
      this.spawn = gsz / p.lt_dens;
      const v = this.voices.find((x) => !x.on) || this.voices[0];
      const scan = clamp(p.lt_scan + scanMod, 0, 1) * L;
      v.on = true; v.ph = 0; v.len = gsz; v.rate = rate;
      v.pos = this.head + scan + (this.rng() - 0.5) * p.lt_spray * L * 0.5;
      v.pan = (this.rng() * 2 - 1) * p.lt_spread;
    }
    let l = 0, r = 0;
    for (const v of this.voices) {
      if (!v.on) continue;
      const env = 0.5 - 0.5 * Math.cos(TAU * (v.ph / v.len));
      const s = this.read(v.pos + v.ph * v.rate, L) * env;
      l += s * (1 - v.pan) * 0.7; r += s * (1 + v.pan) * 0.7;
      v.ph += 1; if (v.ph >= v.len) v.on = false;
    }
    const norm = 1 / Math.sqrt(Math.max(1, p.lt_dens * 0.5));
    this.L = L;
    return [l * norm * 2, r * norm * 2];
  }
  overview(n = 160) {
    const L = this.L || this.buf.length, step = Math.floor(L / n), o = new Array(n);
    for (let i = 0; i < n; i++) { let m = 0; for (let k = 0; k < step; k += 16) m = Math.max(m, Math.abs(this.buf[i * step + k])); o[i] = +m.toFixed(3); }
    return o;
  }
}

// Elemental Revelator: four elemental wavetable oscillators in a ring
function buildTables() {
  const N = 512, F = 8, H = 24;
  const make = (fn) => Array.from({ length: F }, (_, f) => {
    const t = new Float32Array(N);
    const amps = fn(f / (F - 1));
    for (let n = 1; n <= H; n++) { const a = amps(n); if (!a) continue; for (let i = 0; i < N; i++) t[i] += a * Math.sin((TAU * n * i) / N); }
    let pk = 0; for (let i = 0; i < N; i++) pk = Math.max(pk, Math.abs(t[i]));
    for (let i = 0; i < N; i++) t[i] /= pk || 1;
    return t;
  });
  return [
    make((x) => (n) => (n === 1 ? 1 : (x * 0.6 * (n % 3 === 0 ? 1 : 0.35)) / Math.pow(n, 0.9))), // AIR: breath of upper partials
    make((x) => (n) => (n % 2 ? (n === 1 ? 1 : (x * (((n - 1) / 2) % 2 ? -1 : 1)) / (n * n) * 3) : 0)), // WATER: sine to rounded triangle
    make((x) => (n) => { const w = 0.5 - x * 0.42; return Math.sin(Math.PI * n * w) / n; }), // EARTH: narrowing pulse
    make((x) => (n) => (1 / n) * (1 + 3 * Math.exp(-((n - (2 + x * 14)) ** 2) / 3))), // FIRE: saw with a travelling formant
  ];
}
class ElementalRevelator {
  constructor(sr) {
    this.sr = sr; this.tables = buildTables();
    this.ph = new Float64Array(4); this.last = new Float64Array(4);
    this.filt = [new Ladder(), new Ladder()];
    this.notes = [48, 55, 60, 64]; this.cur = [48, 55, 60, 64];
  }
  look(e, phase, frame) {
    const T = this.tables[e], N = 512;
    const f0 = Math.min(6, Math.floor(frame)), fx = frame - f0;
    const pos = (phase - Math.floor(phase)) * N, i = Math.floor(pos), k = pos - i, j = (i + 1) & 511;
    const a = T[f0][i] + (T[f0][j] - T[f0][i]) * k, b = T[f0 + 1][i] + (T[f0 + 1][j] - T[f0 + 1][i]) * k;
    return a + (b - a) * fx;
  }
  tick(p, scan, env) {
    const sr = this.sr, frame = clamp(scan, 0, 1) * 7;
    const o = new Array(4);
    for (let e = 0; e < 4; e++) {
      this.cur[e] += (this.notes[e] - this.cur[e]) * 0.0008;
      const f = mtof(this.cur[e] + 12 * p.er_oct + (e - 1.5) * p.er_detune * 0.1);
      this.ph[e] += f / sr; this.ph[e] -= Math.floor(this.ph[e]);
      const pm = this.last[(e + 3) & 3] * p.er_fm * 0.35; // elemental ring: AIR>WATER>EARTH>FIRE>AIR
      o[e] = this.look(e, this.ph[e] + pm, frame);
    }
    for (let e = 0; e < 4; e++) this.last[e] = o[e];
    const ringA = o[0] * o[2], ringB = o[1] * o[3]; // opposing pairs
    const rg = p.er_ring;
    let l = ((o[0] + o[1]) * 0.5) * (1 - rg) + ringA * rg;
    let r = ((o[2] + o[3]) * 0.5) * (1 - rg) + ringB * rg;
    if (p.er_fold > 0.001) {
      const k = 1 + p.er_fold * 5;
      l = l * (1 - p.er_fold) + Math.sin(l * k * 1.57) * p.er_fold;
      r = r * (1 - p.er_fold) + Math.sin(r * k * 1.57) * p.er_fold;
    }
    const cut = p.er_cut * Math.pow(2, env * 2);
    l = this.filt[0].tick(l * 0.6, cut, p.er_res, 0.1, 0, sr) * env;
    r = this.filt[1].tick(r * 0.6, cut, p.er_res, 0.1, 0, sr) * env;
    return [l, r];
  }
}

// Moon Phase Distortion: waxing = asymmetric warmth, waning = folding; depth follows illumination
class MoonDistortion {
  constructor() { this.dcL = 0; this.dcR = 0; this.lpL = 0; this.lpR = 0; }
  shape(x, ph, depth) {
    const illum = (1 - Math.cos(TAU * ph)) / 2;
    const wax = 0.5 + 0.5 * Math.sin(TAU * ph);
    const drive = 1 + depth * (1 + 14 * illum);
    const xd = x * drive, bias = 0.35 * illum;
    const asym = Math.tanh(xd + bias) - Math.tanh(bias);
    const fold = Math.sin(xd * 0.5 * Math.PI) * 0.9;
    return (wax * asym + (1 - wax) * fold) / (1 + 0.35 * depth * illum);
  }
  tick(l, r, p, moonPhase, sr) {
    const ph = p.mp_manual ? p.mp_phase : moonPhase;
    let yl = this.shape(l, ph, p.mp_depth), yr = this.shape(r, (ph + 0.003) % 1, p.mp_depth);
    this.dcL += 0.0005 * (yl - this.dcL); this.dcR += 0.0005 * (yr - this.dcR);
    yl -= this.dcL; yr -= this.dcR;
    const c = 1 - Math.exp((-TAU * p.mp_tone) / sr);
    this.lpL += c * (yl - this.lpL); this.lpR += c * (yr - this.lpR);
    const m = p.mp_mix;
    return [l * (1 - m) + this.lpL * m, r * (1 - m) + this.lpR * m];
  }
}

// ---------- the processor ----------
class GenXEngine extends AudioWorkletProcessor {
  constructor() {
    super();
    const sr = sampleRate;
    this.sr = sr;
    this.p = {};
    this.running = false;
    this.mask = [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1];
    this.steps = new Array(16).fill(0.5);
    this.seed = 1;
    this.osc = [new Osc(), new Osc(), new Osc()];
    this.env = [new ADSR(), new ADSR(), new ADSR(), new ADSR()];
    this.cosmic = new CosmicClock();
    this.vast = new LiminalVast(sr);
    this.litany = new LitanyEngine(sr);
    this.revel = new ElementalRevelator(sr);
    this.moonDist = new MoonDistortion();
    this.days = 0; this.skyCount = 0; this.liveSky = false; this.uiFrames = 0;
    this.vcf = new Ladder();
    this.macro = new Macro(sr);
    this.lpg = new SVF();
    this.drone = [new Osc(), new Osc(), new Osc(), new Osc()];
    this.droneF = new SVF();
    this.choL = new DelayLine(Math.ceil(sr * 0.06)); this.choR = new DelayLine(Math.ceil(sr * 0.06)); this.choPh = 0;
    this.dlL = new DelayLine(Math.ceil(sr * 2.6)); this.dlR = new DelayLine(Math.ceil(sr * 2.6));
    this.dlTime = 0.4; this.dlToneL = 0; this.dlToneR = 0;
    this.plate = new Plate(sr);
    this.pink = [0, 0, 0]; this.brown = 0;
    this.lfo = [{ ph: 0, v: 0, sh: 0, out: 0 }, { ph: 0.25, v: 0, sh: 0, out: 0 }];
    this.lz = { x: 0.1, y: 0, z: 20, ox: 0, oy: 0, oz: 0 };
    this.walk = 0;
    this.leadNote = 57; this.leadPitch = 57; this.macNote = 45;
    this.panLead = 0;
    this.scope = new Float32Array(2048); this.scopeW = 0;
    this.uiCounter = 0; this.lzTrail = [];
    this.ctrl = 0;
    this.mod = { cut: 0, pw: 0, fm: 0, wave: 0, pan: 0, timbre: 0, morph: 0, drone: 0, space: 0, pitch: 0, ccCut: 0, ccScan: 0, ccGrain: 0, ccVast: 0 };
    this.bus = { l: 0, r: 0, d: 0, v: 0 };
    this.resetSeq();
    this.port.onmessage = (e) => this.onMsg(e.data);
  }

  resetSeq() {
    this.rng = mulberry32(this.seed);
    this.tick = 0; this.sampleInTick = 0; this.nextTickAt = 0; this.time = 0;
    this.regA = Array.from({ length: 16 }, () => ({ v: this.rng(), g: this.rng() < 0.5, burst: 1 }));
    this.posA = -1; this.posB = -1;
    this.events = [];
    this.chordRoot = 0; this.bar = 0;
    this.lastA = null; this.lastB = null;
    this.litany.rng = mulberry32((this.seed ^ 0x11ad) >>> 0);
    // seeded sky: a date within a century of J2000 chosen by the seed
    this.days = ((Math.imul(this.seed, 7919) >>> 0) % 36525) - 18262;
    this.liveSky = false;
    this.cosmic.updateSky(this.days); this.cosmic.events = [];
  }

  triggerRevelator(holdSamples) {
    const p = this.p;
    const root = (p.q_root + this.chordRoot) % 12;
    const deg = [];
    for (let i = 0; i < 12; i++) if (this.mask[i]) deg.push(i);
    const base = 48 + root + p.tune;
    let notes;
    if (p.er_spirit) {
      notes = [0, 2, 4, 6].map((k) => base + deg[k % deg.length] + 12 * Math.floor(k / deg.length));
    } else {
      notes = [base, base + 12, base, base - 12];
    }
    this.revel.notes = notes;
    this.env[3].on();
    this.schedule(this.time + holdSamples * p.er_gate, () => this.env[3].off());
    this.lastRev = notes[0];
  }

  mixCh(id, l, r, stereo, panMod) {
    const p = this.p, b = this.bus;
    if (p[`ch${id}_mute`]) return;
    const g = p[`ch${id}_lvl`];
    const pan = clamp(p[`ch${id}_pan`] + panMod, -1, 1);
    let gl, gr;
    if (stereo) { gl = Math.min(1, 1 - pan); gr = Math.min(1, 1 + pan); }
    else { const a = (pan + 1) * Math.PI * 0.25; gl = Math.cos(a); gr = Math.sin(a); }
    const L = l * g * gl, R = r * g * gr;
    b.l += L; b.r += R;
    const mono = (l + r) * 0.5 * g;
    b.d += mono * p[`ch${id}_dly`]; b.v += mono * p[`ch${id}_rev`];
  }

  onMsg(m) {
    switch (m.t) {
      case 'params': Object.assign(this.p, m.values); break;
      case 'param': this.p[m.id] = m.v; break;
      case 'mask': this.mask = m.mask; break;
      case 'steps': this.steps = m.steps; break;
      case 'seed': this.seed = m.seed >>> 0; this.resetSeq(); break;
      case 'run':
        this.running = m.on;
        if (!m.on) { this.env.forEach((e) => e.off()); this.events = []; }
        break;
      case 'reset': this.resetSeq(); break;
    }
  }

  // nearest enabled note (mask relative to root)
  quantize(semi) {
    const root = (this.p.q_root + this.chordRoot) % 12;
    const n = Math.round(semi);
    let best = n, bd = 99;
    for (let d = -6; d <= 6; d++) {
      const c = n + d;
      const pc = (((c - root) % 12) + 12) % 12;
      if (this.mask[pc] && Math.abs(semi - c) < bd) { bd = Math.abs(semi - c); best = c; }
    }
    return best;
  }

  schedule(at, fn) { this.events.push({ at, fn }); }

  onClockTick(tickLen) {
    const p = this.p, rng = this.rng;
    const t = this.tick;
    // progression every q_bars bars (16 ticks per bar)
    if (t % 16 === 0) {
      this.bar++;
      if (this.bar % Math.max(1, p.q_bars) === 0 && rng() < p.q_prog) {
        const moves = [7, 5, 7, 5, 2, 10, 9, 3];
        this.chordRoot = (this.chordRoot + moves[Math.floor(rng() * moves.length)]) % 12;
      }
      if (p.er_trig === 0 && this.bar % Math.max(1, p.er_bars) === 0) this.triggerRevelator(p.er_bars * 16 * tickLen);
    }
    // --- Bernoulli sequencer (Branches + Marbles + shift register + Burst) ---
    const dA = DIVS[p.bA_div] || 2;
    if (t % dA === 0) {
      const len = Math.max(1, p.bA_len);
      this.posA = (this.posA + 1) % len;
      const cell = this.regA[this.posA];
      if (rng() >= p.bA_deja) {
        const spread = p.bA_spread;
        const u = spread < 0.5 ? (rng() + rng() + rng()) / 3 - 0.5 : rng() - 0.5;
        cell.v = clamp(p.bA_bias + u * spread * 2, 0, 1);
        cell.g = rng() < p.bA_prob;
        cell.burst = rng() < p.bA_ratchet ? (rng() < 0.6 ? 2 : 3) : 1;
      }
      if (cell.g) {
        const semis = cell.v * p.bA_range * 12;
        const note = this.quantize(semis - p.bA_range * 6) + 60 + p.tune;
        const stepLen = dA * tickLen;
        const n = cell.burst;
        for (let k = 0; k < n; k++) {
          const at = this.time + (k * stepLen) / n;
          this.schedule(at, () => { this.leadNote = note; this.env[0].on(); this.env[1].on(); });
          this.schedule(at + (stepLen / n) * p.bA_gate, () => { this.env[0].off(); this.env[1].off(); });
        }
        this.lastA = note;
      }
    }
    // --- Entropy sequencer (Entropia + SEQ3 + Euclid) ---
    const dB = DIVS[p.eB_div] || 4;
    if (t % dB === 0) {
      const len = Math.max(1, p.eB_len);
      this.posB = (this.posB + 1) % len;
      const fill = Math.min(p.eB_fill, len);
      const i = (this.posB + p.eB_rot) % len;
      const gate = Math.floor(((i + 1) * fill) / len) - Math.floor((i * fill) / len) > 0;
      if (gate) {
        const v = rng() < p.eB_entropy ? rng() : this.steps[this.posB];
        const note = this.quantize(v * p.eB_range * 12) + 48 + p.tune;
        const stepLen = dB * tickLen;
        this.schedule(this.time, () => {
          this.macNote = note;
          this.env[2].on();
          this.macro.trigger(Math.random, mtof(note + 12 * p.mac_oct), p.mac_timbre);
        });
        this.schedule(this.time + stepLen * p.eB_gate, () => this.env[2].off());
        this.lastB = note;
      }
    }
  }

  controlUpdate(n) {
    const p = this.p, sr = this.sr;
    const dtc = n / sr;
    // LFOs
    const rates = [p.lfo1_rate, p.lfo2_rate], shapes = [p.lfo1_shape, p.lfo2_shape];
    for (let i = 0; i < 2; i++) {
      const L = this.lfo[i];
      L.ph += rates[i] * dtc;
      if (L.ph >= 1) { L.ph -= Math.floor(L.ph); L.sh = this.rng() * 2 - 1; }
      const ph = L.ph;
      let v;
      switch (shapes[i]) {
        case 0: v = Math.sin(TAU * ph); break;
        case 1: v = 1 - 4 * Math.abs(ph - 0.5); break;
        case 2: v = 2 * ph - 1; break;
        case 3: v = ph < 0.5 ? 1 : -1; break;
        default: v = L.sh;
      }
      L.out += (v - L.out) * (shapes[i] >= 3 ? 0.35 : 1);
    }
    // Lorenz attractor
    const lz = this.lz;
    const steps = 4, h = (p.lz_rate * dtc * 2.2) / steps;
    for (let s = 0; s < steps; s++) {
      const dx = 10 * (lz.y - lz.x), dy = lz.x * (p.lz_rho - lz.z) - lz.y, dz = lz.x * lz.y - (8 / 3) * lz.z;
      lz.x += dx * h; lz.y += dy * h; lz.z += dz * h;
    }
    if (!isFinite(lz.x)) { lz.x = 0.1; lz.y = 0; lz.z = 20; }
    lz.ox = clamp(lz.x / 20, -1, 1); lz.oy = clamp(lz.y / 27, -1, 1); lz.oz = clamp((lz.z - 25) / 18, -1, 1);
    // random walk
    const wr = p.walk_rate;
    this.walk += ((this.rng() * 2 - 1) * wr * 0.08 - this.walk * 0.004);
    this.walk = clamp(this.walk, -1, 1);

    const l1 = this.lfo[0].out, l2 = this.lfo[1].out;
    const m = this.mod;
    m.cut = l1 * p.mod_lfo1_cut * 3 + lz.ox * p.mod_lz_cut * 3; // octaves
    m.pw = l1 * p.mod_lfo1_pw * 0.4;
    m.fm = (l1 * 0.5 + 0.5) * p.mod_lfo1_fm;
    m.wave = l2 * p.mod_lfo2_wave * 1.5;
    m.pan = l2 * p.mod_lfo2_pan;
    m.timbre = l2 * p.mod_lfo2_timbre * 0.5;
    m.morph = lz.oy * p.mod_lz_timbre * 0.5;
    m.drone = lz.oz * p.mod_lz_drone * 2; // octaves
    m.space = (lz.oz * 0.5 + 0.5) * p.mod_lz_space;
    m.pitch = this.walk * p.mod_walk_pitch * 0.5; // semitones

    // Cosmic Clock: sky time advances by the time warp; seeded epoch unless Live Sky
    if (p.cc_live && !this.liveSky) { this.days = (Date.now() - Date.UTC(2000, 0, 1, 12)) / 86400000; this.liveSky = true; }
    if (!p.cc_live && this.liveSky) { this.liveSky = false; this.days = ((Math.imul(this.seed, 7919) >>> 0) % 36525) - 18262; }
    if (this.running || p.cc_live) this.days += (p.cc_warp * dtc) / 86400;
    if ((this.skyCount++ & 7) === 0) {
      this.cosmic.updateSky(this.days);
      for (const ev of this.cosmic.events) {
        if ((p.er_trig === 1 && ev === 1) || (p.er_trig === 2 && ev === 0)) this.triggerRevelator((sr * 60 / p.tempo) * 4 * p.er_bars);
      }
      this.cosmic.events = [];
    }
    const cc = this.cosmic.tick(p.cc_rate, dtc);
    m.ccCut = cc * p.mod_cc_cut * 2;
    m.ccScan = cc * p.mod_cc_scan * 0.5;
    m.ccGrain = cc * p.mod_cc_grain * 0.3;
    m.ccVast = cc * p.mod_cc_vast * 0.6;

    if ((this.lzCount = (this.lzCount || 0) + 1) % 6 === 0) this.lzTrail.push(lz.ox, lz.oz);
  }

  process(inputs, outputs) {
    const out = outputs[0];
    const L = out[0], R = out[1] || out[0];
    const p = this.p, sr = this.sr;
    if (p.tempo === undefined) return true;
    const N = L.length;
    const tickLen = (sr * 60) / p.tempo / 4;

    for (let i = 0; i < N; i++) {
      // ---- clock ----
      if (this.running) {
        if (this.time >= this.nextTickAt) {
          this.onClockTick(tickLen);
          const swing = (this.tick % 2 === 0 ? 1 + p.swing : 1 - p.swing);
          this.nextTickAt = this.time + tickLen * swing;
          this.tick++;
        }
      }
      if (this.events.length) {
        for (let k = this.events.length - 1; k >= 0; k--) {
          if (this.events[k].at <= this.time) { const ev = this.events[k]; this.events.splice(k, 1); ev.fn(); }
        }
      }
      if ((this.ctrl++ & 31) === 0) this.controlUpdate(32);
      const m = this.mod;

      // ---- envelopes ----
      const e1 = this.env[0].tick(p.env1_a, p.env1_d, p.env1_s, p.env1_r, sr);
      const e2 = this.env[1].tick(p.env2_a, p.env2_d, p.env2_s, p.env2_r, sr);
      const e3 = this.env[2].tick(p.env3_a, p.env3_d, p.env3_s, p.env3_r, sr);
      const e4 = this.env[3].tick(p.env4_a, p.env4_d, p.env4_s, p.env4_r, sr);

      // ---- lead voice: Triple VCO → VCF → VCA ----
      const gl = p.glide;
      const gc = gl < 0.002 ? 1 : 1 - Math.exp(-1 / (gl * sr * 0.3));
      this.leadPitch += (this.leadNote - this.leadPitch) * gc;
      const basePitch = this.leadPitch + m.pitch;
      const pw = clamp(p.vco_pw + m.pw, 0.05, 0.95);
      const det = p.vco_detune / 100;
      const f1 = mtof(basePitch + 12 * p.vco1_oct + p.vco1_fine);
      const o1 = this.osc[0].tick(f1, sr, p.vco1_wave + m.wave, pw);
      const fmIdx = (p.vco_fm + m.fm) * f1 * 3 * o1;
      const f2 = mtof(basePitch + 12 * p.vco2_oct + p.vco2_fine + det);
      const f3 = mtof(basePitch + 12 * p.vco3_oct + p.vco3_fine - det);
      if (p.vco_sync && this.osc[0].wrapped) { this.osc[1].ph = 0; this.osc[2].ph = 0; }
      const o2 = this.osc[1].tick(f2, sr, p.vco2_wave + m.wave * 0.7, pw, fmIdx);
      const o3 = this.osc[2].tick(f3, sr, p.vco3_wave - m.wave * 0.5, pw, fmIdx * 0.7);
      let vmix = (o1 * p.vco1_lvl + o2 * p.vco2_lvl + o3 * p.vco3_lvl) * 0.5;
      const fold = clamp(p.vco_fold + e2 * p.mod_env2_fold, 0, 1);
      if (fold > 0.001) vmix = vmix * (1 - fold) + Math.sin(vmix * (1 + fold * 6) * Math.PI * 0.5) * fold;
      // coloured noise
      const wn = Math.random() * 2 - 1;
      this.pink[0] = 0.997 * this.pink[0] + 0.029591 * wn;
      this.pink[1] = 0.985 * this.pink[1] + 0.032534 * wn;
      this.pink[2] = 0.95 * this.pink[2] + 0.048056 * wn;
      const pink = (this.pink[0] + this.pink[1] + this.pink[2]) * 3.5;
      this.brown = clamp(this.brown + wn * 0.02, -1, 1) * 0.998;
      const c = p.noise_color;
      const noise = c < 0.5 ? wn * (1 - c * 2) + pink * c * 2 : pink * (2 - c * 2) + this.brown * 3 * (c * 2 - 1);
      vmix += noise * p.noise_lvl;
      const keyOct = ((basePitch - 60) / 12) * p.vcf_key;
      const cut = p.vcf_cut * Math.pow(2, keyOct + m.cut + m.ccCut + e2 * p.vcf_env * 6);
      const filt = this.vcf.tick(vmix, cut, p.vcf_res, p.vcf_drive, p.vcf_mode, sr);
      const lead = filt * e1;

      // ---- macro voice → LPG ----
      const mf = mtof(this.macNote + 12 * p.mac_oct + m.pitch * 0.5);
      const mo = this.macro.tick(mf, p.mac_model, p.mac_harm, clamp(p.mac_timbre + m.timbre, 0, 1), clamp(p.mac_morph + m.morph, 0, 1));
      const lpgCut = 40 + Math.pow(e3, 1.6) * (300 + 15000 * p.lpg_color);
      const lpgGain = p.lpg_color > 0.5 ? Math.pow(e3, 0.6) : e3;
      const macro = this.lpg.tick(mo, lpgCut, p.lpg_res * 0.9, sr) * lpgGain;

      // ---- drone (cloud on chord root) ----
      const droot = 36 + 12 * (p.dr_oct + 1) + ((p.q_root + this.chordRoot) % 12) + p.tune + m.pitch;
      if (this.droneP === undefined) this.droneP = droot;
      this.droneP += (droot - this.droneP) * 0.00003;
      const sp = p.dr_spread * 0.25;
      let dr = this.drone[0].tick(mtof(this.droneP - sp), sr, 1.6, 0.5)
        + this.drone[1].tick(mtof(this.droneP + sp), sr, 1.6, 0.5)
        + this.drone[2].tick(mtof(this.droneP + 12 + sp * 0.5), sr, 1.2, 0.5) * 0.5;
      dr += this.drone[3].tick(mtof(this.droneP + 7), sr, 0.6, 0.5) * p.dr_fifth;
      const drone = this.droneF.tick(dr * 0.35, p.dr_tone * Math.pow(2, m.drone), 0.3, sr);

      // ---- mixer (MixMaster style) ----
      // ---- Elemental Revelator (chord voice) ----
      const [revL, revR] = this.revel.tick(p, p.er_scan + m.ccScan, e4);

      // ---- mixer (MixMaster style) ----
      const bus = this.bus;
      bus.l = 0; bus.r = 0; bus.d = 0; bus.v = 0;
      this.mixCh(1, lead, lead, false, m.pan);
      this.mixCh(2, macro, macro, false, 0);
      this.mixCh(3, drone, drone, false, 0);
      this.mixCh(5, revL, revR, true, 0);
      // ---- Litany Engine: loops the mix above and plays it back as grains or tape ----
      const [ltL, ltR] = this.litany.tick((bus.l + bus.r) * 0.5, p, m.ccGrain);
      this.mixCh(4, ltL, ltR, true, 0);
      let sl = bus.l, sr2 = bus.r;
      const dsend = bus.d, rsend = bus.v;

      // ---- chorus (insert on mix bus) ----
      this.choPh += p.cho_rate / sr; if (this.choPh >= 1) this.choPh -= 1;
      const depth = p.cho_depth * 0.006 * sr;
      const base = 0.012 * sr;
      this.choL.write(sl); this.choR.write(sr2);
      const cl = this.choL.read(base + depth * (0.5 + 0.5 * Math.sin(TAU * this.choPh)));
      const cr = this.choR.read(base + depth * (0.5 + 0.5 * Math.cos(TAU * this.choPh)));
      sl = sl * (1 - p.cho_mix * 0.5) + cl * p.cho_mix;
      sr2 = sr2 * (1 - p.cho_mix * 0.5) + cr * p.cho_mix;

      // ---- delay (send) ----
      const syncDiv = DELAY_SYNC[p.dl_sync] || 0;
      const target = syncDiv ? (syncDiv * tickLen) / sr : p.dl_time;
      this.dlTime += (target - this.dlTime) * 0.00008;
      const dtS = this.dlTime * sr;
      const yl = this.dlL.read(dtS), yr = this.dlR.read(dtS * 1.013);
      const fb = clamp(p.dl_fb + m.space * 0.3, 0, 0.98);
      const tone = p.dl_tone;
      const tc = tone < 0 ? 0.05 + (1 + tone) * 0.9 : 0.3;
      this.dlToneL += tc * (yl - this.dlToneL); this.dlToneR += tc * (yr - this.dlToneR);
      const fl = tone < 0 ? this.dlToneL : yl - this.dlToneL * tone;
      const fr = tone < 0 ? this.dlToneR : yr - this.dlToneR * tone;
      this.dlL.write(Math.tanh(dsend + fr * fb * 0.4 + fl * fb * 0.6));
      this.dlR.write(Math.tanh(dsend + fl * fb * 0.4 + fr * fb * 0.6));
      const dOutL = yl * p.dl_ret, dOutR = yr * p.dl_ret;

      // ---- plate reverb (send) ----
      const rin = rsend + (yl + yr) * 0.5 * p.dl_rev;
      const [rl, rr] = this.plate.tick(rin, clamp(p.rv_size + m.space * 0.6, 0.3, 2.2), p.rv_decay, p.rv_damp, p.rv_pre, p.rv_mod, sr);

      // ---- Liminal Vast FDN (fed from the reverb send) ----
      const [vl, vr] = this.vast.tick(rin * p.lv_send, rin * p.lv_send, clamp(p.lv_size + m.ccVast, 0.25, 3), p.lv_decay, p.lv_damp, p.lv_mod, p.lv_freeze);

      // ---- master ----
      let ml = sl + dOutL + rl * p.rv_ret + vl * p.lv_ret;
      let mr = sr2 + dOutR + rr * p.rv_ret + vr * p.lv_ret;
      // ---- Moon Phase Distortion (master insert) ----
      if (p.mp_mix > 0.001) [ml, mr] = this.moonDist.tick(ml, mr, p, this.cosmic.moonPhase, sr);
      const mid = (ml + mr) * 0.5, side = (ml - mr) * 0.5 * p.m_width;
      ml = mid + side; mr = mid - side;
      const dg = 1 + p.m_drive * 4;
      ml = Math.tanh(ml * dg) / Math.tanh(dg) * 0.9;
      mr = Math.tanh(mr * dg) / Math.tanh(dg) * 0.9;
      const vol = p.m_vol * p.m_vol;
      L[i] = ml * vol; R[i] = mr * vol;

      this.scope[this.scopeW] = (ml + mr) * 0.5;
      this.scopeW = (this.scopeW + 1) & 2047;
      this.time++;
    }

    // ---- UI telemetry (~30 Hz) ----
    this.uiCounter += N;
    if (this.uiCounter >= sr / 30) {
      this.uiCounter = 0;
      // find a rising zero crossing for a stable scope trace
      const s = new Float32Array(512);
      let start = (this.scopeW - 1024 + 2048) & 2047;
      for (let k = 0; k < 400; k++) {
        const a = this.scope[(start + k) & 2047], b = this.scope[(start + k + 1) & 2047];
        if (a <= 0 && b > 0) { start = (start + k) & 2047; break; }
      }
      for (let k = 0; k < 512; k++) s[k] = this.scope[(start + k) & 2047];
      this.port.postMessage({
        t: 'ui', scope: s, lz: this.lzTrail.splice(0),
        env: [this.env[0].v, this.env[1].v, this.env[2].v, this.env[3].v],
        cc: { lon: this.cosmic.lon, asp: this.cosmic.aspects, moon: this.cosmic.moonPhase, out: this.cosmic.out, days: this.days },
        lt: { head: this.litany.head / (this.litany.L || 1), w: this.litany.w / (this.litany.L || 1), ov: (this.uiFrames++ % 10 === 0) ? this.litany.overview() : null },
        lastRev: this.lastRev ?? null,
        posA: this.posA, posB: this.posB, tick: this.tick,
        regA: this.regA.map((c) => [c.v, c.g ? c.burst : 0]),
        lastA: this.lastA, lastB: this.lastB,
        root: (this.p.q_root + this.chordRoot) % 12,
        lfo: [this.lfo[0].out, this.lfo[1].out],
      });
    }
    return true;
  }
}

registerProcessor('genx-engine', GenXEngine);
