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
| every screening: day, venue, start, film or event id, screening (basket) id | `/eng/Screening_schedule`, one page |
| a film's title, picture (og:image), own section (`grp\|fwsa\|<groupId>`), director, country/year, runtime, language, subtitles, synopsis | `/eng/Films/<id>` |
| every other section a film sits in | the section listings `/eng/Films` links, paged by `?from=` |
| the Hebrew title | the film link's slug on the Hebrew schedule `/לוח_הקרנות` |
| an event's group (opening, industry, …), picture, and hall | `/eng/Events/<id>` |
| the tariff | `/eng/Pricing_\|famp\|_Passes`, served from `[ticketing]` in festival.toml |

The edition marker is the site's own number: "Haifa 42nd International Film
Festival" in the English schedule's og:site_name, "ה-42" in the Hebrew one's,
and `Festival 42` on every film page. The fetch refuses to write when any of them disagrees with
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
  one. The Hebrew title is served beside it as `titleLocal` for every film.
- **Pictures** are each film's and event's og:image, served as `imageUrl`.

## The samples are captured pages

`sources/haifaff-site/samples/` holds whole pages fetch.py read on 2026-09-25,
which `parse.py --selftest` parses. After a site change, re-run the fetch
(its page cache is under `data/festivals/.cache/`), copy the changed pages in,
and fix `parse.py` wherever the markup moved.

## Things the data reports rather than hides

- **Events outside the cinema halls** sit under the schedule's catch-all
  "Events" column. The fetch takes each one's hall from its own page: Mirrors
  Hall for the industry events, and Cinema Reshet in Hadar for the three
  outdoor shorts evenings (which the schedule lists at 19:30, doors; the
  screening starts at 20:30).
- **Four venues share a block** (HaNassi 138-142: Auditorium, Rapaport,
  Cinematheque, Mirrors Hall), so the planner costs the walk between them at
  about zero. Tikotin is a 10-15 minute walk away, and Kriger is a drive.
- **Every venue coordinate is approximate.** None could be geocoded from the
  research session, and each venue's served `notes` says so. Cinema Reshet has
  no coordinates at all.
