#!/usr/bin/env python3
"""Fetch the Royal Edinburgh Military Tattoo's performances from its ticketing API.

Run by hand, on a machine that can reach the site — never on a schedule:

    python3 scraper/festivals/edinburgh_tattoo/sources/ticketing-api/fetch.py --edition 2027

Writes `data/festivals/edinburgh-tattoo/<edition>/ticketing-api/`
(`programme.json` + `manifest.json`) and nothing else.

The Tattoo sells its own tickets at book.edintattoo.co.uk, whose pages call a
JSON API (api.book.edintattoo.co.uk, SecuTix behind an Azure API gateway). The
gateway wants the subscription key the booking site ships to every visitor in
its public bundle, so the key is read from that bundle on each run rather than
committed here. The API is the most official machine surface there is: the
Umbraco site (www.edintattoo.co.uk) publishes no programme feed, and its
delivery API answers 401.

The edition marker is the show product's own name ("<year> Tattoo - ..."): the
catalogue must list exactly one for the edition asked for, and every
performance must fall inside the edition declared in festival.toml, or nothing
is written.

The 2026 edition cannot be fetched: once 2027 went on sale the catalogue kept
only the 2026 programme and gift voucher, and the 2026 show product
(10229016186489) and its performances stopped resolving (404 / null on
2026-09-25). It stays declared and unserved; see festival.toml.
"""

import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(HERE))))
import common
import parse as tparse
import registry

FESTIVAL_DIR = os.path.dirname(os.path.dirname(HERE))
SOURCE_ID = "ticketing-api"
FETCHER_VERSION = 1

SITE = "https://www.edintattoo.co.uk"
BOOKING = "https://book.edintattoo.co.uk"
API = "https://api.book.edintattoo.co.uk"


def subscription_key():
    """The gateway key, read from the booking site's own product-page bundle."""
    home = common.get(SITE + "/", as_json=False)
    product = re.search(r"https://book\.edintattoo\.co\.uk/Product/\d+", home)
    if not product:
        raise SystemExit("no booking link on %s; the site has changed" % SITE)
    page = common.get(product.group(0), as_json=False)
    script = re.search(r'src="(/dist/js/productPage\.js[^"]*)"', page)
    if not script:
        raise SystemExit("no productPage.js on %s" % product.group(0))
    bundle = common.get(BOOKING + script.group(1), as_json=False)
    chunk = re.search(r'"\./(ticketingApiClient-chunk-[\w-]+\.js)"', bundle)
    if not chunk:
        raise SystemExit("productPage.js imports no ticketingApiClient chunk")
    client = common.get(BOOKING + "/dist/js/" + chunk.group(1), as_json=False)
    key = re.search(r'"Ocp-Apim-Subscription-Key":"([0-9a-f]{32})"', client)
    if not key:
        raise SystemExit("no subscription key in %s" % chunk.group(1))
    return key.group(1)


def api(path, key):
    return common.get(API + path, headers={"Accept": "application/json", "Ocp-Apim-Subscription-Key": key})


def build(year):
    key = subscription_key()
    catalog = api("/catalog", key)
    show = tparse.find_show(catalog, year)
    if show is None:
        raise SystemExit("the ticketing catalogue lists no %s show (it lists %s); nothing written"
                         % (year, tparse.other_shows(catalog)))
    availability = api("/event/%d/availability" % show["id"], key)
    return {
        "api": API,
        "product": {
            "id": show["id"],
            "code": show["code"],
            "name": show["externalName"],
            "description": tparse.clean_text(show.get("externalDescription")),
            "image": show.get("xlargeImageUrl") or show.get("mediumImageUrl"),
            "url": "%s/Product/%d" % (BOOKING, show["id"]),
        },
        "venue": "Edinburgh Castle Esplanade",
        "performances": tparse.performances(show, availability),
    }


def main():
    args = common.parse_args(__doc__)
    festival = registry.load(FESTIVAL_DIR)
    edition = registry.edition(festival, args.edition)
    programme = build(int(edition["id"]))
    common.guard_dates(edition, [p["date"] for p in programme["performances"]])
    common.write_raw(
        festival,
        edition["id"],
        SOURCE_ID,
        {"programme.json": programme},
        fetcher="scraper/festivals/edinburgh_tattoo/sources/ticketing-api/fetch.py",
        fetcher_version=FETCHER_VERSION,
        urls=[API + "/catalog", API + "/event/<productId>/availability"],
        notes="Performances and seat-category prices from the catalogue; seats left, availability "
              "level and the cheapest and dearest price on sale per performance from the availability "
              "call. Amounts are thousandths of a pound, as the API writes them.",
    )
    print("%s: %d performances" % (programme["product"]["name"], len(programme["performances"])))


if __name__ == "__main__":
    main()
