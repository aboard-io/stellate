// synclead — a classic HARD-SYNC lead (Cars / darksynth "tearing" formant):
//   a MASTER phasor at the note freq resets a SLAVE saw running at
//   freq*syncRatio every master cycle. The slave's abrupt phase-reset at the
//   master period is the tear: the waveform repeats at the note pitch but its
//   spectral peak tracks the SLAVE frequency, so sweeping `syncRatio` (1..4)
//   slides a bright formant across the sound. `syncSweep` adds an envelope on
//   top of the ratio (a note-on 1->0 decay), the moving-vowel sync sweep. Two
//   slightly DETUNED sync pairs for width, gentle tanh DRIVE, a resonant
//   4-pole ladder (moog_vcf_2bn — ve.moogLadder is BROKEN, see VOICES.md) with
//   a PUNCHY filter envelope (envAmount OCTAVES), and a fast loudness contour.
//   MONO-LEGATO lead: GLIDE slews `freq`; the sync-sweep + envelopes single-
//   trigger on the group gate (legato holds), exactly like modeld.
// SCHEDULER CONTRACT (state-engine `mono:true` units): legato notes (gap
// < ~30 ms or overlapping) route to ONE voice instance, gate HELD — `freq`
// then slews and neither the sync sweep nor the envelopes retrigger.
declare name "synclead";
import("stdfaust.lib");

freq   = hslider("freq", 330, 40, 4000, 0.01);
gate   = button("gate");
syncRatio = hslider("syncRatio", 1.5, 1.0, 4.0, 0.001) : si.smoo; // slave:master — THE tearing knob
syncSweep = hslider("syncSweep", 1.5, 0.0, 4.0, 0.001) : si.smoo; // env-added ratio on note-on
syncDecay = hslider("syncDecay", 0.18, 0.01, 1.5, 0.005);         // sync-sweep time (s)
detune = hslider("detune", 8, 0, 40, 0.1) : si.smoo;             // 2nd sync pair, CENTS
cutoff = hslider("cutoff", 2200, 60, 16000, 1) : si.smoo;
res    = hslider("res", 0.35, 0, 0.95, 0.01);                    // EMPHASIS
envAmount = hslider("envAmount", 1.8, 0, 5, 0.01);               // filter env depth, OCTAVES
envAttack = hslider("envAttack", 0.003, 0.001, 0.5, 0.001);
envDecay  = hslider("envDecay", 0.16, 0.01, 2, 0.005);
envSustain= hslider("envSustain", 0.25, 0, 1, 0.01);
glide  = hslider("glide", 0, 0, 500, 1);                         // portamento, ms
drive  = hslider("drive", 0.3, 0, 1, 0.01);                      // tanh pre-filter
attack = hslider("attack", 0.004, 0.001, 2, 0.001);
sustain= hslider("sustain", 0.85, 0, 1, 0.01);
release= hslider("release", 0.2, 0.01, 3, 0.005);
level  = hslider("level", 0.5, 0, 1, 0.01);
gain   = hslider("gain", 1, 0, 2, 0.01);

// GLIDE — exponential slew toward the target note (tau = glide/4.6 so it lands
// within 1% at ~glide ms; <=2 ms means OFF -> instant snap) — same as modeld
gsec  = glide * 0.001;
gpole = ba.tau2pole(max(gsec / 4.6, 0.0005)) * (gsec > 0.002);
kf    = freq : si.smooth(gpole);

// SYNC-SWEEP envelope: 1 at note-on -> 0 (single-trigger; legato gate holds it
// low so a phrase doesn't re-tear mid-group). Same note-on decay idiom as
// lead_pluck's dec(). Effective slave:master ratio = base + sweep*env.
sweepEnv = ba.impulsify(gate) : (+ ~ *(ba.tau2pole(max(syncDecay / 4.6, 0.002))));
ratio = min(8.0, syncRatio + syncSweep * sweepEnv);

// HARD SYNC — a free master phasor detects each cycle wrap (phase steps down);
// that resets the slave phasor (feedback zeroed) so the slave saw restarts at
// the master period. Naive reset (aliases by design — the resonant LP tames
// it; the grit is the darksynth character). `wrap` via the floor primitive
// (no library dependency for the fractional part).
inc(f)  = f / ma.SR;
wrap(x) = x - floor(x);
syncSaw(mf) = 2.0 * slave - 1.0
with {
    m    = (+(inc(mf)) : wrap) ~ _;          // free-running master phasor 0..1
    rst  = m < m';                           // 1 on the sample the master wraps
    slave = (+(inc(mf * ratio)) : wrap) ~ *(1.0 - rst);
};

// two detuned sync pairs (the whole pair shifts, giving beating width)
detR = pow(2.0, detune / 1200.0);
oscs = (syncSaw(kf) + syncSaw(kf * detR)) * 0.5;

// DRIVE into the filter (gentle tanh, loudness-compensated)
driven = oscs * (1.0 + drive * 4.0) : ma.tanh : *(1.0 / (1.0 + drive * 1.0));

// FILTER ENVELOPE — punchy ADS contour in octaves above cutoff (release rides
// envDecay); ladder = moog_vcf_2bn (Hz + res 0..1, csound moogladder semantics)
fenv = en.adsr(envAttack, envDecay, envSustain, envDecay, gate);
kcut = min(16000.0, max(30.0, cutoff * exp(0.6931472 * envAmount * fenv)));

// loudness contour: fast attack, slight settle into the singing sustain
env = en.adsr(attack, 0.06, sustain, release, gate);

process = driven : ve.moog_vcf_2bn(res, kcut) : *(env * level * gain);
