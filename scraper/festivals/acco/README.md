# The Acco festival (`acco`)

The Acco Festival of Alternative Israeli Theatre runs in Akko's Old City during
Sukkot. In 2026 it has no competition. Its edition holds two programmes, run by
different organisers on different dates, and each programme is a category of
its own:

| category | programme | dates | tickets |
|---|---|---|---|
| `theatre-programme` (פסטיבל תיאטרון עכו) | the Acco Theatre Centre's own festival | 27.9 to 1.10 | eventer.co.il; the foyer concerts are free |
| `street-programme` (מופעי חוצות) | the municipality's street programme | 28 to 30.9, 18:00 to 23:00 | free entry; the Knights' Halls night show is paid |

The general contract is [../README.md](../README.md). This page covers only
what is specific to Acco.

```sh
python3 scraper/festivals/acco/sources/acco-tc/fetch.py --edition 2026
python3 scraper/festivals/acco/sources/street-programme/fetch.py --edition 2026
python3 scraper/convert/to_serving.py acco 2026
python3 scraper/festivals/acco/sources/acco-tc/parse.py --selftest
python3 scraper/festivals/acco/sources/street-programme/parse.py --selftest
```

## Sources

| source | roles | what it is |
|---|---|---|
| `venues-research` (curated) | venues | `curated/venues.json`: names, the pin, halls and seats, one URL per figure |
| `acco-tc` | events, performances, availability, prices | `acco-tc.com/shows/accofestival/`, one hand-built Elementor page, one line per performance |
| `street-programme` | events, performances, venues, availability, prices | `akko-festival-shows.vercel.app`, the municipality's static programme page, cards under zone headings |

Both pages name their own year. The acco-tc page says it in its heading. The
street page says it in its "28–30.9.26". Each fetcher refuses an edition that
disagrees with the page's year. Parsing lives in each `parse.py` and keys off
the page's words, not its class names. `page_blocks.py` turns markup into lines
for both parsers.

acco-tc may also expose the same page as JSON through `wp-json/wp/v2/pages?slug=accofestival`.
Nobody has read that endpoint yet, so it is not declared as a source. The
eventer pages behind each ticket link would carry the hall, price and runtime
that the programme page leaves out. They have not been read either.

How the page's own labels become our fields is documented in the adapters
(`scraper/convert/adapters/acco/`):

- The theatre labels are הפקת מקור, הצגה אורחת, בכורה, הצגות חממה and לנשים בלבד.
  Each becomes a category.
- כניסה חופשית means `free` with a price of 0.
- A sold-out mark becomes `sold-out`.
- Genre is `theatre`, except the free foyer concerts, which are `music`.
- The street items get a genre from each card's genre line, by keyword.

## The 2026 raw is research, not a fetch

`data/festivals/acco/2026/*/` was not written by `fetch.py`. The session that
landed it could not reach either host with curl, because egress policy denied
it. WebFetch returns a model's summary of a page, not its bytes. So both raw
folders are the 2026-09-24 research, transcribed into `fetch.py`'s raw shape.
Each `manifest.json` says so, with `fetcher: "research-2026-09-24"`, and records
how far each field can be trusted.

The `samples/` pages behind the parse self-tests are **reconstructions** for the
same reason. Each one's header comment says which parts were quoted verbatim and
which were assumed.

**A hand-run fetch on a machine with egress should replace both.** Run the
two `fetch.py` commands above, then convert. Save each page as its source's
`samples/programme.html`. Fix `parse.py` wherever the real markup disagrees, and
make its self-test assert on the real page.

## Things the data reports rather than hides

- **Creator and performer names are absent.** Reads of the same card returned
  different names, so none were landed. Blurbs, images and English titles are
  absent as well.
- **Theatre shows have no runtime, no hall and no price.** The programme page
  gives none of them. Only the free foyer concerts name a hall (הפואייה). Akko
  residents pay 40 ₪, which is in `ticketing`, not in any price.
- **14 street items are skipped** (`provenance.skipped`). These are roaming
  performers, and items the page marks "details to come". The page gives them
  no times.
- **Continuous street items** (a DJ, photo walls, criers) are one window per
  night. Their duration is that window, for example 18:00 to 21:30.
- **Coordinates.** Only the Knights' Halls, and the theatre centre inside them,
  have a pin, and it is read off the municipality page's Google Maps link. The
  street zones have no citable coordinate, and roaming items have no venue at
  all.
