#!/usr/bin/env python3
"""Fetch Confederation House's Oud Festival programme for one edition into its raw folder.

Run by the festival update (`scraper/festivals/update.py`), or by hand:

    python3 scraper/festivals/jerusalem_oud/sources/confederation-house/fetch.py --edition 2026

Writes `data/festivals/jerusalem-oud/<edition>/confederation-house/`
(`programme.json` + `manifest.json`) and nothing else. Pages read: the Hebrew
listing (`/page_18014`, one card per concert) and each card's own page. Each
record keeps the listing card and the concert page side by side, in the site's
own words; the converter picks between them.

The site names no edition number, so two things refuse the write: a concert
page whose footer names another festival year, and any concert dated outside
the edition (`common.guard_dates`).

The parsing half lives in parse.py and is proven offline by its self-test.
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(HERE))))
import common
import parse as chparse
import registry

FESTIVAL_DIR = os.path.dirname(os.path.dirname(HERE))
SOURCE_ID = "confederation-house"
# Bumped when the shape of programme.json changes, so a manifest says which
# shape its folder holds.
FETCHER_VERSION = 1
LISTING = chparse.SITE + "/page_18014"


def main():
    args = common.parse_args(__doc__)
    festival = registry.load(FESTIVAL_DIR)
    edition = registry.edition(festival, args.edition)
    cache = registry.cache_dir(festival, edition["id"], SOURCE_ID)

    cards = chparse.listing(common.cached_page(cache, LISTING))
    common.guard_dates(edition, [c["date"] for c in cards if c["date"]])

    def concert(card):
        url = "%s/page_%d" % (chparse.SITE, card["pageId"])
        page = common.cached_page(cache, url)
        return url, chparse.detail(page) if page is not None else None

    concerts = []
    for card, (url, page) in zip(cards, common.fetch_all(concert, cards)):
        if page is not None and page["year"] is not None and page["year"] != int(edition["id"]):
            raise common.FetchRefused(
                "%s names festival year %s, not edition %s — nothing written" % (url, page["year"], edition["id"])
            )
        concerts.append({"url": url, "listing": card, "page": page})
    common.guard_dates(edition, [c["page"]["date"] for c in concerts if c["page"] and c["page"]["date"]])

    common.write_raw(
        festival,
        edition["id"],
        SOURCE_ID,
        {"programme.json": {"site": chparse.SITE, "listing": LISTING, "concerts": concerts}},
        fetcher="scraper/festivals/jerusalem_oud/sources/confederation-house/fetch.py",
        fetcher_version=FETCHER_VERSION,
        urls=[LISTING, chparse.SITE + "/page_<pageId>"],
        notes="One record per listing card, with its concert page parsed beside it "
              "(heading, picture, blurb, date, time, location, printed ticket price, "
              "ticket link); untranslated.",
    )
    print("%d concerts, %d with their own page" % (len(concerts), sum(1 for c in concerts if c["page"])))


if __name__ == "__main__":
    main()
