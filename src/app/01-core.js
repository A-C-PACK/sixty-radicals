"use strict";
// ---------------------------------------------------------------- data
const DATA = window.RAD_DATA;
const STROKES = DATA.strokes;
const GROUPS = DATA.groups;
const RADS = [];
GROUPS.forEach((g, gi) => g.radicals.forEach((r, ri) => {
  r.group = g; r.gi = gi; r.ri = ri; r.n = RADS.length;
  RADS.push(r);
}));
const RAD = Object.fromEntries(RADS.map((r) => [r.id, r]));
const POS_LABEL = { left: "on the left", right: "on the right", top: "on top", bottom: "at the bottom",
  "wrap-tl": "wrapping the top and left", "wrap-bl": "wrapping the left and bottom", frame: "framing the character" };
// 草 and 丝 are the everyday words; the radical's own old form is no longer used on its own.
/** The shape the radical takes in this example: a few radicals have a second form (心 for 忄, 灬 for 火, 刀 for 刂). */
const formOf = (r, item) => (item[item.length - 1] === "alt" && r.alt ? r.alt : r.glyph);
const FULL_IS_WORD = new Set(["grass", "silk"]);

// ---------------------------------------------------------------- small helpers
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const SVGNS = "http://www.w3.org/2000/svg";
const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** el("div.card", {onclick}, child, child...). An id may follow the classes: el("section.band#how"). */
function el(spec, attrs, ...kids) {
  const [head, id] = spec.split("#");
  const [tag, ...cls] = head.split(".");
  const node = document.createElement(tag || "div");
  if (cls.length) node.className = cls.join(" ");
  if (id) node.id = id;
  if (attrs && (typeof attrs !== "object" || attrs instanceof Node || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else if (k === "style" && typeof v === "object") {
      for (const [prop, val] of Object.entries(v)) { if (prop.startsWith("--")) node.style.setProperty(prop, val); else node.style[prop] = val; }
    }
    else if (k === "html") node.innerHTML = v;
    else node.setAttribute(k, v === true ? "" : v);
  }
  const add = (kid) => {
    if (kid === null || kid === undefined || kid === false) return;
    if (Array.isArray(kid)) kid.forEach(add);
    else node.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  };
  kids.forEach(add);
  return node;
}

const shuffle = (list) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const pick = (list, n) => shuffle(list).slice(0, n);
const sample = (list) => list[Math.floor(Math.random() * list.length)];

// ---------------------------------------------------------------- saved progress
// Kept in this browser only. Everything works without it.
const STORE_KEY = "thirty-radicals-v1";
const fresh = () => ({ rad: {}, best: {}, sprint: 0, sound: true, intro: 0 });
let state = fresh();
try { state = Object.assign(fresh(), JSON.parse(localStorage.getItem(STORE_KEY) || "{}")); } catch (e) { /* private window */ }
const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ } };
const prog = (id) => (state.rad[id] ||= { seen: false, streak: 0, right: 0, wrong: 0, last: 0 });
/** 0 new, 1 learned, 2 mastered (three right answers in a row) */
const level = (id) => { const p = state.rad[id]; return !p || !p.seen ? 0 : p.streak >= 3 ? 2 : 1; };
const learnedCount = () => RADS.filter((r) => level(r.id) > 0).length;
const masteredCount = () => RADS.filter((r) => level(r.id) > 1).length;
function record(id, ok) {
  const p = prog(id);
  p.seen = true;
  p.streak = ok ? p.streak + 1 : 0;
  p[ok ? "right" : "wrong"]++;
  p.last = Date.now();
  save();
}

// ---------------------------------------------------------------- characters, drawn stroke by stroke
// Every stroke is its own outline, so the radical can take a colour of its own.
// While a stroke is being drawn, a fat line runs along its centre line, clipped to the outline.
let uid = 0;
const STROKE_S = 0.28;

/**
 * hanzi("河", { size, anim, whole, center, delay })
 * anim: draw it stroke by stroke. whole: colour every stroke as the radical. center: move the glyph to the middle
 * of its box (radical forms sit off to one side in the data).
 */
function hanzi(ch, opt = {}) {
  const g = STROKES[ch];
  if (!g) return el("span.hz-font", ch);
  const svg = document.createElementNS(SVGNS, "svg");
  svg.setAttribute("viewBox", "0 0 1024 1024");
  svg.setAttribute("class", "hz" + (opt.cls ? " " + opt.cls : ""));
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", ch);
  if (opt.size) { svg.style.width = svg.style.height = typeof opt.size === "number" ? opt.size + "px" : opt.size; }
  const root = document.createElementNS(SVGNS, "g");
  let shift = "";
  if (opt.center) {
    const b = bounds(ch);
    shift = ` translate(${Math.round(512 - (b.x0 + b.x1) / 2)},${Math.round(388 - (b.y0 + b.y1) / 2)})`;
  }
  root.setAttribute("transform", "scale(1,-1) translate(0,-900)" + shift);
  svg.append(root);
  const anim = opt.anim && !reduceMotion();
  const n = g.s.length;
  const step = n > 1 ? Math.min(0.16, 1.1 / (n - 1)) : 0;
  g.s.forEach((d, i) => {
    const isRad = opt.whole || g.r.includes(i);
    const path = document.createElementNS(SVGNS, "path");
    path.setAttribute("d", d);
    path.setAttribute("class", isRad ? "rad" : "rest");
    path.dataset.i = i;
    if (!anim) { root.append(path); return; }
    const at = (opt.delay || 0) + i * step;
    const id = "hz" + (++uid);
    const clip = document.createElementNS(SVGNS, "clipPath");
    clip.setAttribute("id", id);
    const cp = document.createElementNS(SVGNS, "path");
    cp.setAttribute("d", d);
    clip.append(cp);
    const line = document.createElementNS(SVGNS, "polyline");
    const m = g.m[i];
    let len = 140;
    for (let k = 1; k < m.length; k++) len += Math.hypot(m[k][0] - m[k - 1][0], m[k][1] - m[k - 1][1]);
    line.setAttribute("points", m.map((p) => p.join(",")).join(" "));
    line.setAttribute("clip-path", `url(#${id})`);
    line.setAttribute("class", "draw " + (isRad ? "rad" : "rest"));
    line.style.strokeDasharray = `${len} ${len}`;
    line.style.strokeDashoffset = len;
    line.style.animation = `hz-draw ${STROKE_S}s ${at}s ease-out forwards`;
    path.style.opacity = 0;
    path.style.animation = `hz-show 0.01s ${at + STROKE_S}s forwards`;
    root.append(clip, line, path);
  });
  svg.dataset.dur = (opt.delay || 0) + (n - 1) * step + STROKE_S;
  return svg;
}

const BOUNDS = {};
function bounds(ch) {
  if (BOUNDS[ch]) return BOUNDS[ch];
  const b = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
  // outline coordinates: every number pair in the path data
  for (const d of STROKES[ch].s) {
    const nums = d.match(/-?\d+(\.\d+)?/g).map(Number);
    for (let i = 0; i + 1 < nums.length; i += 2) {
      b.x0 = Math.min(b.x0, nums[i]); b.x1 = Math.max(b.x1, nums[i]);
      b.y0 = Math.min(b.y0, nums[i + 1]); b.y1 = Math.max(b.y1, nums[i + 1]);
    }
  }
  return (BOUNDS[ch] = b);
}

/** Which stroke of the character is nearest to a pointer event on its svg? */
function strokeAt(svg, ch, ev) {
  const box = svg.getBoundingClientRect();
  const x = ((ev.clientX - box.left) / box.width) * 1024;
  const y = 900 - ((ev.clientY - box.top) / box.height) * 1024;
  let best = -1, bestD = 1e9;
  STROKES[ch].m.forEach((m, i) => {
    for (let k = 0; k < m.length; k++) {
      // also test the midpoints so long straight strokes are easy to hit
      const pts = k ? [m[k], [(m[k][0] + m[k - 1][0]) / 2, (m[k][1] + m[k - 1][1]) / 2]] : [m[k]];
      for (const p of pts) {
        const dd = Math.hypot(p[0] - x, p[1] - y);
        if (dd < bestD) { bestD = dd; best = i; }
      }
    }
  });
  return best;
}

// Chinese inside running text is drawn from the same outlines; pinyin gets a font with the tone marks.
const CJK_RE = /[⺀-⿟㐀-鿿]/;
const PINYIN_RE = /[A-Za-zü]*[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ][A-Za-züāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]*/g;
function rich(text) {
  const out = document.createDocumentFragment();
  let buf = "";
  const flush = () => {
    if (!buf) return;
    let last = 0;
    for (const m of buf.matchAll(PINYIN_RE)) {
      out.append(buf.slice(last, m.index), el("span.py", m[0]));
      last = m.index + m[0].length;
    }
    out.append(buf.slice(last));
    buf = "";
  };
  for (const ch of text) {
    if (CJK_RE.test(ch)) { flush(); out.append(hanzi(ch, { cls: "inline", center: true })); } else buf += ch;
  }
  flush();
  return out;
}
const py = (text) => el("span.py", text);

// ---------------------------------------------------------------- sound
// Little synth blips for right and wrong answers, and spoken Mandarin clips when the build includes them.
let actx = null;
function blip(kind) {
  if (!state.sound) return;
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    const t0 = actx.currentTime;
    const notes = { ok: [[660, 0], [990, 0.09]], no: [[220, 0], [185, 0.1]], win: [[523, 0], [659, 0.1], [784, 0.2], [1047, 0.3]],
      tap: [[440, 0]] }[kind];
    for (const [f, at] of notes) {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = kind === "no" ? "triangle" : "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + at);
      g.gain.exponentialRampToValueAtTime(kind === "tap" ? 0.05 : 0.14, t0 + at + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.22);
      o.connect(g).connect(actx.destination);
      o.start(t0 + at);
      o.stop(t0 + at + 0.25);
    }
  } catch (e) { /* no audio */ }
}

const AUDIO = DATA.audio || {};
const CLIPS = {};
let playing = null;
const hasClip = (text) => Boolean(AUDIO[text]);
/** Play the Mandarin clip for a character or a radical's name. The sound switch silences it unless always is set. */
function say(text, always) {
  if (!AUDIO[text] || (!always && !state.sound)) return;
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    actx.resume();
    const start = (buf) => {
      try { playing?.stop(); } catch (e) { /* already over */ }
      playing = actx.createBufferSource();
      playing.buffer = buf;
      playing.connect(actx.destination);
      playing.start();
    };
    if (CLIPS[text]) { start(CLIPS[text]); return; }
    const bin = atob(AUDIO[text]), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    actx.decodeAudioData(bytes.buffer).then((buf) => { CLIPS[text] = buf; start(buf); }).catch(() => {});
  } catch (e) { /* no audio */ }
}
const SPEAKER_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
/** A small round "listen" button; nothing at all when there is no clip for the text. */
function listenBtn(text, label) {
  if (!hasClip(text)) return null;
  return el("button.listen", { type: "button", title: "Listen", "aria-label": `Listen to ${label || text}`,
    onclick: (e) => { e.stopPropagation(); say(text, true); }, html: SPEAKER_SVG });
}

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 2600);
}
