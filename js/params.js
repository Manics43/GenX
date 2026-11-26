// Parameter registry. Every control in the UI maps to one id here, and the
// worklet receives the same ids. curve: 'lin' | 'exp' | 'int'.

export const PARAMS = {};
const P = (id, label, min, max, def, o = {}) => {
  PARAMS[id] = { id, label, min, max, def, curve: o.curve || 'lin', unit: o.unit || '', names: o.names || null, fmt: o.fmt || null };
};

export const WAVE_NAMES = ['SIN', 'TRI', 'SAW', 'SQR'];
export const LFO_SHAPES = ['SIN', 'TRI', 'SAW', 'SQR', 'S&H'];
export const MACRO_MODELS = ['VA', 'FM', 'ADD', 'PLUCK'];
export const VCF_MODES = ['LP24', 'LP12', 'BP', 'HP'];
export const DIVS = [1, 2, 3, 4, 6, 8];
export const DIV_NAMES = ['1/16', '1/8', '3/16', '1/4', '3/8', '1/2'];
export const DELAY_SYNC = ['FREE', '1/16', '1/8', '3/16', '1/4', '3/8', '1/2'];
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const SCALES = [
  ['Major', [0, 2, 4, 5, 7, 9, 11]],
  ['Minor', [0, 2, 3, 5, 7, 8, 10]],
  ['Dorian', [0, 2, 3, 5, 7, 9, 10]],
  ['Phrygian', [0, 1, 3, 5, 7, 8, 10]],
  ['Lydian', [0, 2, 4, 6, 7, 9, 11]],
  ['Mixolydian', [0, 2, 4, 5, 7, 9, 10]],
  ['Pent Major', [0, 2, 4, 7, 9]],
  ['Pent Minor', [0, 3, 5, 7, 10]],
  ['Hirajoshi', [0, 2, 3, 7, 8]],
  ['In Sen', [0, 1, 5, 7, 10]],
  ['Whole Tone', [0, 2, 4, 6, 8, 10]],
  ['Harm Minor', [0, 2, 3, 5, 7, 8, 11]],
  ['Custom 1', null],
  ['Custom 2', null],
];
export const scaleMask = (idx, customs) => {
  const s = SCALES[idx];
  if (!s) return new Array(12).fill(1);
  if (s[1] === null) return customs[idx - (SCALES.length - 2)].slice();
  const m = new Array(12).fill(0);
  s[1].forEach((n) => (m[n] = 1));
  return m;
};

// Clock
P('tempo', 'Tempo', 30, 200, 76, { unit: 'bpm', fmt: (v) => v.toFixed(0) });
P('swing', 'Swing', 0, 0.5, 0.08);
P('tune', 'Tune', -12, 12, 0, { curve: 'int', unit: 'st' });

// Triple VCO
for (let i = 1; i <= 3; i++) {
  P(`vco${i}_oct`, 'Range', -3, 2, [-1, 0, -1][i - 1], { curve: 'int', unit: 'oct' });
  P(`vco${i}_fine`, 'Fine', -7, 7, [0, 0.07, 7][i - 1], { unit: 'st' });
  P(`vco${i}_wave`, 'Waveform', 0, 3, [2, 1.4, 0.4][i - 1], { names: WAVE_NAMES });
  P(`vco${i}_lvl`, 'Level', 0, 1, [0.8, 0.55, 0.4][i - 1]);
}
P('vco_fm', 'FM 1>2/3', 0, 1, 0.08);
P('vco_sync', 'Sync', 0, 1, 0, { curve: 'int' });
P('vco_pw', 'Shape', 0.05, 0.95, 0.5);
P('vco_detune', 'Detune', 0, 40, 8, { unit: 'ct' });
P('vco_fold', 'Fold', 0, 1, 0.1);
P('glide', 'Glide', 0, 1, 0.12, { unit: 's' });

// VCF + noise
P('vcf_cut', 'Cutoff', 30, 16000, 900, { curve: 'exp', unit: 'Hz' });
P('vcf_res', 'Resonance', 0, 1, 0.35);
P('vcf_drive', 'Drive', 0, 1, 0.25);
P('vcf_env', 'Env Amt', -1, 1, 0.45);
P('vcf_key', 'Key Track', 0, 1, 0.5);
P('vcf_mode', 'Mode', 0, 3, 0, { curve: 'int', names: VCF_MODES });
P('noise_lvl', 'Noise', 0, 1, 0.04);
P('noise_color', 'Color', 0, 1, 0.5);

// Macro VCO + LPG
P('mac_model', 'Model', 0, 3, 3, { curve: 'int', names: MACRO_MODELS });
P('mac_oct', 'Range', -3, 1, -1, { curve: 'int', unit: 'oct' });
P('mac_harm', 'Harmonics', 0, 1, 0.45);
P('mac_timbre', 'Timbre', 0, 1, 0.5);
P('mac_morph', 'Morph', 0, 1, 0.55);
P('lpg_color', 'LPG Color', 0, 1, 0.6);
P('lpg_res', 'LPG Res', 0, 1, 0.2);

// Envelopes
const ENV_DEF = { 1: [0.01, 0.4, 0.5, 1.2], 2: [0.02, 0.6, 0.25, 1.5], 3: [0.002, 0.5, 0.0, 0.8], 4: [2.5, 3, 0.7, 5] };
for (let i = 1; i <= 4; i++) {
  const d = ENV_DEF[i];
  P(`env${i}_a`, 'Attack', 0.001, 8, d[0], { curve: 'exp', unit: 's' });
  P(`env${i}_d`, 'Decay', 0.005, 8, d[1], { curve: 'exp', unit: 's' });
  P(`env${i}_s`, 'Sustain', 0, 1, d[2]);
  P(`env${i}_r`, 'Release', 0.005, 12, d[3], { curve: 'exp', unit: 's' });
}

// LFOs
P('lfo1_rate', 'Rate', 0.01, 20, 0.18, { curve: 'exp', unit: 'Hz' });
P('lfo1_shape', 'Shape', 0, 4, 0, { curve: 'int', names: LFO_SHAPES });
P('lfo2_rate', 'Rate', 0.01, 20, 0.07, { curve: 'exp', unit: 'Hz' });
P('lfo2_shape', 'Shape', 0, 4, 1, { curve: 'int', names: LFO_SHAPES });

// Lorenz + random walk
P('lz_rate', 'Speed', 0.02, 4, 0.35, { curve: 'exp' });
P('lz_rho', 'Chaos (rho)', 14, 40, 28);
P('walk_rate', 'Walk Rate', 0, 1, 0.3);

// Fixed modulation routings (Modifications tab)
export const MODS = [
  ['mod_lfo1_cut', 'LFO 1', 'VCF cutoff', 0.25],
  ['mod_lfo1_pw', 'LFO 1', 'VCO shape (PW)', 0.2],
  ['mod_lfo1_fm', 'LFO 1', 'VCO FM depth', 0.0],
  ['mod_lfo2_wave', 'LFO 2', 'VCO waveform', 0.25],
  ['mod_lfo2_pan', 'LFO 2', 'Lead pan', 0.3],
  ['mod_lfo2_timbre', 'LFO 2', 'Macro timbre', 0.2],
  ['mod_lz_cut', 'Lorenz X', 'VCF cutoff', 0.2],
  ['mod_lz_timbre', 'Lorenz Y', 'Macro morph', 0.25],
  ['mod_lz_drone', 'Lorenz Z', 'Drone tone', 0.4],
  ['mod_lz_space', 'Lorenz Z', 'Reverb size + delay feedback', 0.15],
  ['mod_walk_pitch', 'Walk', 'Lead + drone pitch drift', 0.15],
  ['mod_env2_fold', 'ENV 2', 'VCO fold', 0.1],
  ['mod_cc_cut', 'Cosmic Clock', 'VCF cutoff', 0.15],
  ['mod_cc_scan', 'Cosmic Clock', 'Revelator scan', 0.5],
  ['mod_cc_grain', 'Cosmic Clock', 'Litany scan', 0.3],
  ['mod_cc_vast', 'Cosmic Clock', 'Vast size', 0.1],
];
MODS.forEach(([id, src, dst, def]) => P(id, `${src} > ${dst}`, 0, 1, def));

// Bernoulli sequencer (lead)
P('bA_div', 'Clock Div', 0, 5, 1, { curve: 'int', names: DIV_NAMES });
P('bA_prob', 'Probability', 0, 1, 0.55);
P('bA_deja', 'Deja Vu', 0, 1, 0.7);
P('bA_len', 'Loop Len', 1, 16, 8, { curve: 'int' });
P('bA_spread', 'Spread', 0, 1, 0.5);
P('bA_bias', 'Bias', 0, 1, 0.5);
P('bA_range', 'Range', 0.25, 3, 1.5, { unit: 'oct' });
P('bA_ratchet', 'Burst', 0, 1, 0.08);
P('bA_gate', 'Gate Len', 0.05, 1, 0.6);

// Entropy sequencer (macro voice)
P('eB_div', 'Clock Div', 0, 5, 3, { curve: 'int', names: DIV_NAMES });
P('eB_len', 'Length', 1, 16, 16, { curve: 'int' });
P('eB_entropy', 'Entropy', 0, 1, 0.2);
P('eB_fill', 'Fill', 1, 16, 5, { curve: 'int' });
P('eB_rot', 'Rotate', 0, 15, 0, { curve: 'int' });
P('eB_range', 'Range', 0.25, 3, 1, { unit: 'oct' });
P('eB_gate', 'Gate Len', 0.05, 1, 0.4);

// Quantizer / progression
P('q_root', 'Root', 0, 11, 9, { curve: 'int', names: NOTE_NAMES });
P('q_scale', 'Scale', 0, SCALES.length - 1, 7, { curve: 'int', names: SCALES.map((s) => s[0]) });
P('q_prog', 'Progress', 0, 1, 0.35);
P('q_bars', 'Bars', 1, 16, 4, { curve: 'int' });

// Drone
P('dr_oct', 'Range', -3, 0, -2, { curve: 'int', unit: 'oct' });
P('dr_tone', 'Tone', 60, 6000, 700, { curve: 'exp', unit: 'Hz' });
P('dr_spread', 'Spread', 0, 1, 0.35);
P('dr_fifth', 'Fifth', 0, 1, 0.5);

// ---- Eternal Eclipse family ----
export const ER_TRIG = ['BARS', 'MOON', 'SUN'];
P('cc_rate', 'Rate', 0.005, 4, 0.12, { curve: 'exp', unit: 'Hz' });
P('cc_warp', 'Time Warp', 1, 100000000, 100000, { curve: 'exp', fmt: (v) => 'x' + (v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(1) + 'k' : v.toFixed(0)) });
P('cc_live', 'Live Sky', 0, 1, 0, { curve: 'int' });
P('lv_size', 'Size', 0.25, 3, 1.6);
P('lv_decay', 'Decay', 0.3, 60, 9, { curve: 'exp', unit: 's' });
P('lv_damp', 'Damping', 0, 1, 0.4);
P('lv_mod', 'Modulation', 0, 1, 0.5);
P('lv_send', 'Send', 0, 1, 0.5);
P('lv_ret', 'Return', 0, 1, 0.45);
P('lv_freeze', 'Freeze', 0, 1, 0, { curve: 'int' });
P('lt_len', 'Loop', 1, 8, 4, { unit: 's' });
P('lt_in', 'Record', 0, 1, 0.8);
P('lt_hold', 'Hold', 0, 1, 0, { curve: 'int' });
P('lt_speed', 'Varispeed', -2, 2, 0.5);
P('lt_pitch', 'Pitch', -24, 24, 0, { curve: 'int', unit: 'st' });
P('lt_size', 'Grain Size', 0, 1, 0.45);
P('lt_dens', 'Overlap', 1, 8, 3);
P('lt_scan', 'Scan', 0, 1, 0.3);
P('lt_spray', 'Spray', 0, 1, 0.15);
P('lt_spread', 'Spread', 0, 1, 0.6);
P('mp_depth', 'Depth', 0, 1, 0.3);
P('mp_mix', 'Mix', 0, 1, 0.3);
P('mp_tone', 'Tone', 400, 18000, 9000, { curve: 'exp', unit: 'Hz' });
P('mp_manual', 'Manual', 0, 1, 0, { curve: 'int' });
P('mp_phase', 'Phase', 0, 1, 0.5);
P('er_scan', 'Scan', 0, 1, 0.3);
P('er_fm', 'Ring FM', 0, 1, 0.15);
P('er_ring', 'Ring Mod', 0, 1, 0.2);
P('er_fold', 'Fold', 0, 1, 0.1);
P('er_cut', 'Cutoff', 60, 12000, 1400, { curve: 'exp', unit: 'Hz' });
P('er_res', 'Res', 0, 1, 0.25);
P('er_oct', 'Range', -2, 1, 0, { curve: 'int', unit: 'oct' });
P('er_detune', 'Detune', 0, 1, 0.3);
P('er_spirit', 'Spirit', 0, 1, 1, { curve: 'int' });
P('er_trig', 'Trigger', 0, 2, 0, { curve: 'int', names: ER_TRIG });
P('er_bars', 'Bars', 1, 8, 2, { curve: 'int' });
P('er_gate', 'Hold', 0.1, 1, 0.6);

// Mixer (5 channels: lead, macro, drone, litany, revelator)
const MIX_DEF = { 1: [0.7, -0.15, 0.35, 0.45], 2: [0.6, 0.2, 0.2, 0.35], 3: [0.35, 0, 0.0, 0.6], 4: [0.35, 0, 0.15, 0.4], 5: [0.4, 0, 0.1, 0.5] };
for (let i = 1; i <= 5; i++) {
  const d = MIX_DEF[i];
  P(`ch${i}_lvl`, 'Level', 0, 1, d[0]);
  P(`ch${i}_pan`, 'Pan', -1, 1, d[1]);
  P(`ch${i}_dly`, 'Delay', 0, 1, d[2]);
  P(`ch${i}_rev`, 'Reverb', 0, 1, d[3]);
  P(`ch${i}_mute`, 'Mute', 0, 1, 0, { curve: 'int' });
}

// Chorus
P('cho_rate', 'Rate', 0.05, 5, 0.4, { curve: 'exp', unit: 'Hz' });
P('cho_depth', 'Depth', 0, 1, 0.5);
P('cho_mix', 'Mix', 0, 1, 0.3);

// Delay
P('dl_time', 'Time', 0.02, 2, 0.42, { curve: 'exp', unit: 's' });
P('dl_sync', 'Sync', 0, 6, 5, { curve: 'int', names: DELAY_SYNC });
P('dl_fb', 'Feedback', 0, 0.98, 0.55);
P('dl_tone', 'Tone', -1, 1, -0.2);
P('dl_ret', 'Return', 0, 1, 0.6);
P('dl_rev', 'To Reverb', 0, 1, 0.35);

// Reverb (plate)
P('rv_size', 'Size', 0.3, 2, 1.2);
P('rv_decay', 'Decay', 0, 0.99, 0.82);
P('rv_damp', 'Damping', 0, 1, 0.35);
P('rv_pre', 'Pre-Delay', 0, 0.25, 0.02, { unit: 's' });
P('rv_mod', 'Modulation', 0, 1, 0.5);
P('rv_ret', 'Return', 0, 1, 0.7);

// Master
P('m_vol', 'Volume', 0, 1, 0.7);
P('m_drive', 'Drive', 0, 1, 0.15);
P('m_width', 'Width', 0, 2, 1.1);

// ---- helpers -------------------------------------------------------------
export const toNorm = (p, v) => {
  if (p.curve === 'exp') return Math.log(v / p.min) / Math.log(p.max / p.min);
  return (v - p.min) / (p.max - p.min);
};
export const fromNorm = (p, n) => {
  n = Math.min(1, Math.max(0, n));
  if (p.curve === 'exp') return p.min * Math.pow(p.max / p.min, n);
  const v = p.min + n * (p.max - p.min);
  return p.curve === 'int' ? Math.round(v) : v;
};
export const fmtValue = (p, v) => {
  if (p.names) return p.names[Math.round(v)] ?? '';
  if (p.fmt) return p.fmt(v);
  if (p.unit === 'Hz') return v >= 1000 ? (v / 1000).toFixed(2) + 'k' : v.toFixed(v < 10 ? 2 : 0);
  if (p.unit === 's') return v < 1 ? (v * 1000).toFixed(0) + 'ms' : v.toFixed(2) + 's';
  if (p.curve === 'int') return String(Math.round(v)) + (p.unit ? ' ' + p.unit : '');
  return v.toFixed(2) + (p.unit ? ' ' + p.unit : '');
};
export const defaults = () => Object.fromEntries(Object.values(PARAMS).map((p) => [p.id, p.def]));

// ---- seeded RNG shared by UI and worklet ---------------------------------
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const stepsFromSeed = (seed) => {
  const r = mulberry32(seed ^ 0x5eed);
  return Array.from({ length: 16 }, () => Math.round(r() * 100) / 100);
};

// ---- built-in presets ----------------------------------------------------
export const PRESETS = [
  { name: 'Deterministic Ambient', seed: 1360, values: {} },
  {
    name: 'Bernoulli Rain', seed: 2718,
    values: { tempo: 96, bA_div: 0, bA_prob: 0.35, bA_deja: 0.85, bA_ratchet: 0.2, mac_model: 3, eB_div: 1, eB_fill: 7, eB_entropy: 0.35, q_scale: 6, q_root: 2, vcf_cut: 1800, vcf_res: 0.2, env1_a: 0.003, env1_d: 0.25, env1_s: 0.1, env1_r: 0.6, dl_sync: 3, dl_fb: 0.6, rv_decay: 0.9, ch3_lvl: 0.2 },
  },
  {
    name: 'Lorenz Drift', seed: 1228,
    values: { tempo: 54, bA_prob: 0.3, bA_div: 3, eB_div: 5, lz_rate: 0.8, lz_rho: 34, mod_lz_cut: 0.5, mod_lz_timbre: 0.6, mod_lz_drone: 0.7, mod_lz_space: 0.35, mac_model: 2, env1_a: 1.5, env1_r: 4, env2_a: 2, env3_a: 0.4, env3_s: 0.4, env3_r: 3, ch3_lvl: 0.55, rv_size: 1.8, rv_decay: 0.94, q_scale: 4, q_root: 4 },
  },
  {
    name: 'Entropy Bass', seed: 4096,
    values: { tempo: 112, eB_div: 0, eB_fill: 9, eB_entropy: 0.45, eB_range: 1.5, mac_model: 1, mac_oct: -2, mac_harm: 0.3, mac_timbre: 0.55, env3_d: 0.18, lpg_color: 0.9, ch2_lvl: 0.8, ch2_rev: 0.1, bA_prob: 0.25, q_scale: 3, q_root: 4, vcf_mode: 1, swing: 0.18 },
  },
  {
    name: 'Eclipse Litany', seed: 1999,
    values: { tempo: 60, cc_warp: 2000000, cc_rate: 0.3, er_trig: 1, er_bars: 1, er_scan: 0.6, er_ring: 0.35, ch5_lvl: 0.5, lt_size: 0.3, lt_dens: 5, lt_speed: -0.5, lt_pitch: 12, lt_spray: 0.4, ch4_lvl: 0.5, lv_decay: 25, lv_send: 0.8, lv_ret: 0.6, mp_depth: 0.55, mp_mix: 0.5, bA_prob: 0.3, q_scale: 8, q_root: 1, rv_ret: 0.4 },
  },
  {
    name: 'Glass Choir', seed: 777,
    values: { tempo: 64, vco1_wave: 0, vco2_wave: 0.6, vco3_wave: 1, vco_fm: 0.25, vco_fold: 0.3, env1_a: 0.6, env1_s: 0.8, env1_r: 3, mac_model: 2, mac_harm: 0.8, cho_mix: 0.6, cho_depth: 0.8, rv_decay: 0.95, rv_size: 1.9, q_scale: 0, q_root: 7, ch3_lvl: 0.45 },
  },
];
