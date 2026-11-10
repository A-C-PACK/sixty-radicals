"""Build the radicals site.

    python3 build.py            # -> dist/index.html (open locally) and dist/artifact.html (for publishing)

Content lives in src/content/g1..g6.json, styles in src/css/*.css, scripts in src/app/*.js
(concatenated in name order). Stroke outlines for every Chinese character that appears
anywhere in the content are fetched once into cache/hw (see fetch.py) and inlined, so the
page draws its own characters and needs no Chinese font.
"""
import base64
import json
import re

from fetch import EXTRA, HW, ROOT, get, groups

SRC, DIST = ROOT / "src", ROOT / "dist"
CJK = re.compile(r"[⺀-⿟㐀-鿿]")
# Radical forms with no entry of their own in the stroke data: cut out of a character that carries them.
DERIVED = {"⻊": "跑"}
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
    alias = {"足": "⻊", "⺼": "月", "言": "讠", "食": "饣", "金": "钅", "糸": "纟", "衣": "衤", "犬": "犭", "手": "扌", "水": "氵"}

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
    for c in CJK.findall(json.dumps(gs, ensure_ascii=False)) + list(EXTRA) + list(DERIVED):
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
    data = dict(groups=gs, strokes=strokes, comps=components(taught), audio=audio_manifest())
    blob = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    css = "\n".join(f.read_text() for f in sorted((SRC / "css").glob("*.css")))
    js = "\n".join(f.read_text() for f in sorted((SRC / "app").glob("*.js")))
    page = (SRC / "page.html").read_text()
    body = (page.replace("/*CSS*/", css).replace("/*DATA*/", "window.RAD_DATA=" + blob + ";").replace("/*JS*/", js)
            .replace("{{FONTS}}", FONTS))
    DIST.mkdir(exist_ok=True)
    (DIST / "artifact.html").write_text(body)
    (DIST / "index.html").write_text(
        '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        "<style>body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n</head>\n<body>\n"
        + body + "\n</body>\n</html>\n")
    n = sum(len(g["radicals"]) for g in gs)
    print(f"{n} radicals, {len(strokes)} drawn characters, {len(data['audio'])} audio clips, "
          f"{len(body) / 1e6:.2f} MB" + (f"; no stroke data (font fallback): {' '.join(missing)}" if missing else ""))


if __name__ == "__main__":
    main()
