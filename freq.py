"""Rank radicals by how many of the most-used characters they head.

Character frequency is estimated from the jieba word list (word count x occurrences);
radicals come from the Make Me a Hanzi dictionary. Prints the ranking and the share of
the top-N characters covered by a chosen set.
"""
import json, sys, collections, pathlib
C = pathlib.Path(__file__).parent / "cache"
freq = collections.Counter()
for line in open(C / "jieba_dict.txt", encoding="utf8"):
    w, n, *_ = line.split()
    for ch in w:
        if "一" <= ch <= "鿿":
            freq[ch] += int(n)
D = {}
for line in open(C / "dictionary.txt", encoding="utf8"):
    d = json.loads(line)
    D[d["character"]] = d
# fold variant forms into one family
FOLD = {"水": "氵", "人": "亻", "手": "扌", "心": "忄", "言": "讠", "食": "饣", "衣": "衤", "金": "钅", "刀": "刂", "犬": "犭",
        "艸": "艹", "竹": "⺮", "火": "灬", "糸": "纟", "辵": "辶", "肉": "月", "玉": "王", "示": "礻", "足": "⻊", "网": "罒"}
N = int(sys.argv[1]) if len(sys.argv) > 1 else 2500
top = [c for c, _ in freq.most_common() if c in D][:N]
fam = collections.defaultdict(list)
for c in top:
    r = D[c]["radical"]
    fam[FOLD.get(r, r)].append(c)
rank = sorted(fam.items(), key=lambda kv: -len(kv[1]))
for i, (r, cs) in enumerate(rank[:70], 1):
    print(f"{i:2d} {r} {len(cs):3d}  {''.join(cs[:40])}")
MINE = "亻女口讠忄扌目月⻊疒氵灬土日雨木艹⺮犭虫宀门饣衤纟辶车钅刂贝"
got = sum(len(fam.get(r, [])) for r in MINE)
print(f"chosen 30 head {got} of the top {N} = {got / N:.1%}")
for r in MINE:
    print(r, len(fam.get(r, [])), end="; ")
print()
tot = sum(freq[c] for c in top)
print("by running text:", f"{sum(freq[c] for r in MINE for c in fam.get(r, [])) / tot:.1%}")
