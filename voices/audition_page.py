"""Turn voices/audition/ into one page with every sample inline: voices/audition/voice-audition.html."""
import base64
import json
import subprocess
from pathlib import Path

import soundfile as sf
from pypinyin import Style, lazy_pinyin

HERE = Path(__file__).resolve().parent / "audition"
FFMPEG = str(Path.home() / "tools/ffmpeg/ffmpeg-7.0.2-arm64-static/ffmpeg")
ITEMS = [("ma", "妈", "mā", "tone 1"), ("he", "河", "hé", "tone 2"), ("xiang", "想", "xiǎng", "tone 3"), ("fan", "饭", "fàn", "tone 4"),
         ("name", "三点水", "sāndiǎnshuǐ", "a radical's name"), ("phrase", "你好，我们一起来学部首。", "Nǐ hǎo, wǒmen yìqǐ lái xué bùshǒu.", "a full sentence")]
VOICES = [("vivian", "Vivian", "Young woman, bright and crisp. The voice in the radicals video.", "c-pink"),
          ("serena", "Serena", "Young woman, warmer and softer.", "c-teal"),
          ("uncle_fu", "Uncle Fu", "Older man, low and mellow.", "c-amber"),
          ("dylan", "Dylan", "Young man with a Beijing accent.", "c-water"),
          ("eric", "Eric", "Young man with a Sichuan (Chengdu) accent.", "c-violet")]
CARRIER = "这个字读作{}"


def toneless(text):
    return lazy_pinyin("".join(c for c in text if "一" <= c <= "鿿"), style=Style.NORMAL, v_to_u=True)


def mp3(wav):
    r = subprocess.run([FFMPEG, "-v", "error", "-i", str(wav), "-ac", "1", "-ar", "24000", "-b:a", "56k", "-f", "mp3", "-"],
                       check=True, capture_output=True)
    return base64.b64encode(r.stdout).decode()


def main():
    results = json.loads((HERE / "results.json").read_text())
    data = []
    for vid, name, blurb, color in VOICES:
        res, clips, passed, first = results[vid], [], 0, 0
        for key, text, pinyin, what in ITEMS:
            single = len(text) == 1
            if key in res:
                wav, ok = HERE / vid / f"{key}.wav", True
                passed += 1
                first += res[key]["tries"] == 1
            else:
                # nothing passed: play the take that came closest, and say so
                def score(t):
                    f = HERE / "raw" / f"{'cut' if single else 'full'}_{vid}_{key}_{t['seed']}.wav"
                    right = toneless(t["heard"]) == toneless(CARRIER.format(text) if single else text)
                    return (right, not single or 0.25 <= sf.info(f).duration <= 1.1), f
                wav, ok = max((score(t) for t in res["_tries"][key]), key=lambda x: x[0])[1], False
            clips.append(dict(key=key, text=text, pinyin=pinyin, what=what, ok=ok, audio=mp3(wav)))
        data.append(dict(id=vid, name=name, blurb=blurb, color=color, clips=clips, passed=passed, first=first))
    page = (HERE.parent / "audition_page.html").read_text().replace("/*DATA*/", json.dumps(data, ensure_ascii=False))
    out = HERE / "voice-audition.html"
    out.write_text(page)
    print(out, f"{len(page) / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
