# Credits

GenX's engine is modeled on **57 open-source VCV Rack modules** from **19 plugins**. GenX re-implements the *behaviour* of these modules in its own JavaScript DSP with fixed internal routing (no patch cables). No source code or panel graphics are copied; each plugin keeps its own license. Panel artwork of most VCV plugins is CC BY-NC-ND and must never be copied into GenX.

Generated from `js/credits.js` (run `node tools-gen-credits.mjs > CREDITS.md`).

## Plugins

| Plugin | Repository | License |
|---|---|---|
| VCV Fundamental | https://github.com/VCVRack/Fundamental | GPL-3.0-or-later |
| Befaco (VCV port) | https://github.com/VCVRack/Befaco | GPL-3.0-or-later |
| Bogaudio | https://github.com/bogaudio/BogaudioModules | GPL-3.0-or-later |
| Audible Instruments | https://github.com/VCVRack/AudibleInstruments | GPL-3.0-or-later |
| BaconPlugs | https://github.com/baconpaul/BaconPlugs | GPL-3.0-or-later |
| E-Series | https://github.com/VCVRack/ESeries | GPL-3.0-or-later |
| Amalgamated Harmonics | https://github.com/jhoar/AmalgamatedHarmonics | BSD-3-Clause |
| Valley Rack Free | https://github.com/ValleyAudio/ValleyRackFree | BSD-3-Clause |
| Strum's Mental Modules | https://github.com/Strum/Strums_Mental_VCV_Modules | BSD-3-Clause |
| JulioChaos | https://github.com/JulioArgudo/JulioChaos-modules | BSD-3-Clause |
| Nonlinear Circuits (VCV port) | https://github.com/mhetrick/nonlinearcircuits | CC0-1.0 |
| Impromptu Modular | https://github.com/MarcBoule/ImpromptuModular | GPL-3.0-or-later |
| Count Modula | https://github.com/countmodula/VCVRackPlugins | GPL-3.0 |
| JW-Modules | https://github.com/jeremywen/JW-Modules | BSD-3-Clause |
| Geodesics | https://github.com/MarcBoule/Geodesics | GPL-3.0-only |
| Alikins | https://github.com/alikins/Alikins-rack-plugins | GPL-3.0-or-later |
| Surge XT Rack | https://github.com/surge-synthesizer/surge-rack | GPL-3.0-or-later |
| MindMeld Modular | https://github.com/MarcBoule/MindMeldModular | GPL-3.0-or-later |
| Eternal Eclipse Modular | https://github.com/7337Productions/eternaleclipsemodular | GPL-3.0-or-later |

## Modules

| # | Module | Plugin | Slug | GenX section | What GenX models |
|---|---|---|---|---|---|
| 1 | VCO | VCV Fundamental | `VCO` | Triple VCO | Core analog-style oscillator: band-limited saw/square, triangle, sine, hard sync, linear FM. |
| 2 | Even VCO | Befaco (VCV port) | `EvenVCO` | Triple VCO | Morphing waveform knob and pulse-width control on each of the three oscillators. |
| 3 | XCO | Bogaudio | `Bogaudio-XCO` | Triple VCO | FM-from-oscillator-1 depth, waveform crossfade and the fold stage per voice. |
| 4 | Noise | VCV Fundamental | `Noise` | VCF / Noise | White noise source. |
| 5 | NOISE | Bogaudio | `Bogaudio-Noise` | VCF / Noise | Coloured noise (white to pink to brown) via the Color knob. |
| 6 | Macro Oscillator 2 (Plaits) | Audible Instruments | `Plaits` | Macro VCO | Model selector with Harmonics / Timbre / Morph macro controls. |
| 7 | FM-OP | Bogaudio | `Bogaudio-FMOp` | Macro VCO | FM model: 2-operator FM with ratio, index and feedback. |
| 8 | ADDITATOR | Bogaudio | `Bogaudio-Additator` | Macro VCO | Additive model: 16 partials with tilt, odd/even balance and spectral peak. |
| 9 | KarplusStrongPoly | BaconPlugs | `KarplusStrongPoly` | Macro VCO | Pluck model: Karplus-Strong string with excitation colour and damping. |
| 10 | Resonator (Rings) | Audible Instruments | `Rings` | Macro VCO | Brightness / damping response of the pluck model. |
| 11 | E340 Cloud Generator | E-Series | `E340` | Drone | Detuned oscillator cloud with spread control for the drone voice. |
| 12 | Fifths and Fourths (Circle) | Amalgamated Harmonics | `Circle` | Drone / Quantizer | Chord root that walks around the circle of fifths. |
| 13 | VCF | VCV Fundamental | `VCF` | VCF | 4-pole transistor-ladder low-pass with resonance and drive. |
| 14 | LVCF | Bogaudio | `Bogaudio-LVCF` | VCF | Filter mode selector (LP24 / LP12 / BP / HP). |
| 15 | LPG | Bogaudio | `Bogaudio-LPG` | Macro VCO | Low-pass gate on the macro voice (filter + VCA from one envelope). |
| 16 | Interzone | Valley Rack Free | `Interzone` | Voice architecture | Monosynth signal flow (VCO to filter to VCA with env/LFO mod) used as the fixed voice template. |
| 17 | ADSR | VCV Fundamental | `ADSR` | ENV 1-3 | Exponential ADSR envelopes for amp, filter and LPG. |
| 18 | VCA Mix | VCV Fundamental | `VCMixer` | Mixer | Channel levels into a summing bus. |
| 19 | LFO | VCV Fundamental | `LFO` | LFO 1 / LFO 2 | Sine, triangle, saw, square LFO shapes. |
| 20 | Random | VCV Fundamental | `Random` | LFO 1 / LFO 2 | Stepped and smoothed random shape (S&H). |
| 21 | Quad LFO | Strum's Mental Modules | `MentalQuadLFO` | LFO 2 | Second LFO with independent rate and shape. |
| 22 | WALK2 | Bogaudio | `Bogaudio-Walk2` | Lorenz / Walk | Random-walk pitch drift. |
| 23 | Lorentz84 Oscillator | JulioChaos | `JulioLorentz84` | Lorenz | Chaotic attractor integrated as a modulation source. |
| 24 | Triple Sloth | Nonlinear Circuits (VCV port) | `TripleSloth` | Lorenz | Very slow chaotic CV (X/Y/Z outputs routed to filter, timbre and space). |
| 25 | Slew Limiter | Befaco (VCV port) | `SlewLimiter` | Trimmers | Glide on the lead pitch. |
| 26 | Clocked | Impromptu Modular | `Clocked` | Clock | Master clock with BPM and swing. |
| 27 | Clock Divider | Strum's Mental Modules | `MentalClockDivider` | Sequencers | Per-sequencer clock divisions. |
| 28 | Bernoulli Gate (Branches) | Audible Instruments | `Branches` | Bernoulli Seq | Coin-toss gate: each clock fires with probability P. |
| 29 | Random Sampler (Marbles) | Audible Instruments | `Marbles` | Bernoulli Seq | Spread / Bias random pitch with Deja-vu loop memory. |
| 30 | SHASR | VCV Fundamental | `SHASR` | Bernoulli Seq | Sample & hold shift register behind the loop memory. |
| 31 | Analogue Shift Register | Count Modula | `AnalogueShiftRegister` | Bernoulli Seq | Loop length control of the memory register. |
| 32 | Shift Register Random | JW-Modules | `ShiftRegRnd` | Bernoulli Seq | Turing-machine style lock/unlock of the loop. |
| 33 | Burst | Befaco (VCV port) | `Burst` | Bernoulli Seq | Ratchets: a gate can burst into 2-3 retriggers. |
| 34 | Clocked Random Gates | Count Modula | `ClockedRandomGates` | Bernoulli Seq | Per-clock gate probability looped with the pitch memory. |
| 35 | Entropia | Geodesics | `Entropia` | Entropy Seq | Step sequence that blends towards random values with the Entropy knob. |
| 36 | SEQ 3 | VCV Fundamental | `SEQ3` | Entropy Seq | 16 editable step values with length. |
| 37 | Euclid | Count Modula | `Euclid` | Entropy Seq | Euclidean gate pattern (fill + rotate). |
| 38 | Gate Length | Alikins | `GateLength` | Trimmers | Gate length per sequencer. |
| 39 | Generative | Amalgamated Harmonics | `Generative` | Bernoulli Seq | Probability-driven melodic generation with seeded randomness. |
| 40 | ProbKey | Impromptu Modular | `Prob-Key` | Bernoulli Seq | Range-in-octaves and probability-weighted note choice. |
| 41 | Quantizer | VCV Fundamental | `Quantizer` | Scale Quantizer | 12-note custom scale mask quantizer. |
| 42 | Scale Quantizer MkII | Amalgamated Harmonics | `ScaleQuantizer2` | Scale Quantizer | Named scales and root selection. |
| 43 | Quantiser | Strum's Mental Modules | `MentalQuantiser` | Scale Quantizer | Nearest-note snapping across octaves. |
| 44 | Chopping Kinky | Befaco (VCV port) | `ChoppingKinky` | Triple VCO | Wavefolder on the VCO mix. |
| 45 | Fold | Strum's Mental Modules | `MentalFold` | Triple VCO | Sine-fold transfer curve. |
| 46 | Delay | VCV Fundamental | `Delay` | Delay | Delay with time, feedback and tone (LP/HP) in the loop. |
| 47 | Plateau | Valley Rack Free | `Plateau` | Reverb | Dattorro plate reverb with size, decay, damping, pre-delay and modulation. |
| 48 | Chorus | Surge XT Rack | `SurgeXTFXChorus` | Chorus | Stereo modulated-delay chorus. |
| 49 | MixMaster | MindMeld Modular | `MixMaster` | Mixer | Per-channel level, pan, mute and aux sends. |
| 50 | MasterChannel | MindMeld Modular | `MasterChannel` | Master | Master volume, soft-clip drive and stereo width. |
| 51 | Scope | VCV Fundamental | `Scope` | Oscilloscope | Triggered oscilloscope of the master output. |
| 52 | Full Scope | JW-Modules | `FullScope` | Lorenz | X/Y display used to draw the attractor. |
| 53 | Cosmic Clock | Eternal Eclipse Modular | `CosmicClock` | Cosmic Clock | Nine planetary LFO voices from Keplerian orbital elements, shaped by the element of the sign each planet transits and mixed by live aspects, with time warp and sign-change triggers. |
| 54 | Liminal Vast Reverb | Eternal Eclipse Modular | `LiminalVast` | Liminal Vast | 8-line feedback delay network with a Householder matrix, input diffusion, modulated lines, damping, long decay and freeze. |
| 55 | Litany Engine | Eternal Eclipse Modular | `LitanyEngine` | Litany Engine | Looping playback with through-zero varispeed and a granular reader (grain size from the whole loop down to 15 ms, overlap, scan, spray). GenX loops its own mix instead of bundled samples. |
| 56 | Moon Phase Distortion | Eternal Eclipse Modular | `MoonPhaseDistortion` | Moon Phase Dist | Stereo distortion whose depth and character follow the Moon phase from the Cosmic Clock sky, with manual override. |
| 57 | Elemental Revelator | Eternal Eclipse Modular | `ElementalRevelator` | Elemental Revelator | AIR / WATER / EARTH / FIRE wavetable oscillators with elemental-ring phase modulation, opposing-pair ring mod, SPIRIT chord mode, wavefolding and ladder low-pass. |
