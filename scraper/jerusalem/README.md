# The Jerusalem Comedy Festival scrape

One-shot, on purpose. The festival publishes a fixed five-night programme, hands
ticketing to two external sellers, and posts no availability, price or
cancellation feed — so there is nothing for a scheduled job to refresh. Run it
when the programme changes; commit what it writes.

```sh
python3 scraper/jerusalem/fetch.py --year 2026   # writes data/jerusalem/shows.json
python3 scraper/jerusalem/parse.py               # the offline self-test
```

## Where the data comes from

`comedy-festival.co.il` is WordPress with JetEngine, and its REST API is open.

| what | where |
|---|---|
| shows, their slugs, their categories, which year | `wp/v2/events` + `wp/v2/event-type`, `wp/v2/event-year` |
| performances, and which venue each plays | `wp/v2/dates` + `wp/v2/eventlocation` |
| a performance's date, start time and ticket link | the event's own rendered page |
| a venue's street address and a show's running time | the event's own rendered page |
| venue coordinates | Nominatim, once, over those addresses |

Date, time and address are the half that is **not** in REST: JetEngine renders
them into the page rather than registering them as exposed meta. `parse.py` reads
them out of that markup and is where every Hebrew-specific rule lives (the day
names, the two spellings of a running time, the free-versus-ticketed button); it
touches no network, so its self-test is a real gate on a parsing change.

There is **no price anywhere on the festival site**, so no record carries one.

## Two things the scrape reports rather than hides

- **Four events are skipped**, listed in the output's `skipped`. The
  "family events on <weekday>" pages are placeholders — no date, no venue, no
  blurb. A run that finds them filled in will be a visible change.
- **Two venues share a street address and therefore a coordinate.** The Nissan
  Nativ studio and the Sam Spiegel cinema are both at מנורה 3; that is the
  source's own truth, and the planner correctly costs the walk between them at
  zero.

## Checking a run

The `eventlocation` taxonomy publishes a performance count per venue. A complete
run reproduces those counts exactly — that is the cheapest end-to-end check the
source offers, and it is worth doing after any change to `parse.py`.
