"""Fetch stroke data (hanzi-writer-data 2.0, from Make Me a Hanzi) for every character the site draws -> cache/hw/."""
import json, pathlib, sys, urllib.parse, urllib.request, urllib.error

ROOT = pathlib.Path(__file__).parent
HW = ROOT / "cache" / "hw"
CDN = "https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0/"
# characters outside the lesson content: intro demo, look-alikes mentioned in notes, the hero wall
EXTRA = "妈马吗蚂女口虫部首学会"


def groups():
    return [json.loads((ROOT / "src" / "content" / f"g{i}.json").read_text()) for i in range(1, 7)]


def wanted():
    out = []
    for g in groups():
        out += [g["zh"]]
        for r in g["radicals"]:
            out += [r["glyph"], r.get("alt"), r.get("full")] + list(r["cn"]) + [e[0] for e in r["ex"]] + [d[0] for d in r["decode"]]
    out += list(EXTRA)
    seen = []
    for c in out:
        if c and c not in seen:
            seen.append(c)
    return seen


def get(ch):
    f = HW / f"{ord(ch):x}.json"
    if f.exists():
        return json.loads(f.read_text()) if f.stat().st_size else None
    try:
        with urllib.request.urlopen(CDN + urllib.parse.quote(ch) + ".json", timeout=30) as r:
            f.write_bytes(r.read())
    except urllib.error.HTTPError as e:
        if e.code != 404:
            raise
        f.write_bytes(b"")
    return get(ch)


if __name__ == "__main__":
    HW.mkdir(parents=True, exist_ok=True)
    chars = wanted()
    missing = [c for c in chars if get(c) is None]
    print(len(chars), "characters;", "missing:", " ".join(missing) or "none")
