\version "2.24.0"
% Chorale in G minor
% Printed from keeps/bach-benchmark/chorale-gminor.json — the checked notes and this page are one table.
global = { \key g \minor \time 3/4 }
soprano = { \global \voiceOne bes'4 a'4 bes'4 c''4 bes'4 a'4 fis'4 g'4 g'4 fis'2.\fermata g'4 bes'4 bes'4 c''4 a'4 fis'4 g'4 g'4 fis'4 g'2.\fermata \bar "|." }
alto    = { \global \voiceTwo g'4 fis'4 g'4 g'4 g'4 ees'4 d'4 d'4 ees'4 d'2.\fermata d'4 f'4 ees'4 ees'4 ees'4 d'4 d'4 ees'4 d'4 d'2.\fermata }
tenor   = { \global \voiceOne d'4 d'4 d'4 ees'4 d'4 a4 a4 bes4 c'4 a2.\fermata bes4 d'4 g4 c'4 c'4 a4 bes4 c'4 a4 b2.\fermata }
bass    = { \global \voiceTwo g4 d4 g4 ees4 bes,4 c4 d4 g4 c4 d2.\fermata g4 bes,4 ees4 c4 c4 d4 g4 c4 d4 g2.\fermata \bar "|." }
\score {
  \new ChoirStaff <<
    \new Staff = "up" << \new Voice = "s" \soprano \new Voice = "a" \alto >>
    \new Staff = "down" { \clef bass << \new Voice = "t" \tenor \new Voice = "b" \bass >> }
  >>
  \layout { }
  \midi { \tempo 4 = 72 }
}
