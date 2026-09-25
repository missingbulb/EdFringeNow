#!/usr/bin/env python3
"""Fetch haifaff.co.il's programme for one edition into its raw folder.

Run it by hand, on a machine that can reach the site. It never runs on a schedule:

    python3 scraper/festivals/haifa_iff/sources/haifaff-site/fetch.py --edition 2026

It writes `data/festivals/haifa-iff/<edition>/haifaff-site/` (`programme.json` and
`manifest.json`) and nothing else. The records keep the site's own vocabulary:
its numeric film, event, screening and section ids, its venue labels and its
section names. Translating them is the converter's job (scraper/convert/).

Pages read: the English schedule, which is the whole programme; the Hebrew
schedule, for Hebrew titles by film id; each scheduled film's English page, for
metadata; and each event's English page, for its event group.

Two things refuse the write. First, the edition number the site prints about
itself (the schedule banners, and every film page's "Festival" label) must
equal the edition's `ordinal` in festival.toml. Second, every screening must
fall inside the edition's dates (`common.guard_dates`).

The parsing half lives in parse.py and is proven offline by its self-test.
"""

import os
import sys
import urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(HERE))))
import common
import parse as hparse
import registry

FESTIVAL_DIR = os.path.dirname(os.path.dirname(HERE))
SOURCE_ID = "haifaff-site"
# Bumped when the shape of programme.json changes, so a manifest says which
# shape its folder holds.
FETCHER_VERSION = 2

SITE = "https://www.haifaff.co.il"
SCHEDULE_EN = SITE + "/eng/Screening_schedule"
SCHEDULE_HE = SITE + "/" + urllib.parse.quote("לוח_הקרנות")
FILMS = SITE + "/eng/Films"
# The schedule's column for everything outside the cinema halls. Each such
# event's own page names where it really is.
EVENTS_COLUMN = "Events"


def page(cache_dir, name, url):
    """A page's text, cached on disk so a re-run needs no network."""
    os.makedirs(cache_dir, exist_ok=True)
    path = os.path.join(cache_dir, name + ".html")
    if os.path.exists(path) and os.path.getsize(path) > 1024:
        with open(path, encoding="utf-8") as handle:
            return handle.read()
    body = common.get(url, as_json=False)
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(body)
    return body


def check_marker(where, found, ordinal):
    if found != ordinal:
        raise common.FetchRefused(
            "%s says edition %r, festival.toml declares %r for this edition. The site may "
            "now be serving another edition, so nothing was written" % (where, found, ordinal)
        )


def build(edition, cache_dir):
    ordinal = edition["ordinal"]
    if ordinal is None:
        raise SystemExit("edition %s declares no ordinal; the site's edition marker has nothing to be checked against" % edition["id"])

    en = page(cache_dir, "schedule-eng", SCHEDULE_EN)
    he = page(cache_dir, "schedule-heb", SCHEDULE_HE)
    check_marker(SCHEDULE_EN, hparse.edition_marker(en), ordinal)
    check_marker(SCHEDULE_HE, hparse.edition_marker(he), ordinal)

    rows = hparse.parse_schedule(en, SITE)
    unlinked = [r for r in rows if r["kind"] is None]
    rows = [r for r in rows if r["kind"] is not None]
    common.guard_dates(edition, [r["date"] for r in rows])

    titles_he = {}
    for row in hparse.parse_schedule(he, SITE):
        if row["kind"] == "film" and row["refId"] not in titles_he:
            titles_he[row["refId"]] = hparse.title_from_slug(row["slug"], row["heading"])

    members = {}
    for group in hparse.film_groups(page(cache_dir, "films", FILMS)):
        url, n = "%s/eng/Films/grp%%7Cfwsa%%7C%s" % (SITE, group["id"]), 0
        while url:
            listing = hparse.parse_group_page(page(cache_dir, "group-%s-%d" % (group["id"], n), url), SITE)
            for film_id in listing["filmIds"]:
                members.setdefault(film_id, []).append(group)
            url, n = listing["next"], n + 1

    films = []
    for film_id in sorted({r["refId"] for r in rows if r["kind"] == "film"}):
        url = "%s/eng/Films/%d" % (SITE, film_id)
        film = hparse.parse_film(page(cache_dir, "film-%d" % film_id, url))
        if film["edition"] is not None:
            check_marker(url, film["edition"], ordinal)
        films.append({
            "id": film_id,
            "url": url,
            "title": film["title"],
            "titleHe": titles_he.get(film_id),
            "director": film["director"],
            "country": film["country"],
            "year": film["year"],
            "runtimeMin": film["runtimeMin"],
            "language": film["language"],
            "subtitles": film["subtitles"],
            # The page's own section first, then every other listing it is on.
            "sections": film["sections"] + [g for g in members.get(film_id, []) if g["id"] not in [s["id"] for s in film["sections"]]],
            "synopsis": film["synopsis"],
            "image": film["image"],
        })

    events = []
    for event_id in sorted({r["refId"] for r in rows if r["kind"] == "event"}):
        url = "%s/eng/Events/%d" % (SITE, event_id)
        parsed = hparse.parse_film(page(cache_dir, "event-%d" % event_id, url))
        heading = next(r["heading"] for r in rows if r["kind"] == "event" and r["refId"] == event_id)
        for r in rows:
            if r["kind"] == "event" and r["refId"] == event_id and r["venue"] == EVENTS_COLUMN:
                when = "%s/%s %s" % (r["date"][8:10], r["date"][5:7], r["start"])
                r["venue"] = parsed["halls"].get(when) or parsed["place"] or r["venue"]
        events.append({
            "id": event_id,
            "url": url,
            "title": parsed["title"] or heading,
            # The event hub's group ids (opening, industry, special, …), read
            # the way a film page's section links are read. Empty when the
            # page links none.
            "groups": [s["id"] for s in parsed["sections"]],
            "image": parsed["image"],
        })

    screenings = [
        {
            "date": r["date"],
            "start": r["start"],
            "venue": r["venue"],
            "kind": r["kind"],
            "refId": r["refId"],
            "screeningId": r["screeningId"],
            "ticketUrl": r["ticketUrl"],
            "tags": r["tags"],
            "info": r["info"],
            # The schedule prints no price; the tariff is festival-wide.
            "price": None,
        }
        for r in rows
    ]
    screenings.sort(key=lambda s: (s["date"], s["start"], s["venue"] or "", s["refId"]))
    return {
        "site": SITE,
        "edition": ordinal,
        "venues": sorted({s["venue"] for s in screenings if s["venue"]}),
        "films": films,
        "events": events,
        "screenings": screenings,
        "unlinked": [{"date": r["date"], "start": r["start"], "venue": r["venue"], "heading": r["heading"]} for r in unlinked],
    }


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
        fetcher="scraper/festivals/haifa_iff/sources/haifaff-site/fetch.py",
        fetcher_version=FETCHER_VERSION,
        urls=[SCHEDULE_EN, SCHEDULE_HE, FILMS, SITE + "/eng/Films/grp|fwsa|<groupId>", SITE + "/eng/Films/<id>", SITE + "/eng/Events/<id>"],
        notes="The English schedule gives every screening; the Hebrew schedule gives Hebrew "
              "titles by film id; film pages give metadata, pictures and their own section; "
              "the section listings linked from /eng/Films give every other section a film "
              "sits in; event pages give event groups, pictures and the hall of an event "
              "the schedule files under its catch-all Events column (parse.py).",
    )
    print("%d films, %d events, %d screenings, %d unlinked rows" % (
        len(programme["films"]), len(programme["events"]), len(programme["screenings"]), len(programme["unlinked"]),
    ))


if __name__ == "__main__":
    main()
