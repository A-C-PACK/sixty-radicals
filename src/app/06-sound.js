// ---------------------------------------------------------------- sound families: the other half of the character
// A radical hints at the meaning. The part beside it usually hints at how the character is said.
// Each family is one such part and the characters built on it. Records are kept in state.fam.
const FAM_HOME = ["#sounds", "Back to the sound families"];
const famStyle = (f) => ({ "--rc": `var(--c-${f.color})` });
/** qīng -> qing (ü keeps its dots) */
const plainSyl = (p) => p.normalize("NFD").replace(/[̀́̄̌]/g, "").normalize("NFC");
const sylOf = (item) => plainSyl(item[1]);
const saysText = (f) => (f.says.length > 2 ? `${f.says.slice(0, -1).join(", ")} or ${f.says[f.says.length - 1]}` : f.says.join(" or "));
const famItems = (f) => [...f.ex, ...f.decode];
/** The sound part a character shows: the family's own, or a bigger one built on it (张 inside 涨). */
const partOf = (f, item) => (f.decode.includes(item) && item[4]) || f.glyph;
/** The radical a member carries: one of the sixty, or a [glyph, name] pair from outside them. */
function radOf(f, item) {
  if (typeof item[3] !== "string") return { glyph: item[3][0], name: item[3][1], color: null };
  const r = RAD[item[3]];
  return { id: r.id, glyph: f.forms[item[0]] || r.glyph, name: r.name.toLowerCase(), color: r.color, clue: r.clue };
}
/** The family as the lesson shows it: the characters kept back for the questions stay out, or the table would answer them. */
const famRows = (f) => f.tally.map(([syl, kind, chars]) => [syl, kind, chars.filter(([ch]) => !f.decode.some((d) => d[0] === ch))]).filter((t) => t[2].length);
const tallyCount = (f, kind) => famRows(f).filter((t) => kind === undefined || t[1] === kind).reduce((n, t) => n + t[2].length, 0);

/** How often the part keeps its word: full colour for the same syllable, faint for a rhyme, grey for the rest. */
function trustBar(parts) {
  const n = parts.reduce((a, b) => a + b, 0);
  return el("div.trust-bar", { "aria-hidden": "true" }, ["same", "rhyme", "off"].map((k, i) =>
    (parts[i] ? el("span.trust-" + k, { style: { width: `${(parts[i] / n) * 100}%` } }) : null)));
}

// ---------------------------------------------------------------- home: the band below the sixty
function keepSoundDemo() {
  const f = FAM.qing;
  const stage = el("div.how-stage");
  const caption = el("p.swap-cap");
  const btns = el("div.swap-btns");
  stage.style.setProperty("--rc", `var(--c-${f.color})`);
  const choose = (k, quiet) => {
    const item = f.ex[k], r = radOf(f, item);
    stage.style.setProperty("--rc2", `var(--c-${r.color})`);
    stage.replaceChildren(hanzi(item[0], { snd: true, anim: !quiet }));
    caption.replaceChildren(el("strong", py(item[1])), ` · ${item[2]}`, el("br"), el("span.dim", `${r.name} + the sound of `), el("span.dim", rich(`${f.glyph} ${f.pinyin}`)));
    $$("button", btns).forEach((b, j) => b.setAttribute("aria-pressed", j === k));
    if (!quiet) { blip("tap"); say(item[0]); }
  };
  f.ex.forEach((item, k) => {
    const r = radOf(f, item);
    btns.append(el("button.swap", { type: "button", style: { "--rc": `var(--c-${r.color})` }, "aria-label": r.name, onclick: () => choose(k) },
      hanzi(r.glyph, { whole: true, center: true })));
  });
  choose(0, true);
  return el("article.how-card",
    el("h3", "Keep the sound part, swap the radical"),
    stage, caption, btns,
    el("p", rich(`The right side never changes: ${f.glyph}, said ${f.pinyin}. Four radicals make four words, and all four are said qing.`)));
}

function famTile(f) {
  const lv = famLevel(f.id);
  return el("a.tile.fam-tile" + (lv ? ".seen" : ""), { href: "#f-" + f.id, style: famStyle(f), "aria-label": `The ${saysText(f)} family` },
    stamp(lv),
    el("span.tile-glyph", hanzi(f.glyph, { whole: true, center: true })),
    el("span.tile-name", f.says.slice(0, 2).join(" · ")));
}

function famBand(s, si) {
  const seen = s.families.filter((f) => famLevel(f.id) > 0).length;
  const best = state.fbest[s.id];
  return el("section.group",
    el("div.group-head",
      el("span.group-zh", hanzi(s.zh)),
      el("div.group-title",
        el("p.eyebrow", `Sound set ${si + 1} of ${FAMSETS.length}`),
        el("h3", s.title),
        el("p.group-blurb", s.blurb)),
      el("div.group-act",
        el("span.group-prog", `${seen} / ${s.families.length} learned`),
        el("a.btn.small", { href: "#fset-" + s.id }, best === undefined ? "Practise this set" : `Practise again · best ${best}%`))),
    el("div.tiles", s.families.map(famTile)));
}

function soundSection() {
  if (!FAMS.length) return null;
  const parts = [0, 1, 2].map((k) => FAMS.reduce((n, f) => n + tallyCount(f, k), 0));
  const n = parts[0] + parts[1] + parts[2];
  const pct = (k) => Math.round((parts[k] / n) * 100);
  const two = el("div.how-stage", { style: { "--rc": "var(--c-green)", "--rc2": "var(--c-water)" } }, hanzi("清", { snd: true }));
  const idea = el("article.how-card",
    el("h3", "Two clues in one character"),
    two,
    el("div.split-tags.on",
      el("span.tag", { style: { color: "var(--c-water)" } }, hanzi("氵", { cls: "inline", center: true }), " water = meaning"),
      el("span.tag", { style: { color: "var(--c-green)" } }, hanzi("青", { cls: "inline" }), " ", py("qīng"), " = sound")),
    el("p", rich("清 (qīng) means clear. The radical told you it has to do with water. The other half told you how to say it.")));
  const trust = el("article.how-card",
    el("h3", "How far can you trust it?"),
    el("div.pct", el("span.pct-n", `${pct(0)}%`), el("span.pct-t", "of the common characters in these families keep the exact syllable")),
    trustBar(parts),
    el("p", `Another ${pct(1)}% keep the rhyme and change the first sound. The rest have drifted, and every lesson shows you which ones.`),
    el("p", rich("The tone is never part of the hint: 清 qīng, 情 qíng, 请 qǐng. The syllable comes free. The tone you still learn.")));
  return el("section.band#sounds",
    el("div.wrap",
      el("p.eyebrow", `The other half · ${famCount()} of ${FAMS.length} learned`),
      el("h2", "SOUND ", el("span.red", "FAMILIES")),
      el("p.sub", "A radical hints at the meaning. The part next to it usually hints at the sound. Learn twenty of these sound parts and you can guess how a new character is said, as well as what it is about."),
      el("div.how-grid", idea, keepSoundDemo(), trust),
      FAMSETS.map(famBand)));
}

// ---------------------------------------------------------------- one family: meet the part, hear it in four characters, try it
function famPanel(f) {
  const stage = el("div.panel-glyph");
  const draw = () => stage.replaceChildren(hanzi(f.glyph, { whole: true, center: true, anim: true }));
  draw();
  const n = tallyCount(f), same = tallyCount(f, 0), rhy = tallyCount(f, 1);
  return el("aside.panel", { style: famStyle(f) },
    el("button.panel-stage", { type: "button", title: "Replay the strokes", onclick: () => { draw(); say(f.glyph); } }, stage),
    el("h1.panel-name", f.says[0].toUpperCase()),
    el("div.panel-row", el("span.kai", hanzi(f.glyph)), py(f.pinyin), listenBtn(f.glyph), el("span.dim", f.mean)),
    el("div.panel-row", el("span", "Inside a character it says ", el("strong.py", saysText(f)), ".")),
    el("div.panel-row.trust", trustBar([same, rhy, n - same - rhy]),
      el("span.dim", `${same} of ${n} common characters keep the syllable` + (rhy ? `, ${rhy} more keep${rhy === 1 ? "s" : ""} the rhyme` : ""))),
    el("div.panel-btns",
      el("button.btn.small", { type: "button", onclick: () => { draw(); say(f.glyph); } }, "Replay strokes"),
      el("a.btn.small", { href: "#family-" + f.id, onclick: (e) => { e.preventDefault(); document.getElementById("family-" + f.id)?.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "center" }); } }, "See the whole family")));
}

function famExample(f, item, i) {
  const [ch, pin, mean, , why] = item;
  const r = radOf(f, item);
  const stage = el("span.ex-char", hanzi(ch, { snd: true, anim: true, delay: 0.25 + i * 0.3 }));
  return el("button.ex", { type: "button", style: { "--rc2": r.color ? `var(--c-${r.color})` : "var(--muted)" },
    title: hasClip(ch) ? "Hear it and draw it again" : "Draw it again", onclick: () => { stage.replaceChildren(hanzi(ch, { snd: true, anim: true })); say(ch); } },
    stage,
    el("span.ex-py", pin, hasClip(ch) ? el("span.ex-snd", { html: SPEAKER_SVG }) : null),
    el("span.ex-mean", mean),
    el("span.ex-why", el("span.ex-rad", hanzi(r.glyph, { cls: "inline", center: true }), ` ${r.name}`), rich(`: ${why}`)));
}

/** Every common character built on the part, sorted by how it is said. The ones with a clip can be tapped. */
function famPortrait(f) {
  const KIND = ["same", "rhyme", "off"];
  return el("div.kin#family-" + f.id, famRows(f).map(([syl, kind, chars]) => el("div.kin-row." + KIND[kind],
    el("span.kin-syl", el("span.py", syl), el("span.kin-n", chars.length > 1 ? `× ${chars.length}` : "")),
    el("div.kin-chars", chars.map(([ch, pin]) => {
      const inner = [el("span.kin-ch", hanzi(ch, { snd: true })), el("span.kin-py", pin)];
      return hasClip(ch) ? el("button.kin-chip", { type: "button", title: "Hear it", "aria-label": `${ch} ${pin}`, onclick: () => say(ch, true) }, inner)
        : el("span.kin-chip", inner);
    })))));
}

function famView(f) {
  const s = f.set;
  const prev = FAMS[f.n - 1], next = FAMS[f.n + 1];
  const lastInSet = f.fi === s.families.length - 1;
  const dots = el("nav.dots", { "aria-label": `Families in ${s.title}` }, s.families.map((o) =>
    el("a.dot" + (o.id === f.id ? ".on" : "") + (famLevel(o.id) ? ".seen" : ""), { href: "#f-" + o.id, style: famStyle(o), "aria-label": saysText(o), title: saysText(o) },
      hanzi(o.glyph, { whole: true, center: true }))));

  // Your turn, in two steps on one unseen character: first the sound from the sound part, then the meaning from the radical.
  const item = f.decode[0];
  const first = el("div.q"), second = el("div.q", { hidden: true });
  const after = el("div.lesson-next", { hidden: true });
  const q1 = qSay(f, item);
  q1.prompt = "You have never been taught this character. Find its sound part: how is it most likely said?";
  mountQuestion(q1, first, (ok1) => {
    second.hidden = false;
    mountQuestion(qMeans(f, item), second, (ok2) => {
      const fresh1 = famLevel(f.id) === 0;
      record(f.id, ok1 && ok2, state.fam);
      if (fresh1) toast(`The ${f.says[0]} family learned. ${famCount()} of ${FAMS.length}.`);
      after.hidden = false;
      after.querySelector("a").focus({ preventScroll: true });
      after.scrollIntoView({ block: "nearest", behavior: reduceMotion() ? "auto" : "smooth" });
    }, { noContinue: true });
    second.scrollIntoView({ block: "nearest", behavior: reduceMotion() ? "auto" : "smooth" });
  }, { noContinue: true });
  after.append(
    lastInSet
      ? el("a.btn.primary", { href: "#fset-" + s.id }, `Practise the ${s.title} set`)
      : el("a.btn.primary", { href: "#f-" + next.id }, `Next: the ${next.says[0]} family`),
    lastInSet && next ? el("a.btn.ghost", { href: "#f-" + next.id }, `Skip to ${next.set.title}`) : null);

  return el("div.lesson.wrap", { style: famStyle(f) },
    el("div.lesson-top",
      el("a.back", { href: "#sounds" }, "← Sound families"),
      el("div.lesson-set", el("span.eyebrow", `${s.title} · ${f.fi + 1} of ${s.families.length}`), dots),
      el("div.lesson-arrows",
        prev ? el("a.btn.small", { href: "#f-" + prev.id, "aria-label": `Previous: ${saysText(prev)}` }, "←") : null,
        next ? el("a.btn.small", { href: "#f-" + next.id, "aria-label": `Next: ${saysText(next)}` }, "→") : null)),
    el("div.lesson-grid",
      famPanel(f),
      el("div.lesson-body",
        el("p.origin", rich(f.origin)),
        el("div.clue", el("span.clue-glyph", hanzi(f.glyph, { whole: true, center: true })), el("span.clue-arrow", "→"),
          el("span.clue-text", el("span.eyebrow", "When you see it, say"), el("strong.py", saysText(f)))),
        el("h2.h-small", "One sound part, four radicals"),
        el("p.fam-key", el("span.key-snd", "The sound part"), " keeps one colour in all four. Each radical keeps its own, and is named under the word."),
        el("div.ex-grid", f.ex.map((it, i) => famExample(f, it, i))),
        el("h2.h-small", "The whole family"),
        el("p.fam-key", rich(`The common characters built on ${f.glyph}, sorted by how they are said. Tap one to hear it.`)),
        famPortrait(f),
        el("div.watch", el("span.eyebrow", "Watch out"), el("p", rich(f.watch))),
        el("h2.h-small", "Your turn"),
        first, second,
        after)));
}

// ---------------------------------------------------------------- questions about sound
/** Recognise the part: what does it say? */
function qSound(f) {
  const wrong = pick(FAMS.filter((o) => o !== f && !o.says.some((x) => f.says.includes(x))), 3);
  return { rad: f, kind: "meaning", item: [f.glyph, f.pinyin, f.mean],
    prompt: "What sound does this part lend to a character?",
    stage: () => el("div.q-glyph", { style: famStyle(f) }, hanzi(f.glyph, { whole: true, center: true, anim: true })),
    options: shuffle([f, ...wrong]).map((o) => ({ ok: o === f, node: () => saysText(o), cls: "word syl" })),
    explain: () => rich(`${f.glyph} is ${f.pinyin}. Inside a character it says ${saysText(f)}, as in ${f.ex[0][0]} ${f.ex[0][1]}.`) };
}

/** Recall the part: which one says this? */
function qPart(f) {
  const target = f.says[0];
  const wrong = pick(FAMS.filter((o) => o !== f && !o.says.includes(target)), 3);
  return { rad: f, kind: "glyph", item: [f.glyph, f.pinyin, f.mean],
    prompt: el("span", "Which part lends the sound ", el("strong.py", target), "?"),
    options: shuffle([f, ...wrong]).map((o) => ({ ok: o === f, cls: "glyph", style: famStyle(o), label: o.glyph, note: saysText(o),
      node: () => hanzi(o.glyph, { whole: true, center: true }) })),
    explain: () => rich(`${f.glyph} ${f.pinyin} lends ${saysText(f)}, as in ${f.ex[0][0]} ${f.ex[0][1]}.`) };
}

/** An unseen character: the sound part is the only way to its sound. The tone cannot be guessed, so the answers leave it out. */
function qSay(f, item) {
  item ||= sample(f.decode);
  const ans = sylOf(item), part = partOf(f, item);
  // nothing this family is ever said as may stand as a wrong answer: it would be a fair guess
  const taken = new Set([...f.says, ...f.tally.map((t) => t[0])]);
  const wrong = pick([...new Set(FAMS.flatMap((o) => o.says))].filter((x) => !taken.has(x)), 3);
  return { rad: f, kind: "decode", item,
    prompt: "You have not been taught this one. Find its sound part: how is it most likely said?",
    stage: () => el("div.q-glyph.big", { style: famStyle(f) }, hanzi(item[0], { snd: true, anim: true }), el("span.q-py.late", item[1])),
    options: shuffle([ans, ...wrong]).map((x) => ({ ok: x === ans, node: () => x, cls: "word syl" })),
    explain: (ok) => rich(ok ? `${part} lends its sound: ${item[0]} is ${item[1]}. The syllable came free. The tone is the part to learn.`
      : `The sound part is ${part}, which says ${saysText(f)}. ${item[0]} is ${item[1]}.`) };
}

/** The second half of the trick: the sound is known, now the radical gives the meaning. */
function qMeans(f, item) {
  item ||= sample(f.decode);
  const r = RAD[item[3]], form = f.forms[item[0]] || r.glyph;
  const wrong = pick(FAMS.filter((o) => o !== f).flatMap((o) => o.decode).filter((d) => !clash(r.id, d[3])), 3);
  return { rad: f, kind: "decode", item,
    prompt: el("span", "It is said ", el("strong.py", item[1]), ". Now use the radical: which meaning fits?"),
    stage: () => el("div.q-glyph.big", { style: radStyle(r) }, hanzi(item[0]), el("span.q-py", item[1]), listenBtn(item[0])),
    options: shuffle([item, ...wrong]).map((o) => ({ ok: o === item, node: () => o[2], cls: "word" })),
    explain: () => rich(`${form} points to ${lower(r)}: ${r.clue}. ${partOf(f, item)} gives the sound. ${item[0]} ${item[1]} means ${item[2]}.`) };
}

/** Members of other families that are not said like this one. */
const strangers = (f, syl, from = (o) => o.ex) => pick(FAMS.filter((o) => o !== f && !o.says.includes(syl)), 3)
  .map((o) => [o, sample(from(o).filter((e) => sylOf(e) !== syl))]);
const charOption = (item) => ([o, it]) => ({ ok: it === item, cls: "glyph char", style: famStyle(o), label: it[0],
  node: () => hanzi(it[0], { snd: true }), note: `${it[1]} · ${it[2]}` });

/** Hear a character from the lessons and find it by its sound part. */
function qHear(f) {
  const item = sample(f.ex.filter((e) => hasClip(e[0])));
  if (!item || !state.sound) return qPick(f);
  return { rad: f, kind: "family", item,
    prompt: "Listen. Which character did you hear?",
    stage: () => {
      setTimeout(() => say(item[0], true), 450);
      return el("button.hear-big", { type: "button", "aria-label": "Play it again", title: "Play it again", onclick: () => say(item[0], true), html: SPEAKER_SVG });
    },
    options: shuffle([[f, item], ...strangers(f, sylOf(item))]).map(charOption(item)),
    explain: () => rich(`That was ${item[1]}. ${item[0]} carries ${partOf(f, item)}, which says ${saysText(f)}. It means ${item[2]}.`) };
}

/** Four characters, one of them said the way the question asks. */
function qPick(f) {
  const target = f.says[0];
  const item = sample(famItems(f).filter((e) => sylOf(e) === target));
  return { rad: f, kind: "family", item,
    prompt: el("span", "Which character is most likely said ", el("strong.py", target), "?"),
    options: shuffle([[f, item], ...strangers(f, target, famItems)]).map(charOption(item)),
    explain: () => rich(`${item[0]} carries ${partOf(f, item)}, which says ${saysText(f)}. It is ${item[1]}, ${item[2]}.`) };
}

/** Tap the sound part inside a character. */
function qSpotSound(f) {
  const item = sample(f.ex), r = radOf(f, item);
  return { rad: f, kind: "spot", item, spot: item[0], hot: SND[item[0]], hz: { snd: true }, spotLabel: "Tap the sound part",
    prompt: el("span", "Tap the part that gives this character its sound, ", el("strong.py", item[1]), "."),
    explain: () => rich(`${f.glyph} ${f.pinyin} is the sound part. The rest, ${r.glyph}, is the radical: ${r.name}.`) };
}

// ---------------------------------------------------------------- rounds
function famSetQuestions(s) {
  const fs = s.families;
  const recog = shuffle(fs).map((f, i) => (i % 2 ? qPart(f) : qSound(f)));
  // one unseen character is never asked for both its sound and its meaning in a round: each answer would give the other away
  const [a, b, c] = pick(fs, 3);
  const last = (f) => f.decode[f.decode.length - 1];
  const use = shuffle([
    ...pick(fs, 2).map(qSpotSound),
    qSay(a, last(a)), qSay(b, last(b)), qMeans(c, last(c)),
    ...pick(fs, 2).map(qHear)]);
  return [...recog, ...use];
}

/** Ten questions from the families already learned, the shakiest first. */
function famReviewQuestions() {
  let pool = FAMS.filter((f) => famLevel(f.id) > 0);
  if (pool.length < 4) pool = FAMS.slice(0, Math.max(5, pool.length));
  const now = Date.now();
  const need = (f) => {
    const p = progIn(state.fam, f.id);
    const days = p.last ? (now - p.last) / 864e5 : 30;
    return (3 - Math.min(3, p.streak)) * 2 + Math.min(3, p.wrong) + Math.min(3, days / 2) + Math.random() * 2;
  };
  const chosen = [...pool].sort((x, y) => need(y) - need(x)).slice(0, 10);
  while (chosen.length < 10) chosen.push(sample(pool));
  const kinds = [qSound, qPart, qSpotSound, qSay, qHear, qPick, qSay, qHear, qSpotSound, qPick];
  return shuffle(chosen).map((f, i) => kinds[i](f));
}

function famResultRow(f, ok) {
  return el("a.res" + (ok ? ".ok" : ".no"), { href: "#f-" + f.id, style: famStyle(f) },
    el("span.res-glyph", hanzi(f.glyph, { whole: true, center: true })),
    el("span.res-name", f.says.slice(0, 2).join(" · ").toUpperCase()),
    el("span.res-mark", ok ? "✓" : "review"),
    stamp(famLevel(f.id)));
}

function famSetView(s) {
  const nextS = FAMSETS[FAMSETS.indexOf(s) + 1];
  return quizView({ title: `${s.title} · sound practice`, questions: famSetQuestions(s), home: FAM_HOME,
    onDone: (pct) => { state.fbest[s.id] = Math.max(state.fbest[s.id] ?? 0, pct); save(); },
    again: () => render(true),
    nextLink: nextS ? el("a.btn.primary", { href: "#f-" + nextS.families[0].id }, `Start the next set: ${nextS.title}`)
      : el("a.btn.primary", { href: "#sound-review" }, "Try the mixed sound review") });
}

function famReviewView() {
  return quizView({ title: "Sound review", questions: famReviewQuestions(), home: FAM_HOME, again: () => render(true) });
}
