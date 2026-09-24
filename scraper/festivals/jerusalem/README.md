# The Jerusalem Comedy Festival (`jerusalem-comedy`)

A fixed five-night programme, ticketed by two external sellers, with no
availability, price or cancellation feed — so there is nothing to refresh on a
schedule. Fetch by hand when the programme changes, convert, commit. The general
contract is [../README.md](../README.md); this page is what is specific here.

```sh
python3 scraper/festivals/jerusalem/sources/comedy-festival-site/fetch.py --edition 2026
python3 scraper/festivals/jerusalem/sources/nominatim/fetch.py --edition 2026
python3 scraper/convert/to_serving.py jerusalem-comedy 2026
python3 scraper/festivals/jerusalem/sources/comedy-festival-site/parse.py --selftest
```

## Sources

| source | roles | what it is |
|---|---|---|
| `comedy-festival-site` | events, performances, venues | `comedy-festival.co.il` — WordPress + JetEngine REST joined with each event's rendered page |
| `nominatim` | venues (coordinates) | one Nominatim query per distinct street address the site printed |
| `venues-research` (curated) | venues (rooms, capacity, layout) | `curated/venues.json`, a figure only where a URL backs it |

The site's REST API and its event pages are one source, not two: a performance's
date, start, ticket link and venue address are only in the page, while which venue
it plays is only in REST, so neither half makes a record without the other.

| what | where on the site |
|---|---|
| shows, their slugs, their categories, which year | `wp/v2/events` + `wp/v2/event-type`, `wp/v2/event-year` |
| performances, and which venue each plays | `wp/v2/dates` + `wp/v2/eventlocation` |
| a performance's date, start time and ticket link | the event's own rendered page |
| a venue's street address and a show's running time | the event's own rendered page |

The edition marker is the site's `event-year` term: the fetch refuses an edition
with no term, and any performance dated outside the edition in `festival.toml`.
`parse.py` holds every Hebrew-specific rule (day names, the two spellings of a
running time, the free-versus-ticketed button) and touches no network.

There is **no price anywhere on the festival site**, and no availability, so the
served block's `prices` and `availability` sections name no source.

## Things the data reports rather than hides

- **Four events are skipped** (`provenance.skipped`): the "family events on
  <weekday>" pages are placeholders with no date, venue or blurb.
- **Two venues share a street address and therefore a coordinate** (מנורה 3): the
  Nissan Nativ studio and the Sam Spiegel cinema. The planner correctly costs the
  walk between them at zero.

## Checking a fetch

The `eventlocation` taxonomy publishes a performance count per venue. A complete
fetch reproduces those counts exactly — the cheapest end-to-end check the source
offers, worth doing after any change to `parse.py`.
