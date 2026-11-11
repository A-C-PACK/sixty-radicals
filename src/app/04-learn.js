// ---------------------------------------------------------------- one radical: meet it, see it at work, try it
function posDiagram(pos) {
  const bars = { left: [[0, 0, 36, 100]], right: [[64, 0, 36, 100]], top: [[0, 0, 100, 34]], bottom: [[0, 66, 100, 34]],
    "wrap-tl": [[0, 0, 100, 28], [0, 0, 28, 100]], "wrap-bl": [[0, 0, 28, 100], [0, 72, 100, 28]],
    frame: [[0, 0, 100, 24], [0, 0, 24, 100], [76, 0, 24, 100]],
    box: [[0, 0, 100, 22], [0, 0, 22, 100], [78, 0, 22, 100], [0, 78, 100, 22]] }[pos];
  const svg = document.createElementNS(SVGNS, "svg");
  svg.setAttribute("viewBox", "-4 -4 108 108");
  svg.setAttribute("class", "pos");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = `<rect class="pos-box" x="0" y="0" width="100" height="100" rx="10"/>` +
    bars.map(([x, y, w, h]) => `<rect class="pos-on" x="${x}" y="${y}" width="${w}" height="${h}" rx="6"/>`).join("");
  return svg;
}

/** The same glyph moved to the middle of its box, in the format Hanzi Writer reads. */
function writerData(ch) {
  const g = STROKES[ch], b = bounds(ch);
  const dx = Math.round(512 - (b.x0 + b.x1) / 2), dy = Math.round(388 - (b.y0 + b.y1) / 2);
  let odd = false;
  const move = (d) => d.replace(/-?\d+(\.\d+)?/g, (n) => { odd = !odd; return String(Math.round((Number(n) + (odd ? dx : dy)) * 10) / 10); });
  return { strokes: g.s.map((d) => { odd = false; return move(d); }), medians: g.m.map((m) => m.map(([x, y]) => [x + dx, y + dy])), radStrokes: [] };
}

function radPanel(r) {
  const stage = el("div.panel-glyph");
  const draw = () => {
    stage.classList.remove("tracing");
    stage.replaceChildren(hanzi(r.glyph, { whole: true, center: true, anim: true }));
  };
  draw();
  const traceBtn = el("button.btn.small", { type: "button" }, "Trace it");
  const replayBtn = el("button.btn.small", { type: "button", onclick: () => { draw(); traceBtn.textContent = "Trace it"; say(r.full || r.glyph); } }, "Replay strokes");
  traceBtn.addEventListener("click", () => {
    if (!window.HanziWriter) { toast("Tracing needs a connection the first time. Try again in a moment."); return; }
    stage.classList.add("tracing");
    stage.replaceChildren();
    const size = Math.round(stage.getBoundingClientRect().width);
    const data = writerData(r.glyph);
    const writer = window.HanziWriter.create(stage, r.glyph, { width: size, height: size, padding: Math.round(size * 0.07), showCharacter: false, showOutline: true,
      charDataLoader: (c, done) => done(data), strokeColor: cssVar("--c-" + r.color), outlineColor: cssVar("--line"),
      drawingColor: cssVar("--ink"), drawingWidth: 26, highlightColor: cssVar("--red"), showHintAfterMisses: 2 });
    traceBtn.textContent = "Start over";
    writer.quiz({ onComplete: (s) => { blip("win"); toast(s.totalMistakes ? `Done, with ${s.totalMistakes} slip${s.totalMistakes === 1 ? "" : "s"}. Try once more for a clean one.` : "A clean one. Well written."); } });
  });

  const same = r.full === r.glyph;
  const fullRow = r.full
    ? el("div.panel-row",
        el("span.kai", hanzi(r.full)), py(r.fullPinyin), listenBtn(r.full),
        el("span.dim", same ? "also a word by itself" : FULL_IS_WORD.has(r.id) ? "the everyday word" : "the full character"))
    : el("div.panel-row", el("span.dim", "Only ever a radical. It is not a word by itself."));
  const altRow = r.alt
    ? el("div.panel-row.alt", el("span.kai.col", hanzi(r.alt, { whole: true, center: true })), el("span.dim", `its second shape, ${POS_LABEL[r.altPos]}`))
    : null;
  return el("aside.panel", { style: radStyle(r) },
    el("button.panel-stage", { type: "button", title: "Replay the strokes", onclick: (e) => { if (!stage.classList.contains("tracing")) draw(); } }, stage),
    el("h1.panel-name", r.name),
    fullRow, altRow,
    el("div.panel-row.where", posDiagram(r.pos), el("span", `Usually ${POS_LABEL[r.pos]}`, r.altPos && !r.alt ? `, sometimes ${POS_LABEL[r.altPos]}` : "")),
    el("div.panel-row.cn", el("span.kai", [...r.cn].map((c) => hanzi(c))), py(r.cnPinyin), listenBtn(r.cn),
      el("span.dim", rich(`what teachers call it: “${r.cnLit}”`))),
    el("div.panel-btns", replayBtn, traceBtn));
}

function exampleCard(r, item, i) {
  const [ch, pin, mean, why] = item;
  const stage = el("span.ex-char", hanzi(ch, { anim: true, delay: 0.25 + i * 0.3 }));
  return el("button.ex", { type: "button", title: hasClip(ch) ? "Hear it and draw it again" : "Draw it again", onclick: () => { stage.replaceChildren(hanzi(ch, { anim: true })); say(ch); } },
    stage,
    el("span.ex-py", pin, hasClip(ch) ? el("span.ex-snd", { html: SPEAKER_SVG }) : null),
    el("span.ex-mean", mean),
    el("span.ex-why", rich(why)));
}

function lessonView(r) {
  const g = r.group;
  const prev = RADS[r.n - 1], next = RADS[r.n + 1];
  const lastInSet = r.ri === g.radicals.length - 1;
  const dots = el("nav.dots", { "aria-label": `Radicals in ${g.title}` }, g.radicals.map((o) =>
    el("a.dot" + (o.id === r.id ? ".on" : "") + (level(o.id) ? ".seen" : ""), { href: "#r-" + o.id, style: radStyle(o), "aria-label": o.name, title: o.name },
      hanzi(o.glyph, { whole: true, center: true }))));

  const check = el("div.q");
  const after = el("div.lesson-next", { hidden: true });
  const q = qDecode(r, r.decode[0]);
  q.prompt = "You have never been taught this character. Use the radical: which meaning fits?";
  mountQuestion(q, check, (ok) => {
    // the stamp is earned by answering, right or wrong: the answer is where the learning happens
    const first = level(r.id) === 0;
    record(r.id, ok);
    refreshBar();
    if (first) toast(`${r.name} learned. ${learnedCount()} of ${RADS.length}.`);
    after.hidden = false;
    after.querySelector("a").focus({ preventScroll: true });
    after.scrollIntoView({ block: "nearest", behavior: reduceMotion() ? "auto" : "smooth" });
  }, { noContinue: true });
  after.append(
    lastInSet
      ? el("a.btn.primary", { href: "#set-" + g.id }, `Practise the ${g.title} set`)
      : el("a.btn.primary", { href: "#r-" + next.id }, `Next: ${next.name}`),
    lastInSet && next ? el("a.btn.ghost", { href: "#r-" + next.id }, `Skip to ${next.group.title}`) : null);

  return el("div.lesson.wrap", { style: radStyle(r) },
    el("div.lesson-top",
      el("a.back", { href: "#the-sixty" }, "← All sixty"),
      el("div.lesson-set", el("span.eyebrow", `${g.title} · ${r.ri + 1} of ${g.radicals.length}`), dots),
      el("div.lesson-arrows",
        prev ? el("a.btn.small", { href: "#r-" + prev.id, "aria-label": `Previous: ${prev.name}` }, "←") : null,
        next ? el("a.btn.small", { href: "#r-" + next.id, "aria-label": `Next: ${next.name}` }, "→") : null)),
    el("div.lesson-grid",
      radPanel(r),
      el("div.lesson-body",
        el("p.origin", rich(r.origin)),
        el("div.clue", el("span.clue-glyph", hanzi(r.glyph, { whole: true, center: true })), el("span.clue-arrow", "→"),
          el("span.clue-text", el("span.eyebrow", "When you see it, think"), el("strong", r.clue))),
        el("h2.h-small", "At work in four characters"),
        el("div.ex-grid", r.ex.map((item, i) => exampleCard(r, item, i))),
        el("div.watch", el("span.eyebrow", "Watch out"), el("p", rich(r.watch))),
        el("h2.h-small", "Your turn"),
        check,
        after)));
}
