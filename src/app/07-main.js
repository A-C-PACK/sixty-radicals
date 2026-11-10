// ---------------------------------------------------------------- top bar, routes, start-up
function refreshBar() {
  const n = learnedCount(), m = masteredCount();
  $("#bar-count").replaceChildren(...el("span", el("strong", String(n)), " / 30", m ? el("span.count-gold", ` · ${m} mastered`) : null).childNodes);
}

function route() {
  const h = (location.hash || "#home").slice(1);
  if (h.startsWith("r-") && RAD[h.slice(2)]) return { kind: "lesson", make: () => lessonView(RAD[h.slice(2)]) };
  const g = h.startsWith("set-") && GROUPS.find((x) => x.id === h.slice(4));
  if (g) return { kind: "quiz", make: () => setQuizView(g) };
  const gm = h.match(/^(hunt|build)-(.+)$/), gg = gm && GROUPS.find((x) => x.id === gm[2]);
  if (gg) return { kind: "game", make: () => gameView(gm[1], gg) };
  if (h === "review") return { kind: "quiz", make: reviewView };
  if (h === "sprint") return { kind: "quiz", make: sprintView };
  return { kind: "home", make: homeView, anchor: ["how", "the-thirty", "play"].includes(h) ? h : null };
}

let lastKind = null;
function render(force) {
  const r = route();
  const view = $("#view");
  mountQuestion.keys = null;
  clearInterval(sprintTimer);
  // moving between sections of the home page should scroll, not rebuild
  if (r.kind === "home" && lastKind === "home" && !force && view.firstChild) {
    if (r.anchor) document.getElementById(r.anchor)?.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth" });
    else window.scrollTo({ top: 0, behavior: reduceMotion() ? "auto" : "smooth" });
    return;
  }
  lastKind = r.kind;
  view.replaceChildren(r.make());
  document.body.dataset.view = r.kind;
  refreshBar();
  if (r.anchor) requestAnimationFrame(() => document.getElementById(r.anchor)?.scrollIntoView());
  else window.scrollTo({ top: 0 });
}

function start() {
  $("#brand-seal").append(hanzi("部"));
  const sb = $("#sound-btn");
  const syncSound = () => { sb.setAttribute("aria-pressed", state.sound); sb.title = state.sound ? "Sound on" : "Sound off"; };
  sb.addEventListener("click", () => { state.sound = !state.sound; save(); syncSound(); blip("tap"); });
  syncSound();
  window.addEventListener("hashchange", () => render());
  let resizeT = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => { const c = $("canvas.wall"); if (c) paintWall(c); }, 200);
  });
  render();
}

// Inside the Claude viewer a republished page hot-swaps; progress already lives in localStorage, so a plain start is enough.
if (window.claude?.hot?.ready) window.claude.hot.ready(start); else start();
