/*
 * Stellate for Move — song starter.
 *
 * Pick a genre (oldest to newest) and a seed, press the jog wheel: Stellate
 * composes the whole song and writes it as a new Move Set (8 scenes of clips,
 * tempo, key, scale, time signature, fitting Move instruments, the song order for
 * Song Mode). It appears in your Set list straight away -- turn to it to play it.
 * Nothing restarts and your current Set is left untouched.
 *
 *   Jog turn ........ genre              Knob 1 ...... seed
 *   Jog press ....... make the Set       Knob 2 ...... sounds: genre / this Set's
 *   Shift+Jog press . random seed, then make
 *   Back ............ quit, back to Move
 */

import * as os from 'os';
import * as std from 'std';
import { announce } from '/data/UserData/schwung/shared/screen_reader.mjs';
import { decodeDelta, decodeAcceleratedDelta }
    from '/data/UserData/schwung/shared/input_filter.mjs';

/* NOTE: do not call clearAllLEDs() anywhere in here. It forces all 128 pad LEDs and all
 * 128 button LEDs to black, and Move does not repaint them when the tool exits -- you come
 * back to a Set list with nothing lit, which still responds to a tap but shows you
 * nothing. Stellate is jog and knobs only and never lights a pad, so it has nothing to
 * clean up; the other jog-only tools (ai-manual, guitar-tuner, chord-finder) do not clear
 * either. Only light-then-restore tools like song-mode do, and they snapshot first with
 * shadow_get_pad_led_snapshot(). */
import * as S from './stellate.mjs';

const MODULE_DIR = '/data/UserData/schwung/modules/tools/stellate';
const SETS_DIR = '/data/UserData/UserLibrary/Sets';
const PRESETS_DIR = '/data/CoreLibrary/Track Presets';

const CC_JOG = 14, CC_JOG_PRESS = 3, CC_SHIFT = 49, CC_KNOB1 = 71, CC_KNOB2 = 72;
const CC_BACK = 51;          /* Move's Back button: leave the tool (as the other tools do) */

let genres = [], gi = 0, seed = 1;
let genreSounds = true;          /* true: pick Move instruments for the genre */
let here = null, hereName = '';  /* the Set you're in (base for mixer/effects) */
let shift = false, dirty = true;
let busy = '', pending = false, error = '', done = '';

/* ---- files ---- */
function readJson(path) {
    try { const t = host_read_file(path); return t ? JSON.parse(t) : null; } catch (e) { return null; }
}
function loadJsonAnywhere(path) {            /* CoreLibrary is outside host_read_file's reach */
    try { return JSON.parse(std.loadFile(path)); } catch (e) { return null; }
}
function walk(dir, rel, out, depth) {
    if (depth > 5) return;
    let names = [];
    try { names = os.readdir(dir)[0] || []; } catch (e) { return; }
    for (const n of names) {
        if (n === '.' || n === '..' || n[0] === '.') continue;
        const p = dir + '/' + n, r = rel ? rel + '/' + n : n;
        const st = os.stat(p)[0];
        if (st && (st.mode & os.S_IFMT) === os.S_IFDIR) walk(p, r, out, depth + 1);
        else if (/\.json$/i.test(n)) out.push(r);
    }
}
let presetIndex = null;
function presets() {
    if (!presetIndex) { const files = []; walk(PRESETS_DIR, '', files, 0); presetIndex = S.indexPresets(files); }
    return { index: presetIndex, load: (rel) => loadJsonAnywhere(PRESETS_DIR + '/' + rel) };
}

function currentSet() {
    const raw = host_read_file('/data/UserData/schwung/active_set.txt') || '';
    const [uuid, name] = raw.split('\n').map((s) => (s || '').trim());
    if (uuid && name && uuid.indexOf('/') < 0 && name.indexOf('/') < 0) {
        const t = readJson(SETS_DIR + '/' + uuid + '/' + name + '/Song.abl');
        if (S.templateOk(t)) { here = t; hereName = name; return; }
    }
    here = null; hereName = '';
}
function saveState() {
    try { host_write_file(MODULE_DIR + '/state.json', JSON.stringify({ genre: genres[gi] && genres[gi].key, seed, genreSounds })); }
    catch (e) { /* best effort */ }
}

/* ---- make ---- */
function uuid4() {
    const h = '0123456789abcdef'; let s = '';
    for (let i = 0; i < 36; i++) {
        if (i === 8 || i === 13 || i === 18 || i === 23) s += '-';
        else if (i === 14) s += '4';
        else if (i === 19) s += h[8 + Math.floor(Math.random() * 4)];
        else s += h[Math.floor(Math.random() * 16)];
    }
    return s;
}
/* Back button: hand Move its screen back, LEDs untouched. */
function quit() {
    if (typeof host_exit_module === 'function') host_exit_module();
}
function exists(path) {
    return typeof host_file_exists === 'function' ? !!host_file_exists(path)
                                                  : host_read_file(path) != null;
}
function make() {
    const g = genres[gi];
    const base = here || readJson(MODULE_DIR + '/template.abl');
    if (!base) throw new Error('no template');
    const useGenre = genreSounds || !here;
    console.log('stellate: make ' + g.key + ' #' + seed + ' base=' + (here ? hereName : 'template.abl') + ' genreSounds=' + useGenre +
                (useGenre ? ' presets=' + presets().index.length : ''));
    const f = S.makeSet(g.key, seed, base, useGenre ? presets() : null);
    console.log('stellate: picked ' + JSON.stringify(f.picked) + ' sounds ' + JSON.stringify(f.sounds) + ' Song.abl ' + f.abl.length + ' bytes');
    const id = uuid4(), stage = MODULE_DIR + '/out/' + id;
    host_ensure_dir(MODULE_DIR + '/out'); host_ensure_dir(stage);
    if (!(host_write_file(stage + '/Song.abl', f.abl) && host_write_file(stage + '/song_mode.json', f.songMode) &&
          host_write_file(stage + '/name', f.name) && host_write_file(stage + '/uuid', id)))
        throw new Error('could not write to out/ (ownership?)');
    host_system_cmd('sh ' + MODULE_DIR + '/make-set.sh ' + stage);
    const res = (host_read_file(stage + '/result') || 'err no result').trim().split(' ');
    console.log('stellate: make-set.sh -> ' + res.join(' ') + ' uuid ' + id);
    /* keep a copy of the last Set for debugging */
    host_system_cmd('sh -c "rm -rf ' + MODULE_DIR + '/last && cp -r ' + stage + ' ' + MODULE_DIR + '/last"');
    host_remove_dir(stage);
    if (res[0] !== 'ok') throw new Error(res.slice(1).join(' ') || 'failed');
    /* make-set.sh has already asked Move to re-read its Set list, so the new Set is
     * in it now and you can turn to it. Nothing else happens by default: the only way
     * to make Move *open* a Set is to set currentSongIndex and restart, and that
     * restart takes Schwung down with it and loses whatever you were doing. If you
     * would rather have it restart straight into the song:
     *   touch /data/UserData/schwung/modules/tools/stellate/restart_on_make
     * scripts/rescue.sh undoes a bad currentSongIndex if a Set ever won't load.  */
    f.index = +res[1];
    f.restarting = exists(MODULE_DIR + '/restart_on_make');
    if (f.restarting) host_system_cmd('sh ' + MODULE_DIR + '/open-set.sh ' + res[1]);
    host_write_file(MODULE_DIR + '/last.json', JSON.stringify({ name: f.name, index: f.index, sounds: f.sounds, picked: f.picked }));
    return f;
}

/* ---- screen ---- */
function fit(text, w) {
    text = String(text);
    if (text_width(text) <= w) return text;
    while (text.length > 1 && text_width(text + '.') > w) text = text.slice(0, -1);
    return text + '.';
}
/* Right-align a string against x = w. */
function printRight(text, y, w, colour) {
    print(Math.max(0, w - text_width(text)), y, text, colour);
}

/* The genre list, three rows with the selection in the middle, over a status bar
 * holding the two things the knobs change. 128x64: bar 0-10, rows 12-47, hint 50-62. */
const ROWS = [14, 26, 38];

function draw() {
    clear_screen();
    if (busy) {
        fill_rect(0, 0, 128, 11, 1);
        print(1, 2, fit('Stellate', 126), 0);
        print(0, 30, fit(busy, 128), 1);
        dirty = false; return;
    }
    if (done || error) {
        fill_rect(0, 0, 128, 11, 1);
        print(1, 2, fit(done ? 'Made it' : 'Could not make it', 126), 0);
        print(0, 18, fit(done || error, 128), 1);
        if (done) print(0, 32, 'It is in your Sets.', 1);
        print(0, 52, fit(done ? 'Back: quit   Jog: more' : 'Back: quit   Jog: go on', 128), 1);
        dirty = false; return;
    }

    /* status bar: seed on the left, where the sounds come from on the right */
    fill_rect(0, 0, 128, 11, 1);
    print(1, 2, 'seed ' + seed, 0);
    printRight(genreSounds || !here ? 'snd: genre' : fit('snd: ' + hereName, 74), 2, 127, 0);

    /* The list, oldest to newest, selection inverted. Name left, year right: the
     * longest names ("New wave of British heavy metal") outrun 128px, and the year
     * is the half you cannot guess, so it gets its own column instead of being the
     * first thing a truncation eats. */
    for (let r = 0; r < ROWS.length; r++) {
        const i = gi + r - 1, y = ROWS[r];
        if (i < 0 || i >= genres.length) continue;
        const g = genres[i], selected = r === 1, ink = selected ? 0 : 1;
        if (selected) fill_rect(0, y - 2, 128, 12, 1);
        /* Never print "undefined": Schwung keeps stellate.mjs cached in its running JS
         * context, so a freshly deployed ui.js can be talking to an older bundle that
         * has no title/name. Fall back through what every version has. */
        const year = g.year == null ? '' : (g.year < 0 ? -g.year + ' BC' : String(g.year));
        const left = g.name || g.title || g.label || g.key || '?';
        if (year) {
            printRight(year, y, 126, ink);
            print(2, y, fit(left, 120 - text_width(year)), ink);
        } else {
            print(2, y, fit(g.title || g.label || g.key || '?', 124), ink);
        }
    }

    print(0, 52, fit('Press jog: make song', 128), 1);
    dirty = false;
}

/* ---- lifecycle ---- */
globalThis.init = function () {
    genres = S.genreList();
    let st = readJson(MODULE_DIR + '/state.json') || {};
    const at = genres.findIndex((g) => g.key === st.genre);
    gi = at >= 0 ? at : Math.max(0, genres.findIndex((g) => g.key === 'acid'));
    seed = Number.isInteger(st.seed) ? st.seed : 1;
    genreSounds = st.genreSounds !== false;
    currentSet();
    dirty = true;
};
globalThis.onResume = function () { currentSet(); dirty = true; };

globalThis.tick = function () {
    if (pending) {
        pending = false;
        draw();
        if (typeof host_flush_display === 'function') host_flush_display();
        try {
            const f = make();
            /* busy swallows input, so only stay busy when the restart is about to
             * take the screen away; otherwise hand control back with the result. */
            if (f.restarting) busy = 'Opening ' + f.name + '...';
            else { busy = ''; done = f.name; }
            dirty = true; draw();
            if (typeof host_flush_display === 'function') host_flush_display();
            announce('Made ' + f.name + (f.restarting ? '. Opening it' : '. It is in your Sets, turn to it to play it'));
            if (f.restarting && typeof shadow_control_restart === 'function') shadow_control_restart();
        } catch (e) {
            console.log('stellate: FAILED ' + ((e && e.message) || e) + ' | ' + ((e && e.stack) || ''));
            busy = '';
            error = String((e && e.message) || e);
            announce('Could not make the song: ' + error);
            dirty = true;
        }
    }
    if (dirty) draw();
};

globalThis.onMidiMessageInternal = function (data) {
    if (!data || busy) return;
    const st = data[0] | 0, d1 = data[1] | 0, d2 = data[2] | 0;
    if ((st & 0xf0) !== 0xb0) return;
    if (d1 === CC_SHIFT) { shift = d2 > 0; return; }
    if (d1 === CC_BACK && d2 > 0) { quit(); return; }
    if (done) { if (d1 === CC_JOG || d1 === CC_JOG_PRESS) { done = ''; dirty = true; } return; }
    if (error) { if (d1 === CC_JOG || d1 === CC_JOG_PRESS) { error = ''; dirty = true; } return; }

    if (d1 === CC_JOG) {
        const d = decodeAcceleratedDelta(d2, 'jog');
        if (d) { gi = Math.max(0, Math.min(genres.length - 1, gi + d)); announce(genres[gi].title || genres[gi].label || genres[gi].key); saveState(); dirty = true; }
    } else if (d1 === CC_KNOB1) {
        const d = decodeAcceleratedDelta(d2, 'k1');
        if (d) { seed = (seed + d + 65536) & 0xffff; saveState(); dirty = true; }
    } else if (d1 === CC_KNOB2) {
        const d = decodeDelta(d2);
        if (d && here) { genreSounds = d > 0 ? false : true; saveState(); announce(genreSounds ? 'Sounds for the genre' : 'Sounds from ' + hereName); dirty = true; }
    } else if (d1 === CC_JOG_PRESS && d2 > 0) {
        if (shift) { seed = Math.floor(Math.random() * 65536); saveState(); }
        done = ''; busy = 'Composing #' + seed + '...';
        pending = true;
        dirty = true;
    }
};
globalThis.onMidiMessageExternal = function () {};
globalThis.onUnload = function () { /* nothing to undo: we never lit anything */ };
