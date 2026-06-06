<CsoundSynthesizer>
; ============================================================================
;  royal-road.csd — a vaporwave sketch built on the Royal Road progression
;
;  THIS FILE IS THE CAPABILITY. The .wav/.mp3 it renders are derived and
;  disposable (see .gitignore); the found sound is fetched, not stored. If you
;  can run fetch-found-sound.sh + render.sh and hear it, the capability is
;  intact. So this file lives in git.
;
;  Harmony:  Royal Road (王道進行) — IVΔ7·V7·iii7·vi7 = Fmaj7·G7·Em7·Am7 in C.
;  Build:    nothing starts at once. The city plays alone, then pads enter,
;            then bass, then a kick pulse, then the full kit + melody; a
;            stripped interlude, a full reprise, and the city alone to fade.
;  Found:    Tokyo Station field recording (radio aporee / Internet Archive),
;            granular-stretched + pitched down through syncgrain into the verb.
;  Verifier: "is this vaporwave" is irreducibly taste (catalog 12.33 / 17.43) —
;            the gate is an A/B vs a reference (Macintosh Plus / Mariya
;            Takeuchi "Plastic Love"), not a unit test.
; ============================================================================
<CsOptions>
-o vaporwave.wav -W
</CsOptions>
<CsInstruments>
sr     = 44100
ksmps  = 32
nchnls = 2
0dbfs  = 1

; ---- buses: a reverb send and a master mix (master applies a soft limiter) ----
gaRevL init 0
gaRevR init 0
gaMixL init 0
gaMixR init 0

; ---- found sound: Tokyo Station (radio aporee, Internet Archive — SOURCES.md).
;      Fetched + trimmed by fetch-found-sound.sh; NOT committed. ----
gitokyo ftgen 0, 0, 0, 1, "found/tokyo_station.wav", 0, 0, 1
giwin   ftgen 0, 0, 16384, 20, 2, 1          ; Hanning grain window

; ============================================================================
; instr 1 — pad voice (detuned saws, tape-wow vibrato, warm lowpass, long swell)
;   p4 = pitch (pch)   p5 = amplitude
; ============================================================================
instr 1
  ipch  = cpspch(p4)
  iamp  = p5
  kwow  lfo   ipch * 0.004, 0.3, 0           ; slow tape-wow
  kfreq =     ipch + kwow
  aenv  linsegr 0, 1.5, iamp, p3 - 1.5, iamp * 0.8, 2.5, 0
  a1    vco2  1, kfreq * 0.994, 0
  a2    vco2  1, kfreq * 1.000, 0
  a3    vco2  1, kfreq * 1.006, 0
  asig  =     (a1 + a2 + a3) * 0.33
  asig  moogladder asig, 1400, 0.15
  asig  =     asig * aenv
  gaMixL = gaMixL + asig * 0.7
  gaMixR = gaMixR + asig * 0.7
  gaRevL = gaRevL + asig * 0.55
  gaRevR = gaRevR + asig * 0.55
endin

; ============================================================================
; instr 2 — bass voice (syncopated moving line; pluckier envelope)
; ============================================================================
instr 2
  ipch  = cpspch(p4)
  iamp  = p5
  aenv  linsegr 0, 0.012, iamp, p3 - 0.05, iamp * 0.5, 0.10, 0
  a1    vco2  1, ipch, 0
  a1    moogladder a1, 700, 0.15
  asig  =     a1 * aenv
  gaMixL = gaMixL + asig
  gaMixR = gaMixR + asig
  gaRevL = gaRevL + asig * 0.08
  gaRevR = gaRevR + asig * 0.08
endin

; ============================================================================
; instr 3 — found sound, granular-stretched + pitched down, into the haze
; ============================================================================
instr 3
  iamp  = p5
  aenv  linsegr 0, 1.5, iamp, p3 - 3.0, iamp, 1.5, 0
  asig  syncgrain iamp, 28, 0.78, 0.12, 0.45, gitokyo, giwin, 100
  asig  moogladder asig, 2600, 0.1
  asig  =     asig * aenv
  gaMixL = gaMixL + asig * 0.55
  gaMixR = gaMixR + asig * 0.55
  gaRevL = gaRevL + asig * 0.6
  gaRevR = gaRevR + asig * 0.6
endin

; ============================================================================
; instr 4 — lead melody (detuned sines + soft octave, vibrato, reverb send)
; ============================================================================
instr 4
  ipch  = cpspch(p4)
  iamp  = p5
  kvib  lfo   ipch * 0.006, 5.2, 0
  kf    =     ipch + kvib
  aenv  linsegr 0, 0.05, iamp, p3 - 0.12, iamp * 0.85, 0.30, 0
  a1    oscili 1, kf
  a2    oscili 1, kf * 1.004
  a3    oscili 0.16, kf * 2
  asig  =     (a1 + a2) * 0.5 + a3
  asig  moogladder asig, 3400, 0.05
  asig  =     asig * aenv
  gaMixL = gaMixL + asig * 0.6
  gaMixR = gaMixR + asig * 0.6
  gaRevL = gaRevL + asig * 0.45
  gaRevR = gaRevR + asig * 0.45
endin

; ============================================================================
; DRUMS — synthesized kit. p5 = amplitude.
; ============================================================================
; instr 10 — kick: sine with a fast pitch drop + percussive decay
instr 10
  iamp  = p4                                ; amp is p4 for drums (no pitch p-field)
  kp    expseg 110, 0.06, 46, p3 - 0.06, 40
  aenv  transeg 1, p3, -4, 0
  a1    oscili iamp * aenv, kp
  a1    =     tanh(a1 * 1.4) * 0.8           ; gentle saturation / weight
  gaMixL = gaMixL + a1
  gaMixR = gaMixR + a1
  gaRevL = gaRevL + a1 * 0.04
  gaRevR = gaRevR + a1 * 0.04
endin

; instr 11 — snare / rimshot: band-passed noise + two soft tones
instr 11
  iamp  = p4
  aenv  transeg 1, p3, -6, 0
  anz   noise  iamp, 0
  anz   butbp  anz, 1800, 1600
  at1   oscili iamp * 0.5, 300
  at2   oscili iamp * 0.3, 185
  asig  =     (anz + at1 + at2) * aenv
  gaMixL = gaMixL + asig
  gaMixR = gaMixR + asig
  gaRevL = gaRevL + asig * 0.18
  gaRevR = gaRevR + asig * 0.18
endin

; instr 12 — hi-hat: high-passed noise, very short
instr 12
  iamp  = p4
  aenv  transeg 1, p3, -8, 0
  anz   noise  iamp, 0
  anz   buthp  anz, 7000
  asig  =     anz * aenv
  gaMixL = gaMixL + asig * 0.7
  gaMixR = gaMixR + asig * 0.7
endin

; ============================================================================
; instr 99 — big hall reverb, summed into the master mix
; ============================================================================
instr 99
  aL, aR reverbsc gaRevL, gaRevR, 0.85, 12000
  gaMixL = gaMixL + aL
  gaMixR = gaMixR + aR
  clear  gaRevL, gaRevR
endin

; ============================================================================
; instr 100 — master bus: soft-limit so stacked layers never hard-clip
; ============================================================================
instr 100
  aL    clip  gaMixL, 0, 0.95
  aR    clip  gaMixR, 0, 0.95
  outs  aL, aR
  clear gaMixL, gaMixR
endin

</CsInstruments>
<CsScore>
t 0 88                      ; ~88 BPM — slowed, but with a pulse

; ----------------------------------------------------------------------------
; Build (beats, t=70). Each chord = 8 beats; a full Royal Road cycle = 32.
;   intro   0- 16 : city alone (found sound)
;   cyc A  16- 48 : + pads
;   cyc B  48- 80 : + bass
;   cyc C  80-112 : + kick pulse (drums creep in)
;   cyc D 112-144 : + full kit + melody  (everything)
;   inter 144-160 : band out, city alone
;   cyc E 160-192 : full reprise
;   outro 192-208 : city alone, fading
; pch: .00=C .02=D .04=E .05=F .07=G .09=A .11=B ; octave 8 = middle-C octave.
; ----------------------------------------------------------------------------

; A chord = 8 beats. Macros take a literal start beat and do their own
; (single-bracket) arithmetic, so nothing nests.

#define PAD(S'N1'N2'N3'N4) #
i 1 $S 8 $N1 0.085
i 1 $S 8 $N2 0.085
i 1 $S 8 $N3 0.085
i 1 $S 8 $N4 0.085 #

#define BASS(S'R5'R6'F6) #
i 2 [$S+0]   1.5 $R5 0.22
i 2 [$S+2]   0.5 $R6 0.18
i 2 [$S+3]   1.0 $F6 0.18
i 2 [$S+4.5] 0.5 $R5 0.22
i 2 [$S+5]   1.0 $R6 0.18
i 2 [$S+6.5] 1.5 $R5 0.22 #

; kick-only pulse for the "drums creeping in" cycle
#define DRUMKICK(S) #
i 10 [$S+0]   0.35 0.65
i 10 [$S+4]   0.35 0.65
i 12 [$S+3.5] 0.10 0.10
i 12 [$S+7.5] 0.10 0.10 #

; full kit: kick + backbeat snare + eighth-note hats
#define DRUMS(S) #
i 10 [$S+0]   0.35 0.65
i 10 [$S+2.5] 0.30 0.38
i 10 [$S+4]   0.35 0.65
i 10 [$S+6.5] 0.30 0.38
i 11 [$S+2]   0.30 0.42
i 11 [$S+6]   0.30 0.42
i 12 [$S+0.5] 0.10 0.13
i 12 [$S+1.5] 0.10 0.13
i 12 [$S+2.5] 0.10 0.13
i 12 [$S+3.5] 0.10 0.13
i 12 [$S+4.5] 0.10 0.13
i 12 [$S+5.5] 0.10 0.13
i 12 [$S+6.5] 0.10 0.13
i 12 [$S+7.5] 0.10 0.13 #

; lead line across all four chords of a cycle, $O = cycle start beat
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

; ---- reprise variations (so cyc E is not a copy of cyc D) ----

; busier, eighth-note walking bass
#define BASS2(S'R5'R6'F6) #
i 2 [$S+0]   1.0 $R5 0.22
i 2 [$S+1]   0.5 $R6 0.18
i 2 [$S+1.5] 0.5 $F6 0.18
i 2 [$S+2.5] 0.5 $R5 0.20
i 2 [$S+3]   1.0 $R6 0.18
i 2 [$S+4]   0.5 $R5 0.22
i 2 [$S+4.5] 0.5 $F6 0.18
i 2 [$S+5.5] 0.5 $R6 0.18
i 2 [$S+6]   1.0 $R5 0.22
i 2 [$S+7]   0.5 $R6 0.18
i 2 [$S+7.5] 0.5 $F6 0.18 #

; higher, more ornamented lead variation
#define MEL2(O) #
i 4 [$O+0]    1.0 9.00 0.14
i 4 [$O+1]    1.0 9.04 0.14
i 4 [$O+2]    1.0 9.05 0.14
i 4 [$O+3]    1.0 9.04 0.14
i 4 [$O+4]    2.0 9.02 0.14
i 4 [$O+6]    1.0 9.00 0.14
i 4 [$O+7]    1.0 8.11 0.14
i 4 [$O+8]    1.5 9.02 0.14
i 4 [$O+9.5]  0.5 9.04 0.14
i 4 [$O+10]   1.0 9.05 0.14
i 4 [$O+11]   1.0 9.04 0.14
i 4 [$O+12]   2.0 9.02 0.14
i 4 [$O+14]   2.0 8.11 0.14
i 4 [$O+16]   1.0 9.04 0.14
i 4 [$O+17]   1.0 9.07 0.14
i 4 [$O+18]   1.0 9.04 0.14
i 4 [$O+19]   1.0 9.02 0.14
i 4 [$O+20]   2.0 8.11 0.14
i 4 [$O+22]   2.0 9.02 0.14
i 4 [$O+24]   1.0 9.00 0.14
i 4 [$O+25]   1.0 9.04 0.14
i 4 [$O+26]   1.5 9.07 0.14
i 4 [$O+27.5] 0.5 9.04 0.14
i 4 [$O+28]   1.0 9.00 0.14
i 4 [$O+29]   1.0 8.09 0.14
i 4 [$O+30]   2.0 8.09 0.14 #

; kit variation: ghost snares + open hats on the offbeats
#define DRUMS2(S) #
i 10 [$S+0]   0.35 0.65
i 10 [$S+2.5] 0.30 0.38
i 10 [$S+4]   0.35 0.65
i 10 [$S+6.5] 0.30 0.38
i 11 [$S+2]   0.30 0.42
i 11 [$S+6]   0.30 0.42
i 11 [$S+3.5] 0.12 0.16
i 11 [$S+7.5] 0.12 0.16
i 12 [$S+0.5] 0.10 0.13
i 12 [$S+1.5] 0.10 0.13
i 12 [$S+2.5] 0.10 0.13
i 12 [$S+3.5] 0.30 0.16
i 12 [$S+4.5] 0.10 0.13
i 12 [$S+5.5] 0.10 0.13
i 12 [$S+6.5] 0.10 0.13
i 12 [$S+7.5] 0.30 0.16 #

; 2-beat snare-roll fill to lead into a drop, starting at beat $S
#define FILL(S) #
i 11 [$S+0]    0.25 0.34
i 11 [$S+0.5]  0.25 0.36
i 11 [$S+1]    0.22 0.40
i 11 [$S+1.25] 0.20 0.42
i 11 [$S+1.5]  0.20 0.45
i 11 [$S+1.75] 0.20 0.48
i 10 [$S+0]    0.30 0.55 #

; --- always-on: master, reverb, found-sound haze bed ---
i 100 0 214
i 99  0 214
i 3   0 214 0 0.05

; --- intro (0): city alone ---
i 3 0 16 0 0.42

; --- cyc A (16-48): PADS only ---
$PAD(16'7.05'7.09'8.00'8.04)
$PAD(24'7.07'7.11'8.02'8.05)
$PAD(32'7.04'7.07'7.11'8.02)
$PAD(40'7.09'8.00'8.04'8.07)

; --- cyc B (48-80): + BASS ---
$PAD(48'7.05'7.09'8.00'8.04)  $BASS(48'5.05'6.05'6.00)
$PAD(56'7.07'7.11'8.02'8.05)  $BASS(56'5.07'6.07'6.02)
$PAD(64'7.04'7.07'7.11'8.02)  $BASS(64'5.04'6.04'5.11)
$PAD(72'7.09'8.00'8.04'8.07)  $BASS(72'5.09'6.09'6.04)

; --- cyc C (80-112): + KICK pulse ---
$PAD(80'7.05'7.09'8.00'8.04)  $BASS(80'5.05'6.05'6.00)
$PAD(88'7.07'7.11'8.02'8.05)  $BASS(88'5.07'6.07'6.02)
$PAD(96'7.04'7.07'7.11'8.02)  $BASS(96'5.04'6.04'5.11)
$PAD(104'7.09'8.00'8.04'8.07) $BASS(104'5.09'6.09'6.04)
$DRUMKICK(80) $DRUMKICK(88) $DRUMKICK(96) $DRUMKICK(104)
$FILL(110)                              ; fill into the full-kit drop

; --- cyc D (112-144): + FULL KIT + MELODY (everything) ---
$PAD(112'7.05'7.09'8.00'8.04) $BASS(112'5.05'6.05'6.00)
$PAD(120'7.07'7.11'8.02'8.05) $BASS(120'5.07'6.07'6.02)
$PAD(128'7.04'7.07'7.11'8.02) $BASS(128'5.04'6.04'5.11)
$PAD(136'7.09'8.00'8.04'8.07) $BASS(136'5.09'6.09'6.04)
$DRUMS(112) $DRUMS(120) $DRUMS(128) $DRUMS(136)
$MEL(112)

; --- interlude (144): band out, city alone, then a fill back in ---
i 3 144 16 0 0.42
$FILL(158)                              ; fill out of the interlude into the reprise

; --- cyc E (160-192): full reprise — varied bass, melody, and kit ---
$PAD(160'7.05'7.09'8.00'8.04) $BASS2(160'5.05'6.05'6.00)
$PAD(168'7.07'7.11'8.02'8.05) $BASS2(168'5.07'6.07'6.02)
$PAD(176'7.04'7.07'7.11'8.02) $BASS2(176'5.04'6.04'5.11)
$PAD(184'7.09'8.00'8.04'8.07) $BASS2(184'5.09'6.09'6.04)
$DRUMS2(160) $DRUMS2(168) $DRUMS2(176) $DRUMS2(184)
$MEL2(160)

; --- outro (192): city alone, fading ---
i 3 192 16 0 0.42

e
</CsScore>
</CsoundSynthesizer>
