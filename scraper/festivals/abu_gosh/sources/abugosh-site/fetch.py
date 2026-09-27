#!/usr/bin/env python3
"""Fetch abugoshfestival.co.il's programme for one edition into its raw folder.

Run it by hand, on a machine that can reach the site. It never runs on a schedule:

    python3 scraper/festivals/abu_gosh/sources/abugosh-site/fetch.py --edition 2026

It writes `data/festivals/abu-gosh/<edition>/abugosh-site/` (`programme.json` and
`manifest.json`) and nothing else. The records keep the site's own vocabulary:
its WordPress post ids, its card labels ("Church Concert No. 1"), its place
names and its prices in shekels.

Pages read: the English Concert Schedule (every ticketed concert, Tel Aviv
Museum, Kiryat Ye'arim Church and the Crypt alike) and Outdoor Performances
(the free courtyard sets); their Hebrew twins, for Hebrew titles, paired by
URL slug; and each card's own English page, for the price, the Smarticket
link, the running time and the description. Each card's picture is the
listing card's own.

Two things refuse the write. First, the year the schedule's heading prints
("Concerts Board 2026", and the Hebrew "לוח קונצרטים 2026") must equal the
edition id: the festival runs twice a year (Shavuot and Sukkot), so the id
alone says nothing about which of the two the site shows, but a site rolled
over to next year cannot pass. Second, every performance must fall inside the
edition's declared dates (`common.guard_dates`), which is what tells this
year's Sukkot programme from its Shavuot one.

The parsing half lives in parse.py and is proven offline by its self-test.
"""

import os
import sys
import urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(HERE))))
import common
import parse as aparse
import registry

FESTIVAL_DIR = os.path.dirname(os.path.dirname(HERE))
SOURCE_ID = "abugosh-site"
# Bumped when the shape of programme.json changes.
FETCHER_VERSION = 1

SITE = "https://abugoshfestival.co.il"
SCHEDULE = urllib.parse.quote("/לוח-קונצרטים/")
OUTDOOR = "/outside/"
# Which listing a card came from, and its English and Hebrew pages.
LISTINGS = [
    ("concerts", SITE + "/en" + SCHEDULE, SITE + SCHEDULE),
    ("outdoor", SITE + "/en" + OUTDOOR, SITE + OUTDOOR),
]


def _url(href):
    """A card link as the site prints it (Hebrew path segments raw) -> a fetchable URL."""
    return urllib.parse.quote(href, safe=":/%?=&")


def build(edition, cache_dir):
    year = int(edition["id"])
    cards = []
    for listing, en_url, he_url in LISTINGS:
        en = common.cached_page(cache_dir, en_url)
        he = common.cached_page(cache_dir, he_url)
        if en is None or he is None:
            raise common.FetchRefused("%s: the listing page is gone (404) — nothing written" % listing)
        if listing == "concerts":
            for where, page in ((en_url, en), (he_url, he)):
                found = aparse.year_marker(page)
                if found != year:
                    raise common.FetchRefused(
                        "%s says programme year %r, edition %s was asked for. The site may now be "
                        "serving another edition, so nothing was written" % (where, found, edition["id"]))
        hebrew = {c["slug"]: c for c in aparse.parse_listing(he)}
        for card in aparse.parse_listing(en):
            twin = hebrew.get(card["slug"])
            card["listing"] = listing
            card["date"] = aparse.iso_date(card["dayMonth"], year)
            card["titleHe"] = twin["title"] if twin else None
            card["placeHe"] = twin["place"] if twin else None
            cards.append(card)
    if not cards:
        raise common.FetchRefused("no programme cards on the listing pages — nothing written")
    common.guard_dates(edition, [c["date"] for c in cards])

    details = common.fetch_all(lambda c: common.cached_page(cache_dir, _url(c["url"])), cards)
    for card, page in zip(cards, details):
        card["detail"] = aparse.parse_detail(page) if page else None
    cards.sort(key=lambda c: (c["date"], c["times"][0]["start"] if c["times"] else "", c["postId"]))
    return {"site": SITE, "year": year, "cards": cards}


def main():
    args = common.parse_args(__doc__)
    festival = registry.load(FESTIVAL_DIR)
    edition = registry.edition(festival, args.edition)
    programme = build(edition, registry.cache_dir(festival, edition["id"], SOURCE_ID))
    common.write_raw(
        festival,
        edition["id"],
        SOURCE_ID,
        {"programme.json": programme},
        fetcher="scraper/festivals/abu_gosh/sources/abugosh-site/fetch.py",
        fetcher_version=FETCHER_VERSION,
        urls=[url for _, en, he in LISTINGS for url in (en, he)] + [SITE + "/en/<listing>/<card slug>/"],
        notes="The English Concert Schedule and Outdoor Performances pages give every card "
              "(post id, picture, label, day/month, times, place, title, blurb); their Hebrew "
              "twins give Hebrew titles and places by URL slug; each card's own page gives the "
              "price, Smarticket link, running time and description (parse.py). The year is the "
              "schedule heading's, checked against the edition id.",
    )
    print("%d cards (%d with a price, %d free)" % (
        len(programme["cards"]),
        sum(1 for c in programme["cards"] if c["detail"] and c["detail"]["price"] is not None),
        sum(1 for c in programme["cards"] if c["detail"] and c["detail"]["free"]),
    ))


if __name__ == "__main__":
    main()
