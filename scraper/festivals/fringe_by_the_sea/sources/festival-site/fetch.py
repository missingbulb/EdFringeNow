#!/usr/bin/env python3
"""Fetch fringebythesea.com's programme for one edition into its raw folder.

Run by hand, on a machine that can reach the site — never on a schedule:

    python3 scraper/festivals/fringe_by_the_sea/sources/festival-site/fetch.py --edition 2026

Writes `data/festivals/fringe-by-the-sea/<edition>/festival-site/`
(`programme.json` + `manifest.json`) and nothing else.

The site has no events plugin: each show is a WP post (`wp/v2/posts`), and its
date, venue, time and price live in an ACF box REST does not expose, so each
post's page is read for that box (parse.py). Tickets sold through CitizenTicket
(`citizenticket.com/events/fringe-by-the-sea-<year>/…`); its organiser page had
rolled over to the next year by 2026-09-25 and it publishes no open API, so
nothing is read from it. The line-up page is emptied between editions; the posts
stay. The venues page gives the Lodge Grounds' street address.

The edition marker is the post's publication year: this edition's shows are the
posts published in the edition's year whose title and box do not name the next
year (the next year's membership offers are published in September). News posts are
left out. Every kept post is recorded with its box's lines as written, including
the multi-day and ambiguous ones the parser leaves without sessions.
"""

import os
import re
import sys
import urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(HERE))))
import common
import parse as fparse
import registry

FESTIVAL_DIR = os.path.dirname(os.path.dirname(HERE))
SOURCE_ID = "festival-site"
FETCHER_VERSION = 1

SITE = "https://www.fringebythesea.com"
REST = SITE + "/wp-json/wp/v2"
# Categories that file a post by something other than its section.
NOT_SECTIONS = re.compile(r"^(?:(?:mon|tues|wednes|thurs|fri|satur|sun)day-.*|featured-act-homepage|uncategorised|news-item)$")
NEWS = "news-item"
VENUES_PAGE = SITE + "/venues-and-map/"


def rest_all(path, **params):
    params.setdefault("per_page", 100)
    out, page = [], 1
    while True:
        params["page"] = page
        batch = common.get(REST + "/" + path + "?" + urllib.parse.urlencode(params))
        out.extend(batch)
        if len(batch) < params["per_page"]:
            return out
        page += 1


def build(edition, cache_dir):
    year = int(edition["id"])
    categories = {c["id"]: (c["slug"], fparse.clean(c["name"])) for c in rest_all("categories")}
    news = {i for i, (slug, _n) in categories.items() if slug == NEWS}
    posts = [p for p in rest_all("posts") if p["date"].startswith(str(year)) and not news & set(p["categories"])]
    shows = []
    for post in posts:
        page = common.cached_page(cache_dir, post["link"])
        lines = fparse.box_lines(page)
        if lines is None or any(str(year + 1) in text for text in lines + [post["title"]["rendered"]]):
            continue
        box = fparse.read_box(lines, edition["first"], edition["last"])
        shows.append({
            "id": post["id"],
            "slug": post["slug"],
            "title": fparse.clean(post["title"]["rendered"]),
            "url": post["link"],
            "sections": [categories[c][0] for c in post["categories"]
                         if c in categories and not NOT_SECTIONS.match(categories[c][0])],
            "description": fparse.description(post["content"]["rendered"]),
            "image": fparse.page_image(page),
            "ticketUrl": fparse.ticket_link(post["content"]["rendered"]),
            "box": lines,
            "dates": box["dates"],
            "sessions": box["sessions"],
            "venue": box["venue"],
            "place": fparse.place(box["venue"]),
            "price": box["price"],
            "free": fparse.free_flag(box["price"]),
            "unresolved": box["unresolved"],
        })
    shows.sort(key=lambda s: ((s["dates"] or [""])[0], s["slug"]))
    names = dict(categories.values())
    main_address = fparse.main_venue_address(common.cached_page(cache_dir, VENUES_PAGE))
    if main_address is None:
        raise common.FetchRefused("no Lodge Grounds address on %s — nothing written" % VENUES_PAGE)
    return {
        "site": SITE,
        "year": year,
        "mainVenue": {"venue": fparse.LODGE_GROUNDS, "name": "Lodge Grounds", "address": main_address},
        "categories": [[s, names[s]] for s in sorted({c for show in shows for c in show["sections"]})],
        "shows": shows,
    }


def main():
    args = common.parse_args(__doc__)
    festival = registry.load(FESTIVAL_DIR)
    edition = registry.edition(festival, args.edition)
    programme = build(edition, registry.cache_dir(festival, edition["id"], SOURCE_ID))
    common.guard_dates(edition, [s["date"] for show in programme["shows"] for s in show["sessions"]])
    common.write_raw(
        festival,
        edition["id"],
        SOURCE_ID,
        {"programme.json": programme},
        fetcher="scraper/festivals/fringe_by_the_sea/sources/festival-site/fetch.py",
        fetcher_version=FETCHER_VERSION,
        urls=[REST + "/posts", REST + "/categories", SITE + "/<post-slug>/", VENUES_PAGE],
        notes="WP REST gives identity, sections, description and the CitizenTicket link; date, venue, "
              "time and price are read from each post page's details box (parse.py), whose lines are "
              "kept as written; `place` names the venue each box's text is, and the Lodge Grounds' "
              "address is read from the venues page. Prices are free text; no availability.",
    )
    served = sum(1 for s in programme["shows"] if s["sessions"])
    print("%d shows (%d with sessions, %d sessions)" % (
        len(programme["shows"]), served, sum(len(s["sessions"]) for s in programme["shows"])))


if __name__ == "__main__":
    main()
