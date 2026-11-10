// ---------------------------------------------------------------- questions
// Five kinds, from recognising a radical to using it on a character nobody taught you.

// Radicals whose hints overlap. They never appear as wrong answers for one another,
// so a question always has exactly one defensible answer.
const CLOSE = [["mouth", "speech", "food"], ["hand", "knife", "foot"], ["foot", "walk", "vehicle"], ["water", "rain"], ["fire", "sun"],
  ["tree", "grass", "bamboo"], ["animal", "bug"], ["flesh", "sick", "person", "woman", "heart", "eye"], ["roof", "door", "earth"],
  ["clothes", "silk"], ["metal", "shell", "knife"], ["earth", "tree", "metal"], ["hand", "silk"], ["person", "foot", "walk"]];
const clash = (a, b) => a === b || CLOSE.some((set) => set.includes(a) && set.includes(b));
const others = (r) => RADS.filter((o) => !clash(r.id, o.id));
const lower = (r) => r.name.toLowerCase();
/** Wrong answers for a recognition question: the radical's own set and anything already met come first. */
function rivals(r) {
  const fair = RADS.filter((o) => o.id !== r.id && o.name !== r.name);
  const near = fair.filter((o) => o.group === r.group || level(o.id) > 0);
  return [...pick(near, 3), ...pick(fair.filter((o) => !near.includes(o)), 3)].slice(0, 3);
}

const charCard = (ch, extra) => el("span.q-char", extra || null, hanzi(ch));
const radStyle = (r) => ({ "--rc": `var(--c-${r.color})` });

function qMeaning(r) {
  const wrong = rivals(r);
  return { rad: r, kind: "meaning",
    prompt: "What does this radical hint at?",
    stage: () => el("div.q-glyph", { style: radStyle(r) }, hanzi(r.glyph, { whole: true, center: true, anim: true })),
    options: shuffle([r, ...wrong]).map((o) => ({ ok: o.id === r.id, node: () => o.name, cls: "word" })),
    explain: () => rich(`${r.glyph} is ${lower(r)}: ${r.clue}.`) };
}

function qGlyph(r) {
  const wrong = rivals(r);
  return { rad: r, kind: "glyph",
    prompt: el("span", "Which radical means ", el("strong", lower(r)), "?"),
    options: shuffle([r, ...wrong]).map((o) => ({ ok: o.id === r.id, cls: "glyph", style: radStyle(o), label: o.name,
      node: () => hanzi(o.glyph, { whole: true, center: true }) })),
    explain: () => rich(`${r.glyph} is ${lower(r)}. It usually sits ${POS_LABEL[r.pos]}.`) };
}

/** An unseen character: the radical is the only way in. */
function qDecode(r, item, still) {
  item ||= sample(r.decode);
  const wrong = pick(others(r), 3).map((o) => sample(o.decode));
  const form = formOf(r, item);
  return { rad: r, kind: "decode", item,
    prompt: "You have not been taught this one. Which meaning fits?",
    stage: () => el("div.q-glyph.big", { style: radStyle(r) }, hanzi(item[0], { anim: !still }), el("span.q-py", item[1]), listenBtn(item[0])),
    options: shuffle([item, ...wrong]).map((o) => ({ ok: o === item, node: () => o[2], cls: "word" })),
    explain: (ok) => rich(ok ? `${form} points to ${lower(r)}. ${item[0]} ${item[1]} means ${item[2]}.`
      : `The clue was ${form}, ${lower(r)}: ${r.clue}. ${item[0]} ${item[1]} means ${item[2]}.`) };
}

/** Four characters, one of them from this radical's family. */
function qFamily(r) {
  const item = sample([...r.ex, ...r.decode]);
  // a wrong answer must not carry this radical's shape anywhere inside it
  const shapes = [r.glyph, r.alt, r.full].filter(Boolean);
  const clean = (it) => !shapes.some((s) => (DATA.comps[it[0]] || "").includes(s));
  const wrong = [];
  for (const o of shuffle(others(r))) {
    const ok = [...o.ex, ...o.decode].filter(clean);
    if (ok.length) wrong.push([o, sample(ok)]);
    if (wrong.length === 3) break;
  }
  return { rad: r, kind: "family", item,
    prompt: el("span", "Which character has to do with ", el("strong", r.clue), "?"),
    options: shuffle([[r, item], ...wrong]).map(([o, it]) => ({ ok: o.id === r.id, cls: "glyph char", style: radStyle(o), label: it[0],
      node: () => hanzi(it[0]), note: `${it[1]} · ${it[2]}` })),
    explain: () => rich(`${item[0]} ${item[1]} means ${item[2]}. It carries ${formOf(r, item)}, ${lower(r)}.`) };
}

/** Tap the radical inside a character. */
function qSpot(r) {
  const item = sample(r.ex);
  return { rad: r, kind: "spot", item,
    prompt: el("span", "Tap the radical in this character. It means ", el("strong", lower(r)), "."),
    spot: item[0],
    explain: () => rich(`${formOf(r, item)} is the ${lower(r)} radical. ${item[0]} ${item[1]} means ${item[2]}.`) };
}

/**
 * Put one question on screen. cb(ok) fires when the learner moves on.
 * opt.fast: no explanation, a short flash and straight on (the sprint).
 */
function mountQuestion(q, host, cb, opt = {}) {
  let answered = false;
  const fb = el("div.q-fb", { hidden: true });
  const finish = (ok, reveal) => {
    if (answered) return;
    answered = true;
    blip(ok ? "ok" : "no");
    reveal();
    host.classList.add(ok ? "is-right" : "is-wrong");
    if (opt.fast) { setTimeout(() => cb(ok), ok ? 380 : 1100); return; }
    // the meaning has just been confirmed: now hear the character
    if (q.item) setTimeout(() => say(q.item[0]), 420);
    const go = opt.noContinue ? null : el("button.btn.primary", { type: "button", onclick: () => cb(ok) }, "Continue");
    fb.replaceChildren(
      el("div.q-verdict", ok ? sample(["Right.", "Yes.", "Got it.", "Correct."]) : "Not this time."),
      el("p.q-why", q.explain(ok)),
      go || "");
    fb.hidden = false;
    if (!go) { cb(ok); return; }
    go.focus({ preventScroll: true });
    fb.scrollIntoView({ block: "nearest", behavior: reduceMotion() ? "auto" : "smooth" });
  };

  const prompt = el("p.q-prompt", q.prompt);
  let body;
  if (q.spot) {
    const g = STROKES[q.spot];
    const svg = hanzi(q.spot);
    const wrap = el("button.q-spot", { type: "button", style: radStyle(q.rad), "aria-label": "Tap the radical" }, svg);
    wrap.addEventListener("click", (ev) => {
      if (answered) return;
      const i = strokeAt(svg, q.spot, ev);
      const ok = g.r.includes(i);
      if (!ok) $(`path[data-i="${i}"]`, svg)?.classList.add("miss");
      finish(ok, () => wrap.classList.add("lit"));
    });
    body = el("div.q-stage", wrap, el("span.q-py", q.item[1]));
  } else {
    const buttons = q.options.map((o, i) => {
      const b = el("button.opt." + o.cls.split(" ").join("."), { type: "button", style: o.style, "aria-label": o.label || null },
        el("span.opt-key", String(i + 1)), el("span.opt-body", o.node()), o.note ? el("span.opt-note", o.note) : null);
      b.addEventListener("click", () => finish(o.ok, () => {
        buttons.forEach((x, j) => { x.disabled = true; x.classList.add(q.options[j].ok ? "right" : "off"); });
        if (!o.ok) b.classList.add("wrong");
        host.querySelector(".q-glyph")?.classList.add("lit");
      }));
      return b;
    });
    body = [q.stage ? el("div.q-stage", q.stage()) : null,
      el("div.q-opts." + (q.options[0].cls.includes("glyph") ? "glyphs" : "words"), buttons)];
  }
  host.className = "q " + q.kind;
  host.replaceChildren(prompt, ...[body].flat().filter(Boolean), fb);
  host.onkeydown = null;
  mountQuestion.keys = (ev) => {
    if (answered || q.spot) return;
    const k = Number(ev.key);
    if (k >= 1 && k <= q.options.length) $$(".opt", host)[k - 1].click();
  };
}
document.addEventListener("keydown", (ev) => { if (mountQuestion.keys && !ev.metaKey && !ev.ctrlKey && !ev.altKey) mountQuestion.keys(ev); });
