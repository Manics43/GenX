# GenX

GenX is an open-source generative music engine that runs in the browser. Its synth and sequencing engine is modeled on **52 open-source VCV Rack modules from 18 plugins** (see [CREDITS.md](CREDITS.md)), but unlike VCV Rack there are **no patch cables**: every module is wired into a fixed, musically useful signal flow, and you shape it with knobs.

## Run it

No build step. Serve the folder over HTTP (AudioWorklets cannot load from `file://`):

```sh
python3 -m http.server 8000
# open http://localhost:8000 and press Play
```

It works in current Chrome, Edge, Firefox and Safari.

## Signal flow (fixed routing)

```
Clock (BPM, swing)
 ├─ Bernoulli Sequencer ─ Scale Quantizer ─ Glide ─ Triple VCO + Noise ─ Ladder VCF ─ VCA ─┐
 │    coin-toss gates, Marbles-style spread/bias,     FM 1>2/3, sync, fold   ENV 2      ENV 1   │
 │    deja-vu loop memory, bursts                                                           │
 ├─ Entropy Sequencer ─ Scale Quantizer ─ Macro VCO (VA / FM / Additive / Pluck) ─ LPG (ENV 3)┤─ Mixer ─ Chorus ─┬─ Master
 │    16 drawable steps, Euclidean gates, entropy                                           │  (sends)          │  drive, width
 └─ Progression (circle of fifths) ─ root ─ Drone Cloud ─ SVF ──────────────────────────────┘  Delay ─ Plate Reverb
Modulation: LFO 1, LFO 2, Lorenz attractor (X/Y/Z), random walk, ENV 2 → fixed destinations (Modifications tab)
```

Everything is driven by one seeded random generator, so a **seed + patch** always plays back the same music. Reseed for a new piece, Mutate to nudge the generative knobs.

## Tabs

- **Main**: the full rack.
- **Modifications**: the amount of every fixed modulation route (LFOs, Lorenz, walk, envelope).
- **Trimmers**: tuning, gate lengths, clock divisions, voice levels, panning and FX trims.
- **Scope**: large oscilloscope and Lorenz attractor display.
- **Patches**: factory presets, saving patches in the browser, JSON export/import, and the module credits.

## Code layout

| Path | What it is |
|---|---|
| `js/worklet/genx-engine.js` | All DSP and sequencing, in one AudioWorkletProcessor |
| `js/params.js` | Parameter registry, scales, presets, seeded RNG |
| `js/ui.js` | Knob, fader, toggle and display widgets |
| `js/main.js` | Rack layout, tabs, patches, audio setup, telemetry drawing |
| `js/credits.js` | The 52 modeled modules (source of truth for CREDITS.md) |
| `css/style.css` | Rack styling |

## License

GenX is free software under the **GNU General Public License v3.0 or later** (see [LICENSE](LICENSE)). The modules it is modeled on are GPL-3.0, BSD-3-Clause, MIT-compatible or CC0 (listed in CREDITS.md); all are compatible with GPL-3.0. GenX does not include any VCV panel artwork. If you port source code from one of those plugins verbatim, keep its copyright notice and add it to CREDITS.md.
