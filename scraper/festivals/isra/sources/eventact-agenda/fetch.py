#!/usr/bin/env python3
"""Fetch ISRA's scientific programme for one edition into its raw folder.

Run it by hand, on a machine that can reach the site. It never runs on a schedule:

    python3 scraper/festivals/isra/sources/eventact-agenda/fetch.py --edition 2026

It writes `data/festivals/isra/<edition>/eventact-agenda/` (`programme.json` and
`manifest.json`) and nothing else. The records keep the site's own vocabulary:
EventAct's activity ids and type numbers, its hall labels, its titles.

Pages read: the conference site's Scientific Program page (events.ortra.com,
one site per year: `/isra<edition>/`), for the agenda widget it embeds (event
id, agenda id and the public API token); the EventAct open API's timetable for
that agenda, which is every activity by day and hall; and each activity's
session answer, for its lectures, speakers and speaker portraits.

The edition is the year in the site's own path; `common.guard_dates` then
refuses any activity dated outside the edition declared in festival.toml.
The parsing half lives in parse.py and is proven offline by its self-test.
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(HERE))))
import common
import parse as iparse
import registry

FESTIVAL_DIR = os.path.dirname(os.path.dirname(HERE))
SOURCE_ID = "eventact-agenda"
FETCHER_VERSION = 1

API = "https://api.eventact.com/o/v2/agenda"


def programme_page(edition_id):
    return "https://events.ortra.com/isra%s/ScientificVProgram" % edition_id


def build(edition, cache_dir):
    page_url = programme_page(edition["id"])
    agenda = iparse.widget(common.cached_page(cache_dir, page_url) or "")
    if agenda is None:
        raise common.FetchRefused("%s embeds no agenda widget; nothing written" % page_url)
    headers = {"API-Token": agenda["key"]}
    timetable = common.get("%s/%d/%d/en/timetable" % (API, agenda["event"], agenda["agenda"]), headers=headers)
    if (timetable.get("eventID"), timetable.get("agendaID")) != (agenda["event"], agenda["agenda"]):
        raise common.FetchRefused("the timetable answered for another agenda; nothing written")
    rows = iparse.activities(timetable)
    common.guard_dates(edition, [r["date"] for r in rows])

    answers = common.fetch_all(
        lambda row: common.get("%s/%d/%d/session" % (API, agenda["event"], row["id"]), headers=headers),
        rows,
    )
    for row, answer in zip(rows, answers):
        if answer.get("sessionID") != row["id"]:
            raise common.FetchRefused("session %s answered as %r; nothing written" % (row["id"], answer.get("sessionID")))
        row["session"] = iparse.session(answer)
    return {
        "site": page_url,
        "eventId": agenda["event"],
        "agendaId": agenda["agenda"],
        "activities": rows,
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
        fetcher="scraper/festivals/isra/sources/eventact-agenda/fetch.py",
        fetcher_version=FETCHER_VERSION,
        urls=[
            programme_page(edition["id"]),
            API + "/<eventId>/<agendaId>/en/timetable",
            API + "/<eventId>/<sessionId>/session",
        ],
        notes="The programme page embeds EventAct's agenda widget (event, agenda, public API token); "
              "the timetable gives every activity with its day, times, halls and EventAct type "
              "(12 session, 2 registration and breaks, 29 social, 39 lunch); each session answer "
              "gives its lectures, presenting speakers and their portraits (parse.py).",
    )
    print("%d activities, %d lectures" % (
        len(programme["activities"]), sum(len(a["session"]["lectures"]) for a in programme["activities"]),
    ))


if __name__ == "__main__":
    main()
