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
python3 scraper/festivals/acco/sources/eventer/fetch.py --edition 2026
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
| `eventer` | events, performances, availability, prices | `eventer.co.il/user/accofestival`, the theatre centre's ticket seller ([platform](../platforms/eventer.py)), one event per ticketed performance |
| `street-programme` | events, performances, venues, availability, prices | `akko-festival-shows.vercel.app`, the municipality's static programme page, cards under zone headings |

Both programme pages name their own year. The acco-tc page says it in its
heading. The street page says it in its "28–30.9.26". Each fetcher refuses an
edition that disagrees with the page's year. Parsing lives in each `parse.py`,
proven by its self-test against the real page saved as `samples/programme.html`.

### Where each theatre fact comes from

The programme page is the festival's schedule; Eventer is where the tickets are
sold, and knows what the programme page leaves out. Eventer never adds a
performance of its own: each Eventer event is matched to the programme line at
its date and start.

| fact | source | why |
|---|---|---|
| title, labels (categories), schedule, free concerts | acco-tc | the festival's own words; Eventer's title lines pack in the festival name, hall and runtime |
| hall | eventer (title line), acco-tc for the foyer concerts | the programme page names no hall for a ticketed show |
| running time | eventer (title line, "(50 דק')") | not on the programme page; Eventer's end time is a booking slot, not the runtime |
| prices | eventer ticket types | full price and concessions; the residents' rate needs ID and is in `ticketing` |
| ticket link, availability | eventer, then acco-tc's sold-out marks | Eventer drops a sold-out performance, so the page's "sold out" covers those |
| blurb, picture | eventer | the full description, with credits |

How the page's own labels become our fields is documented in the adapters
(`scraper/convert/adapters/acco/`):

- The theatre labels are הפקת מקור, הצגה אורחת, בכורה, הצגות חממה and לנשים בלבד.
  Each becomes a category.
- כניסה חופשית means `free` with a price of 0.
- A sold-out mark becomes `sold-out`.
- Genre is `theatre`, except the free foyer concerts, which are `music`.
- The street items get a genre from each card's genre line, by keyword.

## Things the data reports rather than hides

- **Sold-out theatre performances have no hall, price or ticket link.** Eventer
  drops a performance once it sells out, and the programme page gives none of
  the three.
- **A programme line whose link sells another night** (29.9's אורשינא links to
  the 28.9 Eventer page, and Eventer lists no 29.9 performance) keeps the
  page's line, with no ticket link and an unknown status.
- **15 street items are skipped** (`provenance.skipped`). These are roaming
  performers, items the page marks "details to come", and the Knights' Halls
  daytime visit. The page gives them no times.
- **Continuous street items** (a DJ, photo walls, criers) are one window per
  night. Their duration is that window, for example 18:00 to 21:30.
- **Coordinates.** Only the Knights' Halls, and the theatre centre inside them,
  have a pin, and it is read off the municipality page's Google Maps link. The
  street zones have no citable coordinate, and roaming items have no venue at
  all.
