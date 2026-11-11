// ---------------------------------------------------------------- practice rounds
function setQuestions(g) {
  const rs = g.radicals;
  const recog = shuffle(rs).map((r, i) => (i % 2 ? qGlyph(r) : qMeaning(r)));
  const use = shuffle([
    ...pick(rs, 2).map(qSpot),
    ...pick(rs, 3).map((r) => qDecode(r, r.decode[1])),
    ...pick(rs, 2).map(qFamily)]);
  return [...recog, ...use];
}

/** Ten questions from the radicals already learned, the shakiest first. */
function reviewQuestions() {
  let pool = RADS.filter((r) => level(r.id) > 0);
  if (pool.length < 4) pool = RADS.slice(0, Math.max(5, pool.length));
  const now = Date.now();
  const need = (r) => {
    const p = prog(r.id);
    const days = p.last ? (now - p.last) / 864e5 : 30;
    return (3 - Math.min(3, p.streak)) * 2 + Math.min(3, p.wrong) + Math.min(3, days / 2) + Math.random() * 2;
  };
  const chosen = [...pool].sort((a, b) => need(b) - need(a)).slice(0, 10);
  while (chosen.length < 10) chosen.push(sample(pool));
  const kinds = [qMeaning, qGlyph, qSpot, qDecode, qFamily, qDecode, qFamily, qSpot, qDecode, qMeaning];
  return shuffle(chosen).map((r, i) => kinds[i](r));
}

function quizShell(title, body) {
  const bar = el("div.quiz-meter", el("div.quiz-fill"));
  const count = el("span.quiz-count");
  const view = el("div.quiz.wrap",
    el("div.quiz-top", el("a.back", { href: "#the-sixty" }, "← Leave"), el("span.eyebrow", title), count),
    bar, body);
  return { view, setProgress: (i, n) => { $(".quiz-fill", bar).style.width = `${(Math.min(i, n) / n) * 100}%`; count.textContent = i < n ? `${i + 1} / ${n}` : "Retry"; } };
}

function resultRow(r, ok) {
  return el("a.res" + (ok ? ".ok" : ".no"), { href: "#r-" + r.id, style: radStyle(r) },
    el("span.res-glyph", hanzi(r.glyph, { whole: true, center: true })),
    el("span.res-name", r.name),
    el("span.res-mark", ok ? "✓" : "review"),
    stamp(level(r.id)));
}

/** A round with feedback after every answer. Missed questions come back once at the end. */
function quizView({ title, questions, onDone, again, nextLink, extra }) {
  const host = el("div.q");
  const shell = quizShell(title, host);
  const firstTry = new Map();
  const queue = questions.map((q) => ({ q, retry: false }));
  let i = 0, right = 0;
  const total = questions.length;
  const step = () => {
    if (i >= queue.length) return finish();
    const { q, retry } = queue[i];
    shell.setProgress(i, total);
    host.classList.remove("is-right", "is-wrong");
    mountQuestion(q, host, (ok) => {
      if (!retry) {
        record(q.rad.id, ok);
        if (ok) right++;
        firstTry.set(q.rad.id, (firstTry.get(q.rad.id) ?? true) && ok);
        if (!ok) queue.push({ q: { ...q, prompt: q.prompt }, retry: true });
      }
      i++;
      refreshBar();
      step();
    });
    if (retry) host.prepend(el("p.q-again", "One you missed. Try it again."));
    window.scrollTo({ top: 0 });
  };
  const finish = () => {
    mountQuestion.keys = null;
    const pct = Math.round((right / total) * 100);
    onDone?.(pct);
    blip(pct >= 80 ? "win" : "ok");
    const rads = [...firstTry.keys()].map((id) => RAD[id]).sort((a, b) => a.n - b.n);
    const headline = pct === 100 ? "A PERFECT ROUND" : pct >= 80 ? "STRONG ROUND" : pct >= 50 ? "GETTING THERE" : "FIRST PASS DONE";
    shell.view.replaceChildren(
      el("div.done",
        el("p.eyebrow", title),
        el("h1", headline),
        el("p.done-score", el("span.red", `${right}`), ` of ${total} right first time`),
        el("p.sub", pct === 100 ? "Every answer right on the first try." : "The ones marked “review” are worth another look before your next round."),
        el("div.res-list", rads.map((r) => resultRow(r, firstTry.get(r.id)))),
        el("div.done-btns",
          nextLink || null,
          el("button.btn" + (nextLink ? ".ghost" : ".primary"), { type: "button", onclick: again }, "Another round"),
          el("a.btn.ghost", { href: "#the-sixty" }, "Back to the sixty")),
        extra?.()));
    window.scrollTo({ top: 0 });
  };
  step();
  return shell.view;
}

function setQuizView(g) {
  const gi = GROUPS.indexOf(g), nextG = GROUPS[gi + 1];
  return quizView({ title: `${g.title} · practice`, questions: setQuestions(g),
    onDone: (pct) => { state.best[g.id] = Math.max(state.best[g.id] ?? 0, pct); save(); },
    again: () => render(true),
    extra: () => el("div.done-games", el("p.eyebrow", "Use them in the wild"), gameLinks(g)),
    nextLink: nextG ? el("a.btn.primary", { href: "#r-" + nextG.radicals[0].id }, `Start the next set: ${nextG.title}`)
      : el("a.btn.primary", { href: "#sprint" }, "Try the 60-second decode") });
}

function reviewView() {
  return quizView({ title: "Mixed review", questions: reviewQuestions(), again: () => render(true) });
}

// ---- the sprint: unseen characters against the clock
let sprintTimer = null;
function sprintView() {
  const SECONDS = 60;
  const host = el("div.q");
  const shell = quizShell("60-second decode", host);
  const fill = $(".quiz-fill", shell.view), count = $(".quiz-count", shell.view);
  let score = 0, ends = 0;
  const missed = [];
  const intro = el("div.done",
    el("p.eyebrow", "60-second decode"),
    el("h1", "READ THE ", el("span.red", "RADICAL")),
    el("p.sub", "You get characters from all sixty families, most of them never taught here. Pick the meaning the radical points to. A right answer scores one. A miss costs you a second while the answer shows."),
    el("p.done-score", state.sprint ? `Your best: ${state.sprint}` : "No score yet"),
    el("div.done-btns", el("button.btn.primary", { type: "button", onclick: () => start() }, "Start the clock"), el("a.btn.ghost", { href: "#the-sixty" }, "Not now")));
  const tick = () => {
    const left = Math.max(0, ends - Date.now());
    fill.style.width = `${(left / (SECONDS * 1000)) * 100}%`;
    count.textContent = `${Math.ceil(left / 1000)}s · ${score}`;
    if (left <= 0) end();
  };
  const ask = () => {
    const r = sample(RADS);
    const q = Math.random() < 0.7 ? qDecode(r, null, true) : qFamily(r);
    host.classList.remove("is-right", "is-wrong");
    mountQuestion(q, host, (ok) => {
      if (ok) score++; else missed.push(q);
      record(r.id, ok);
      if (Date.now() < ends) ask();
    }, { fast: true });
  };
  const start = () => {
    shell.view.querySelector(".done")?.replaceWith(host);
    score = 0; missed.length = 0;
    ends = Date.now() + SECONDS * 1000;
    fill.classList.add("timer");
    clearInterval(sprintTimer);
    sprintTimer = setInterval(() => { if (!document.body.contains(shell.view)) clearInterval(sprintTimer); else tick(); }, 100);
    ask();
  };
  const end = () => {
    clearInterval(sprintTimer);
    mountQuestion.keys = null;
    const best = score > (state.sprint || 0);
    if (best) { state.sprint = score; save(); }
    blip("win");
    refreshBar();
    const seen = new Set();
    const rows = missed.filter((q) => !seen.has(q.item[0]) && seen.add(q.item[0])).slice(0, 8).map((q) =>
      el("a.res.no", { href: "#r-" + q.rad.id, style: radStyle(q.rad) },
        el("span.res-glyph.char", hanzi(q.item[0])), el("span.res-name", `${q.item[1]} · ${q.item[2]}`),
        el("span.res-mark", `${q.rad.name.toLowerCase()} radical`)));
    host.replaceWith(el("div.done",
      el("p.eyebrow", "Time"),
      el("h1", el("span.red", String(score)), score === 1 ? " CHARACTER DECODED" : " CHARACTERS DECODED"),
      el("p.done-score", best ? "A new best." : `Your best: ${state.sprint}`),
      rows.length ? el("p.sub", "The ones that got away. The radical is in colour.") : el("p.sub", "Not a single miss."),
      el("div.res-list", rows),
      el("div.done-btns", el("button.btn.primary", { type: "button", onclick: () => render(true) }, "Go again"), el("a.btn.ghost", { href: "#the-sixty" }, "Back to the sixty"))));
  };
  shell.view.querySelector(".q").replaceWith(intro);
  count.textContent = `${SECONDS}s`;
  fill.style.width = "100%";
  return shell.view;
}
