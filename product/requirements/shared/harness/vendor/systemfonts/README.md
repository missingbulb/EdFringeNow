# The font jail

Chromium renders this repo's pages with the vendored web fonts (`../fonts/`) —
but only for the characters those fonts carry. Everything else (emoji, arrows,
`≤`, a Cyrillic show title) is drawn from whatever is **installed on the
machine**, which made the goldens a record of the renderer's font set rather
than of the product. It cost a whole CI lane: the walk-time line
(`🚶 5 min · £16`) measured a different width on the GitHub runner than in the
Claude sandbox, wrapped to a second line, and every show card came out 21px
taller.

These files are that fallback set, pinned. `shared/harness/browser.js` generates
a fontconfig config whose only `<dir>` is this folder and launches Chromium with
`FONTCONFIG_FILE` pointing at it, so no host font can reach the page.

| File | Source | Licence |
| --- | --- | --- |
| `NotoColorEmoji-req-subset.ttf` | Noto Color Emoji (`fonts-noto-color-emoji`) | SIL Open Font License 1.1 |
| `DejaVuSans.ttf`, `DejaVuSans-Bold.ttf` | DejaVu Sans (`fonts-dejavu-core`) | DejaVu / Bitstream Vera (permissive) |
| `LiberationSans-Regular.ttf`, `LiberationSans-Bold.ttf` | Liberation Sans (`fonts-liberation`) | SIL Open Font License 1.1 |

Liberation Sans is here because the product's metric-matched fallback faces are
`src: local("Arial")` (`css/styles.css`); the config aliases `Arial` to it, which
is what a stock Linux desktop does anyway.

All three are subset — full Noto Color Emoji alone is 10.8 MB. The subsets cover
the characters the product and the fixtures actually use, so an unexpected
character renders as a deterministic tofu box rather than as a different font on
a different machine. **A new emoji or script in the product or the fixtures
means re-running the subset below** (and re-baselining whatever goldens it
touches).

```sh
pip install fonttools
# emoji: the code points scanned out of the pages, scripts and fixtures
python3 -m fontTools.subset /usr/share/fonts/truetype/noto/NotoColorEmoji.ttf \
  --unicodes=U+2190-2194,U+2197,U+21D2,U+221A,U+2248,U+2263-2265,U+23F0,... \
  --output-file=NotoColorEmoji-req-subset.ttf --drop-tables+=DSIG --name-IDs='*'
# text: Latin + Greek + Cyrillic + the symbol blocks
python3 -m fontTools.subset /usr/share/fonts/truetype/dejavu/DejaVuSans.ttf \
  --unicodes=U+0000-024F,U+0300-036F,U+0370-03FF,U+0400-04FF,U+1E00-1EFF,U+2000-20BF,U+2100-21FF,U+2200-23FF,U+2500-257F,U+25A0-27BF,U+2A00-2AFF,U+FB00-FB4F,U+FE0F,U+FF00-FFEF \
  --output-file=DejaVuSans.ttf --drop-tables+=DSIG --name-IDs='*' --layout-features='*'
```
