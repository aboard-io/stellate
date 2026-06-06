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
; instr 2 — bass voice (now plays a moving, syncopated line — see score macro)
;   Pluckier envelope so repeated notes articulate instead of smearing.
; ============================================================================
instr 2
  ipch  = cpspch(p4)
  iamp  = p5
  aenv  linsegr 0, 0.012, iamp, p3 - 0.05, iamp * 0.5, 0.10, 0
  a1    vco2  1, ipch, 0
  a1    moogladder a1, 700, 0.15
  asig  =     a1 * aenv
  outs  asig, asig
  gaRevL = gaRevL + asig * 0.08
  gaRevR = gaRevR + asig * 0.08
endin

; ============================================================================
; instr 4 — lead melody. Two detuned sines + a soft octave partial, gentle
;   vibrato, a little attack, sent to the reverb. Sits above the pads, the
;   bittersweet top line over the Royal Road.
; ============================================================================
instr 4
  ipch  = cpspch(p4)
  iamp  = p5
  kvib  lfo   ipch * 0.006, 5.2, 0       ; gentle vibrato
  kf    =     ipch + kvib
  aenv  linsegr 0, 0.05, iamp, p3 - 0.12, iamp * 0.85, 0.30, 0
  a1    oscili 1, kf
  a2    oscili 1, kf * 1.004              ; slight detune shimmer
  a3    oscili 0.16, kf * 2               ; soft octave for sheen
  asig  =     (a1 + a2) * 0.5 + a3
  asig  moogladder asig, 3400, 0.05
  asig  =     asig * aenv
  outs  asig * 0.6, asig * 0.6
  gaRevL = gaRevL + asig * 0.45
  gaRevR = gaRevR + asig * 0.45
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

; Structure (beats, t=70):
;   intro  0-8   : Tokyo Station solo
;   passI  8-40  : Royal Road — pads + moving bass + lead melody
;   inter 40-48  : Tokyo Station solo (band out)
;   passII 48-80 : Royal Road again
;   outro 80-88  : Tokyo Station alone, fading
; A quiet found-sound BED runs underneath for haze.
; pch: .00=C .02=D .04=E .05=F .07=G .09=A .11=B ; octave 8 = middle-C octave.

; --- PAD(start' 4 chord tones) : the held Royal Road voicing ---
#define PAD(S'N1'N2'N3'N4) #
i 1 $S 8 $N1 0.085
i 1 $S 8 $N2 0.085
i 1 $S 8 $N3 0.085
i 1 $S 8 $N4 0.085 #

; --- BASS(start' root5' octave-root6' fifth6) : syncopated city-pop figure ---
#define BASS(S'R5'R6'F6) #
i 2 [$S+0]   1.5 $R5 0.22
i 2 [$S+2]   0.5 $R6 0.18
i 2 [$S+3]   1.0 $F6 0.18
i 2 [$S+4.5] 0.5 $R5 0.22
i 2 [$S+5]   1.0 $R6 0.18
i 2 [$S+6.5] 1.5 $R5 0.22 #

; --- MEL(passStart) : the lead line across all four chords of a pass ---
#define MEL(O) #
i 4 [$O+0]    1.5 8.09 0.14
i 4 [$O+1.5]  0.5 8.07 0.14
i 4 [$O+2]    1.0 8.09 0.14
i 4 [$O+3]    2.0 9.00 0.14
i 4 [$O+5]    1.5 9.04 0.14
i 4 [$O+6.5]  1.5 9.02 0.14
i 4 [$O+8]    1.0 9.02 0.14
i 4 [$O+9]    1.0 8.11 0.14
i 4 [$O+10]   2.0 8.07 0.14
i 4 [$O+12]   1.0 8.09 0.14
i 4 [$O+13]   1.0 8.11 0.14
i 4 [$O+14]   2.0 9.02 0.14
i 4 [$O+16]   1.5 9.04 0.14
i 4 [$O+17.5] 0.5 9.02 0.14
i 4 [$O+18]   2.0 8.11 0.14
i 4 [$O+20]   1.5 8.07 0.14
i 4 [$O+21.5] 0.5 8.09 0.14
i 4 [$O+22]   2.0 8.11 0.14
i 4 [$O+24]   1.0 9.00 0.14
i 4 [$O+25]   1.0 8.11 0.14
i 4 [$O+26]   2.0 8.09 0.14
i 4 [$O+28]   1.5 9.04 0.14
i 4 [$O+29.5] 0.5 9.00 0.14
i 4 [$O+30]   2.0 8.09 0.14 #

i 3 0   88 0 0.06           ; found-sound haze bed, whole piece
i 99 0  88                  ; reverb running for the whole piece + tail

; ---- intro: city alone ----
i 3 0   8  0 0.42

; ---- Pass I (Fmaj7 G7 Em7 Am7) ----
$PAD(8'7.05'7.09'8.00'8.04)   $BASS(8'5.05'6.05'6.00)
$PAD(16'7.07'7.11'8.02'8.05)  $BASS(16'5.07'6.07'6.02)
$PAD(24'7.04'7.07'7.11'8.02)  $BASS(24'5.04'6.04'5.11)
$PAD(32'7.09'8.00'8.04'8.07)  $BASS(32'5.09'6.09'6.04)
$MEL(8)

; ---- interlude: city alone (band out) ----
i 3 40  8  0 0.42

; ---- Pass II ----
$PAD(48'7.05'7.09'8.00'8.04)  $BASS(48'5.05'6.05'6.00)
$PAD(56'7.07'7.11'8.02'8.05)  $BASS(56'5.07'6.07'6.02)
$PAD(64'7.04'7.07'7.11'8.02)  $BASS(64'5.04'6.04'5.11)
$PAD(72'7.09'8.00'8.04'8.07)  $BASS(72'5.09'6.09'6.04)
$MEL(48)

; ---- outro: city alone, fading ----
i 3 80  8  0 0.42

e
</CsScore>
</CsoundSynthesizer>
