#!/usr/bin/env python3
# classify-sample-cd.py — the analyzer half of the "incorporate a sample CD"
# pipeline (tools/fetch/fetch-sample-cd.sh). Sample CDs like Fatboy Slim's "Skip to My
# Loops" ship WAVs with generic names (Sample_12.wav) and no pitch/bpm/label
# metadata — so we recover it here. numpy + scipy only (librosa/aubio are NOT
# installed in this repo).
#
# For every mono WAV in a directory it computes: duration, RMS, spectral
# centroid, a YIN pitch estimate + clarity, and an onset-autocorrelation BPM,
# then classifies each into loop / tonal / oneshot / chop:
#     dur>=1.6 and bpm>=80          -> "loop"    (a rhythmic phrase)
#     clarity>=0.80 and 60<f0<900   -> "tonal"   (a pitched stab/note)
#     centroid<2500 and dur<1.6     -> "oneshot" (a dark percussive hit)
#     else                          -> "chop"    (everything else)
# Samples under 0.12s are dropped (near-empty trim residue).
#
# Usage:
#   python3 tools/fetch/classify-sample-cd.py <dir-of-wavs> [--json out.json]
# Prints a JSON array of per-file records to stdout (and optionally a file):
#   [{"file":"Sample_1.wav","class":"loop","dur":3.45,"rms":0.12,
#     "centroid":1840,"f0":0,"clarity":0.41,"bpm":133,"note":null}, ...]
import numpy as np, scipy.io.wavfile as wav, glob, os, json, sys

NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']

def note(f):
    if f <= 0: return None
    m = int(round(69 + 12*np.log2(f/440.0)))
    return NOTES[m % 12] + str(m//12 - 1)

def pitch_yin(x, sr, fmin=60, fmax=1000):
    w = int(0.09*sr); c = len(x)//2
    seg = x[max(0, c-w):c+w].astype(np.float64)
    if len(seg) < 200: return 0, 0
    tmax = int(sr/fmin); tmin = int(sr/fmax); d = np.zeros(tmax+1)
    for tau in range(1, tmax+1):
        diff = seg[:-tau] - seg[tau:]; d[tau] = np.dot(diff, diff)
    cmnd = np.zeros(tmax+1); cmnd[0] = 1; run = 0
    for tau in range(1, tmax+1):
        run += d[tau]; cmnd[tau] = d[tau]*tau/run if run > 0 else 1
    best = tmin; bestv = 1e9
    for t in range(tmin, tmax+1):
        if cmnd[t] < bestv: bestv = cmnd[t]; best = t
    return (sr/best if best > 0 else 0), max(0.0, 1.0 - bestv)

def spectral_centroid(x, sr):
    if len(x) < 256: return 0.0
    win = x.astype(np.float64) * np.hanning(len(x))
    mag = np.abs(np.fft.rfft(win))
    freqs = np.fft.rfftfreq(len(win), 1.0/sr)
    s = mag.sum()
    return float((freqs*mag).sum()/s) if s > 0 else 0.0

def bpm_est(x, sr):
    hop = 512; frames = len(x)//hop
    if frames < 8: return 0
    env = np.array([np.sqrt(np.mean(x[i*hop:(i+1)*hop]**2.0)) for i in range(frames)])
    env = np.maximum(0, np.diff(env))
    if env.std() < 1e-6: return 0
    env = (env - env.mean())/(env.std() + 1e-9)
    ac = np.correlate(env, env, 'full')[len(env)-1:]
    fps = sr/hop; lo = int(fps*60/180); hi = min(int(fps*60/70), len(ac)-1)
    if lo < 1 or hi <= lo: return 0
    pk = np.argmax(ac[lo:hi]) + lo
    return 60.0*fps/pk if pk > 0 else 0

def load_mono(path):
    sr, data = wav.read(path)
    if data.dtype == np.int16: x = data.astype(np.float64)/32768.0
    elif data.dtype == np.int32: x = data.astype(np.float64)/2147483648.0
    elif data.dtype == np.uint8: x = (data.astype(np.float64)-128)/128.0
    else: x = data.astype(np.float64)
    if x.ndim > 1: x = x.mean(axis=1)
    return sr, x

def classify_file(path):
    sr, x = load_mono(path)
    dur = len(x)/sr if sr else 0.0
    if dur < 0.12:
        return {"file": os.path.basename(path), "class": "drop", "dur": round(dur, 3)}
    rms = float(np.sqrt(np.mean(x**2))) if len(x) else 0.0
    cen = spectral_centroid(x, sr)
    f0, clar = pitch_yin(x, sr)
    bpm = bpm_est(x, sr)
    # octave-error correction: a loop clocked implausibly fast (>170) whose half
    # lands in the danceable 80-140 band is almost always a double-count.
    if bpm > 170 and 80 <= bpm/2 <= 140: bpm = bpm/2
    if dur >= 1.6 and bpm >= 80:                 cls = "loop"
    elif clar >= 0.80 and 60 < f0 < 900:         cls = "tonal"
    elif cen < 2500 and dur < 1.6:               cls = "oneshot"
    else:                                        cls = "chop"
    rec = {"file": os.path.basename(path), "class": cls, "dur": round(dur, 3),
           "rms": round(rms, 4), "centroid": round(cen, 1),
           "f0": round(f0, 1), "clarity": round(clar, 3), "bpm": round(bpm, 1)}
    if cls == "loop":  rec["bpm_round"] = int(round(bpm))
    if cls == "tonal": rec["note"] = note(f0)
    if cls == "chop" and 60 < f0 < 900 and clar >= 0.55: rec["note"] = note(f0)
    return rec

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    out_path = None
    if "--json" in sys.argv:
        out_path = sys.argv[sys.argv.index("--json")+1]
    if not args:
        print("usage: classify-sample-cd.py <dir> [--json out.json]", file=sys.stderr); sys.exit(2)
    d = args[0]
    files = sorted(glob.glob(os.path.join(d, "*.wav")))
    recs = [classify_file(p) for p in files]
    js = json.dumps(recs, indent=1)
    if out_path:
        open(out_path, "w").write(js)
    print(js)

if __name__ == "__main__":
    main()
