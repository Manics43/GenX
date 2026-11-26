// Open-source VCV Rack modules that GenX's engine is modeled on.
// GenX re-implements the *behaviour* of these modules in its own code with fixed
// internal routing. No source code or panel graphics are copied from them.
// Licenses were checked against each repository's LICENSE / plugin.json (Nov 2026).

const R = {
  fundamental: ['VCV Fundamental', 'https://github.com/VCVRack/Fundamental', 'GPL-3.0-or-later'],
  befaco: ['Befaco (VCV port)', 'https://github.com/VCVRack/Befaco', 'GPL-3.0-or-later'],
  audible: ['Audible Instruments', 'https://github.com/VCVRack/AudibleInstruments', 'GPL-3.0-or-later'],
  eseries: ['E-Series', 'https://github.com/VCVRack/ESeries', 'GPL-3.0-or-later'],
  bogaudio: ['Bogaudio', 'https://github.com/bogaudio/BogaudioModules', 'GPL-3.0-or-later'],
  impromptu: ['Impromptu Modular', 'https://github.com/MarcBoule/ImpromptuModular', 'GPL-3.0-or-later'],
  geodesics: ['Geodesics', 'https://github.com/MarcBoule/Geodesics', 'GPL-3.0-only'],
  mindmeld: ['MindMeld Modular', 'https://github.com/MarcBoule/MindMeldModular', 'GPL-3.0-or-later'],
  valley: ['Valley Rack Free', 'https://github.com/ValleyAudio/ValleyRackFree', 'BSD-3-Clause'],
  surge: ['Surge XT Rack', 'https://github.com/surge-synthesizer/surge-rack', 'GPL-3.0-or-later'],
  ah: ['Amalgamated Harmonics', 'https://github.com/jhoar/AmalgamatedHarmonics', 'BSD-3-Clause'],
  bacon: ['BaconPlugs', 'https://github.com/baconpaul/BaconPlugs', 'GPL-3.0-or-later'],
  count: ['Count Modula', 'https://github.com/countmodula/VCVRackPlugins', 'GPL-3.0'],
  nlc: ['Nonlinear Circuits (VCV port)', 'https://github.com/mhetrick/nonlinearcircuits', 'CC0-1.0'],
  mental: ["Strum's Mental Modules", 'https://github.com/Strum/Strums_Mental_VCV_Modules', 'BSD-3-Clause'],
  jw: ['JW-Modules', 'https://github.com/jeremywen/JW-Modules', 'BSD-3-Clause'],
  julio: ['JulioChaos', 'https://github.com/JulioArgudo/JulioChaos-modules', 'BSD-3-Clause'],
  eclipse: ['Eternal Eclipse Modular', 'https://github.com/7337Productions/eternaleclipsemodular', 'GPL-3.0-or-later'],
  alikins: ['Alikins', 'https://github.com/alikins/Alikins-rack-plugins', 'GPL-3.0-or-later'],
};

const M = (repo, module, slug, genx, usedFor) => ({
  plugin: R[repo][0], repo: R[repo][1], license: R[repo][2], module, slug, genx, usedFor,
});

export const CREDITS = [
  // Oscillators & sources
  M('fundamental', 'VCO', 'VCO', 'Triple VCO', 'Core analog-style oscillator: band-limited saw/square, triangle, sine, hard sync, linear FM.'),
  M('befaco', 'Even VCO', 'EvenVCO', 'Triple VCO', 'Morphing waveform knob and pulse-width control on each of the three oscillators.'),
  M('bogaudio', 'XCO', 'Bogaudio-XCO', 'Triple VCO', 'FM-from-oscillator-1 depth, waveform crossfade and the fold stage per voice.'),
  M('fundamental', 'Noise', 'Noise', 'VCF / Noise', 'White noise source.'),
  M('bogaudio', 'NOISE', 'Bogaudio-Noise', 'VCF / Noise', 'Coloured noise (white to pink to brown) via the Color knob.'),
  M('audible', 'Macro Oscillator 2 (Plaits)', 'Plaits', 'Macro VCO', 'Model selector with Harmonics / Timbre / Morph macro controls.'),
  M('bogaudio', 'FM-OP', 'Bogaudio-FMOp', 'Macro VCO', 'FM model: 2-operator FM with ratio, index and feedback.'),
  M('bogaudio', 'ADDITATOR', 'Bogaudio-Additator', 'Macro VCO', 'Additive model: 16 partials with tilt, odd/even balance and spectral peak.'),
  M('bacon', 'KarplusStrongPoly', 'KarplusStrongPoly', 'Macro VCO', 'Pluck model: Karplus-Strong string with excitation colour and damping.'),
  M('audible', 'Resonator (Rings)', 'Rings', 'Macro VCO', 'Brightness / damping response of the pluck model.'),
  M('eseries', 'E340 Cloud Generator', 'E340', 'Drone', 'Detuned oscillator cloud with spread control for the drone voice.'),
  M('ah', 'Fifths and Fourths (Circle)', 'Circle', 'Drone / Quantizer', 'Chord root that walks around the circle of fifths.'),
  // Filters, envelopes, VCAs
  M('fundamental', 'VCF', 'VCF', 'VCF', '4-pole transistor-ladder low-pass with resonance and drive.'),
  M('bogaudio', 'LVCF', 'Bogaudio-LVCF', 'VCF', 'Filter mode selector (LP24 / LP12 / BP / HP).'),
  M('bogaudio', 'LPG', 'Bogaudio-LPG', 'Macro VCO', 'Low-pass gate on the macro voice (filter + VCA from one envelope).'),
  M('valley', 'Interzone', 'Interzone', 'Voice architecture', 'Monosynth signal flow (VCO to filter to VCA with env/LFO mod) used as the fixed voice template.'),
  M('fundamental', 'ADSR', 'ADSR', 'ENV 1-3', 'Exponential ADSR envelopes for amp, filter and LPG.'),
  M('fundamental', 'VCA Mix', 'VCMixer', 'Mixer', 'Channel levels into a summing bus.'),
  // Modulation
  M('fundamental', 'LFO', 'LFO', 'LFO 1 / LFO 2', 'Sine, triangle, saw, square LFO shapes.'),
  M('fundamental', 'Random', 'Random', 'LFO 1 / LFO 2', 'Stepped and smoothed random shape (S&H).'),
  M('mental', 'Quad LFO', 'MentalQuadLFO', 'LFO 2', 'Second LFO with independent rate and shape.'),
  M('bogaudio', 'WALK2', 'Bogaudio-Walk2', 'Lorenz / Walk', 'Random-walk pitch drift.'),
  M('julio', "Lorentz84 Oscillator", 'JulioLorentz84', 'Lorenz', 'Chaotic attractor integrated as a modulation source.'),
  M('nlc', 'Triple Sloth', 'TripleSloth', 'Lorenz', 'Very slow chaotic CV (X/Y/Z outputs routed to filter, timbre and space).'),
  M('befaco', 'Slew Limiter', 'SlewLimiter', 'Trimmers', 'Glide on the lead pitch.'),
  // Sequencing & logic
  M('impromptu', 'Clocked', 'Clocked', 'Clock', 'Master clock with BPM and swing.'),
  M('mental', 'Clock Divider', 'MentalClockDivider', 'Sequencers', 'Per-sequencer clock divisions.'),
  M('audible', 'Bernoulli Gate (Branches)', 'Branches', 'Bernoulli Seq', 'Coin-toss gate: each clock fires with probability P.'),
  M('audible', 'Random Sampler (Marbles)', 'Marbles', 'Bernoulli Seq', 'Spread / Bias random pitch with Deja-vu loop memory.'),
  M('fundamental', 'SHASR', 'SHASR', 'Bernoulli Seq', 'Sample & hold shift register behind the loop memory.'),
  M('count', 'Analogue Shift Register', 'AnalogueShiftRegister', 'Bernoulli Seq', 'Loop length control of the memory register.'),
  M('jw', 'Shift Register Random', 'ShiftRegRnd', 'Bernoulli Seq', 'Turing-machine style lock/unlock of the loop.'),
  M('befaco', 'Burst', 'Burst', 'Bernoulli Seq', 'Ratchets: a gate can burst into 2-3 retriggers.'),
  M('count', 'Clocked Random Gates', 'ClockedRandomGates', 'Bernoulli Seq', 'Per-clock gate probability looped with the pitch memory.'),
  M('geodesics', 'Entropia', 'Entropia', 'Entropy Seq', 'Step sequence that blends towards random values with the Entropy knob.'),
  M('fundamental', 'SEQ 3', 'SEQ3', 'Entropy Seq', '16 editable step values with length.'),
  M('count', 'Euclid', 'Euclid', 'Entropy Seq', 'Euclidean gate pattern (fill + rotate).'),
  M('alikins', 'Gate Length', 'GateLength', 'Trimmers', 'Gate length per sequencer.'),
  M('ah', 'Generative', 'Generative', 'Bernoulli Seq', 'Probability-driven melodic generation with seeded randomness.'),
  M('impromptu', 'ProbKey', 'Prob-Key', 'Bernoulli Seq', 'Range-in-octaves and probability-weighted note choice.'),
  // Pitch
  M('fundamental', 'Quantizer', 'Quantizer', 'Scale Quantizer', '12-note custom scale mask quantizer.'),
  M('ah', 'Scale Quantizer MkII', 'ScaleQuantizer2', 'Scale Quantizer', 'Named scales and root selection.'),
  M('mental', 'Quantiser', 'MentalQuantiser', 'Scale Quantizer', 'Nearest-note snapping across octaves.'),
  // Shaping & FX
  M('befaco', 'Chopping Kinky', 'ChoppingKinky', 'Triple VCO', 'Wavefolder on the VCO mix.'),
  M('mental', 'Fold', 'MentalFold', 'Triple VCO', 'Sine-fold transfer curve.'),
  M('fundamental', 'Delay', 'Delay', 'Delay', 'Delay with time, feedback and tone (LP/HP) in the loop.'),
  M('valley', 'Plateau', 'Plateau', 'Reverb', 'Dattorro plate reverb with size, decay, damping, pre-delay and modulation.'),
  M('surge', 'Chorus', 'SurgeXTFXChorus', 'Chorus', 'Stereo modulated-delay chorus.'),
  // Mixing & display
  M('mindmeld', 'MixMaster', 'MixMaster', 'Mixer', 'Per-channel level, pan, mute and aux sends.'),
  M('mindmeld', 'MasterChannel', 'MasterChannel', 'Master', 'Master volume, soft-clip drive and stereo width.'),
  M('fundamental', 'Scope', 'Scope', 'Oscilloscope', 'Triggered oscilloscope of the master output.'),
  M('jw', 'Full Scope', 'FullScope', 'Lorenz', 'X/Y display used to draw the attractor.'),
  // Eternal Eclipse family
  M('eclipse', 'Cosmic Clock', 'CosmicClock', 'Cosmic Clock', 'Nine planetary LFO voices from Keplerian orbital elements, shaped by the element of the sign each planet transits and mixed by live aspects, with time warp and sign-change triggers.'),
  M('eclipse', 'Liminal Vast Reverb', 'LiminalVast', 'Liminal Vast', '8-line feedback delay network with a Householder matrix, input diffusion, modulated lines, damping, long decay and freeze.'),
  M('eclipse', 'Litany Engine', 'LitanyEngine', 'Litany Engine', 'Looping playback with through-zero varispeed and a granular reader (grain size from the whole loop down to 15 ms, overlap, scan, spray). GenX loops its own mix instead of bundled samples.'),
  M('eclipse', 'Moon Phase Distortion', 'MoonPhaseDistortion', 'Moon Phase Dist', 'Stereo distortion whose depth and character follow the Moon phase from the Cosmic Clock sky, with manual override.'),
  M('eclipse', 'Elemental Revelator', 'ElementalRevelator', 'Elemental Revelator', 'AIR / WATER / EARTH / FIRE wavetable oscillators with elemental-ring phase modulation, opposing-pair ring mod, SPIRIT chord mode, wavefolding and ladder low-pass.'),
];
