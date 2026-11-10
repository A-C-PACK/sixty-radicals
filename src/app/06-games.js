// ---------------------------------------------------------------- the two games each set ends with
const GAMES = DATA.games;
const radVar = (r) => `var(--c-${r.color})`;
const shapes = (r) => [r.glyph, r.alt].filter(Boolean);
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const COUNT_WORD = ["no", "one", "two", "three", "four", "five", "six"];
/** The hunts of a set's scene that have been finished with nothing shown. */
const huntsDone = (g) => (state.hunt[g.id] || []).filter((id) => GAMES[g.id].scene.hunts.some((h) => h.rad === id));

// ---------------------------------------------------------------- radical hunt
// One piece of everyday text per set: a menu, a forecast, a clinic form. Each hunt asks for every character in it that carries one radical.
function huntGame(g) {
  const SCENE = GAMES[g.id].scene, HUNTS = SCENE.hunts;
  const cells = [];
  const done = new Set(huntsDone(g));
  let hi = 0, misses = 0, over = false;
  const found = new Set(), shown = new Set();
  const hunt = () => HUNTS[hi];
  const rad = () => RAD[hunt().rad];
  const total = () => Object.keys(hunt().targets).length;

  const cell = (ch) => {
    const c = { ch, btn: el("button.mc", { type: "button", "aria-label": ch, onclick: () => tap(c) }, hanzi(ch)) };
    cells.push(c);
    return c.btn;
  };
  // the page carries no Chinese font, so the text keeps to plain punctuation
  const line = (zh) => [...zh].map((ch) => (STROKES[ch] ? cell(ch) : ch === " " ? el("span.gap") : el("span.pz", ch)));
  const chat = SCENE.kind === "chat";
  const row = (it) => (chat
    ? el("div.row.msg", el("span.msg-who", it.tag), el("div.row-zh", line(it.zh)), el("span.row-en", it.en))
    : el("div.row" + (it.tag ? ".has-tag" : ""), el("div.row-zh", line(it.zh)),
      it.tag ? [el("span.row-lead"), el("span.row-tag", it.tag)] : null, el("span.row-en", it.en)));
  const scene = el("div.scene" + (chat ? ".chat" : ""),
    el("div.scene-top", el("span.scene-zh", [...SCENE.zh].map((ch) => hanzi(ch))), el("span.scene-en", SCENE.en)),
    SCENE.sections.map((s) => el("section.scene-sec", el("h4.scene-label", s.label),
      el("div.rows" + (s.wide || chat ? ".wide" : ""), s.rows.map(row)))));
  const chips = el("div.hunt-chips"), head = el("div.hunt-head"), count = el("div.hunt-count");
  const status = el("p.hunt-status", { role: "status", "aria-live": "polite" });
  const foot = el("div.hunt-foot"), tray = el("ol.found-list");
  const info = el("div.hunt-info", chips, head);
  const live = el("div.hunt-live", count, status);
  const root = el("div.hunt", scene, el("div.hunt-side", info, live, foot, tray));

  function begin(i) {
    hi = i; misses = 0; over = false;
    found.clear(); shown.clear();
    for (const c of cells) {
      c.btn.className = "mc";
      c.btn.style.removeProperty("--rc");
      c.btn.removeAttribute("aria-pressed");
    }
    tray.replaceChildren();
    status.className = "hunt-status";
    status.textContent = `Nothing found yet. Tap a character ${SCENE.where}.`;
    paint();
  }

  /** On a phone the text sits between the question and the result, so each is brought into view when its turn comes. */
  function bring(part) {
    const box = part.getBoundingClientRect();
    if (box.top < 60 || box.bottom > window.innerHeight) part.scrollIntoView({ block: part === foot ? "center" : "start", behavior: reduceMotion() ? "auto" : "smooth" });
  }

  function paint() {
    const h = hunt(), r = rad(), n = total();
    for (const part of [info, live, tray]) part.style.setProperty("--rc", radVar(r));
    chips.replaceChildren(...HUNTS.map((x, i) => {
      const xr = RAD[x.rad];
      return el("button.chip" + (i === hi ? ".on" : ""), { type: "button", style: { "--rc": radVar(xr) }, "aria-pressed": String(i === hi), onclick: () => begin(i) },
        el("span.kai.col", hanzi(xr.glyph, { whole: true, center: true })), xr.name, done.has(x.rad) ? el("span.chip-tick", { "aria-label": "done" }, "✓") : null);
    }));
    head.replaceChildren(
      el("p.eyebrow", `Hunt ${hi + 1} of ${HUNTS.length}`),
      el("div.hunt-rad", shapes(r).map((f) => el("span.hunt-glyph", hanzi(f, { whole: true, center: true }))), el("span.hunt-name", r.name)),
      el("p.hunt-ask", `Tap every character ${SCENE.where} that carries it. Think of ${r.clue}. `,
        h.hint || (shapes(r).length > 1 ? "It has two shapes: one for the side, one for underneath." : "")));
    count.replaceChildren(el("span.pips", Array.from({ length: n }, (_, k) => el("span.pip" + (k < found.size + shown.size ? ".on" : "")))),
      el("span.count-text", `${found.size} of ${n} found`));
    const next = hi + 1 < HUNTS.length ? RAD[HUNTS[hi + 1].rad] : null;
    foot.replaceChildren(...(over
      ? [el("p.hunt-sum", shown.size ? `You found ${found.size} of ${n}. The other ${shown.size === 1 ? "one is" : shown.size + " are"} outlined ${SCENE.where}.`
          : `All ${n} found with ${misses ? plural(misses, "wrong tap") : "no wrong taps"}.`),
        next ? el("button.btn.primary", { type: "button", onclick: () => { begin(hi + 1); bring(info); } }, "Next hunt: ", el("span.kai", hanzi(next.glyph, { whole: true, center: true })), next.name)
          : el("a.btn.primary", { href: "#build-" + g.id }, "Now build a character"),
        shown.size ? el("button.link", { type: "button", onclick: () => { begin(hi); bring(info); } }, "Try this hunt again")
          : next ? null : el("button.link", { type: "button", onclick: () => { begin(0); bring(info); } }, "Hunt again from the start")]
      : [el("button.link", { type: "button", onclick: reveal }, "Show me the rest")]).filter(Boolean));
  }

  /** Light up a target wherever it appears; the same character often turns up in several lines. */
  function mark(ch, byPlayer) {
    const t = hunt().targets[ch];
    (byPlayer ? found : shown).add(ch);
    for (const c of cells) {
      if (c.ch !== ch) continue;
      c.btn.classList.add(byPlayer ? "found" : "shown");
      c.btn.style.setProperty("--rc", radVar(rad()));
      c.btn.setAttribute("aria-pressed", "true");
    }
    tray.append(el("li.found-row" + (byPlayer ? "" : ".was-shown"),
      el("span.found-ch", hanzi(ch)),
      el("div.found-text", el("p.found-top", py(t[0]), el("span.found-gloss", t[1]), listenBtn(ch)), el("p.found-why", rich(t[2])))));
  }

  function tap(c) {
    const h = hunt(), r = rad(), t = h.targets[c.ch];
    if (found.has(c.ch) || shown.has(c.ch)) { say(c.ch, true); return; }
    if (over) return;
    if (t) {
      mark(c.ch, true);
      blip("ok");
      setTimeout(() => say(c.ch), 260);
      status.className = "hunt-status good";
      status.replaceChildren(rich(c.ch + " "), py(t[0]), `, ${t[1]}. `, rich(t[2]));
      if (found.size === total()) finish();
      paint();
      return;
    }
    c.btn.classList.remove("no");
    void c.btn.offsetWidth;
    c.btn.classList.add("no");
    blip("no");
    const own = SCENE.rads[c.ch], forms = shapes(r).join(" or ");
    let msg, counts = true;
    if (h.traps[c.ch]) msg = h.traps[c.ch];
    // the radical standing alone is not what the hunt is after, and not a mistake worth counting
    else if (shapes(r).includes(c.ch)) { msg = `${c.ch} on its own is a whole character. This hunt is for characters that carry it as a part.`; counts = false; }
    else if (c.ch === r.full) { msg = `${c.ch} is ${r.name} written in full. This hunt is for its side form, ${r.glyph}.`; counts = false; }
    else if (own && own[0] !== r.id && own[1] !== c.ch) msg = `No ${forms} in ${c.ch}. It carries ${own[1]} ${RAD[own[0]].name}.`;
    else msg = `No ${forms} in ${c.ch}.`;
    if (counts) misses++;
    status.className = "hunt-status bad";
    status.replaceChildren(rich(msg));
  }

  function finish() {
    over = true;
    done.add(hunt().rad);
    state.hunt[g.id] = [...done];
    save();
    setTimeout(() => blip("win"), 500);
    const at = hi;
    setTimeout(() => { if (root.isConnected && over && hi === at) bring(foot); }, 900);
  }

  function reveal() {
    for (const ch of Object.keys(hunt().targets)) if (!found.has(ch)) mark(ch, false);
    over = true;
    status.className = "hunt-status";
    status.textContent = `The ones you missed are outlined ${SCENE.where} and listed with the others.`;
    paint();
    bring(foot);
  }

  // pick up at the first hunt not yet finished
  const first = HUNTS.findIndex((h) => !done.has(h.rad));
  begin(first < 0 ? 0 : first);
  return root;
}

// ---------------------------------------------------------------- build a character
// Start from a meaning: choose the radical, say where it sits, then find the part that finishes it.
function buildGame(g) {
  const BUILDS = GAMES[g.id].builds;
  const STEPS = ["Meaning", "Position", "The other part"];
  let bi = 0, step = 0, slips = 0, timer = null;
  const bench = el("div.bench"), ask = el("div.build-ask"), steps = el("ol.steps"), opts = el("div.build-opts");
  const msg = el("p.build-msg", { role: "status", "aria-live": "polite" }), foot = el("div.build-foot");
  const root = el("div.build", el("div.build-left", bench), el("div.build-right", ask, steps, opts, msg, foot));
  const b = () => BUILDS[bi];
  const rad = () => RAD[b().rad];
  const form = () => b().form || rad().glyph;
  const tell = (cls, text) => { msg.className = "build-msg " + cls; msg.replaceChildren(rich(text)); };
  const glyphOf = (ch) => el("span.kai", hanzi(ch, { whole: true, center: true }));

  function round(i) {
    bi = i; step = 0;
    clearTimeout(timer);
    root.style.removeProperty("--rc");
    bench.replaceChildren();
    foot.replaceChildren();
    msg.className = "build-msg";
    msg.textContent = "";
    paint();
  }

  function paint() {
    const t = b(), r = rad();
    ask.replaceChildren(
      el("p.eyebrow", `Character ${bi + 1} of ${BUILDS.length}`),
      el("p.build-lead", "Build the character for"),
      el("div.build-target", el("span.build-mean", t.mean), el("span.build-py", py(t.py), listenBtn(t.ch, t.py))));
    // the second shape of a radical is only given away once its position is known
    const chosen = [glyphOf(step > 1 ? form() : r.glyph), POS_LABEL[t.pos], el("span.kai", hanzi(t.parts[0][0], { center: true }))];
    steps.replaceChildren(...STEPS.map((name, k) => el("li.step" + (k < step ? ".got" : k === step ? ".now" : ""),
      el("span.step-n", String(k + 1)), el("span.step-name", name), k < step ? el("span.step-val", chosen[k]) : null)));
    if (step === 0) {
      choices("Which radical carries the meaning?", "n4", shuffle(t.radOpts).map((id) => {
        const o = RAD[id];
        return pickBtn([el("span.pick-glyph", hanzi(o.glyph, { whole: true, center: true })), el("span.pick-name", o.name)], id === t.rad, () => {
          root.style.setProperty("--rc", radVar(r));
          bench.replaceChildren(hanzi(r.glyph, { whole: true, center: true, anim: true, cls: "held" }));
          tell("good", `${r.glyph} ${r.name}: ${r.clue}.`);
        }, () => tell("bad", t.radNotes[id] || `${o.glyph} ${o.name} is for ${o.clue}. Try another.`));
      }));
    } else if (step === 1) {
      const q = t.form ? [`${cap(r.name.toLowerCase())} has two shapes, `, glyphOf(r.glyph), " and ", glyphOf(r.alt), ". Where does it sit in this character?"]
        : ["Where does ", el("span.kai.col", hanzi(r.glyph, { whole: true, center: true })), " sit?"];
      choices(q, "n4", shuffle(t.posOpts).map((pos) =>
        pickBtn([posDiagram(pos), el("span.pick-name.plain", cap(POS_LABEL[pos]))], pos === t.pos, () => {
          bench.replaceChildren(hanzi(t.ch, { cls: "only-rad pop" }));
          tell("good", t.posNote);
        }, () => tell("bad", `Not there. Picture ${t.parts[1][3]} and ${t.parts[2][3]}: where does ${form()} sit in those?`))));
    } else if (step === 2) {
      choices("Which part finishes it?", "n3", shuffle(t.parts).map((p) =>
        pickBtn([el("span.pick-glyph.plain", hanzi(p[0], { center: true })), el("span.pick-py", py(p[1])), el("span.pick-mean", p[2])], p === t.parts[0], () => {
          clearTimeout(timer);
          const drawn = hanzi(t.ch, { anim: true });
          bench.replaceChildren(drawn);
          setTimeout(() => say(t.ch), Number(drawn.dataset.dur || 0) * 1000 + 150);
          tell("good", `${t.ch} ${t.py}, ${t.mean}. ${t.done}`);
          foot.replaceChildren(bi + 1 < BUILDS.length
            ? el("button.btn.primary", { type: "button", onclick: () => round(bi + 1) }, "Next character")
            : el("button.btn.primary", { type: "button", onclick: finish }, "See what you built"));
        }, () => {
          // a real character, just not the one asked for: show it for a moment, then take the wrong part away again
          clearTimeout(timer);
          bench.replaceChildren(hanzi(p[3], { anim: true, cls: "ghost" }));
          tell("bad", `${form()} with ${p[0]} makes ${p[3]} ${p[4]}, ${p[5]}. A real character, but not this one.`);
          const at = bi;
          timer = setTimeout(() => { if (bi === at && step === 2) bench.replaceChildren(hanzi(t.ch, { cls: "only-rad" })); }, 2400);
        })));
    } else {
      opts.replaceChildren();
    }
  }

  function choices(question, cls, buttons) {
    opts.className = "build-opts " + cls;
    opts.replaceChildren(el("p.build-q", question), ...buttons);
  }

  /** One answer tile. A wrong one greys out and stays; the right one moves the build on a step. */
  function pickBtn(kids, right, onRight, onWrong) {
    const btn = el("button.pick", { type: "button", onclick: () => {
      if (!right) {
        slips++;
        btn.classList.add("out");
        btn.disabled = true;
        blip("no");
        onWrong(btn);
        return;
      }
      blip("ok");
      for (const other of $$(".pick", opts)) other.disabled = true;
      btn.classList.add("right");
      btn.style.setProperty("--rc", radVar(rad()));
      onRight(btn);
      step++;
      const at = bi;
      if (step < 3) timer = setTimeout(() => { if (bi === at && root.isConnected) paint(); }, 1500); else paint();
    } }, kids);
    return btn;
  }

  function finish() {
    clearTimeout(timer);
    step = 3;
    state.built[g.id] = Math.min(state.built[g.id] ?? slips, slips);
    save();
    // the square keeps the last character; tapping a card draws that one again
    const show = (t) => {
      root.style.setProperty("--rc", radVar(RAD[t.rad]));
      bench.replaceChildren(hanzi(t.ch, { anim: true }));
      say(t.ch, true);
    };
    ask.replaceChildren(el("p.eyebrow", "Done"), el("p.build-lead", `${BUILDS.length} characters built`),
      el("div.build-target", el("span.build-mean", slips ? plural(slips, "slip") : "No slips")));
    steps.replaceChildren();
    opts.className = "build-opts built";
    opts.replaceChildren(...BUILDS.map((t) => el("button.built-card", { type: "button", style: { "--rc": radVar(RAD[t.rad]) }, title: "Draw and hear it again", onclick: () => show(t) },
      el("span.built-ch", hanzi(t.ch)), el("span.pick-py", py(t.py)), el("span.pick-mean", t.mean))));
    msg.className = "build-msg";
    msg.textContent = "Each one is a radical in its usual place plus a second part, which most often hints at the sound.";
    foot.replaceChildren(el("a.btn.primary", { href: "#the-thirty" }, "Back to the thirty"),
      el("button.btn.ghost", { type: "button", onclick: () => { slips = 0; round(0); } }, "Build them again"));
    blip("win");
  }

  round(0);
  return root;
}

// ---------------------------------------------------------------- where the games are reached from
/** Links to a set's two games, with what has been done so far. `only` keeps just one of them. */
function gameLinks(g, only) {
  const game = GAMES[g.id], n = game.scene.hunts.length, got = huntsDone(g).length, built = state.built[g.id] !== undefined;
  const link = (kind, zh, label, title, mark, isDone) => el("a.game-link" + (isDone ? ".is-done" : ""), { href: `#${kind}-${g.id}` },
    el("span.game-link-zh", [...zh].map((ch) => hanzi(ch))),
    el("span.game-link-text", el("span.game-link-kind", label), el("span.game-link-title", title)),
    mark ? el("span.game-link-mark", mark) : null);
  return el("div.game-links" + (only ? ".one" : ""),
    only === "build" ? null : link("hunt", game.scene.zh, "Radical hunt", `${game.scene.en} · ${n} hunts`, got ? (got === n ? "✓ done" : `${got} / ${n}`) : null, got === n),
    only === "hunt" ? null : link("build", game.builds.map((t) => t.ch).join(""), "Build a character", `${cap(COUNT_WORD[game.builds.length])} characters`, built ? "✓ built" : null, built));
}

function gameView(kind, g) {
  const game = GAMES[g.id], isHunt = kind === "hunt";
  return el("div.game.wrap",
    el("div.quiz-top", el("a.back", { href: "#the-thirty" }, "← Leave"), el("span.eyebrow", `Set ${GROUPS.indexOf(g) + 1} · ${g.title}`), el("span.quiz-count")),
    el("div.game-head",
      el("h1", isHunt ? "RADICAL " : "BUILD A ", el("span.red", isHunt ? "HUNT" : "CHARACTER")),
      el("p.sub", isHunt ? `One ${game.scene.noun}, ${COUNT_WORD[game.scene.hunts.length]} hunts. The aim is to spot radicals in something you would really read.`
        : "Start from a meaning and put the character together: the radical, where it sits, then the part that finishes it.")),
    isHunt ? huntGame(g) : buildGame(g),
    el("div.game-more", el("p.eyebrow", "Also in this set"), gameLinks(g, isHunt ? "build" : "hunt"),
      el("a.btn.small.ghost", { href: "#set-" + g.id }, "Practise this set")));
}
