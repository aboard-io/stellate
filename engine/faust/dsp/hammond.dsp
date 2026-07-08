// hammond — a Hammond B-3 tonewheel organ + Leslie rotary cabinet.
//
// The POINT of this voice is its drawbar vector: NINE additive tonewheel
// sines, each a separate 0..8 morphable param, so two genres can sit at two
// registrations and a blend morphs the whole spectrum between them. On top of
// the tonewheels: always-on leakage/crosstalk (the Hammond shimmer even at
// zero drawbar), a single-trigger PERCUSSION tap (2nd/3rd harmonic, decays
// under the held gate), a note-on KEY CLICK transient, gentle tube DRIVE, then
// a two-rotor LESLIE — 800 Hz crossover, horn + drum spinning at different
// rates with AM (tremolo), doppler FM (fractional-delay pitch shimmer) and
// opposite-mic stereo pan. `leslie` (0=chorale .. 1=tremolo) is a single
// morphable speed with rotor INERTIA: the horn accelerates faster than the
// heavy bass drum, so speed changes audibly ramp.
//
// STEREO OUT (2 channels) — this is the project's first stereo VOICE (all
// prior voices are mono; only fx_bus was stereo). Channel [0] alone is a
// full, mono-compatible Leslie (both rotors present, AM keeps it lively), so
// the current press path — which reads render(...)[0] — degrades gracefully to
// a mono Leslie; wire both channels to get the stereo spin (see integration
// notes). Tonewheels are FREE-RUNNING os.osc (the real wheels never stop — no
// phase reset, unlike tonal drums); the fast attack + key click mask the
// per-note phase-0 start in the re-instantiated press path.
//
// Poly KEYS voice (voices chords). Target genres: house, disco, krautrock,
// blues. Recipe knobs: the nine bars + perc/percHarm/percDecay, click, leak,
// drive, leslie, plus attack/release/level/gain.
declare name "hammond";
import("stdfaust.lib");

freq   = hslider("freq", 220, 20, 4000, 0.01) : si.smoo;
gate   = button("gate");
level  = hslider("level", 0.4, 0, 1, 0.01);
gain   = hslider("gain", 1, 0, 2, 0.01);

// --- the nine drawbars (0..8 each), the morphable spectrum vector ----------
// footage      harmonic   address
// 16'  sub      x0.5       bar16
// 5-1/3' quint  x1.5       bar513
// 8'   unison   x1.0       bar8     (the played pitch)
// 4'   octave   x2.0       bar4
// 2-2/3' twelfth x3.0      bar223
// 2'   fifteenth x4.0      bar2
// 1-3/5' seventeenth x5.0  bar135
// 1-1/3' nineteenth x6.0   bar113
// 1'   twentysecond x8.0   bar1
bar16  = hslider("bar16",  8, 0, 8, 0.01) : si.smoo;
bar513 = hslider("bar513", 3, 0, 8, 0.01) : si.smoo;
bar8   = hslider("bar8",   8, 0, 8, 0.01) : si.smoo;
bar4   = hslider("bar4",   6, 0, 8, 0.01) : si.smoo;
bar223 = hslider("bar223", 0, 0, 8, 0.01) : si.smoo;
bar2   = hslider("bar2",   0, 0, 8, 0.01) : si.smoo;
bar135 = hslider("bar135", 0, 0, 8, 0.01) : si.smoo;
bar113 = hslider("bar113", 0, 0, 8, 0.01) : si.smoo;
bar1   = hslider("bar1",   0, 0, 8, 0.01) : si.smoo;

leak   = hslider("leak",   0.35, 0, 1, 0.01);   // tonewheel crosstalk floor
drive  = hslider("drive",  0.15, 0, 1, 0.01);   // tube warmth / overdrive

// --- percussion (single-trigger harmonic tap) ------------------------------
perc     = hslider("perc",     0.5, 0, 1,   0.01);   // amount
percHarm  = hslider("percHarm", 0,   0, 1,   0.01);  // 0 = 2nd harmonic, 1 = 3rd
percDecay = hslider("percDecay",0.35,0.05,2, 0.005); // s, decays under held gate

// --- key click -------------------------------------------------------------
click  = hslider("click",  0.25, 0, 1, 0.01);   // note-on transient amount

// --- Leslie speed (morphable): 0 = chorale (slow) .. 1 = tremolo (fast) -----
leslie = hslider("leslie", 0.85, 0, 1, 0.01);

// --- loudness contour (organ: fast on / fast off, full sustain) ------------
attack = hslider("attack", 0.006, 0.001, 0.5, 0.001);
release= hslider("release",0.02,  0.005, 1,   0.005);

// ---------------------------------------------------------------------------
// TONEWHEELS — nine additive sines. bar/8 -> amplitude; a small leak floor is
// added to EVERY wheel so the crosstalk shimmer is present even at drawbar 0.
// Tiny fixed per-wheel detune (the gear-train imperfection) thickens it.
g(b)   = b / 8.0;
fl     = leak * 0.045;
tw(mult, det, b) = os.osc(freq * mult * det) * (g(b) + fl);
wheels = tw(0.5,   0.99980, bar16)
       + tw(1.5,   1.00060, bar513)
       + tw(1.0,   1.00000, bar8)
       + tw(2.0,   0.99970, bar4)
       + tw(3.0,   1.00050, bar223)
       + tw(4.0,   0.99960, bar2)
       + tw(5.0,   1.00070, bar135)
       + tw(6.0,   0.99950, bar113)
       + tw(8.0,   1.00080, bar1);

// PERCUSSION — decays to zero even while the key is held (single-trigger tap).
percEnv  = en.adsr(0.002, percDecay, 0, percDecay, gate);
percTone = os.osc(freq * 2) * (1 - percHarm) + os.osc(freq * 3) * percHarm;
percSig  = percTone * percEnv * perc * 0.9;

// KEY CLICK — a very short bright noise transient at note-on.
clickEnv = en.adsr(0.0004, 0.009, 0, 0.009, gate);
clickSig = (no.noise : fi.highpass(1, 1500)) * clickEnv * click * 0.6;

// organ bus (mono) -> tube -> loudness env
raw    = (wheels * 0.12 + percSig + clickSig);
warm   = raw * (1 + drive * 4) : ma.tanh : *(1 / (1 + drive * 1.5));
env    = en.adsr(attack, 0.01, 1.0, release, gate);
voiced = warm * (env * level * gain);

// ---------------------------------------------------------------------------
// LESLIE — 800 Hz crossover; horn + drum rotors at different rates, each with
// AM (tremolo) and doppler FM (opposite-mic fractional delay) for stereo spin.
// `leslie` speed is smoothed with rotor INERTIA: horn spins up/down faster
// than the heavy bass drum, so the two rates cross-fade at different rates.
rotary(sig) = (hornL + drumL, hornR + drumR)
with {
  horn = sig : fi.highpass(2, 800);
  drum = sig : fi.lowpass(2, 800);
  // speed morph with inertia (horn light, drum heavy)
  spH = leslie : si.smooth(ba.tau2pole(0.9));
  spD = leslie : si.smooth(ba.tau2pole(1.9));
  hRate = 0.80 + spH * (6.70 - 0.80);   // chorale 0.8 Hz -> tremolo 6.7 Hz
  dRate = 0.66 + spD * (5.50 - 0.66);   // bass drum a touch slower
  hph = os.lf_sawpos(hRate);
  dph = os.lf_sawpos(dRate);
  hs  = sin(2 * ma.PI * hph);
  ds  = sin(2 * ma.PI * dph);
  // doppler: opposite mics get opposite delay swings (pitch shimmer)
  hL = horn : de.fdelay(128, 34 + 30 * hs);
  hR = horn : de.fdelay(128, 34 - 30 * hs);
  dL = drum : de.fdelay(128, 14 +  8 * ds);
  dR = drum : de.fdelay(128, 14 -  8 * ds);
  // AM tremolo, opposite phase per mic
  hornL = hL * (1 + 0.50 * hs);
  hornR = hR * (1 - 0.50 * hs);
  drumL = dL * (1 + 0.28 * ds);
  drumR = dR * (1 - 0.28 * ds);
};

process = rotary(voiced);
