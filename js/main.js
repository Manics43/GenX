import {
  PARAMS, MODS, PRESETS, SCALES, NOTE_NAMES, defaults, scaleMask, stepsFromSeed, fmtValue,
} from './params.js';
import { CREDITS } from './credits.js';
import {
  el, knob, fader, toggle, button, lcd, canvas, module, row, drawWave,
  setChangeHandler, setReadout, refreshAll, refreshParam,
} from './ui.js';

// ------------------------------------------------------------------ state
const state = {
  values: defaults(),
  seed: 1360,
  steps: stepsFromSeed(1360),
  customs: [[1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0], [1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0]],
  preset: 0,
  name: PRESETS[0].name,
  running: false,
};
let ctx = null, node = null;
const send = (m) => node && node.port.postMessage(m);
const mask = () => scaleMask(state.values.q_scale, state.customs);

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};

// ------------------------------------------------------------------ dynamic views
const views = { waves: [], bern: null, ent: null, keys: [], rootLcd: null, noteLcd: null, scope: [], lorenz: [], leds: [], scaleLcd: null, meters: null };

function setParam(id, v, fromUI = true) {
  state.values[id] = v;
  if (!fromUI) refreshParam(id, v);
  send({ t: 'param', id, v });
  if (id.startsWith('vco') && (id.endsWith('_wave') || id === 'vco_pw')) drawWaves();
  if (id === 'q_scale') { send({ t: 'mask', mask: mask() }); drawKeys(); }
  if (id === 'q_root') { views.lastRoot = undefined; drawKeys(); }
  if (id === 'eB_len' || id === 'eB_fill' || id === 'eB_rot') drawEntropy();
  if (id === 'tempo') document.querySelectorAll('.tempo-lcd').forEach((n) => (n.textContent = Math.round(v)));
}
setChangeHandler((id, v) => setParam(id, v));

function drawWaves() {
  views.waves.forEach(([c, i]) => drawWave(c, state.values[`vco${i}_wave`], state.values.vco_pw));
}

// ------------------------------------------------------------------ top bar
function topBar() {
  const bar = el('header', 'topbar');
  const play = button('<span class="pi">&#9654;</span>', 'big play', togglePlay);
  play.setAttribute('aria-label', 'Play / stop');
  views.play = play;
  const transport = row('tb-group',
    labelled(play, 'Play'),
    labelled(button('&#8635;', 'big', reseed), 'Reseed'),
    labelled(button('&#9881;', 'big', mutate), 'Mutate'),
    labelled(button('&#9776;', 'big', () => showTab('patches')), 'Preset'),
  );
  const presetBox = el('div', 'preset-box');
  const prev = button('&lsaquo;', 'nav', () => loadPreset((state.preset - 1 + PRESETS.length) % PRESETS.length));
  const next = button('&rsaquo;', 'nav', () => loadPreset((state.preset + 1) % PRESETS.length));
  views.presetName = el('div', 'pname', state.name);
  views.presetSub = el('div', 'psub', 'DETERMINISTIC AMBIENT ENGINE');
  const mid = el('div', 'pmid'); mid.append(views.presetName, views.presetSub);
  presetBox.append(prev, mid, next);
  const nums = el('div', 'numbox');
  views.seedLcd = el('input', 'num seed-in');
  views.seedLcd.value = String(state.seed);
  views.seedLcd.inputMode = 'numeric';
  views.seedLcd.setAttribute('aria-label', 'Seed');
  views.seedLcd.title = 'Seed: type a number and press Enter';
  views.seedLcd.addEventListener('change', () => {
    const s = views.seedLcd.value.trim();
    if (/^\d{1,9}$/.test(s)) setSeed(parseInt(s, 10)); else views.seedLcd.value = String(state.seed);
  });
  const tempo = el('div', 'num tempo-lcd', String(state.values.tempo));
  nums.append(row('numrow', el('span', 'nl', 'SEED'), views.seedLcd), row('numrow', el('span', 'nl', 'BPM'), tempo));
  const scaleBox = el('div', 'scalebox');
  views.scaleLcd = el('div', 'sl1', '');
  views.rootLcd = el('div', 'sl2', '');
  scaleBox.append(el('div', 'sl0', 'SCALE / ROOT'), views.scaleLcd, views.rootLcd);
  const knobs = row('tb-knobs', knob('tempo', { size: 's' }), knob('swing', { size: 's' }), knob('tune', { size: 's' }), knob('m_width', { size: 's' }), knob('m_vol', { size: 's', label: 'Volume' }));
  views.readout = el('div', 'readout');
  setReadout(views.readout);
  bar.append(transport, presetBox, nums, scaleBox, knobs, views.readout);
  return bar;
}
const labelled = (node, text) => { const w = el('div', 'lbl'); w.append(node, el('span', '', text)); return w; };

// ------------------------------------------------------------------ main rack
function tripleVco() {
  const body = el('div', 'vco-body');
  const grid = el('div', 'vco-grid');
  for (let i = 1; i <= 3; i++) {
    const c = canvas(64, 34, 'wavecv');
    views.waves.push([c, i]);
    const lcdWrap = el('div', 'wavelcd'); lcdWrap.append(c);
    grid.append(
      knob(`vco${i}_oct`, { size: 'm' }),
      el('div', 'bignum', String(i)),
      lcdWrap,
      knob(`vco${i}_wave`, { size: 'm' }),
      knob(`vco${i}_fine`, { size: 's' }),
      knob(`vco${i}_lvl`, { size: 's' }),
    );
  }
  const side = el('div', 'vco-side');
  side.append(knob('vco_fm', { size: 'm' }), knob('vco_pw', { size: 'm' }), knob('vco_detune', { size: 's' }), knob('vco_fold', { size: 's' }), toggle('vco_sync', { label: 'Sync 2/3' }), knob('glide', { size: 's' }));
  body.append(grid, side);
  return module('TRIPLE VCO', 'dark', body, { grow: 5.2 });
}

function vcf() {
  const b = el('div', 'grid g3');
  b.append(knob('vcf_cut', { size: 'l' }), knob('vcf_res'), knob('vcf_mode'),
    knob('vcf_env'), knob('vcf_drive'), knob('vcf_key', { size: 's' }),
    knob('noise_lvl', { size: 's' }), knob('noise_color', { size: 's' }), el('div', ''));
  return module('VCF &middot; LADDER', 'dark', b, { grow: 2.6 });
}

function macroVco() {
  const b = el('div', 'grid g4');
  b.append(knob('mac_model'), knob('mac_oct'), knob('mac_harm'), knob('mac_timbre'),
    knob('mac_morph'), knob('lpg_color'), knob('lpg_res', { size: 's' }), el('div', 'note-wrap'));
  views.noteLcdB = lcd('--', 'notelcd');
  b.lastChild.append(el('div', 'klabel', 'Note'), views.noteLcdB);
  return module('MACRO VCO &middot; LPG', 'dark', b, { grow: 3.4 });
}

function envKnobs(i) {
  const r = el('div', 'env-row');
  const led = el('span', 'led big'); views.leds[i - 1] = led;
  r.append(led, knob(`env${i}_a`, { size: 's' }), knob(`env${i}_d`, { size: 's' }), knob(`env${i}_s`, { size: 's' }), knob(`env${i}_r`, { size: 's' }));
  return r;
}
function envStack() {
  const b = el('div', 'env-stack');
  b.append(envKnobs(1), el('h4', 'subtitle', '&#9662; ENV 1 &middot; AMP'), envKnobs(2), el('h4', 'subtitle', '&#9662; ENV 2 &middot; FILTER'));
  const m = module('', 'dark', b, { grow: 2.7, cls: 'notitle' });
  return m;
}

function lfo(i) {
  const b = el('div', 'grid g2');
  b.append(knob(`lfo${i}_rate`, { size: 'l' }), knob(`lfo${i}_shape`));
  const amt = i === 1 ? [['mod_lfo1_cut', '>Cutoff'], ['mod_lfo1_pw', '>Shape']] : [['mod_lfo2_wave', '>Wave'], ['mod_lfo2_timbre', '>Timbre']];
  amt.forEach(([id, label]) => b.append(knob(id, { size: 's', label })));
  const meter = el('div', 'lfo-meter'); meter.innerHTML = '<span></span>';
  views[`lfoMeter${i}`] = meter.firstChild;
  b.append(meter);
  return module(`LFO ${i}`, 'red', b, { grow: 1.5 });
}

function clockMod() {
  const b = el('div', 'grid g2');
  b.append(knob('q_prog'), knob('q_bars'), knob('walk_rate', { size: 's' }), knob('mod_walk_pitch', { size: 's', label: 'Drift' }));
  return module('PROGRESSION', 'red', b, { grow: 1.6 });
}

function drone() {
  const b = el('div', 'grid g2');
  b.append(knob('dr_tone', { size: 'l' }), knob('dr_oct'), knob('dr_spread', { size: 's' }), knob('dr_fifth', { size: 's' }));
  return module('DRONE CLOUD', 'red', b, { grow: 1.6 });
}

function env3() {
  const b = el('div', 'env3');
  const led = el('span', 'led big'); views.leds[2] = led;
  const f = el('div', 'faders');
  f.append(fader('env3_a', { label: 'A' }), fader('env3_d', { label: 'D' }), fader('env3_s', { label: 'S' }), fader('env3_r', { label: 'R' }));
  b.append(led, f);
  return module('ENV 3 &middot; LPG', 'red', b, { grow: 1.9 });
}

function mixer() {
  const b = el('div', 'mixer');
  ['LEAD', 'MACRO', 'DRONE', 'LITANY', 'REVEL'].forEach((name, i) => {
    const id = i + 1;
    const s = el('div', 'strip');
    const col = el('div', 'strip-knobs');
    col.append(knob(`ch${id}_pan`, { size: 's' }), knob(`ch${id}_dly`, { size: 's' }), knob(`ch${id}_rev`, { size: 's' }));
    s.append(el('div', 'chname', name), row('strip-body', fader(`ch${id}_lvl`, { label: 'Level' }), col), toggle(`ch${id}_mute`, { label: 'Mute' }));
    b.append(s);
  });
  return module('MIXER', 'dark', b, { grow: 5.2 });
}

function bernoulli() {
  const b = el('div', 'seq-body');
  const left = el('div', 'grid g2 tight');
  left.append(knob('bA_prob'), knob('bA_deja'), knob('bA_spread', { size: 's' }), knob('bA_bias', { size: 's' }));
  const mem = el('div', 'memgrid');
  views.bern = [];
  for (let i = 0; i < 16; i++) {
    const c = el('div', 'memcell');
    c.innerHTML = '<i></i><b></b>';
    mem.append(c); views.bern.push(c);
  }
  const memWrap = el('div', 'memwrap');
  views.noteLcdA = lcd('--', 'notelcd');
  memWrap.append(row('memhead', el('span', 'tag', 'LOOP MEMORY'), views.noteLcdA), mem);
  const right = el('div', 'grid g3 tight');
  right.append(knob('bA_len'), knob('bA_range'), knob('bA_div'), knob('bA_ratchet', { size: 's' }), knob('bA_gate', { size: 's' }), el('div', ''));
  b.append(left, memWrap, right);
  return module('BERNOULLI SEQUENCER', 'red', b, { grow: 5.6 });
}

function entropy() {
  const b = el('div', 'seq-body');
  const bars = el('div', 'stepbars');
  views.ent = { bars: [], gates: [] };
  for (let i = 0; i < 16; i++) {
    const s = el('div', 'stepbar');
    s.innerHTML = '<i></i>';
    s.dataset.i = i;
    bars.append(s); views.ent.bars.push(s);
  }
  const setFromPointer = (e) => {
    const t = document.elementFromPoint(e.clientX, e.clientY);
    const bar = t && t.closest('.stepbar');
    if (!bar) return;
    const r = bar.getBoundingClientRect();
    const v = Math.round(Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height)) * 100) / 100;
    state.steps[+bar.dataset.i] = v;
    send({ t: 'steps', steps: state.steps });
    drawEntropy();
  };
  let painting = false;
  bars.addEventListener('pointerdown', (e) => { painting = true; bars.setPointerCapture(e.pointerId); setFromPointer(e); });
  bars.addEventListener('pointermove', (e) => painting && setFromPointer(e));
  bars.addEventListener('pointerup', () => (painting = false));
  const gates = el('div', 'gaterow');
  for (let i = 0; i < 16; i++) { const g = el('div', 'gcell', String(i + 1)); gates.append(g); views.ent.gates.push(g); }
  const mid = el('div', 'entmid');
  mid.append(row('memhead', el('span', 'tag', 'STEPS (drag to draw)'), button('Randomize', 'small', () => { state.steps = stepsFromSeed((Math.random() * 1e9) | 0); send({ t: 'steps', steps: state.steps }); drawEntropy(); })), bars, gates);
  const left = el('div', 'grid g1 tight');
  left.append(knob('eB_entropy', { size: 'l' }), knob('eB_range', { size: 's' }));
  const right = el('div', 'grid g3 tight');
  right.append(knob('eB_len'), knob('eB_fill'), knob('eB_rot'), knob('eB_div', { size: 's' }), knob('eB_gate', { size: 's' }), el('div', ''));
  b.append(left, mid, right);
  return module('ENTROPY SEQUENCER', 'red', b, { grow: 6.2 });
}

function quantizer() {
  const b = el('div', 'quant');
  const kb = el('div', 'keyboard');
  views.keys = [];
  const black = [1, 3, 6, 8, 10];
  for (let i = 0; i < 12; i++) {
    const k = el('button', 'key ' + (black.includes(i) ? 'black' : 'white'));
    k.innerHTML = `<span>${NOTE_NAMES[i]}</span>`;
    k.setAttribute('aria-label', `Toggle scale degree ${i} (semitones above root)`);
    k.addEventListener('click', () => toggleKey(i));
    kb.append(k); views.keys.push(k);
  }
  const ctl = row('grid g4 tight', knob('q_scale'), knob('q_root'), knob('mod_lz_drone', { size: 's', label: 'Lz>Drone' }), knob('mod_lz_cut', { size: 's', label: 'Lz>Cutoff' }));
  b.append(row('memhead', el('span', 'tag', 'SCALE MASK FROM ROOT (click to edit)'), views.chordLcd = lcd('', 'notelcd')), kb, ctl);
  return module('SCALE QUANTIZER', 'red', b, { grow: 4.4 });
}

function toggleKey(i) {
  // editing a key turns the current scale into a custom scale
  const pc = i;
  let idx = state.values.q_scale;
  const isCustom = SCALES[idx][1] === null;
  if (!isCustom) {
    const m = mask();
    idx = SCALES.length - 2;
    state.customs[0] = m;
    setParam('q_scale', idx, false);
  }
  const ci = idx - (SCALES.length - 2);
  const m = state.customs[ci];
  m[pc] = m[pc] ? 0 : 1;
  if (!m.some(Boolean)) m[0] = 1;
  send({ t: 'mask', mask: mask() });
  drawKeys();
}

function drawKeys() {
  const m = mask();
  const root = views.lastRoot ?? state.values.q_root;
  views.keys.forEach((k, i) => (k.firstChild.textContent = NOTE_NAMES[(root + i) % 12]));
  if (views.rootLcd) views.rootLcd.textContent = 'ROOT ' + NOTE_NAMES[root];
  if (views.chordLcd) views.chordLcd.textContent = 'ROOT ' + NOTE_NAMES[root];
  views.keys.forEach((k, i) => k.classList.toggle('in', !!m[i]));
  const p = PARAMS.q_scale;
  if (views.scaleLcd) views.scaleLcd.textContent = fmtValue(p, state.values.q_scale);
}

function fx() {
  const delay = el('div', 'grid g3');
  delay.append(knob('dl_time'), knob('dl_sync'), knob('dl_fb'), knob('dl_tone'), knob('dl_ret'), knob('dl_rev'));
  const rev = el('div', 'grid g3');
  rev.append(knob('rv_size'), knob('rv_decay'), knob('rv_damp'), knob('rv_pre'), knob('rv_mod'), knob('rv_ret'));
  const cho = el('div', 'grid g2');
  cho.append(knob('cho_rate'), knob('cho_depth'), knob('cho_mix', { size: 'l' }));
  return [
    module('Delay', 'dark', delay, { grow: 2.4, titleTop: true, cls: 'centered' }),
    module('Reverb', 'dark', rev, { grow: 2.4, titleTop: true, cls: 'centered' }),
    module('Chorus', 'dark', cho, { grow: 1.7, titleTop: true, cls: 'centered' }),
  ];
}

function lorenzMod(w = 240, h = 150, big = false) {
  const b = el('div', 'lorenz');
  const c = canvas(w, h, 'screen');
  views.lorenz.push(c);
  b.append(c);
  if (!big) b.append(row('row-knobs', knob('lz_rate', { size: 's' }), knob('lz_rho', { size: 's' }), knob('mod_lz_space', { size: 's', label: 'Lz>Space' })));
  return module('Lorenz', 'dark', b, { grow: big ? 1 : 2.6, titleTop: true, cls: 'centered' });
}

function scopeMod(w = 210, h = 120, big = false) {
  const b = el('div', 'scope');
  const c = canvas(w, h, 'screen');
  views.scope.push(c);
  b.append(c);
  if (!big) b.append(row('row-knobs', knob('mod_lfo2_pan', { size: 's', label: 'Auto-Pan' }), knob('mp_depth', { size: 's', label: 'Moon Dist' })));
  return module('Oscilloscope', 'dark', b, { grow: big ? 1 : 2.2, titleTop: true, cls: 'centered' });
}

function master() {
  const b = el('div', 'master');
  const meters = el('div', 'meters'); meters.innerHTML = '<span></span><span></span>';
  views.meters = meters.querySelectorAll('span');
  const k = el('div', 'grid g1 tight');
  k.append(knob('m_drive', { size: 's' }), knob('m_width', { size: 's' }));
  b.append(fader('m_vol', { label: 'Volume' }), meters, k);
  return module('Master', 'dark', b, { grow: 2.2, titleTop: true, cls: 'centered' });
}

// ---------------- Eternal Eclipse modules
function cosmicClock() {
  const b = el('div', 'cosmic');
  const c = canvas(200, 200, 'screen wheel');
  views.wheel = c;
  const side = el('div', 'cosmic-side');
  views.skyDate = lcd('----', 'notelcd');
  side.append(row('memhead', el('span', 'tag', 'SKY DATE'), views.skyDate),
    row('grid g2 tight', knob('cc_rate'), knob('cc_warp'), toggle('cc_live'), knob('mod_cc_cut', { size: 's', label: '>Cutoff' }), knob('mod_cc_scan', { size: 's', label: '>Scan' }), knob('mod_cc_grain', { size: 's', label: '>Grain' })));
  views.aspectList = el('div', 'aspects');
  side.append(views.aspectList);
  b.append(c, side);
  return module('COSMIC CLOCK', 'dark', b, { grow: 4.6 });
}

function revelator() {
  const b = el('div', 'revel');
  const elems = el('div', 'elements');
  views.elemLeds = ['AIR', 'WATER', 'EARTH', 'FIRE'].map((n) => { const e = el('span', 'elem ' + n.toLowerCase(), n); elems.append(e); return e; });
  views.revNote = lcd('--', 'notelcd');
  const led = el('span', 'led big'); views.leds[3] = led;
  const g = el('div', 'grid g6 tight');
  g.append(knob('er_scan', { size: 'l' }), knob('er_fm'), knob('er_ring'), knob('er_fold'), knob('er_cut'), knob('er_res', { size: 's' }),
    knob('er_oct', { size: 's' }), knob('er_detune', { size: 's' }), toggle('er_spirit', { label: 'Spirit Chord' }), knob('er_trig', { size: 's' }), knob('er_bars', { size: 's' }), knob('er_gate', { size: 's' }));
  const env = row('env-row', led, knob('env4_a', { size: 's' }), knob('env4_d', { size: 's' }), knob('env4_s', { size: 's' }), knob('env4_r', { size: 's' }));
  b.append(row('memhead', elems, views.revNote), g, env);
  return module('ELEMENTAL REVELATOR', 'red', b, { grow: 6.2 });
}

function moonPhase() {
  const b = el('div', 'moonmod');
  const c = canvas(96, 96, 'moon');
  views.moon = c;
  views.moonLcd = lcd('--', 'notelcd');
  requestAnimationFrame(() => drawMoon(c, state.values.mp_phase));
  const g = el('div', 'grid g2 tight');
  g.append(knob('mp_depth'), knob('mp_mix'), knob('mp_tone', { size: 's' }), knob('mp_phase', { size: 's' }), toggle('mp_manual'));
  b.append(row('moonhead', c, views.moonLcd), g);
  return module('MOON PHASE DIST', 'dark', b, { grow: 2.4 });
}

function litany() {
  const b = el('div', 'litany');
  const c = canvas(330, 70, 'screen');
  views.loop = c;
  const g = el('div', 'grid g5 tight');
  g.append(knob('lt_speed', { size: 'l' }), knob('lt_size'), knob('lt_dens'), knob('lt_scan'), knob('lt_pitch'),
    knob('lt_spray', { size: 's' }), knob('lt_spread', { size: 's' }), knob('lt_len', { size: 's' }), knob('lt_in', { size: 's' }), toggle('lt_hold'));
  b.append(row('memhead', el('span', 'tag', 'TAPE LOOP OF THE MIX'), el('span', '')), c, g);
  return module('LITANY ENGINE', 'red', b, { grow: 4.6 });
}

function liminalVast() {
  const g = el('div', 'grid g2 tight');
  g.append(knob('lv_size', { size: 'l' }), knob('lv_decay', { size: 'l' }), knob('lv_damp'), knob('lv_mod'), knob('lv_send', { size: 's' }), knob('lv_ret', { size: 's' }), toggle('lv_freeze'), knob('mod_cc_vast', { size: 's', label: 'Cosmic>Size' }));
  return module('LIMINAL VAST', 'red', g, { grow: 2.4 });
}

function mainTab() {
  const t = el('div', 'tab tab-main');
  t.append(
    row('rrow', tripleVco(), vcf(), macroVco(), envStack()),
    row('rrow', lfo(1), lfo(2), clockMod(), drone(), env3()),
    row('rrow', bernoulli(), entropy(), quantizer()),
    row('rrow', cosmicClock(), revelator(), moonPhase()),
    row('rrow', litany(), liminalVast(), mixer()),
    row('rrow', ...fx(), lorenzMod(), scopeMod(), master()),
  );
  return t;
}

// ------------------------------------------------------------------ other tabs
function modsTab() {
  const t = el('div', 'tab tab-mods');
  const groups = {};
  MODS.forEach(([id, src]) => (groups[src] ||= []).push(id));
  const intro = el('p', 'tabnote', 'GenX has no patch cables. Every modulation path is wired in already; these knobs set how much each fixed route is used.');
  const rowA = row('rrow');
  const srcCtl = { 'LFO 1': ['lfo1_rate', 'lfo1_shape'], 'LFO 2': ['lfo2_rate', 'lfo2_shape'], 'Lorenz X': ['lz_rate', 'lz_rho'], Walk: ['walk_rate'], 'Cosmic Clock': ['cc_rate', 'cc_warp'] };
  Object.entries(groups).forEach(([src, ids], i) => {
    const b = el('div', 'modgroup');
    (srcCtl[src] || []).forEach((id) => b.append(knob(id, { size: 's' })));
    ids.forEach((id) => b.append(knob(id, { label: PARAMS[id].label.split(' > ')[1] })));
    rowA.append(module(src.toUpperCase(), i % 2 ? 'red' : 'dark', b, { grow: ids.length + 1 }));
  });
  t.append(intro, rowA);
  return t;
}

function trimTab() {
  const t = el('div', 'tab tab-trim');
  const mk = (title, tone, ids) => { const b = el('div', 'modgroup'); ids.forEach((id) => b.append(knob(id, { size: 's' }))); return module(title, tone, b, { grow: ids.length }); };
  t.append(
    el('p', 'tabnote', 'Fine trims: tuning, gate lengths, clock divisions, voice levels and panning.'),
    row('rrow', mk('TUNING', 'dark', ['tune', 'vco1_fine', 'vco2_fine', 'vco3_fine', 'vco_detune', 'glide']), mk('VOICE LEVELS', 'red', ['vco1_lvl', 'vco2_lvl', 'vco3_lvl', 'noise_lvl', 'noise_color', 'ch4_lvl', 'ch5_lvl']), mk('CLOCK', 'dark', ['tempo', 'swing', 'bA_div', 'eB_div'])),
    row('rrow', mk('GATES', 'red', ['bA_gate', 'eB_gate', 'bA_ratchet']), mk('PANNING', 'dark', ['ch1_pan', 'ch2_pan', 'ch3_pan', 'ch4_pan', 'ch5_pan', 'm_width']), mk('FX TRIMS', 'red', ['dl_tone', 'dl_rev', 'rv_pre', 'rv_mod', 'm_drive', 'lpg_res'])),
  );
  return t;
}

function scopeTab() {
  const t = el('div', 'tab tab-scope');
  t.append(row('rrow tall', scopeMod(760, 360, true), lorenzMod(760, 360, true)));
  return t;
}

function patchesTab() {
  const t = el('div', 'tab tab-patches');
  const list = el('div', 'plist');
  const render = () => {
    list.innerHTML = '';
    PRESETS.forEach((p, i) => list.append(button(`<b>${p.name}</b><span>factory &middot; seed ${p.seed}</span>`, 'pitem', () => loadPreset(i))));
    store.get('genx.patches', []).forEach((p, i) => {
      const item = button(`<b>${escapeHtml(p.name)}</b><span>user &middot; seed ${p.seed}</span>`, 'pitem user', () => applyPatch(p));
      const del = button('&times;', 'pdel', (e) => {
        e.stopPropagation();
        const all = store.get('genx.patches', []); all.splice(i, 1); store.set('genx.patches', all); render();
      });
      del.setAttribute('aria-label', `Delete ${p.name}`);
      item.append(del);
      list.append(item);
    });
  };
  const nameIn = el('input', 'pname-in');
  nameIn.id = 'patch-name';
  nameIn.placeholder = 'Patch name';
  nameIn.setAttribute('aria-label', 'Patch name');
  const actions = row('pactions', nameIn,
    button('Save current patch', 'btn-wide', () => {
      const name = (nameIn.value.trim() || state.name).slice(0, 40);
      state.name = name; views.presetName.textContent = name; nameIn.value = '';
      const all = store.get('genx.patches', []);
      all.push(snapshot(name)); store.set('genx.patches', all); render();
    }),
    button('Export JSON', 'btn-wide', () => {
      const blob = new Blob([JSON.stringify(snapshot(state.name), null, 2)], { type: 'application/json' });
      const a = el('a'); a.href = URL.createObjectURL(blob); a.download = `${state.name.replace(/\W+/g, '-')}.genx.json`; a.click();
    }),
    button('Copy JSON', 'btn-wide', async () => {
      const text = JSON.stringify(snapshot(state.name));
      try { await navigator.clipboard.writeText(text); alertBox('Patch JSON copied to the clipboard'); }
      catch { pasteBox.value = text; pasteBox.hidden = false; pasteBox.select(); alertBox('Copy the selected JSON below'); }
    }),
    importButton(),
  );
  const pasteBox = el('textarea', 'pastebox');
  pasteBox.id = 'patch-json';
  pasteBox.placeholder = 'Or paste patch JSON here';
  pasteBox.setAttribute('aria-label', 'Patch JSON');
  pasteBox.addEventListener('paste', () => setTimeout(() => {
    try { applyPatch(JSON.parse(pasteBox.value)); alertBox('Patch loaded'); } catch { alertBox('That text is not a GenX patch.'); }
  }, 0));
  const credits = el('div', 'credits');
  const plugins = new Set(CREDITS.map((c) => c.plugin));
  credits.innerHTML = `<h4>Modeled on ${CREDITS.length} open-source VCV Rack modules from ${plugins.size} plugins</h4>
    <p>GenX re-implements the behaviour of these modules in its own code with fixed routing. No panel art or source code is copied. Each plugin keeps its own license.</p>
    <table><thead><tr><th>Module</th><th>Plugin</th><th>License</th><th>In GenX</th><th>What GenX models</th></tr></thead><tbody>
    ${CREDITS.map((c) => `<tr><td>${c.module}</td><td><a href="${c.repo}" target="_blank" rel="noopener">${c.plugin}</a></td><td>${c.license}</td><td>${c.genx}</td><td>${c.usedFor}</td></tr>`).join('')}
    </tbody></table>`;
  render();
  const left = el('div', 'pleft'); left.append(el('h4', '', 'Patches'), list, actions, pasteBox);
  t.append(row('patches-wrap', left, credits));
  return t;
}
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function importButton() {
  const input = el('input'); input.type = 'file'; input.accept = '.json,application/json'; input.hidden = true;
  input.addEventListener('change', async () => {
    const f = input.files[0]; if (!f) return;
    try { applyPatch(JSON.parse(await f.text())); } catch { alertBox('That file is not a GenX patch.'); }
    input.value = '';
  });
  const b = button('Import JSON', 'btn-wide', () => input.click());
  const w = el('span'); w.append(b, input);
  return w;
}
const alertBox = (msg) => { views.readout.textContent = msg; views.readout.classList.add('on'); setTimeout(() => views.readout.classList.remove('on'), 2500); };

// ------------------------------------------------------------------ patches
function snapshot(name) {
  return { genx: 1, name, seed: state.seed, values: { ...state.values }, steps: state.steps.slice(), customs: state.customs.map((m) => m.slice()) };
}
function applyPatch(p) {
  if (!p || typeof p !== 'object') return;
  const vals = defaults();
  for (const [k, v] of Object.entries(p.values || {})) if (k in PARAMS && typeof v === 'number' && isFinite(v)) vals[k] = v;
  state.values = vals;
  state.seed = Number.isInteger(p.seed) ? p.seed : state.seed;
  state.steps = Array.isArray(p.steps) && p.steps.length === 16 ? p.steps.map(Number) : stepsFromSeed(state.seed);
  if (Array.isArray(p.customs) && p.customs.length === 2) state.customs = p.customs.map((m) => m.map((x) => (x ? 1 : 0)));
  state.name = String(p.name || 'Untitled').slice(0, 40);
  syncAll();
}
function loadPreset(i) {
  state.preset = i;
  const p = PRESETS[i];
  applyPatch({ name: p.name, seed: p.seed, values: { ...defaults(), ...p.values }, steps: stepsFromSeed(p.seed) });
}
function setSeed(s) {
  state.seed = s >>> 0;
  state.steps = stepsFromSeed(state.seed);
  views.seedLcd.value = String(state.seed);
  send({ t: 'steps', steps: state.steps });
  send({ t: 'seed', seed: state.seed });
  drawEntropy();
}
function reseed() { setSeed((Math.random() * 99999) | 0); }
function mutate() {
  // nudge the generative controls a little, like turning a few knobs at random
  const ids = ['bA_prob', 'bA_deja', 'bA_spread', 'bA_bias', 'eB_entropy', 'mac_timbre', 'mac_morph', 'vcf_cut', 'vco_fm', 'lfo1_rate', 'lfo2_rate', 'dr_tone', 'q_prog'];
  ids.forEach((id) => {
    const p = PARAMS[id];
    const span = p.curve === 'exp' ? Math.log(p.max / p.min) : p.max - p.min;
    let v = state.values[id];
    v = p.curve === 'exp' ? v * Math.exp((Math.random() - 0.5) * span * 0.15) : v + (Math.random() - 0.5) * span * 0.15;
    v = Math.min(p.max, Math.max(p.min, v));
    setParam(id, v, false);
  });
}
function syncAll() {
  refreshAll(state.values);
  views.presetName.textContent = state.name;
  views.seedLcd.value = String(state.seed);
  document.querySelectorAll('.tempo-lcd').forEach((n) => (n.textContent = Math.round(state.values.tempo)));
  views.lastRoot = undefined;
  drawWaves(); drawKeys(); drawEntropy();
  send({ t: 'params', values: state.values });
  send({ t: 'mask', mask: mask() });
  send({ t: 'steps', steps: state.steps });
  send({ t: 'seed', seed: state.seed });
}

// ------------------------------------------------------------------ audio
async function togglePlay() {
  if (!ctx) {
    try {
      ctx = new AudioContext({ latencyHint: 'playback' });
      await ctx.audioWorklet.addModule(new URL('./worklet/genx-engine.js', import.meta.url));
      node = new AudioWorkletNode(ctx, 'genx-engine', { numberOfInputs: 0, outputChannelCount: [2] });
      node.connect(ctx.destination);
      node.port.onmessage = (e) => e.data.t === 'ui' && onTelemetry(e.data);
      syncAll();
    } catch (err) {
      console.error(err);
      alertBox('Audio could not start in this browser: ' + err.message);
      ctx = null; return;
    }
  }
  if (ctx.state === 'suspended') await ctx.resume();
  state.running = !state.running;
  send({ t: 'run', on: state.running });
  views.play.classList.toggle('on', state.running);
  views.play.innerHTML = state.running ? '<span class="pi">&#9632;</span>' : '<span class="pi">&#9654;</span>';
}

// ------------------------------------------------------------------ telemetry drawing
let lzPts = [];
const peak = [0, 0];
function onTelemetry(d) {
  // scope
  views.scope.forEach((c) => {
    const g = c.getContext('2d'); const { w, h } = c;
    g.clearRect(0, 0, w, h);
    grid(g, w, h);
    g.strokeStyle = '#7dff9a'; g.lineWidth = 1.6; g.shadowColor = '#40ff70'; g.shadowBlur = 6;
    g.beginPath();
    const n = Math.min(d.scope.length, 400);
    let pk = 0;
    for (let i = 0; i < n; i++) {
      const v = d.scope[i]; pk = Math.max(pk, Math.abs(v));
      const x = (i / (n - 1)) * w, y = h / 2 - v * h * 0.42;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke(); g.shadowBlur = 0;
    peak[0] = Math.max(pk, peak[0] * 0.9);
  });
  if (views.meters) {
    views.meters.forEach((m) => (m.style.height = Math.min(100, peak[0] * 110) + '%'));
  }
  // lorenz
  for (let i = 0; i < d.lz.length; i += 2) lzPts.push(d.lz[i], d.lz[i + 1]);
  if (lzPts.length > 3000) lzPts = lzPts.slice(lzPts.length - 3000);
  views.lorenz.forEach((c) => {
    const g = c.getContext('2d'); const { w, h } = c;
    g.clearRect(0, 0, w, h);
    grid(g, w, h);
    const n = lzPts.length / 2;
    for (let i = 0; i < n; i++) {
      const x = w / 2 + lzPts[i * 2] * w * 0.44, y = h / 2 - lzPts[i * 2 + 1] * h * 0.44;
      g.fillStyle = `rgba(190,255,200,${0.12 + 0.8 * (i / n)})`;
      g.fillRect(x, y, 1.3, 1.3);
    }
    if (n) {
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(w / 2 + lzPts[lzPts.length - 2] * w * 0.44, h / 2 - lzPts[lzPts.length - 1] * h * 0.44, 2.5, 0, Math.PI * 2); g.fill();
    }
  });
  drawEclipse(d);
  // envelopes & LFO meters
  d.env.forEach((v, i) => views.leds[i] && (views.leds[i].style.opacity = (0.15 + Math.min(1, v) * 0.85).toFixed(2)));
  if (views.lfoMeter1) views.lfoMeter1.style.transform = `scaleX(${d.lfo[0].toFixed(3)})`;
  if (views.lfoMeter2) views.lfoMeter2.style.transform = `scaleX(${d.lfo[1].toFixed(3)})`;
  // bernoulli memory
  const lenA = state.values.bA_len;
  views.bern.forEach((c, i) => {
    const [v, g] = d.regA[i];
    c.classList.toggle('off', i >= lenA);
    c.classList.toggle('cur', i === d.posA);
    c.classList.toggle('gate', g > 0);
    c.firstChild.style.height = (v * 100).toFixed(0) + '%';
    c.lastChild.textContent = g > 1 ? 'x' + g : '';
  });
  views.ent.gates.forEach((g, i) => g.classList.toggle('cur', i === d.posB));
  views.ent.bars.forEach((b, i) => b.classList.toggle('cur', i === d.posB));
  if (d.lastA != null) views.noteLcdA.textContent = noteName(d.lastA);
  if (d.lastB != null) views.noteLcdB.textContent = noteName(d.lastB);
  views.rootLcd.textContent = 'ROOT ' + NOTE_NAMES[d.root];
  if (d.root !== views.lastRoot) {
    views.lastRoot = d.root;
    views.keys.forEach((k, i) => (k.firstChild.textContent = NOTE_NAMES[(d.root + i) % 12]));
  }
  views.chordLcd.textContent = 'ROOT ' + NOTE_NAMES[d.root];
  // highlight the scale degrees being played (keys are laid out from the current root)
  const pcs = new Set([d.lastA, d.lastB].filter((x) => x != null).map((x) => (((x - d.root) % 12) + 12) % 12));
  views.keys.forEach((k, i) => k.classList.toggle('hit', pcs.has(i)));
}
// ---------------- Eternal Eclipse drawing
const PLANET_ABBR = ['Su', 'Mo', 'Me', 'Ve', 'Ma', 'Ju', 'Sa', 'Ur', 'Ne'];
const PLANET_COL = ['#ffd36b', '#e8e8f0', '#b9c4d6', '#ffb7d0', '#ff6a4a', '#ffb070', '#d8c48a', '#8fe0ff', '#7a9cff'];
const SIGNS = ['Ari', 'Tau', 'Gem', 'Can', 'Leo', 'Vir', 'Lib', 'Sco', 'Sag', 'Cap', 'Aqu', 'Pis'];
const ELEM_COL = ['rgba(255,90,60,0.16)', 'rgba(140,200,90,0.14)', 'rgba(200,220,255,0.12)', 'rgba(80,140,255,0.16)'];
const ASPECT_NAMES = ['conjunct', 'sextile', 'square', 'trine', 'opposite'];
const ASPECT_COL = ['#ffd36b', '#7dff9a', '#ff5a4a', '#6fa8ff', '#ff8a2a'];
const MOON_NAMES = ['New', 'Wax Cres', '1st Qtr', 'Wax Gibb', 'Full', 'Wan Gibb', 'Last Qtr', 'Wan Cres'];
function drawEclipse(d) {
  const cc = d.cc;
  if (cc && views.wheel) {
    const c = views.wheel, g = c.getContext('2d'), { w, h } = c, cx = w / 2, cy = h / 2, R = w / 2 - 4;
    g.clearRect(0, 0, w, h);
    const ang = (lon) => Math.PI - lon * Math.PI / 180; // Aries at the left, counter-clockwise
    for (let i = 0; i < 12; i++) {
      g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, ang(i * 30 + 30), ang(i * 30)); g.closePath();
      g.fillStyle = ELEM_COL[i % 4]; g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.12)'; g.stroke();
      const a = ang(i * 30 + 15);
      g.fillStyle = 'rgba(220,225,240,0.7)'; g.font = '9px "Share Tech Mono", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(SIGNS[i], cx + Math.cos(a) * (R - 10), cy - Math.sin(a) * (R - 10));
    }
    g.fillStyle = '#0b0f1a'; g.beginPath(); g.arc(cx, cy, R - 21, 0, Math.PI * 2); g.fill();
    const pos = cc.lon.map((lon, i) => { const a = ang(lon), r = R - 32 - (i % 3) * 13; return [cx + Math.cos(a) * r, cy - Math.sin(a) * r]; });
    g.lineWidth = 1;
    cc.asp.forEach(([i, j, k, s]) => {
      g.strokeStyle = ASPECT_COL[k]; g.globalAlpha = 0.25 + s * 0.6;
      g.beginPath(); g.moveTo(...pos[i]); g.lineTo(...pos[j]); g.stroke();
    });
    g.globalAlpha = 1;
    pos.forEach(([x, y], i) => {
      g.fillStyle = PLANET_COL[i]; g.beginPath(); g.arc(x, y, 3.2, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#e8e8f0'; g.font = '9px "Share Tech Mono", monospace'; g.fillText(PLANET_ABBR[i], x, y - 8);
    });
    // cosmic output needle
    g.strokeStyle = '#ff8a2a'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx, cy - cc.out * (R - 40)); g.stroke();
    const date = new Date(Date.UTC(2000, 0, 1, 12) + cc.days * 86400000);
    views.skyDate.textContent = isFinite(date) ? date.toISOString().slice(0, 10) : '----';
    const top = cc.asp.slice().sort((a, b) => b[3] - a[3]).slice(0, 3);
    views.aspectList.innerHTML = top.map(([i, j, k]) => `<span style="color:${ASPECT_COL[k]}">${PLANET_ABBR[i]} ${ASPECT_NAMES[k]} ${PLANET_ABBR[j]}</span>`).join('') || '<span>no aspects</span>';
  }
  if (cc && views.moon) {
    const ph = state.values.mp_manual ? state.values.mp_phase : cc.moon;
    drawMoon(views.moon, ph);
    views.moonLcd.textContent = MOON_NAMES[Math.round(ph * 8) % 8];
  }
  if (d.lt && views.loop) {
    if (d.lt.ov) views.loopOv = d.lt.ov;
    const c = views.loop, g = c.getContext('2d'), { w, h } = c;
    g.clearRect(0, 0, w, h);
    const ov = views.loopOv || [];
    g.fillStyle = 'rgba(160,190,255,0.55)';
    ov.forEach((v, i) => { const bh = Math.min(1, v * 2.2) * (h - 8); g.fillRect((i / ov.length) * w, h / 2 - bh / 2, Math.max(1, w / ov.length - 0.5), bh); });
    g.fillStyle = '#ff4a2a'; g.fillRect(d.lt.w * w, 0, 1.5, h);
    g.fillStyle = '#7dff9a'; g.fillRect(d.lt.head * w - 1, 0, 2.5, h);
  }
  if (d.lastRev != null && views.revNote) views.revNote.textContent = noteName(d.lastRev);
  if (views.elemLeds && d.env[3] != null) views.elemLeds.forEach((e) => (e.style.opacity = (0.35 + Math.min(1, d.env[3]) * 0.65).toFixed(2)));
}
function drawMoon(c, ph) {
  const g = c.getContext('2d'), { w, h } = c, cx = w / 2, cy = h / 2, r = w / 2 - 6;
  g.clearRect(0, 0, w, h);
  g.fillStyle = '#1a1d26'; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  // lit part: a half disc plus/minus an ellipse whose width follows the phase
  const k = Math.cos(ph * Math.PI * 2); // 1 new, -1 full
  const waxing = ph < 0.5;
  g.fillStyle = '#efe9d8'; g.shadowColor = 'rgba(255,240,200,0.6)'; g.shadowBlur = 10;
  g.beginPath();
  g.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, !waxing);
  g.ellipse(cx, cy, Math.abs(k) * r, r, 0, Math.PI / 2, -Math.PI / 2, (k > 0) === waxing ? true : false);
  g.fill(); g.shadowBlur = 0;
  g.strokeStyle = 'rgba(255,255,255,0.15)'; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
}

const noteName = (m) => NOTE_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
function grid(g, w, h) {
  g.strokeStyle = 'rgba(120,160,255,0.12)'; g.lineWidth = 1;
  g.beginPath();
  for (let x = 0; x <= 8; x++) { g.moveTo((x * w) / 8, 0); g.lineTo((x * w) / 8, h); }
  for (let y = 0; y <= 4; y++) { g.moveTo(0, (y * h) / 4); g.lineTo(w, (y * h) / 4); }
  g.stroke();
}

function drawEntropy() {
  if (!views.ent) return;
  const { eB_len: len, eB_fill: fill, eB_rot: rot } = state.values;
  const f = Math.min(fill, len);
  views.ent.bars.forEach((b, i) => {
    b.firstChild.style.height = (state.steps[i] * 100).toFixed(0) + '%';
    b.classList.toggle('off', i >= len);
  });
  views.ent.gates.forEach((g, i) => {
    const j = (i + rot) % len;
    const on = i < len && Math.floor(((j + 1) * f) / len) - Math.floor((j * f) / len) > 0;
    g.classList.toggle('on', on);
    g.classList.toggle('off', i >= len);
  });
}

// ------------------------------------------------------------------ tabs & layout
const TABS = [['main', 'Main'], ['mods', 'Modifications'], ['trim', 'Trimmers'], ['scope', 'Scope'], ['patches', 'Patches']];
const tabNodes = {};
function showTab(id) {
  Object.entries(tabNodes).forEach(([k, n]) => (n.hidden = k !== id));
  document.querySelectorAll('.tabbtn').forEach((b) => b.classList.toggle('on', b.dataset.tab === id));
  store.set('genx.tab', id);
  fit();
}

function build() {
  const app = document.getElementById('app');
  const rack = el('div', 'rack');
  const inner = el('div', 'rack-inner');
  inner.append(topBar());
  const area = el('div', 'tabarea');
  tabNodes.main = mainTab();
  tabNodes.mods = modsTab();
  tabNodes.trim = trimTab();
  tabNodes.scope = scopeTab();
  tabNodes.patches = patchesTab();
  Object.values(tabNodes).forEach((n) => area.append(n));
  inner.append(area);
  const tabs = el('nav', 'tabs');
  TABS.forEach(([id, label]) => {
    const b = button(label.toUpperCase(), 'tabbtn', () => showTab(id));
    b.dataset.tab = id; tabs.append(b);
  });
  inner.append(tabs);
  rack.append(el('div', 'cheek left'), inner, el('div', 'cheek right'));
  app.append(rack);
  showTab(store.get('genx.tab', 'main'));
  loadPreset(0);
  window.addEventListener('resize', fit);
  fit();
}

// scale the fixed-width rack to fit the viewport (no horizontal scroll)
function fit() {
  const rack = document.querySelector('.rack');
  const app = document.getElementById('app');
  if (!rack) return;
  rack.style.transform = '';
  const natural = rack.offsetWidth;
  const cs = getComputedStyle(app);
  const avail = document.documentElement.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const s = Math.min(1, avail / natural);
  rack.style.transform = `scale(${s})`;
  app.style.height = rack.offsetHeight * s + 'px';
}

build();
