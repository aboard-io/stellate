// LISTENING — what you play on your own instrument, against the part on the
// staff. Two halves, kept apart so the judging can be tested without a
// keyboard and without a browser:
//
//   Judge     pure. Given the part (beats, durations, pitches) it takes the
//             notes you play, one at a time, each with the beat it landed on,
//             and says whether it was the next note of the part: the right
//             pitch class (the staff may be written an octave from where you
//             play it; the octave is the reader's), inside the window, and not
//             already claimed. For the drummer any key is a stroke: rhythm only.
//             A part note the clock has passed, window and all, unplayed, is a
//             MISS; a note you played that matches nothing is an EXTRA.
//   Listener  Web MIDI note-ons, with the instant each happened (the event's
//             own timestamp, not when this page got round to it).
//
// iOS Safari has no Web MIDI; Listener.supported says so and the page says so.

export class Judge {
  constructor(notes, { drums = false } = {}) {
    // one entry per note; a chord is several entries on one beat
    this.notes = notes.map((n) => ({ beat: n.beat, midi: n.midi, state: 0 }))   // 0 open, 1 hit, 2 missed
      .sort((a, b) => a.beat - b.beat);
    this.drums = drums;
    this.hits = 0; this.misses = 0; this.extra = 0;
    this.next = 0;                       // first note not yet swept past
  }

  // a note played at `beat`; `win` is the window in beats either side
  hear(midi, beat, win) {
    const N = this.notes;
    let best = -1, bd = Infinity;
    // only notes near enough can match: start from the first whose window is still open
    let i = this.next;
    while (i > 0 && N[i - 1].beat + win >= beat) i--;
    for (; i < N.length && N[i].beat <= beat + win; i++) {
      const n = N[i];
      if (n.state !== 0 || Math.abs(n.beat - beat) > win) continue;
      if (!this.drums && ((n.midi - midi) % 12 + 12) % 12 !== 0) continue;
      const d = Math.abs(n.beat - beat);
      if (d < bd) { bd = d; best = i; }
    }
    if (best < 0) { this.extra++; return null; }
    N[best].state = 1; this.hits++;
    return N[best];
  }

  // the clock is at `now`: every open note whose window has closed is a miss
  sweep(now, win) {
    const N = this.notes, missed = [];
    while (this.next < N.length && N[this.next].beat + win < now) {
      const n = N[this.next++];
      if (n.state === 0) { n.state = 2; this.misses++; missed.push(n); }
    }
    return missed;
  }

  // the song came round, or started again from somewhere: forget everything from `beat` on
  rewind(beat) {
    for (const n of this.notes) if (n.beat >= beat - 1e-6 && n.state) {
      if (n.state === 1) this.hits--; else this.misses--;
      n.state = 0;
    }
    this.next = 0;
    while (this.next < this.notes.length && this.notes[this.next].beat < beat - 1e-6) this.next++;
  }

  get total() { return this.hits + this.misses; }
}

export class Listener {
  static get supported() { return typeof navigator !== "undefined" && typeof navigator.requestMIDIAccess === "function"; }
  constructor(onNote) { this.onNote = onNote; this.access = null; this.inputs = []; }
  async enable() {
    if (!Listener.supported) throw new Error("no Web MIDI in this browser");
    const a = await navigator.requestMIDIAccess({ sysex: false });
    this.access = a;
    const hook = () => {
      this.inputs = [];
      a.inputs.forEach((inp) => {
        this.inputs.push(inp.name || "a MIDI input");
        inp.onmidimessage = (e) => {
          const [st, n, v] = e.data;
          if ((st & 0xf0) === 0x90 && v > 0) this.onNote(n, e.timeStamp);
        };
      });
    };
    hook();
    a.onstatechange = hook;
    return this.inputs;
  }
  disable() {
    if (!this.access) return;
    this.access.inputs.forEach((inp) => { inp.onmidimessage = null; });
    this.access.onstatechange = null;
    this.access = null; this.inputs = [];
  }
}
