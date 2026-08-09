# static-website

Client-side delivery practices for a site served with no server of its own —
GitHub Pages, S3, a bare CDN — where the host sets `Cache-Control` and won't vary
it per file, so the freshness policy has to live in the client.

Activates when working on how the browser fetches, caches, evicts or joins the
site's data files. Not markup (that's `html`), and not this repo's scrape or wire
formats (that's `edfringe-data`).

| Section | How enforced |
|---|---|
| Manifest over TTL | prose |
| Nothing attests to its own freshness | prose |
| Size is not a freshness check | prose |
| Record the hash, don't re-hash | prose |
| Deploy-race mismatches retry | prose |
| Files cached on different clocks | prose |
| Measure the join rate | prose |
| Check what missing data renders as | prose |

## Where it came from

EdFringeNow #309. The planner drew all 4,122 shows as sold out during the
festival. Its catalogue and its ticket-availability sidecar were split so each
could be cached on its own clock — four days and one — and a commit in between
corrected every performance time by an hour, because the upstream API's timestamps
were UTC. The sidecar names performances by date and start time, so the correction
moved every key in it. A visitor holding Thursday's catalogue against Saturday's
sidecar matched 6% of them; the other 94% came back status-unknown, which every
consumer downstream read as not-bookable.

Nothing failed. No error, no console line, and — because both files were inside
their TTLs — no network request at all. The two files were individually perfect
and no longer described the same festival.

Every rule here is one of the things that would have caught it, in the order they
would have: a manifest would have evicted the stale catalogue outright, a
generation stamp would have refused the join, a coverage floor would have raised
it, and following the missing status to the pixel would have stopped it being
treated as survivable in the first place.

## Promoting this pack

It is deliberately free of any reference to this repo, so it can move to shared
canon unchanged. That move belongs upstream in the Claudinite repository — adding
it under `.claudinite/shared/` here would be dropped by the next re-vendor.
