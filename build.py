"""Build the radicals site.

    python3 build.py            # -> docs/index.html (the public page, served by GitHub Pages) and dist/artifact.html (the Artifact)

Content lives in src/content/g1..g12.json (lessons) and games.json (one hunt scene and three
build rounds per set), styles in src/css/*.css, scripts in src/app/*.js (concatenated in name order). Stroke outlines for every Chinese character that appears
anywhere in the content are fetched once into cache/hw (see fetch.py) and inlined, so the
page draws its own characters and needs no Chinese font.
"""
import base64
import json
import re

from fetch import EXTRA, HW, ROOT, families, get, groups, strays

SRC, DIST, DOCS = ROOT / "src", ROOT / "dist", ROOT / "docs"
ABOUT = "Learn the 60 most useful Chinese radicals and 20 sound families: stroke-drawn lessons, quizzes, radical hunts, character building, a 60-second decode sprint and Mandarin audio."
ICON = ("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23F2452F'/%3E"
        "%3Cpath d='M18 20h28M18 32h28M18 44h28M32 14v36' stroke='%23F7F2E8' stroke-width='6' stroke-linecap='round' fill='none'/%3E%3C/svg%3E")
CJK = re.compile(r"[⺀-⿟㐀-鿿]")
# The dictionary writes both ear radicals as 阝. On the left it is ⻖ (hill), on the right ⻏ (town).
ear = lambda decomposition: "⻖" if decomposition.startswith("⿰阝") else "⻏"
# Radical forms with no entry of their own in the stroke data: cut out of a character that carries them.
DERIVED = {"⻊": "跑", "牜": "物", "⻖": "院", "⻏": "都"}
FONTS = ("https://fonts.googleapis.com/css2?family=Anton&family=Lexend:wght@400;500&family=Noto+Sans:wght@500;700"
         "&family=Outfit:wght@400;500;700&display=swap")


def glyph(ch):
    if ch in DERIVED:
        d = get(DERIVED[ch])
        keep = d["radStrokes"]
        return dict(s=[d["strokes"][i] for i in keep], m=[d["medians"][i] for i in keep], r=list(range(len(keep))))
    d = get(ch)
    if d is None:
        return None
    assert len(d["strokes"]) == len(d["medians"]), ch
    return dict(s=d["strokes"], m=d["medians"], r=d.get("radStrokes", []))


def components(chars):
    """Every part found inside each character, all the way down: {char: "parts"}.

    The family question uses it to keep a wrong answer from carrying the right answer's radical
    as a mere component (口 inside 路, say), which would make two answers defensible.
    """
    decomp = {}
    for line in (ROOT / "cache" / "dictionary.txt").read_text().splitlines():
        d = json.loads(line)
        decomp[d["character"]] = [c for c in d["decomposition"] if CJK.match(c)]
        if "阝" in decomp[d["character"]]:
            decomp[d["character"]].append(ear(d["decomposition"]))
    alias = {"足": "⻊", "⺼": "月", "言": "讠", "食": "饣", "金": "钅", "糸": "纟", "衣": "衤", "犬": "犭", "手": "扌", "水": "氵",
             "攴": "攵"}

    def walk(c, seen):
        for part in decomp.get(c, []):
            if part not in seen:
                seen.add(part)
                walk(part, seen)
        return seen

    out = {}
    for c in chars:
        parts = walk(c, set())
        parts |= {alias[x] for x in parts if x in alias}
        out[c] = "".join(sorted(parts))
    return out


COLORS = ("water", "amber", "pink", "green", "violet", "teal", "coral", "lime")
POSITIONS = ("left", "right", "top", "bottom", "wrap-tl", "wrap-bl", "frame", "box")


def games(gs):
    """The two games' content, checked against the dictionary so a hunt never marks a learner wrong unfairly.

    Adds to each scene `rads`: {char: [radical id, the form it takes there]} for the "it carries X" feedback.
    """
    content = json.loads((SRC / "content" / "games.json").read_text())
    rads = [r for g in gs for r in g["radicals"]]
    by_id = {r["id"]: r for r in rads}
    assert list(content) == [g["id"] for g in gs], "games.json needs one entry per set, in order"
    # which of the sixty a character is filed under. The dictionary keeps body characters under ⺼ and moon ones under 月.
    shape = {"⺼": "flesh", "攴": "strike"}
    for r in rads:
        for form in (r["glyph"], r.get("alt"), r.get("full")):
            if form and not (r["id"] == "flesh" and form == "月"):
                shape.setdefault(form, r["id"])
    filed, pinyin = {}, {}
    for line in (ROOT / "cache" / "dictionary.txt").read_text().splitlines():
        d = json.loads(line)
        filed[d["character"]] = d["radical"]
        pinyin[d["character"]] = d["pinyin"]
        if d["radical"] == "阝" and d["character"] != "阝":
            filed[d["character"]] = ear(d["decomposition"])
        # the cow leans over on the left (牜) and keeps its full shape underneath (牛); the dictionary writes 牛 for both
        elif d["radical"] == "牛" and d["decomposition"].startswith("⿰牛"):
            filed[d["character"]] = "牜"
    odd, unfair = [], []

    def sound(c, p):
        if p not in pinyin.get(c, []):
            odd.append(f"{c} {p} (dictionary: {', '.join(pinyin.get(c, [])) or 'none'})")

    for gid, game in content.items():
        scene = game["scene"]
        chars = []
        for s in scene["sections"]:
            for row in s["rows"]:
                chars += [c for c in CJK.findall(row["zh"]) if c not in chars]
        scene["rads"] = {}
        for c in chars:
            rid = shape.get(filed.get(c))
            if rid:
                r = by_id[rid]
                scene["rads"][c] = [rid, filed[c] if filed[c] in (r["glyph"], r.get("alt")) else r["glyph"]]
        inside = components(chars)
        for h in scene["hunts"]:
            r = by_id[h["rad"]]
            forms = [f for f in (r["glyph"], r.get("alt")) if f]
            for c, t in h["targets"].items():
                assert c in chars and shape.get(filed[c]) == h["rad"], (gid, h["rad"], c, filed.get(c))
                assert glyph(c)["r"], (gid, c, "no radical strokes")
                sound(c, t[0])
            for c in h["traps"]:
                assert c in chars and c not in h["targets"], (gid, h["rad"], c)
            for c in chars:
                if c in h["targets"] or c in forms or c in h["traps"]:
                    continue
                alone = c == r.get("full") and filed[c] == c
                if alone:
                    continue
                if shape.get(filed.get(c)) == h["rad"]:
                    unfair.append(f"{gid}/{h['rad']}: {c} is filed under this radical but is not a target")
                # the shape is in there somewhere without being the radical: the learner deserves a reason, not "no X in Y"
                elif any(f in inside[c] for f in forms):
                    unfair.append(f"{gid}/{h['rad']}: {c} holds the shape and needs a trap")
                # a look-alike twin (the other ear, the big box for the small one) is the likeliest wrong tap of all
                elif r.get("twin") and shape.get(filed.get(c)) == r["twin"]:
                    unfair.append(f"{gid}/{h['rad']}: {c} carries the look-alike {r['twin']} and needs a trap")
        assert len(game["builds"]) == 3, gid
        for b in game["builds"]:
            r = by_id[b["rad"]]
            assert shape.get(filed[b["ch"]]) == b["rad"] and glyph(b["ch"])["r"], b["ch"]
            assert b.get("form", filed[b["ch"]]) == filed[b["ch"]] or (filed[b["ch"]] == r.get("full") and "form" not in b), (b["ch"], filed[b["ch"]])
            assert b["pos"] in b["posOpts"] and len(set(b["posOpts"])) == 4 and all(p in POSITIONS for p in b["posOpts"]), b["ch"]
            assert b["rad"] in b["radOpts"] and len(set(b["radOpts"])) == 4 and all(o in by_id for o in b["radOpts"]), b["ch"]
            assert all(o in b["radOpts"] and o != b["rad"] for o in b["radNotes"]), b["ch"]
            assert len(b["parts"]) == 3 and len(b["parts"][0]) == 3 and all(len(p) == 6 for p in b["parts"][1:]), b["ch"]
            sound(b["ch"], b["py"])
            for p in b["parts"]:
                assert glyph(p[0]), p[0]
                sound(p[0], p[1])
                if len(p) == 6:
                    # the wrong part still makes a real character out of this radical (字 is filed under 子, so look inside)
                    held = components([p[3]])[p[3]]
                    assert glyph(p[3]) and p[0] in held and any(f in held for f in (r["glyph"], r.get("alt"), r.get("full")) if f), (b["ch"], p[3], held)
                    sound(p[3], p[4])
    assert not unfair, "\n" + "\n".join(unfair)
    if odd:
        print("pinyin to check:", "; ".join(odd))
    return content


IDC = {**{c: 2 for c in "⿰⿱⿴⿵⿶⿷⿸⿹⿺⿻"}, "⿲": 3, "⿳": 3}
TONELESS = dict(zip("āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ", "aaaaeeeeiiiioooouuuuüüüü"))
toneless = lambda p: "".join(TONELESS.get(c, c) for c in p.lower())


def part_path(ids, part):
    """Where a component sits in a decomposition (⿰氵青): the child numbers that lead to it, or None."""
    pos = 0

    def node(path):
        nonlocal pos
        c = ids[pos]
        pos += 1
        if c not in IDC:
            return path if c == part else None
        found = None
        for k in range(IDC[c]):
            below = node(path + [k])
            found = below if found is None else found
        return found

    return node([])


def rhyme(syl):
    """The syllable without its first sound, spelled the way it sounds: yang and xiang both end in iang."""
    ini = next((i for i in ("zh", "ch", "sh", *"bpmfdtnlgkhjqxrzcsyw") if syl.startswith(i)), "")
    fin = syl[len(ini):]
    if ini == "y":
        fin = fin if fin[0] == "i" else "ü" + fin[1:] if fin[0] == "u" else "i" + fin
    elif ini == "w":
        fin = fin if fin == "u" else "u" + fin
    elif ini in ("j", "q", "x") and fin[0] == "u":
        fin = "ü" + fin[1:]
    return {"iou": "iu", "uei": "ui", "uen": "un"}.get(fin, fin)


def sound_families(gs):
    """The sound-family sets, checked against the dictionary.

    Adds to each family `strays` (the characters its watch-out note spells out) and `tally`: every common
    character built on the sound part, grouped by how it is said, as [syllable, kind, [[char, pinyin], ...]]
    with kind 0 for the part's own syllable, 1 for a rhyme and 2 for anything else.
    Returns the sets and {char: the strokes that make up its sound part}.
    """
    sets = families()
    by_id = {r["id"]: r for g in gs for r in g["radicals"]}
    entry = {}
    for line in (ROOT / "cache" / "dictionary.txt").read_text().splitlines():
        d = json.loads(line)
        entry[d["character"]] = d
    taught = {e[0] for g in gs for r in g["radicals"] for e in r["ex"] + r["decode"]}
    snd, odd, seen = {}, [], set()
    for s in sets:
        for f in s["families"]:
            assert f["id"] not in seen and f["color"] in COLORS, f["id"]
            seen.add(f["id"])
            assert toneless(f["pinyin"]) == f["says"][0], f["id"]
            assert len(f["ex"]) == 4 and 1 <= len(f["decode"]) <= 2, f["id"]
            f["strays"] = strays(f)
            f["forms"] = {}
            said = {c: p for c, p in f["strays"]}
            for e in f["ex"] + f["decode"]:
                ch, p, rad = e[0], e[1], e[3]
                d = entry[ch]
                said[ch] = p
                if p not in d["pinyin"] and toneless(p) not in map(toneless, d["pinyin"]):
                    odd.append(f"{ch} {p} (dictionary: {', '.join(d['pinyin'])})")
                # an unseen character is a fair test only if it is said one of the ways the lesson gives for the part
                assert e in f["ex"] or toneless(p) in f["says"], (ch, p, f["says"])
                if ch not in f["kin"]:
                    f["kin"] += ch
                if isinstance(rad, str):
                    r = by_id[rad]
                    forms = [x for x in (r["glyph"], r.get("alt"), r.get("full")) if x] + {"flesh": ["⺼"], "hill": ["阝"], "town": ["阝"]}.get(rad, [])
                    assert d["radical"] in forms, (ch, rad, d["radical"])
                    # the two halves of a character are shown in two colours, so they must differ
                    assert r["color"] != f["color"], (f["id"], ch, rad, "shares the family's colour")
                    # the shape the radical takes in this character (心 under 忠, 忄 beside 情)
                    f["forms"][ch] = (ear(d["decomposition"]) if d["radical"] == "阝" else d["radical"] if d["radical"] in (r["glyph"], r.get("alt"))
                                      else d["radical"] if d["decomposition"][0] == "⿻" else r["glyph"])
                else:
                    assert d["radical"] == rad[0], (ch, rad, d["radical"])
                # the strokes of the sound part (a decode character may name a bigger part: 张 inside 涨)
                part = e[4] if e in f["decode"] and len(e) > 4 else f["glyph"]
                path = part_path(d["decomposition"], part)
                assert path is not None, (ch, d["decomposition"], part)
                g = glyph(ch)
                assert len(d["matches"]) == len(g["s"]), ch
                snd[ch] = [i for i, m in enumerate(d["matches"]) if m is not None and m[:len(path)] == path]
                assert snd[ch] and not set(snd[ch]) & set(g["r"]) and len(snd[ch]) < len(g["s"]), (ch, snd[ch], g["r"])
            for e in f["decode"]:
                assert e[0] not in taught, (e[0], "is taught in a radical lesson, so it is no test")
                assert isinstance(e[3], str) and glyph(e[0])["r"], (e[0], "needs one of the sixty, with its strokes marked")
            groups_ = {}
            for c in f["kin"]:
                assert f["glyph"] in components([c])[c], (f["id"], c)
                p = said.get(c) or entry[c]["pinyin"][0]
                groups_.setdefault(toneless(p), []).append([c, p])
                # light the sound part in the family portrait too, wherever the dictionary can point to it
                path = part_path(entry[c]["decomposition"], f["glyph"])
                if c not in snd and path and len(entry[c]["matches"]) == len(glyph(c)["s"]):
                    snd[c] = [i for i, m in enumerate(entry[c]["matches"]) if m is not None and m[:len(path)] == path]
            base = f["says"][0]
            kind = lambda syl: 0 if syl == base else 1 if rhyme(syl) == rhyme(base) else 2
            f["tally"] = sorted(([syl, kind(syl), cs] for syl, cs in groups_.items()), key=lambda t: (t[1], -len(t[2])))
    if odd:
        print("family pinyin to check:", "; ".join(odd))
    return sets, snd


def audio_manifest():
    """Clips made by voices.py, if any, as {text: base64 mp3}. The page decodes them with Web Audio."""
    f = SRC / "audio" / "manifest.json"
    if not f.exists():
        return {}
    return {t: base64.b64encode((f.parent / rel).read_bytes()).decode() for t, rel in json.loads(f.read_text()).items()}


def main():
    HW.mkdir(parents=True, exist_ok=True)
    gs = groups()
    chars = []
    play = games(gs)
    fams, snd = sound_families(gs)
    for c in (CJK.findall(json.dumps(gs, ensure_ascii=False) + json.dumps(play, ensure_ascii=False) + json.dumps(fams, ensure_ascii=False))
              + list(EXTRA) + list(DERIVED)):
        if c not in chars:
            chars.append(c)
    strokes, missing = {}, []
    for c in chars:
        g = glyph(c)
        if g:
            strokes[c] = g
        else:
            missing.append(c)
    taught = [e[0] for g in gs for r in g["radicals"] for e in r["ex"] + r["decode"]]
    data = dict(groups=gs, strokes=strokes, comps=components(taught), audio=audio_manifest(), games=play, families=fams, snd=snd)
    silent = [c for g in play.values() for c in [t for h in g["scene"]["hunts"] for t in h["targets"]] + [b["ch"] for b in g["builds"]]
              if c not in data["audio"]]
    blob = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    css = "\n".join(f.read_text() for f in sorted((SRC / "css").glob("*.css")))
    js = "\n".join(f.read_text() for f in sorted((SRC / "app").glob("*.js")))
    page = (SRC / "page.html").read_text()
    body = (page.replace("/*CSS*/", css).replace("/*DATA*/", "window.RAD_DATA=" + blob + ";").replace("/*JS*/", js)
            .replace("{{FONTS}}", FONTS))
    DIST.mkdir(exist_ok=True)
    (DIST / "artifact.html").write_text(body)
    # the public page is the same body as a full document, with the title and sharing tags in its head
    title = re.search(r"<title>(.*?)</title>", body).group(1)
    DOCS.mkdir(exist_ok=True)
    (DOCS / ".nojekyll").write_text("")
    (DOCS / "index.html").write_text(
        '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        f'<title>{title}</title>\n<meta name="description" content="{ABOUT}">\n'
        f'<meta property="og:title" content="{title}">\n<meta property="og:description" content="{ABOUT}">\n<meta property="og:type" content="website">\n'
        f'<meta name="theme-color" content="#0A0A10">\n<link rel="icon" href="{ICON}">\n'
        "<style>body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n</head>\n<body>\n"
        + re.sub(r"<title>.*?</title>\n?", "", body, count=1) + "\n</body>\n</html>\n")
    n = sum(len(g["radicals"]) for g in gs)
    print(f"{n} radicals, {len(strokes)} drawn characters, {len(data['audio'])} audio clips, "
          f"{len(body) / 1e6:.2f} MB" + (f"; no stroke data (font fallback): {' '.join(missing)}" if missing else "")
          + (f"; game characters with no clip: {' '.join(dict.fromkeys(silent))}" if silent else ""))


if __name__ == "__main__":
    main()
