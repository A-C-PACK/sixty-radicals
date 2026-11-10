// ---------------------------------------------------------------- home: hero, how radicals work, the thirty
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** The wall of characters behind the hero: texture, not meant to be read. */
function paintWall(canvas) {
  const box = canvas.parentElement.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(box.width * dpr);
  canvas.height = Math.round(box.height * dpr);
  const ctx = canvas.getContext("2d");
  const cell = box.width < 600 ? 40 : 54;
  const pool = RADS.flatMap((r) => [...r.ex, ...r.decode].map((e) => e[0]));
  const wall = cssVar("--wall"), ink = cssVar("--ink"), red = cssVar("--red");
  const cols = Math.ceil(box.width / cell), rows = Math.ceil(box.height / cell);
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const g = STROKES[pool[Math.floor(rnd() * pool.length)]];
      const roll = rnd();
      const s = (cell * 0.74 * dpr) / 1024;
      ctx.setTransform(s, 0, 0, -s, (col * cell + cell * 0.13) * dpr, (row * cell + cell * 0.13) * dpr + 900 * s);
      g.s.forEach((d, i) => {
        // now and then a radical glows: the pieces are hiding in plain sight
        ctx.fillStyle = roll < 0.07 && g.r.includes(i) ? red : roll > 0.95 ? ink : wall;
        ctx.globalAlpha = roll < 0.07 && g.r.includes(i) ? 0.85 : roll > 0.95 ? 0.35 : 0.75;
        ctx.fill(new Path2D(d));
      });
    }
  }
}

function nextRadical() { return RADS.find((r) => level(r.id) === 0) || null; }

const HERO_DEMO = [["water", 0], ["mouth", 0], ["woman", 0], ["fire", 2], ["grass", 1], ["walk", 1], ["heart", 2]];
let heroTimer = null;
function heroDemo() {
  const card = el("div.demo");
  let i = 0;
  const show = () => {
    const [id, k] = HERO_DEMO[i++ % HERO_DEMO.length];
    const r = RAD[id], ex = r.ex[k];
    card.style.setProperty("--rc", `var(--c-${r.color})`);
    card.replaceChildren(
      el("div.demo-char", hanzi(ex[0], { anim: true })),
      el("div.demo-line",
        el("span.demo-rad", hanzi(formOf(r, ex), { whole: true, center: true })),
        el("span.demo-name", r.name),
        el("span.demo-arrow", "→"),
        el("span.demo-mean", ex[2])),
      el("div.demo-py", ex[1]));
    card.classList.remove("lit");
    setTimeout(() => card.classList.add("lit"), reduceMotion() ? 0 : 1300);
  };
  show();
  clearInterval(heroTimer);
  if (!reduceMotion()) heroTimer = setInterval(() => { if (document.body.contains(card)) show(); else clearInterval(heroTimer); }, 4200);
  return card;
}

function hero() {
  const next = nextRadical();
  const done = learnedCount();
  const canvas = el("canvas.wall", { "aria-hidden": "true" });
  const cta = next
    ? el("a.btn.primary", { href: "#r-" + next.id }, done ? `Continue with ${next.name}` : "Start with the first radical")
    : el("a.btn.primary", { href: "#review" }, "Practise all thirty");
  const sec = el("section.hero",
    canvas,
    el("div.hero-shade"),
    el("div.wrap.hero-in",
      el("div.hero-text",
        el("p.eyebrow", el("span.kai", hanzi("部"), hanzi("首")), py("bùshǒu"), " · the building blocks of Chinese"),
        el("h1", "30 RADICALS.", el("br"), el("span.red", "THOUSANDS"), " OF CHARACTERS."),
        el("p.lede", "Chinese characters are built from parts. One part, the radical, hints at the meaning. Learn the thirty that matter most and every new character arrives with a clue."),
        el("div.hero-cta", cta, el("a.btn.ghost", { href: "#how" }, "How radicals work"))),
      heroDemo()));
  requestAnimationFrame(() => paintWall(canvas));
  return sec;
}

// ---- how radicals work: three things to try
function howSection() {
  // 1. pull a character apart
  const split = el("div.how-stage.split-demo", hanzi("妈"));
  split.style.setProperty("--rc", "var(--c-pink)");
  const tags = el("div.split-tags",
    el("span.tag.rad-tag", hanzi("女", { cls: "inline" }), " woman = meaning"),
    el("span.tag.snd-tag", hanzi("马", { cls: "inline" }), " ", py("mǎ"), " = sound"));
  const splitBtn = el("button.btn.small", { type: "button", onclick: () => {
    const on = split.classList.toggle("open");
    tags.classList.toggle("on", on);
    splitBtn.textContent = on ? "Put it back" : "Pull it apart";
    blip("tap");
  } }, "Pull it apart");
  const one = el("article.how-card",
    el("h3", "Characters are built from parts"),
    split, tags,
    el("p", rich("妈 (mā) means mom. It is two smaller characters side by side.")),
    splitBtn);

  // 2. swap the radical
  const SWAPS = [["女", "妈", "mā", "mom", "pink", "woman"], ["口", "吗", "ma", "question word", "amber", "mouth"], ["虫", "蚂", "mǎ", "ant", "coral", "bug"]];
  const stage = el("div.how-stage");
  const caption = el("p.swap-cap");
  const btns = el("div.swap-btns");
  const choose = (k, quiet) => {
    const [rad, ch, pin, mean, color, name] = SWAPS[k];
    stage.style.setProperty("--rc", `var(--c-${color})`);
    stage.replaceChildren(hanzi(ch, { anim: !quiet }));
    caption.replaceChildren(el("strong", py(pin)), ` · ${mean}`, el("br"), el("span.dim", `${name} + the sound of `), el("span.dim", rich("马 mǎ")));
    $$("button", btns).forEach((b, j) => b.setAttribute("aria-pressed", j === k));
    if (!quiet) { blip("tap"); say(ch); }
  };
  SWAPS.forEach(([rad, , , , color, name], k) => btns.append(
    el("button.swap", { type: "button", style: { "--rc": `var(--c-${color})` }, "aria-label": name, onclick: () => choose(k) }, hanzi(rad, { whole: true }))));
  choose(0, true);
  const two = el("article.how-card",
    el("h3", "Swap the radical, change the meaning"),
    stage, caption, btns,
    el("p", rich("The right side, 马, lends its sound. The radical on the left tells you what kind of thing it is.")));

  // 3. a hint, not a rule
  const three = el("article.how-card",
    el("h3", "A hint, not a rule"),
    el("div.pct", el("span.pct-n", "80%"), el("span.pct-t", "of characters pair a meaning part with a sound part")),
    el("div.meter", el("div.meter-fill", { style: { width: "80%" } })),
    el("p", "The hint is often broad, and three thousand years of history have worn some hints away. Every radical here comes with a “watch out” note for exactly that."),
    el("p", "Use the radical to narrow your guess and to make a new character stick. That is the skill this site trains."));

  return el("section.band#how",
    el("div.wrap",
      el("p.eyebrow", "Before you start"),
      el("h2", "HOW RADICALS ", el("span.red", "WORK")),
      el("div.how-grid", one, two, three)));
}

// ---- stamps: a hollow seal once a radical is learned, a red one once it is mastered
function stamp(lv) {
  if (!lv) return null;
  return el("span.stamp.lv" + lv, { title: lv === 2 ? "Mastered: three right answers in a row" : "Learned" }, hanzi(lv === 2 ? "会" : "学"));
}

function radTile(r) {
  const lv = level(r.id);
  return el("a.tile" + (lv ? ".seen" : ""), { href: "#r-" + r.id, style: { "--rc": `var(--c-${r.color})` }, "aria-label": `${r.name} radical` },
    stamp(lv),
    el("span.tile-glyph", hanzi(r.glyph, { whole: true, center: true })),
    el("span.tile-name", r.name));
}

function groupBand(g, gi) {
  const seen = g.radicals.filter((r) => level(r.id) > 0).length;
  const best = state.best[g.id];
  return el("section.group",
    el("div.group-head",
      el("span.group-zh", hanzi(g.zh)),
      el("div.group-title",
        el("p.eyebrow", `Set ${gi + 1} of ${GROUPS.length}`),
        el("h3", g.title),
        el("p.group-blurb", g.blurb)),
      el("div.group-act",
        el("span.group-prog", `${seen} / ${g.radicals.length} learned`),
        el("a.btn.small", { href: "#set-" + g.id }, best === undefined ? "Practise this set" : `Practise again · best ${best}%`))),
    el("div.tiles", g.radicals.map(radTile)));
}

function playSection() {
  const n = learnedCount();
  return el("section.band#play",
    el("div.wrap",
      el("p.eyebrow", "Make it stick"),
      el("h2", "PRACTISE ", el("span.red", "ACROSS SETS")),
      el("div.play-grid",
        el("a.play-card", { href: "#review" },
          el("h3", "Mixed review"),
          el("p", "Ten questions drawn from every radical you have learned, the shaky ones first. Mixing sets is harder than drilling one, and it is what makes them last."),
          el("span.play-meta", n ? `${n} radical${n === 1 ? "" : "s"} in your pool` : "Learn a radical first, or jump in anyway"),
          el("span.btn.small", "Start review")),
        el("a.play-card", { href: "#sprint" },
          el("h3", "60-second decode"),
          el("p", "Characters you have never been taught, one after another. Read the radical, pick the meaning, beat the clock."),
          el("span.play-meta", state.sprint ? `Your best: ${state.sprint}` : "No score yet"),
          el("span.btn.small", "Start the clock")))));
}

function footer() {
  const resetBtn = el("button.link", { type: "button", onclick: () => {
    if (resetBtn.dataset.armed) {
      state = fresh(); save(); toast("Progress cleared"); render();
    } else {
      resetBtn.dataset.armed = "1";
      resetBtn.textContent = "Tap again to clear all progress";
      setTimeout(() => { delete resetBtn.dataset.armed; resetBtn.textContent = "Clear my progress"; }, 4000);
    }
  } }, "Clear my progress");
  return el("footer.foot",
    el("div.wrap.foot-in",
      el("div",
        el("h4", "Why these thirty"),
        el("p", "They were picked for two things: how many everyday characters they appear in, and how dependable the hint is. Together they are the dictionary radical of about 58% of the 2,500 most-used simplified characters. Frequent radicals with a weak hint, such as 阝, were left out in favour of clearer ones like food and rain.")),
      el("div",
        el("h4", "How the site teaches"),
        el("p", "Five radicals at a time, each with its picture, its position and four familiar characters. Then you recall them, spot them inside characters, and use them on characters you have not met. Missed questions come back. A red seal means three right answers in a row.")),
      el("div",
        el("h4", "Credits"),
        el("p", "Stroke outlines: Make Me a Hanzi and Hanzi Writer data, derived from Arphic fonts under the Arphic Public License. Progress is saved in this browser only."),
        resetBtn)));
}

function homeView() {
  const total = learnedCount(), gold = masteredCount();
  return el("div.home",
    hero(),
    howSection(),
    el("section.band#the-thirty",
      el("div.wrap",
        el("p.eyebrow", `${total} learned · ${gold} mastered`),
        el("h2", "THE ", el("span.red", "THIRTY")),
        el("p.sub", "Six sets of five. Open a radical to learn it, then practise the set."),
        GROUPS.map(groupBand))),
    playSection(),
    footer());
}
