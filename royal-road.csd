<CsoundSynthesizer>
; ============================================================================
;  royal-road.csd — a vaporwave sketch built on the Royal Road progression
;
;  THIS FILE IS THE CAPABILITY. The .wav it renders is derived and disposable
;  (see .gitignore). If you can run render.sh and hear it, the capability is
;  intact. If this file is lost, the capability is lost — so it lives in git.
;
;  Harmony:  Royal Road (王道進行) — IVΔ7 · V7 · iii7 · vi7
;            in C major:  Fmaj7 · G7 · Em7 · Am7
;  Feel:     ~70 BPM, detuned saw pads, tape-wow pitch wobble, big hall verb.
;  Verifier: genre-conformance is irreducibly taste (catalog 12.33 / 17.43) —
;            the gate is an A/B against a reference (Macintosh Plus / Mariya
;            Takeuchi "Plastic Love"), not a unit test. The chords are easy;
;            the slowed, chorus-drenched, reverbed TREATMENT is the genre.
; ============================================================================
<CsOptions>
-o vaporwave.wav -W
</CsOptions>
<CsInstruments>
sr     = 44100
ksmps  = 32
nchnls = 2
0dbfs  = 1

; ---- global reverb send buses ----
gaRevL init 0
gaRevR init 0

; ---- found sound: Tokyo Station field recording (radio aporee, Internet
;      Archive — see SOURCES.md). Fetched + trimmed by fetch-found-sound.sh;
;      NOT committed. Deferred-length table (size 0 reads the whole wav). ----
gitokyo ftgen 0, 0, 0, 1, "found/tokyo_station.wav", 0, 0, 1
giwin   ftgen 0, 0, 16384, 20, 2, 1          ; Hanning grain window

; ============================================================================
; instr 1 — pad voice
;   p4 = pitch (pch notation, e.g. 8.04 = E4)   p5 = amplitude
;   Three detuned saws (chorus/width) + a slow tape-wow vibrato + warm lowpass,
;   long swell in and out, wide stereo, generous reverb send.
; ============================================================================
instr 1
  ipch  = cpspch(p4)
  iamp  = p5

  ; slow tape-wow pitch wobble (~0.3 Hz, a few cents either way)
  kwow  lfo   ipch * 0.004, 0.3, 0
  kfreq =     ipch + kwow

  ; long, lazy per-note swell (release segment hands the tail to the verb)
  aenv  linsegr 0, 1.5, iamp, p3 - 1.5, iamp * 0.8, 2.5, 0

  ; three detuned saws
  a1    vco2  1, kfreq * 0.994, 0
  a2    vco2  1, kfreq * 1.000, 0
  a3    vco2  1, kfreq * 1.006, 0
  asig  =     (a1 + a2 + a3) * 0.33

  ; warm lowpass — keep it hazy
  asig  moogladder asig, 1400, 0.15
  asig  =     asig * aenv

  outs  asig * 0.7, asig * 0.7

  ; reverb send
  gaRevL = gaRevL + asig * 0.55
  gaRevR = gaRevR + asig * 0.55
endin

; ============================================================================
; instr 2 — lazy root bass (one note per chord, an octave or two down)
; ============================================================================
instr 2
  ipch  = cpspch(p4)
  iamp  = p5
  aenv  linsegr 0, 0.08, iamp, p3 - 0.2, iamp, 0.4, 0
  a1    vco2  1, ipch, 0
  a1    moogladder a1, 450, 0.1
  asig  =     a1 * aenv
  outs  asig, asig
  gaRevL = gaRevL + asig * 0.1
  gaRevR = gaRevR + asig * 0.1
endin

; ============================================================================
; instr 3 — found sound, granular-stretched + pitched down, into the haze
;   p4 = unused   p5 = amplitude
;   syncgrain scans the Tokyo Station table slowly (kprate < 1 = time-stretch)
;   at a lowered pitch (~4-5 semitones down) — the city smeared into texture,
;   warmed by a lowpass and sent generously to the reverb so it "sits in the
;   haze" rather than playing dry.
; ============================================================================
instr 3
  iamp  = p5
  aenv  linsegr 0, 1.5, iamp, p3 - 3.0, iamp, 1.5, 0
  ;            amp   grainfreq pitch grsize prate  src      win    olaps
  asig  syncgrain iamp, 28, 0.78, 0.12, 0.45, gitokyo, giwin, 100
  asig  moogladder asig, 2600, 0.1
  asig  =     asig * aenv
  outs  asig * 0.55, asig * 0.55
  gaRevL = gaRevL + asig * 0.6
  gaRevR = gaRevR + asig * 0.6
endin

; ============================================================================
; instr 99 — always-on big hall reverb
; ============================================================================
instr 99
  aL, aR reverbsc gaRevL, gaRevR, 0.88, 12000
  outs   aL, aR
  clear  gaRevL, gaRevR
endin

</CsInstruments>
<CsScore>
t 0 70                      ; ~70 BPM — slow it down

i 99 0  84                  ; reverb running for the whole piece + tail

; A vaporwave move: the found city plays ALONE at the edges, the band drops
; out for an interlude, then crashes back. Structure (beats, t=70):
;   intro  0-8   : Tokyo Station solo
;   passI  8-40  : Royal Road, Fmaj7-G7-Em7-Am7
;   inter 40-48  : Tokyo Station solo (band out)
;   passII 48-80 : Royal Road again
;   outro 80-88  : Tokyo Station alone, fading
; A quiet found-sound BED runs underneath the whole thing for haze.
; pch: .00=C .02=D .04=E .05=F .07=G .09=A .11=B ; octave 8 = middle-C octave.

; ---- found sound: quiet bed + three featured solos ----
i 3 0   88 0 0.06           ; haze bed, whole piece
i 3 0   8  0 0.42           ; intro solo
i 3 40  8  0 0.42           ; interlude solo (band out)
i 3 80  8  0 0.42           ; outro solo, fading

; ---- Pass I ----
; Fmaj7 (F A C E)
i 1 8   8  7.05 0.10
i 1 8   8  7.09 0.10
i 1 8   8  8.00 0.10
i 1 8   8  8.04 0.10
i 2 8   8  5.05 0.22
; G7 (G B D F)
i 1 16  8  7.07 0.10
i 1 16  8  7.11 0.10
i 1 16  8  8.02 0.10
i 1 16  8  8.05 0.10
i 2 16  8  5.07 0.22
; Em7 (E G B D)
i 1 24  8  7.04 0.10
i 1 24  8  7.07 0.10
i 1 24  8  7.11 0.10
i 1 24  8  8.02 0.10
i 2 24  8  5.04 0.22
; Am7 (A C E G)
i 1 32  8  7.09 0.10
i 1 32  8  8.00 0.10
i 1 32  8  8.04 0.10
i 1 32  8  8.07 0.10
i 2 32  8  5.09 0.22

; ---- Pass II (after the interlude) ----
; Fmaj7
i 1 48  8  7.05 0.10
i 1 48  8  7.09 0.10
i 1 48  8  8.00 0.10
i 1 48  8  8.04 0.10
i 2 48  8  5.05 0.22
; G7
i 1 56  8  7.07 0.10
i 1 56  8  7.11 0.10
i 1 56  8  8.02 0.10
i 1 56  8  8.05 0.10
i 2 56  8  5.07 0.22
; Em7
i 1 64  8  7.04 0.10
i 1 64  8  7.07 0.10
i 1 64  8  7.11 0.10
i 1 64  8  8.02 0.10
i 2 64  8  5.04 0.22
; Am7
i 1 72  8  7.09 0.10
i 1 72  8  8.00 0.10
i 1 72  8  8.04 0.10
i 1 72  8  8.07 0.10
i 2 72  8  5.09 0.22

e
</CsScore>
</CsoundSynthesizer>
