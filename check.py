"""Does the highlighted part of every example match the radical being taught?"""
import json
from fetch import ROOT, groups, get
D = {}
for line in open(ROOT / "cache" / "dictionary.txt", encoding="utf8"):
    d = json.loads(line); D[d["character"]] = d
FAM = {"亻": "亻人", "忄": "忄心", "讠": "讠言", "扌": "扌手", "月": "月⺼肉", "⻊": "⻊足", "氵": "氵水", "火": "火灬", "艹": "艹艸",
       "⺮": "⺮竹", "犭": "犭犬", "饣": "饣食", "衤": "衤衣", "纟": "纟糸", "辶": "辶辵", "钅": "钅金", "刂": "刂刀"}
for g in groups():
    for r in g["radicals"]:
        fam = FAM.get(r["glyph"], r["glyph"])
        nrad = len(get(r["glyph"])["strokes"]) if get(r["glyph"]) else None
        for kind, items in (("ex", r["ex"]), ("decode", r["decode"])):
            for it in items:
                ch = it[0]; hw = get(ch); d = D.get(ch, {})
                rs = hw.get("radStrokes", [])
                flag = "" if d.get("radical") in fam and rs else "  <-- CHECK"
                py = ",".join(d.get("pinyin", []))
                pflag = "" if it[1] in d.get("pinyin", []) else f"  <-- pinyin {py}"
                et = d.get("etymology", {})
                print(f"{r['glyph']}({nrad}) {kind:6s} {ch} {it[1]:7s} dict-rad {d.get('radical')} radStrokes {rs} of {len(hw['strokes'])} {et.get('type','')[:5]} sem={et.get('semantic','')} ph={et.get('phonetic','')}{flag}{pflag}")
