"""Mandarin clips for the site, made with the Qwen3-TTS server on this machine (:8100).

    python voices.py audition            # the same six samples from every Mandarin preset -> voices/audition/
    python voices.py run serena          # every clip the site plays -> src/audio/ (resumable; build.py inlines them)
    python voices.py run serena 河 想     # make those again

A single syllable on its own comes out of the model unreliably, so each character is read at the
end of a carrier sentence ("这个字读作：河。") and the last spoken segment is cut out, the method the
radicals video used. Every take is checked inside the qwen-tts-studio container: whisper must hear
the right syllables, and for single characters the pitch contour must fit the tone (whisper cannot
tell tones apart). The first seed that passes is kept.
"""
import base64
import io
import json
import subprocess
import sys
import urllib.request
from pathlib import Path

import numpy as np
import soundfile as sf
from pypinyin import Style, lazy_pinyin, pinyin

from fetch import groups

ROOT = Path(__file__).resolve().parent
SERVER = "http://127.0.0.1:8100"
BOX = "qwen-tts-studio"
CARRIER = "这个字读作：{}。"
INSTRUCT = "像汉语老师一样，用标准普通话清楚地朗读，冒号后面停顿一下，再清晰地读出那个字。"
PLAIN = "像汉语老师一样，用标准普通话清楚、自然地朗读。"
SEEDS = [11, 23, 37]
# presets whose home language is Chinese (dylan leans Beijing, eric leans Sichuan)
MANDARIN = ["vivian", "serena", "uncle_fu", "dylan", "eric"]
# key: (text, tone or None, carrier?)
AUDITION = {
    "ma": ("妈", 1, True), "he": ("河", 2, True), "xiang": ("想", 3, True), "fan": ("饭", 4, True),
    "name": ("三点水", None, False), "phrase": ("你好，我们一起来学部首。", None, False),
}

INSIDE = r'''
import json, sys, numpy as np, librosa, whisper
m = whisper.load_model("/tmp/wh/large-v3-turbo.pt")
out = {}
for f in sys.argv[1:]:
    name = f.split("/")[-1]
    if name.startswith("cut_"):
        y, sr = librosa.load(f, sr=16000)
        f0, _, _ = librosa.pyin(y, fmin=80, fmax=500, sr=sr, frame_length=1024, hop_length=160)
        v = f0[~np.isnan(f0)]
        st = 12 * np.log2(v / 200) if len(v) else np.array([])
        out[name] = [round(float(np.median(c)), 1) for c in np.array_split(st, 5)] if len(st) >= 5 else []
    else:
        r = m.transcribe(f, language="zh", fp16=True, condition_on_previous_text=False)
        out[name] = r["text"].strip()
print("JSON" + json.dumps(out, ensure_ascii=False))
'''


def post(path, body, timeout=900):
    req = urllib.request.Request(SERVER + path, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def speak(text, speaker, seed, instruct):
    r = post("/generate", dict(mode="custom", text=text, language="chinese", speaker=speaker, instruct=instruct, seed=seed))
    a, sr = sf.read(io.BytesIO(base64.b64decode(r["audio_b64"])), dtype="float32")
    return (a.mean(axis=1) if a.ndim > 1 else a), sr


def trim(a, sr, pad=0.08):
    loud = np.flatnonzero(np.abs(a) > 0.01)
    return a if not len(loud) else a[max(0, loud[0] - int(pad * sr)):min(len(a), loud[-1] + int(pad * sr))]


def last_segment(a, sr, pad=(0.05, 0.12)):
    """The last stretch of speech in the take: everything after the final pause of 100 ms or more."""
    fr = int(0.01 * sr)
    rms = np.array([np.sqrt(np.mean(a[i:i + fr] ** 2)) for i in range(0, len(a) - fr, fr)])
    loud = rms >= 0.02 * rms.max() + 1e-4
    end = int(np.flatnonzero(loud)[-1]) + 1
    i, quiet = end - 1, 0
    while i > 0 and quiet < 10:
        i -= 1
        quiet = 0 if loud[i] else quiet + 1
    start = i + quiet if quiet >= 10 else 0
    cut = a[max(0, start * fr - int(pad[0] * sr)):min(len(a), end * fr + int(pad[1] * sr))].copy()
    n = int(0.02 * sr)
    cut[:n] *= np.linspace(0, 1, n)
    cut[-n:] *= np.linspace(1, 0, n)
    return cut, start > 0


def fits(tone, st):
    """Does a five-point pitch contour (semitones) look like this tone?"""
    if len(st) < 5:
        return False
    lo, at = min(st), st.index(min(st))
    if tone == 1:
        return max(st) - lo <= 3.5
    if tone == 2:
        return st[-1] - min(st[:3]) >= 3.5 and st[-1] >= st[0]
    if tone == 3:
        return 1 <= at <= 3 and st[0] - lo >= 1.5
    if tone == 4:
        return st[0] - st[-1] >= 4 or max(st[:2]) - st[-1] >= 4
    return max(st) - lo <= 5


def toneless(text):
    return lazy_pinyin("".join(c for c in text if "一" <= c <= "鿿"), style=Style.NORMAL, v_to_u=True)


def check(files):
    """{file name: whisper text, or a pitch contour for cut_ files}, worked out inside the container."""
    subprocess.run(["docker", "exec", BOX, "sh", "-c", "rm -rf /tmp/radsite && mkdir -p /tmp/radsite"], check=True)
    for f in files:
        subprocess.run(["docker", "cp", str(f), f"{BOX}:/tmp/radsite/{f.name}"], check=True, capture_output=True)
    subprocess.run(["docker", "exec", "-i", BOX, "sh", "-c", "cat > /tmp/radsite/check.py"], input=INSIDE, text=True, check=True)
    r = subprocess.run(["docker", "exec", BOX, "python", "/tmp/radsite/check.py"] + [f"/tmp/radsite/{f.name}" for f in files],
                       check=True, capture_output=True, text=True)
    return json.loads(r.stdout[r.stdout.index("JSON") + 4:])


def audition():
    out = ROOT / "voices" / "audition"
    raw = out / "raw"
    raw.mkdir(parents=True, exist_ok=True)
    results_f = out / "results.json"
    results = json.loads(results_f.read_text()) if results_f.exists() else {}
    todo = [(v, k) for v in MANDARIN for k in AUDITION if k not in results.get(v, {})]
    for seed in SEEDS:
        if not todo:
            break
        files = []
        for v, k in todo:
            text, tone, carrier = AUDITION[k]
            a, sr = speak(CARRIER.format(text) if carrier else text, v, seed, INSTRUCT if carrier else PLAIN)
            stem = f"{v}_{k}_{seed}.wav"
            sf.write(raw / f"full_{stem}", a, sr)
            files.append(raw / f"full_{stem}")
            if carrier:
                cut, found = last_segment(a, sr)
                sf.write(raw / f"cut_{stem}", cut if found else a, sr)
                files.append(raw / f"cut_{stem}")
            print(f"  made {v} {k} seed {seed}", flush=True)
        heard = check(files)
        for v, k in list(todo):
            text, tone, carrier = AUDITION[k]
            stem = f"{v}_{k}_{seed}.wav"
            said = heard[f"full_{stem}"]
            if carrier:
                st = heard[f"cut_{stem}"]
                seconds = sf.info(raw / f"cut_{stem}").duration
                ok = toneless(said) == toneless(CARRIER.format(text)) and fits(tone, st) and 0.25 <= seconds <= 1.1
            else:
                st, ok = None, toneless(said) == toneless(text)
            print(f"{v:9s} {k:7s} seed {seed}: {'ok ' if ok else 'NO '} heard {said!r} contour {st}", flush=True)
            entry = results.setdefault(v, {}).setdefault("_tries", {}).setdefault(k, [])
            entry.append(dict(seed=seed, ok=ok, heard=said, contour=st))
            if ok:
                (out / v).mkdir(exist_ok=True)
                if carrier:
                    (out / v / f"{k}.wav").write_bytes((raw / f"cut_{stem}").read_bytes())
                else:
                    a, sr = sf.read(raw / f"full_{stem}", dtype="float32")
                    sf.write(out / v / f"{k}.wav", trim(a, sr), sr)
                results[v][k] = dict(seed=seed, tries=len(entry))
                todo.remove((v, k))
        results_f.write_text(json.dumps(results, ensure_ascii=False, indent=1))
    for v in MANDARIN:
        got = [k for k in AUDITION if k in results.get(v, {})]
        first = sum(1 for k in got if results[v][k]["tries"] == 1)
        print(f"{v}: {len(got)}/{len(AUDITION)} samples passed, {first} on the first take")


# ---------------------------------------------------------------- the site's own clips
RUN_SEEDS = [11, 23, 37, 41, 53, 67, 79, 97]
FFMPEG = str(Path.home() / "tools/ffmpeg/ffmpeg-7.0.2-arm64-static/ffmpeg")
MARKS = {"āēīōūǖ": 1, "áéíóúǘ": 2, "ǎěǐǒǔǚ": 3, "àèìòùǜ": 4}
PLAIN_V = dict(zip("āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ", "aaaaeeeeiiiioooouuuuüüüü"))


def syllable(p):
    """'xiǎng' -> ('xiang', 3); no mark means the neutral tone, 5."""
    tone = next((t for marks, t in MARKS.items() if any(c in marks for c in p)), 5)
    return "".join(PLAIN_V.get(c, c) for c in p.lower()), tone


# whisper writes a lone "ti" or "bi" as the letter it sounds like
LETTERS = {"T": {"ti"}, "B": {"bi"}}
# read alone, these come out in their other reading, so a character with the wanted sound is spoken instead
SPOKEN_AS = {"缝": "逢"}


def readings(c):
    return set(pinyin(c, style=Style.NORMAL, heteronym=True, v_to_u=True)[0])


def matches(said, want):
    """Did whisper hear these syllables? Any reading of each character it wrote down counts."""
    chars = [c for c in said if "一" <= c <= "鿿" or c in LETTERS]
    return len(chars) == len(want) and all(w in (LETTERS.get(c) or readings(c)) for c, w in zip(chars, want))


def site_items():
    """{text: (syllables, tone or None)}: single characters carry a tone to check, radical names do not."""
    items = {}
    for g in groups():
        for r in g["radicals"]:
            for e in r["ex"] + r["decode"]:
                assert len(e[0]) == 1 and " " not in e[1], e
                items[e[0]] = syllable(e[1])
            if r["full"]:
                items.setdefault(r["full"], syllable(r["fullPinyin"]))
            name = lazy_pinyin(r["cn"], style=Style.NORMAL, v_to_u=True)
            assert "".join(name) == syllable(r["cnPinyin"])[0], (r["cn"], name, r["cnPinyin"])
            items[r["cn"]] = (name, None)
    for ch, p in (("吗", "ma"), ("蚂", "mǎ")):          # the radical-swap demo on the home page
        items.setdefault(ch, syllable(p))
    return {t: (([s], tone) if isinstance(s, str) else (s, tone)) for t, (s, tone) in items.items()}


def level_out(a):
    peak = float(np.abs(a).max())
    return a * (0.89 / peak) if peak > 0 else a


def run(speaker, redo):
    out = ROOT / "src" / "audio"
    raw = ROOT / "voices" / "raw" / speaker
    for d in (raw, out / "wav", out / "mp3"):
        d.mkdir(parents=True, exist_ok=True)
    items = site_items()
    clips_f = out / "clips.json"
    clips = json.loads(clips_f.read_text()) if clips_f.exists() else {}
    clips = {t: c for t, c in clips.items() if t in items and c["speaker"] == speaker}
    todo = [t for t in items if t in redo or t not in clips or not (out / "wav" / f"{t}.wav").exists()]
    print(f"{len(items)} clips wanted, {len(todo)} to make", flush=True)
    carrier_want = lazy_pinyin("这个字读作", style=Style.NORMAL)
    for seed in RUN_SEEDS:
        if not todo:
            break
        files = []
        for t in todo:
            single = items[t][1] is not None
            a, sr = speak(CARRIER.format(SPOKEN_AS.get(t, t)) if single else t, speaker, seed, INSTRUCT if single else PLAIN)
            sf.write(raw / f"full_{t}_{seed}.wav", a, sr)
            files.append(raw / f"full_{t}_{seed}.wav")
            if single:
                cut, found = last_segment(a, sr)
                sf.write(raw / f"cut_{t}_{seed}.wav", cut if found else a, sr)
                files.append(raw / f"cut_{t}_{seed}.wav")
        heard = {}
        for i in range(0, len(files), 120):
            heard.update(check(files[i:i + 120]))
        for t in list(todo):
            syl, tone = items[t]
            said = heard[f"full_{t}_{seed}.wav"]
            if tone is not None:
                st = heard[f"cut_{t}_{seed}.wav"]
                a, sr = sf.read(raw / f"cut_{t}_{seed}.wav", dtype="float32")
                ok = matches(said, carrier_want + syl) and fits(tone, st) and 0.25 <= len(a) / sr <= 1.1
            else:
                st = None
                a, sr = sf.read(raw / f"full_{t}_{seed}.wav", dtype="float32")
                a = trim(a, sr)
                ok = matches(said, syl) and 0.6 <= len(a) / sr <= 2.6
            print(f"{t} {'-'.join(syl):14s} tone {tone} seed {seed}: {'ok ' if ok else 'NO '} heard {said!r} {len(a) / sr:.2f}s contour {st}", flush=True)
            if ok:
                sf.write(out / "wav" / f"{t}.wav", level_out(a), sr)
                subprocess.run([FFMPEG, "-v", "error", "-y", "-i", str(out / "wav" / f"{t}.wav"), "-ac", "1", "-ar", "24000", "-b:a", "48k",
                                str(out / "mp3" / f"{t}.mp3")], check=True)
                clips[t] = dict(speaker=speaker, seed=seed, pinyin="".join(syl), tone=tone, heard=said, contour=st, seconds=round(len(a) / sr, 3))
                todo.remove(t)
        clips_f.write_text(json.dumps(clips, ensure_ascii=False, indent=1))
        (out / "manifest.json").write_text(json.dumps({t: f"mp3/{t}.mp3" for t in items if t in clips}, ensure_ascii=False, indent=1))
        print(f"after seed {seed}: {len(clips)}/{len(items)} done", flush=True)
    print(f"{len(clips)}/{len(items)} clips" + (f"; still missing: {' '.join(todo)}" if todo else ""))


if __name__ == "__main__":
    if sys.argv[1:2] == ["audition"]:
        audition()
    elif sys.argv[1:2] == ["run"] and len(sys.argv) > 2:
        run(sys.argv[2], set(sys.argv[3:]))
    else:
        print(__doc__)
