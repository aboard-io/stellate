#!/usr/bin/env python3
# sing.py — make the speech synthesizer SING, the intelligible way: WORLD-vocoder F0
# replacement. We analyze the REAL espeak speech into pitch (F0) + spectral envelope (the
# formants/vowels) + aperiodicity (the breath/consonants), then swap ONLY the F0 for the
# melody note and resynthesize. The words stay fully intelligible (their formants and
# unvoiced consonants are untouched) — they just sing the tune. Per-syllable pitch, exact.
#
#   .venv-sing/bin/python sing.py            -> sung-melody.wav
#
# Requires: espeak-ng, ffmpeg, and pyworld+numpy+soundfile (in .venv-sing).
import subprocess, tempfile, os, sys, numpy as np, soundfile as sf, pyworld as pw

HERE = os.path.dirname(os.path.abspath(__file__))
def _arg(name, default):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default

FS = 44100
BPM = float(_arg("--bpm", 112))         # match the track tempo
TRANSPOSE = int(_arg("--transpose", -12))  # octave/key: keyOffset - 12 to sit an octave down in the track's key
OUT = _arg("--out", os.path.join(HERE, "sung-melody.wav"))
SPB = 60.0 / BPM
FP = 5.0                                # WORLD frame period (ms)

# the 8-bar chorus: [word, midiNote, beat, durBeats]. Rhymes (fare/care/stare/share) on E.
MELODY = [
  ("when",69,0,1),("i",67,1,1),("pay",65,2,2),   ("my",64,4,1),("train",62,5,1),("fare",64,6,2),
  ("i",69,8,1),("dont",67,9,1),("have",65,10,2),  ("to",64,12,1),("think",62,13,1),("or",60,14,1),("care",64,15,1),
  ("when",67,16,1),("you",67,17,1),("see",69,18,1),("me",69,19,1), ("you",67,20,1),("can",65,21,1),("stare",64,22,2),
  ("we",60,24,1),("can",64,25,1),("take",69,26,2), ("the",67,28,1),("train",65,29,1),("and",62,30,1),("share",64,31,1),
]

def midi_hz(m, tr): return 440.0 * 2.0 ** ((m + tr - 69) / 12.0)
ALPHA = 0.045   # portamento one-pole; lower = more legato

def espeak_token(token, voice):
    raw = tempfile.mktemp(suffix=".wav"); wav = tempfile.mktemp(suffix=".wav")
    subprocess.run(["espeak-ng","-v",voice,"-p","45","-s","140","-w",raw,token], check=True)
    subprocess.run(["ffmpeg","-y","-v","error","-i",raw,"-ar",str(FS),"-ac","1",wav], check=True)
    x, _ = sf.read(wav); os.remove(raw); os.remove(wav)
    return np.ascontiguousarray(x.astype(np.float64))

def build_voice(items, transpose, voice="en-us", octave_down=0.0):
    """WORLD-resynthesize a [(token,midi,beat,dur)] line: analyze each token, stretch to its
    note, concatenate into one continuous stream, glide the F0 (legato) and resynthesize."""
    SP, AP, vl, nl = [], [], [], []
    for token, midi, beat, dur in items:
        x = espeak_token(token, voice)
        f0, sp, ap = pw.wav2world(x, FS, frame_period=FP)
        nf = max(3, int(round(dur * SPB / (FP / 1000.0))))
        idx = np.linspace(0, len(f0) - 1, nf)
        lo = np.floor(idx).astype(int); hi = np.minimum(lo + 1, len(f0) - 1); fr = (idx - lo)
        f0s = f0[lo] * (1 - fr) + f0[hi] * fr
        SP.append(sp[lo] * (1 - fr)[:, None] + sp[hi] * fr[:, None])
        AP.append(ap[lo] * (1 - fr)[:, None] + ap[hi] * fr[:, None])
        vl.append(f0s > 0); nl.append(np.full(nf, midi_hz(midi, transpose)))
    SP = np.ascontiguousarray(np.concatenate(SP)); AP = np.ascontiguousarray(np.concatenate(AP))
    voiced = np.concatenate(vl); note = np.concatenate(nl); N = len(note)
    k = np.array([0.12, 0.22, 0.32, 0.22, 0.12])                       # formant smoothing -> legato vowels
    SP = np.ascontiguousarray(np.apply_along_axis(lambda c: np.convolve(c, k, "same"), 0, SP))
    glide = np.empty(N); g = note[0]
    for i in range(N): g += ALPHA * (note[i] - g); glide[i] = g
    vib = 1.0 + 0.010 * np.sin(2*np.pi*5.0 * np.arange(N) * FP/1000.0)
    f0 = np.where(voiced, glide * vib, 0.0)
    y = pw.synthesize(np.ascontiguousarray(f0), SP, AP, FS, frame_period=FP)
    if octave_down > 0:
        f0lo = np.where(voiced, glide * vib * 0.5, 0.0)
        y = y + octave_down * pw.synthesize(np.ascontiguousarray(f0lo), SP, AP, FS, frame_period=FP)
    return y

# LEAD — the lyric, low (transpose), with an octave-down double underneath
lead = build_voice(MELODY, TRANSPOSE, "en-us", octave_down=0.62)

# FEMALE CHOIR — oohs + lahs harmonizing the chorus, an octave up (CHOIR_TR) over the chords
# Am7 - Fmaj7 - Cmaj7 - G7 (one chord per 8-beat bar). Two "ooh" voices + a "lah" descant.
CHOIR_TR = TRANSPOSE + 12
CHOIR = [
  ("ooh", [(69,0,8),(65,8,8),(67,16,8),(67,24,8)]),   # A4  F4  G4  G4
  ("ooh", [(72,0,8),(69,8,8),(72,16,8),(71,24,8)]),   # C5  A4  C5  B4
  ("lah", [(76,0,8),(72,8,8),(76,16,8),(74,24,8)]),   # E5  C5  E5  D5  (descant)
]
mix = lead.copy()
for vowel, line in CHOIR:
    yc = build_voice([(vowel, m, b, d) for (m, b, d) in line], CHOIR_TR, "en-us+f4")
    L = min(len(mix), len(yc)); mix[:L] += 0.4 * yc[:L]

mix = mix / (np.max(np.abs(mix)) + 1e-9) * 0.92
if OUT.lower().endswith(".mp3"):
    # tw_vocal ships as MP3 (HOSTING.md §3) — libsndfile MP3 write support is
    # build-dependent, so write a temp WAV and let ffmpeg (already a dependency)
    # do the encode: mono 44.1k, libmp3lame V2, same recipe as the beds.
    tmp = tempfile.mktemp(suffix=".wav")
    sf.write(tmp, mix.astype(np.float32), FS)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", tmp,
                    "-codec:a", "libmp3lame", "-q:a", "2", "-ac", "1", "-ar", str(FS), OUT], check=True)
    os.remove(tmp)
else:
    sf.write(OUT, mix.astype(np.float32), FS)
print(f"✓ {os.path.basename(OUT)}  (lead {len(MELODY)}w + female choir, {len(mix)/FS:.1f}s @ {BPM:g}bpm, transpose {TRANSPOSE:+d})")
