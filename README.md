# Thirty Radicals

A single-page website that teaches a Chinese learner the 30 most useful simplified-character radicals: what each one means, where it sits in a character, and how to use it to guess the meaning of characters never seen before.

Open `dist/index.html` in a browser. It is one self-contained file (about 2.4 MB) and needs only an internet connection for the web fonts and the Hanzi Writer script used for tracing.

## What is in it

- Six themed sets of five radicals. Each lesson gives the radical's origin, its usual position, the name teachers use for it, a memory clue, four example characters, a "watch out" note, a question on an unseen character, and stroke tracing.
- Set quizzes with five question types (meaning, shape, spot the radical, decode, family), a mixed review weighted towards weak radicals, and a 60-second decode sprint.
- Mandarin pronunciation for all 208 taught characters and the 30 radical names (238 clips).
- Progress is kept in the browser's local storage.

## Building

```
python3 build.py        # -> dist/index.html and dist/artifact.html
```

| Path | What it is |
| --- | --- |
| `src/content/g1..g6.json` | The lesson content, one file per set |
| `src/app/*.js`, `src/css/*.css`, `src/page.html` | Scripts, styles and page shell, inlined by the build |
| `src/audio/mp3/`, `clips.json`, `manifest.json` | Pronunciation clips and the record of how each was checked |
| `fetch.py` | Fetches stroke outlines for every character the site draws into `cache/hw/` |
| `check.py` | Verifies each radical and pinyin reading against the Make Me a Hanzi dictionary |
| `freq.py` | Ranks radicals by how many common characters they head |
| `voices.py` | Makes the pronunciation clips |
| `voices/audition_page.*` | Builds the page used to choose the voice |

Characters are drawn from stroke outlines rather than a font, so the page looks the same on every device.

## Pronunciation clips

The clips use the `serena` preset of a Qwen3-TTS server running locally (`voices.py run serena`). Each character is read at the end of a carrier sentence and cut out. A take is kept only if speech recognition hears the right syllable and its pitch contour fits the tone. These are machine checks, so a clip that sounds wrong can be redone with `voices.py run serena <character>`.

## Credits

- Stroke data and the character dictionary: [Make Me a Hanzi](https://github.com/skishore/makemeahanzi) through [hanzi-writer-data](https://github.com/chanind/hanzi-writer-data) (Arphic Public License for the graphics, LGPL for the dictionary).
- Tracing: [Hanzi Writer](https://hanziwriter.org) (MIT).
- Word frequencies: the [jieba](https://github.com/fxsjy/jieba) word list (MIT).
