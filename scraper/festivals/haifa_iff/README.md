# The Haifa International Film Festival (`haifa-iff`)

A nine-day film festival held every Sukkot in Haifa's Carmel Centre. Tickets are
sold at one flat tariff through the festival's own basket, and the site publishes
no availability feed. So there is nothing to refresh on a schedule: fetch by hand
when the programme changes, convert, commit. The general contract is
[../README.md](../README.md); this page covers what is specific to Haifa.

```sh
python3 scraper/festivals/haifa_iff/sources/haifaff-site/fetch.py --edition 2026
python3 scraper/convert/to_serving.py haifa-iff 2026
python3 scraper/festivals/haifa_iff/sources/haifaff-site/parse.py --selftest
```

## Sources

| source | roles | what it is |
|---|---|---|
| `haifaff-site` | events, performances, venues, prices | `haifaff.co.il`: the English schedule, the Hebrew schedule, and one page per film and per event |
| `venues-research` (curated) | venues (address, capacity, layout, access, coordinates) | `curated/venues.json`: a URL for every figure, and a stated basis for every coordinate |
| `smarticket` (optional, absent) | availability | not built yet; [its fetch.py](sources/smarticket/fetch.py) says what it needs |

The site has no API that anyone has found. It is a custom CMS that renders
server-side HTML, and the English (`/eng/…`) and Hebrew mirrors use the same
numeric ids:

| what | where on the site |
|---|---|
| every screening: day, venue, start, film or event id, screening (basket) id, section tags | `/eng/Screening_schedule`, one page |
| a film's title, sections (`grp\|fwsa\|<groupId>`), director, country/year, runtime, language, subtitles | `/eng/Films/<id>` |
| the Hebrew title | the film link's slug on the Hebrew schedule `/לוח_הקרנות` |
| an event's group (opening, industry, …) | `/eng/Events/<id>` |
| the tariff | `/eng/Pricing_\|famp\|_Passes`, served from `[ticketing]` in festival.toml |

The edition marker is the site's own number: "Haifa 42nd International Film
Festival" on the English schedule, "ה-42" on the Hebrew one, and `Festival: 42`
on every film page. The fetch refuses to write when any of them disagrees with
the edition's `ordinal`, or when a screening falls outside the edition's dates.

Key everything on the numeric id and never on a title: the Hebrew title is often
a local release title that differs from the English one (13537 *Adult
Supervision* is השגחה הורית).

## What the served block says, and why

- **Genre.** Every film, and the opening event, is `film`. An event in the
  industry group (713), such as a pitching forum, a round table or an AI session,
  is `talk`.
- **Categories** are the festival's 17 sections, keyed by the site's group id.
  A film in several sections is filed under all of them.
- **Prices** are one festival-wide tariff, served as `festival.ticketing`
  (49 ₪ standard, 46 ₪ discounted, 150 ₪ opening, 115 ₪ Culinary Cinema,
  plus passes). A performance carries a price only when the programme gives
  one for that performance. Today that is the opening event, at 150 ₪.
- **Status** is `unknown` everywhere, because no availability source exists.
- **Titles** are English (`lang = "en"`), since the English mirror is the complete
  one. Hebrew titles stay in raw as `titleHe`, because the serving block has no
  local-title field.

## The 2026 raw is a research transcription, not a fetch

`haifaff.co.il` was denied at CONNECT from the session that added this festival,
so `fetch.py` has never run. The committed
`data/festivals/haifa-iff/2026/haifaff-site/` was transcribed from WebFetch
summaries of the site on 2026-09-24 and reshaped into `fetch.py`'s output shape.
Its `manifest.json` records exactly how (`fetcher: "research-2026-09-24"`) and
lists the known gaps. The main ones are that no synopses, images or section tags
were captured, 28 films lack a Hebrew title, and one screening's ticket link is
unknown. **The first real run of `fetch.py`, on a machine with egress, should
overwrite that folder.** Diff the result against the transcription: any
difference is either a gap closing or a transcription error.

## The samples are reconstructed

`sources/haifaff-site/samples/` holds HTML excerpts that `parse.py --selftest`
reads. They are **not captured bytes**. They were rebuilt from markdown renderings
of the real pages: the text, links, headings and list structure are what those
renderings showed, and the class names and wrappers of the real markup are
unknown. So `parse.py` reads element kinds (headings, list items, links, text
lines) and never class names. Each sample's header comment says what it was
rebuilt from. Replace them with real excerpts from the same hand-run fetch
(its page cache is under `data/festivals/.cache/`), and fix `parse.py` wherever
the real markup disagrees.

## Things the data reports rather than hides

- **Four venues share a block** (HaNassi 138-142: Auditorium, Rapaport,
  Cinematheque, Mirrors Hall), so the planner costs the walk between them at
  about zero. Tikotin is a 10-15 minute walk away, and Kriger is a drive.
- **Every venue coordinate is approximate.** None could be geocoded from the
  research session, and each venue's served `notes` says so.
- **Two section-listed films have no screening** (13458 *The Black Ball*,
  13614 *Violence at Noon*), so they are not served.
