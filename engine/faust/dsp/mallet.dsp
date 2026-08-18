// mallet — A STRUCK BAR OVER A TUBE, which is what a marimba, a vibraphone and
// a kalimba tine all are: a stiff bar with inharmonic modes, a resonator under
// it, and a mallet whose HARDNESS decides which modes speak. That last part is
// the whole reason this exists. On a sampled mallet the velocity column is a
// fader: the same recording of the same rubber head, quieter. On a bar, a soft
// yarn mallet excites the fundamental and almost nothing else, and a hard
// plastic one rings the second and third bar modes where the CLICK lives.
// Measured on the tape at equal loudness, over MIDI 67-79 (where a marimba
// lives), a ghosted note reads 2252 Hz of spectral centroid and a hammered one
// 3722 — the same instrument played two ways, not two volumes. The sampled zone
// it replaces measures 922 against 940: no change at all, because there is only
// one recording in there. Low on the instrument the claim weakens honestly —
// under middle C the resonator tube is the loudest thing in the note and the
// mallet's own noise is buried under it, which is also true of the real bar.
//
// pm.marimbaModel hard-codes its bar decay at maxT60 0.1 s, which is not even a
// marimba — a bar that has stopped before the player's hand has, and 14 dB down
// on the tape for that reason alone. The bar model is called directly below so
// `ring` can be a parameter: 0.5 s is a rosewood marimba, 0.8 a kalimba tine,
// 2.2 a vibraphone with the pedal down.
//
// exPos is a POSITION ON THE BAR (0-4 in the library's own units), and it is a
// real articulation, not a tone control: struck at a node (0) the fundamental
// is missing and the bar reads as a click; struck at 1, off-centre, it speaks.
// 1 is the default because it is where a player hits.
declare name "mallet";
import("stdfaust.lib");

freq   = hslider("freq", 440, 40, 4000, 0.01);
gate   = button("gate");
hard   = hslider("hard", 0.45, 0, 1, 0.01);      // MALLET HARDNESS = velocity
exPos  = hslider("exPos", 1, 0, 4, 0.01);        // where on the bar it lands
ring   = hslider("ring", 0.1, 0.02, 3, 0.001);   // bar decay, seconds
tilt   = hslider("tilt", 5, 1, 12, 0.1);         // how much faster the high modes die
cutoff = hslider("cutoff", 9000, 400, 16000, 1) : si.smoo;
level  = hslider("level", 0.5, 0, 1, 0.01);
gain   = hslider("gain", 0.4, 0, 2, 0.01);

// THE MALLET. strikeModel(HPcutoff, LPcutoff, sharpness, gain, trigger): a
// filtered noise burst. `hard` opens the burst's lowpass from 1.4 kHz (yarn) to
// 12.6 kHz (plastic) AND shortens it — a hard head is in contact for less time,
// which is why it excites the modes a soft one cannot reach.
// The strike's gain is compensated for its own LENGTH (sqrt of the ratio,
// energy going as amplitude squared times time) for the same reason the guitar's
// pluck is: the library scales the burst's AMPLITUDE, so shortening it takes
// energy out, and measured on the tape a hammered note came back 0.1 dB louder
// than a ghosted one — all timbre and no force, which is only half true.
msharp = 0.45 - hard*0.36;
mallet = pm.strikeModel(10, 1400.0 + hard*11200.0, msharp, sqrt(0.45/msharp), gate);

// the bar's own modes, then the tube under it. THE LIBRARY'S TUBE IS FLAT: it
// takes f2l(freq) at face value and ignores its own loop delay, so under the
// bottom two octaves the resonator sings a sixth of a semitone to two semitones
// under the bar it is supposed to reinforce, and being the loudest thing in the
// note it wins. Measured on this chain the extra delay is a constant 0.242 m
// (31.4 samples at 44.1 kHz, hence the ma.SR form) — subtracted, the tube
// agrees with the bar everywhere instead of only above middle C.
tubeL = max(0.05, pm.f2l(freq) - 31.4*pm.speedOfSound/ma.SR);
bar = pm.marimbaBarModel(freq, exPos, ring, 1, tilt) : pm.marimbaResTube(tubeL);

// THE DAMPER. A marimba bar cannot be stopped and its default release says so
// (1.5 s is longer than the bar rings, so note-off is inaudible); a vibraphone
// has a pedal and a music box a comb stop, and those write it short. The 0.3 ms
// attack is under the strike's own rise, so it shapes nothing.
release = hslider("release", 1.5, 0.02, 3, 0.005);
env = en.asr(0.0003, 1, release, gate);

// *3.6: the bar model runs about 11 dB under the sampled zones it stands in for
// (A/B measured through the same recipe level and the same master chain).
process = mallet : bar : fi.lowpass(2, max(300.0, min(cutoff, 16000.0)))
        : *(env*gain*level*3.6) : fi.dcblocker;
