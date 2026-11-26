// Small widget toolkit for the rack: knobs, faders, toggles, LCDs, canvases.
import { PARAMS, toNorm, fromNorm, fmtValue } from './params.js';

export const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};

// id -> list of widgets bound to that param (a param can appear in several tabs)
const bound = new Map();
let onChange = () => {};
let readout = null;
export const setChangeHandler = (fn) => (onChange = fn);
export const setReadout = (node) => (readout = node);

const bind = (id, w) => {
  if (!bound.has(id)) bound.set(id, []);
  bound.get(id).push(w);
};
export const refreshParam = (id, v) => (bound.get(id) || []).forEach((w) => w.set(v));
export const refreshAll = (values) => {
  for (const [id, ws] of bound) ws.forEach((w) => w.set(values[id]));
};

const showReadout = (p, v) => {
  if (!readout) return;
  readout.textContent = `${p.label}: ${fmtValue(p, v)}`;
  readout.classList.add('on');
  clearTimeout(showReadout.t);
  showReadout.t = setTimeout(() => readout.classList.remove('on'), 900);
};

function dragBehaviour(node, p, getN, setN) {
  let startY = 0, startN = 0, active = false;
  node.addEventListener('pointerdown', (e) => {
    active = true; startY = e.clientY; startN = getN();
    node.setPointerCapture(e.pointerId);
    node.classList.add('drag');
    e.preventDefault();
  });
  node.addEventListener('pointermove', (e) => {
    if (!active) return;
    const scale = e.shiftKey ? 900 : 180;
    setN(startN + (startY - e.clientY) / scale);
  });
  const end = () => { active = false; node.classList.remove('drag'); };
  node.addEventListener('pointerup', end);
  node.addEventListener('pointercancel', end);
  node.addEventListener('dblclick', () => setN(toNorm(p, p.def)));
  node.addEventListener('wheel', (e) => {
    e.preventDefault();
    const step = p.curve === 'int' ? 1 / Math.max(1, p.max - p.min) : 0.01;
    setN(getN() + (e.deltaY < 0 ? step : -step));
  }, { passive: false });
  node.addEventListener('keydown', (e) => {
    const step = p.curve === 'int' ? 1 / Math.max(1, p.max - p.min) : e.shiftKey ? 0.002 : 0.02;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { setN(getN() + step); e.preventDefault(); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { setN(getN() - step); e.preventDefault(); }
  });
}

// Knob. size: 's' | 'm' | 'l'
export function knob(id, opts = {}) {
  const p = PARAMS[id];
  if (!p) throw new Error('unknown param ' + id);
  const wrap = el('div', `kw ${opts.size || 'm'}`);
  const k = el('div', 'knob');
  k.tabIndex = 0;
  k.setAttribute('role', 'slider');
  k.setAttribute('aria-label', opts.label || p.label);
  k.innerHTML = '<div class="ticks"></div><div class="ring"></div><div class="cap"></div>';
  const lab = el('div', 'klabel', opts.label || p.label);
  const val = p.names ? el('div', 'kval') : null;
  wrap.append(k, lab);
  if (val) wrap.append(val);
  let n = 0, v = p.def;
  const w = {
    set(nv) {
      v = nv; n = toNorm(p, nv);
      k.style.setProperty('--pct', n.toFixed(4));
      k.setAttribute('aria-valuetext', fmtValue(p, nv));
      if (val) val.textContent = fmtValue(p, nv);
    },
  };
  dragBehaviour(k, p, () => n, (nn) => {
    const nv = fromNorm(p, nn);
    if (nv === v && p.curve === 'int') { n = Math.min(1, Math.max(0, nn)); return; }
    w.set(nv);
    if (p.curve === 'int') n = Math.min(1, Math.max(0, nn));
    onChange(id, nv);
    showReadout(p, nv);
  });
  bind(id, w);
  w.set(p.def);
  return wrap;
}

export function fader(id, opts = {}) {
  const p = PARAMS[id];
  const wrap = el('div', 'fw');
  const track = el('div', 'fader');
  track.tabIndex = 0;
  track.setAttribute('role', 'slider');
  track.setAttribute('aria-label', opts.label || p.label);
  track.innerHTML = '<div class="fscale"></div><div class="fslot"></div><div class="fcap"></div>';
  wrap.append(track, el('div', 'klabel', opts.label || p.label));
  let n = 0;
  const w = { set(v) { n = toNorm(p, v); track.style.setProperty('--pct', n.toFixed(4)); } };
  dragBehaviour(track, p, () => n, (nn) => {
    const v = fromNorm(p, nn); w.set(v); onChange(id, v); showReadout(p, v);
  });
  bind(id, w);
  w.set(p.def);
  return wrap;
}

export function toggle(id, opts = {}) {
  const p = PARAMS[id];
  const wrap = el('div', 'tw');
  const b = el('button', 'toggle');
  b.setAttribute('aria-label', opts.label || p.label);
  b.innerHTML = '<span class="led"></span>';
  wrap.append(b, el('div', 'klabel', opts.label || p.label));
  let v = 0;
  const w = { set(nv) { v = nv; b.classList.toggle('on', !!nv); b.setAttribute('aria-pressed', String(!!nv)); } };
  b.addEventListener('click', () => { w.set(v ? 0 : 1); onChange(id, v); showReadout(p, v); });
  bind(id, w);
  w.set(p.def);
  return wrap;
}

export function button(label, cls, fn) {
  const b = el('button', 'btn ' + (cls || ''), label);
  b.addEventListener('click', fn);
  return b;
}

export function lcd(text, cls = '') {
  return el('div', 'lcd ' + cls, text);
}

export function canvas(w, h, cls = '') {
  const c = el('canvas', 'cv ' + cls);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = w * dpr; c.height = h * dpr;
  c.style.width = w + 'px'; c.style.height = h + 'px';
  c.getContext('2d').scale(dpr, dpr);
  c.w = w; c.h = h;
  return c;
}

export function module(title, tone, body, opts = {}) {
  const m = el('section', `mod ${tone} ${opts.cls || ''}`);
  if (opts.grow) m.style.flexGrow = opts.grow;
  if (opts.basis) m.style.flexBasis = opts.basis + 'px';
  const h = el('h3', 'mtitle', `<span class="tri">&#9662;</span> ${title}`);
  m.append(body, h);
  if (opts.titleTop) m.prepend(h);
  return m;
}

export const row = (cls, ...kids) => { const r = el('div', cls); r.append(...kids); return r; };

// Draw one cycle of the morphing VCO waveform.
export function drawWave(c, wave, pw = 0.5) {
  const g = c.getContext('2d');
  const { w, h } = c;
  g.clearRect(0, 0, w, h);
  g.strokeStyle = '#6fa8ff'; g.lineWidth = 1.6; g.shadowColor = '#4a8cff'; g.shadowBlur = 4;
  g.beginPath();
  const i = Math.min(2, Math.floor(wave)), x = wave - i;
  const f = (k, p) => [Math.sin(2 * Math.PI * p), 1 - 4 * Math.abs(p - 0.5), 2 * p - 1, p < pw ? 1 : -1][k];
  for (let s = 0; s <= 80; s++) {
    const p = s / 80;
    const y = f(i, p) * (1 - x) + f(i + 1, p) * x;
    const px = 4 + p * (w - 8), py = h / 2 - y * (h / 2 - 5);
    s ? g.lineTo(px, py) : g.moveTo(px, py);
  }
  g.stroke();
}
