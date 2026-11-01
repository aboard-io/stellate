// THE LILGUYS — the four, drawn as on the FM-1's screen (stellate-lilguys,
// firmware/src/stellate_band.c st_sprite / st_prop), ported pixel for pixel:
// sixteen pixels across, twelve down, three screen pixels a pixel, each member
// its own shape and face. The drummer round and wide-eyed behind its kick and
// cymbal; the bassist tall, cool and half-lidded; the keys boxy in glasses; the
// lead a drop with a sparkle in its eye.
//
// drawMember(ctx, m, look, pose, ms) draws member m into a 60×64 logical cell
// (the firmware's 60-pixel column); the page scales the canvas, pixelated.

export const COL = ["#ff7a54", "#b080ff", "#54d6be", "#ffd24a"];
export const BG = "#0e0e14", INK = "#ececf0", MID = "#8c8c9c", DIM = "#343440", HEAD = "#242430";
const RED = "#ff4040", WOOD = "#965c34";

const BODIES = [
  [0x0FF0, 0x3FFC, 0x7FFE, 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF, 0x7FFE, 0x3FFC, 0x1FF8, 0x0C30, 0x1C38], // drums
  [0x07E0, 0x0FF0, 0x1FF8, 0x1FF8, 0x3FFC, 0x3FFC, 0x7FFE, 0x7FFE, 0x7FFE, 0x3FFC, 0x0C30, 0x1C38], // bass
  [0x3FFC, 0x7FFE, 0x7FFE, 0x7FFE, 0x7FFE, 0x7FFE, 0x7FFE, 0x7FFE, 0x7FFE, 0x3FFC, 0x1818, 0x381C], // keys
  [0x0180, 0x07E0, 0x1FF8, 0x3FFC, 0x7FFE, 0x7FFE, 0x7FFE, 0x7FFE, 0x3FFC, 0x1FF8, 0x1818, 0x381C], // lead
];
// what each wears on its head: by LOOK (sticks, cap, then the third chair's and the lead's looks)
export const LOOK = { STICKS: 0, CAP: 1, KEYS: 2, GUITAR: 3, SINGER: 4, HORN: 5, SYNTH: 6 };
const HAT = [
  [0x4002, 0x2004, 0x1008, 0x0810], // the drummer's sticks
  [0x0000, 0x0FF0, 0x1FF8, 0x7FF8], // the bassist's cap
  [0x0000, 0x0C30, 0x0FF0, 0x0C30], // keys: a bow
  [0x0000, 0x00E0, 0x03F0, 0x07F8], // guitar: a quiff
  [0x0920, 0x05A0, 0x07E0, 0x03C0], // singer: hair up
  [0x0000, 0x07C0, 0x0FF0, 0x1FF8], // horn: a beret
  [0x0180, 0x0180, 0x03C0, 0x0FF0], // synth: an antenna
];
const STRIKE = [0x0000, 0x0000, 0xC003, 0x3C3C]; // the sticks coming down on a hit
export const BASS = { UPRIGHT: 0, GUITAR: 1, SYNTH: 2, VOICE: 3 };

// mix two #rrggbb colours: pct of the way from a to b
export function mix(a, b, pct) {
  const p = Math.max(0, Math.min(100, pct)) / 100;
  const ca = parseInt(a.slice(1), 16), cb = parseInt(b.slice(1), 16);
  const ch = s => Math.round(((ca >> s) & 255) * (1 - p) + ((cb >> s) & 255) * p);
  return "#" + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
}

function rect(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); }
function frame(c, x, y, w, h, col) {
  rect(c, x, y, w, 1, col); rect(c, x, y + h - 1, w, 1, col);
  rect(c, x, y, 1, h, col); rect(c, x + w - 1, y, 1, h, col);
}
function line(c, x0, y0, x1, y1, col, t) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
  c.fillStyle = col;
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n);
    c.fillRect(x - (t >> 1), y - (t >> 1), t, t);
  }
}

// what it plays, in front of it
function prop(c, x, by, m, look, bassKind, p, col, ms) {
  const S = 3, play = p.mood && p.note, tick = (ms / 120 | 0) & 1;
  if (m === 0) {
    const face = p.hit ? INK : "#e8e8ec";
    rect(c, x + 10, by + 36, 28, 13, "#c83840"); // the kick, its head to us
    rect(c, x + 13, by + 38, 22, 9, face);
    rect(c, x + 20, by + 40, 8, 5, p.hit ? COL[0] : "#c83840");
    rect(c, x + 47, by + 26, 2, 22, MID); // the cymbal on its stand
    rect(c, x + 41, by + 24 + (p.hit ? 1 : 0), 14, 2, p.hit ? INK : "#e8be50");
    return;
  }
  if (m === 1) {
    if (bassKind === BASS.UPRIGHT) {
      line(c, x + 46, by + 2, x + 46, by + 30, "#3c2414", 2);
      rect(c, x + 39, by + 28, 14, 9, WOOD);
      rect(c, x + 41, by + 36, 10, 3, WOOD);
      rect(c, x + 38, by + 39, 16, 10, WOOD);
      rect(c, x + 45, by + 33, 2, 10, "#3c2414");
      if (p.mood) rect(c, x + 41 + (play && tick ? 4 : 0), by + 34, 5, 4, col);
    } else if (bassKind === BASS.GUITAR) {
      line(c, x + 16, by + 42, x + 58, by + 14, "#462818", 3);
      rect(c, x + 54, by + 10, 6, 6, "#462818");
      rect(c, x + 2, by + 34, 20, 14, "#7846aa");
      rect(c, x + 9, by + 39, 5, 4, BG);
      if (p.mood) rect(c, x + 16, by + 34 + (play && tick ? 7 : 1), 5, 4, col);
    } else if (bassKind === BASS.SYNTH) {
      rect(c, x + 6, by + 38, 36, 10, "#b0b0bc");
      for (let i = 0; i < 4; i++)
        rect(c, x + 10 + i * 8, by + 40, 4, 3, play && (((ms / 90 | 0) + i) & 1) ? RED : "#3c3c48");
      if (p.mood) rect(c, x + 12 + (play && tick ? 12 : 0), by + 35, 6, 4, col);
    } else {
      rect(c, x + 47, by + 30, 2, 20, MID);
      rect(c, x + 44, by + 24, 7, 7, "#5a5a68");
    }
    return;
  }
  if (look === LOOK.GUITAR) {
    line(c, x + 22, by + 41, x + 54, by + 22, WOOD, 3);
    rect(c, x + 50, by + 18, 7, 5, WOOD);
    rect(c, x + 6, by + 35, 20, 12, "#d67836");
    rect(c, x + 13, by + 38, 5, 5, BG);
    if (p.mood) rect(c, x + 20, by + 33 + (play && ((ms / 70 | 0) & 1) ? 8 : 2), 5, 4, col);
  } else if (look === LOOK.SINGER) {
    rect(c, x + 47, by + 30, 2, 20, MID);
    rect(c, x + 44, by + 24, 7, 7, "#5a5a68");
    rect(c, x + 45, by + 25, 2, 2, INK);
  } else if (look === LOOK.HORN) {
    line(c, x + 27, by + 33, x + 46, by + 42, "#e8be50", 2);
    rect(c, x + 44, by + 39, 6, 7, "#e8be50");
    if (play) {
      rect(c, x - 2, by + 9 * S, S, 2 * S, col);
      rect(c, x + 16 * S - 1, by + 9 * S, S, 2 * S, col);
    }
  } else {
    const syn = look === LOOK.SYNTH;
    rect(c, x + 2, by + 39, 44, 9, syn ? "#2c2c38" : "#ececf0");
    for (let i = 0; i < 7; i++)
      if (syn) rect(c, x + 5 + i * 6, by + 41, 3, 2, play && (((ms / 100 | 0) + i) % 3 === 0) ? COL[m] : MID);
      else if (i !== 2) rect(c, x + 7 + i * 6, by + 39, 3, 5, BG);
    if (play) {
      rect(c, x + 8 + (tick ? 0 : 3), by + 36 + (tick ? 2 : 0), 2 * S, S, col);
      rect(c, x + 34 - (tick ? 3 : 0), by + 36 + (tick ? 0 : 2), 2 * S, S, col);
    }
  }
}

// pose: { mood: 0 asleep | 1 awake | 2 playing its own motif, bob, look: -1|0|1,
//         sway, note, blink, flip, hit, listen }
export function drawSprite(c, x, y, m, look, bassKind, p, ms) {
  const S = 3;
  const col = p.mood ? COL[m] : mix(COL[m], BG, 45);
  const hat = m === 0 && p.hit ? STRIKE : HAT[m === 0 ? 0 : m === 1 ? 1 : look];
  const by = y - (p.bob || 0), hc = m === 0 ? INK : col;
  x += p.sway || 0;
  const ROW = r => (p.flip ? 15 - r : r);
  for (let r = 0; r < 4; r++)
    for (let k = 0; k < 16; k++)
      if ((hat[r] >> (15 - k)) & 1) rect(c, x + k * S, by + ROW(r) * S, S, S, hc);
  for (let r = 0; r < 12; r++)
    for (let k = 0; k < 16; k++)
      if ((BODIES[m][r] >> (15 - k)) & 1) rect(c, x + k * S, by + ROW(r + 4) * S, S, S, col);
  const ey = by + ROW(7) * S - (p.flip ? S : 0);
  const my = p.flip ? by + ROW(11) * S - S : by + 10 * S;
  prop(c, x, by, m, look, bassKind, p, col, ms);
  if (!p.mood || p.blink) {
    rect(c, x + 4 * S, ey + S, 2 * S, S, BG);
    rect(c, x + 10 * S, ey + S, 2 * S, S, BG);
  } else {
    const dx = p.look > 0 ? S : p.look < 0 ? 0 : (S >> 1) + 1, dy = S - (p.listen ? S : 0);
    for (let e = 0; e < 2; e++) {
      const ex = x + (e ? 10 : 4) * S;
      if (m === 0) {
        rect(c, ex - 1, ey - 1, 2 * S + 2, 2 * S + 2, INK);
        rect(c, ex + dx, ey + dy - 1, S, S, BG);
      } else {
        rect(c, ex, ey, 2 * S, 2 * S, INK);
        rect(c, ex + dx, ey + dy, S, S, BG);
      }
      if (m === 1 && !p.note) rect(c, ex, ey, 2 * S, S - 1, col); // cool: a lid half down
      if (m === 2) frame(c, ex - 2, ey - 2, 2 * S + 4, 2 * S + 4, BG); // glasses
      if (m === 3) rect(c, ex + dx, ey + dy, 1, 1, INK); // a sparkle
    }
    if (m === 2) rect(c, x + 6 * S + 2, ey + 1, 4 * S - 4, 1, BG);
  }
  if (p.mood === 2 || (p.mood && p.note))
    for (let k = 0; k < 2; k++) rect(c, x + (k ? 12 : 2) * S, ey + 3 * S, 2 * S, S, mix(col, "#ff78aa", 60));
  if (p.mood && p.note) rect(c, x + 6 * S, my, 4 * S, 2 * S, BG);
  else if (p.listen) rect(c, x + 7 * S, my, 2 * S, 2 * S, BG);
  else rect(c, x + 7 * S, my + S, 2 * S, S, BG);
  if (p.listen) { // an ear, cupped
    rect(c, x + 16 * S, by + 6 * S, 2, 4 * S, RED);
    rect(c, x + 16 * S + 2, by + 5 * S, 2, 2, RED);
    rect(c, x + 16 * S + 2, by + 10 * S, 2, 2, RED);
  }
}

export function quaver(c, x, y, col) {
  rect(c, x + 3, y, 2, 7, col);
  rect(c, x, y + 5, 4, 3, col);
  rect(c, x + 5, y + 1, 2, 2, col);
}

// a z, rising, for one asleep (no font: three strokes)
export function zee(c, x, y, big, col) {
  const s = big ? 5 : 3;
  rect(c, x, y, s, 1, col);
  line(c, x + s - 1, y, x, y + s - 1, col, 1);
  rect(c, x, y + s - 1, s, 1, col);
}
