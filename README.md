# Sixty Radicals

A single-page website that teaches a Chinese learner the 60 most useful simplified-character radicals: what each one means, where it sits in a character, and how to use it to guess the meaning of characters never seen before.

**Visit it: https://a-c-pack.github.io/sixty-radicals/**

The page is `docs/index.html`, one self-contained file (about 6.6 MB) served by GitHub Pages. It can also be opened straight from disk, and needs an internet connection only for the web fonts and the Hanzi Writer script used for tracing.

## What is in it

- Twelve themed sets of five radicals. Each lesson gives the radical's origin, its usual position, the name teachers use for it, a memory clue, four example characters, a "watch out" note, a question on an unseen character, and stroke tracing.
- Set quizzes with five question types (meaning, shape, spot the radical, decode, family), a mixed review weighted towards weak radicals, and a 60-second decode sprint.
- Sound families: twenty sound parts in four sets (clean echoes, a stray or two, near rhymes, worn hints). Each lesson shows the part in four characters with four different radicals, a table of every common character built on it sorted by how it is said, and a two-step question on an unseen character: first the sound from the sound part, then the meaning from the radical. Each set has a practice round and there is a mixed sound review. The content is `src/content/families.json`; `build.py` checks it against the Make Me a Hanzi dictionary and works out which strokes belong to the sound part.
- Two games at the end of every set. In **Radical hunt** you read a piece of everyday text (a family chat, a clinic form, a menu, a town map, a shopping list, a museum guide) and tap every character that carries a given radical. In **Build a character** you start from a meaning and pick the radical, where it sits, and the part that finishes it.
- Mandarin pronunciation for all 412 taught characters, the 60 radical names and the characters the games teach (532 clips).
- Progress is kept in the browser's local storage.

The site began as Thirty Radicals. Sets 7 to 12 were added later, and progress saved under the old name carries over.

## Building

```
python3 build.py        # -> docs/index.html (the public page)
```

| Path | What it is |
| --- | --- |
| `src/content/g1..g12.json` | The lesson content, one file per set |
| `src/content/games.json` | The hunt scene and build round for each set. The build checks it against the dictionary, so no tap in a hunt is marked wrong unfairly |
| `src/app/*.js`, `src/css/*.css`, `src/page.html` | Scripts, styles and page shell, inlined by the build |
| `src/audio/mp3/`, `clips.json`, `manifest.json` | Pronunciation clips and the record of how each was checked |
| `fetch.py` | Fetches stroke outlines for every character the site draws into `cache/hw/` |
| `check.py` | Verifies each radical and pinyin reading against the Make Me a Hanzi dictionary |
| `freq.py` | Ranks radicals by how many common characters they head |
| `voices.py` | Makes the pronunciation clips |
| `voices/audition_page.*` | Builds the page used to choose the voice |

Characters are drawn from stroke outlines rather than a font, so the page looks the same on every device.

Two pairs of radicals look alike and are told apart by position: the ear-shaped hook is HILL on the left of a character and TOWN on the right, and the box is MOUTH when small and ENCLOSURE when it holds the rest of the character. The content marks each pair with `twin`, and the quizzes and hunts never set one against the other on shape alone.

## Pronunciation clips

The clips use the `serena` preset of a Qwen3-TTS server running locally (`voices.py run serena`). Each character is read at the end of a carrier sentence and cut out. A take is kept only if speech recognition hears the right syllable and its pitch contour fits the tone. These are machine checks, so a clip that sounds wrong can be redone with `voices.py run serena <character>`.

## Credits

- Stroke data and the character dictionary: [Make Me a Hanzi](https://github.com/skishore/makemeahanzi) through [hanzi-writer-data](https://github.com/chanind/hanzi-writer-data) (Arphic Public License for the graphics, LGPL for the dictionary).
- Tracing: [Hanzi Writer](https://hanziwriter.org) (MIT).
- Word frequencies: the [jieba](https://github.com/fxsjy/jieba) word list (MIT).
