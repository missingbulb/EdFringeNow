#!/usr/bin/env python3
"""EventAct: the conference platform whose agenda widget several Israeli conferences embed.

A conference's programme page carries one `<ea-program key=… event=… agenda=…>`
tag; the widget it loads reads EventAct's open API with the public token the
tag hands every visitor's browser:

  * `https://api.eventact.com/o/v2/agenda/<event>/<agenda>/en/timetable` — every
    activity by day, with its halls, times and EventAct type number;
  * `https://api.eventact.com/o/v2/agenda/<event>/<session>/session` — one
    session's lectures, their presenting speakers, institutes and portraits.

The timetable carries the day twice: the table's `date` (month-first,
"10/18/2026") and each activity's own `date` (day-first, "18/10/2026 08:00:00").
Its per-table `startDate` is the agenda's last day on every table, so it is
never read. The two readings must agree, or the activity is refused.

This module turns that into one raw programme per edition, in EventAct's own
vocabulary. Parsing is pure; `build` fetches only through the callables it is
handed, and `run` is the hand-run fetcher's entry point.

    python3 scraper/festivals/platforms/eventact.py --selftest
"""

import html
import re
import sys

FETCHER_VERSION = 1
API = "https://api.eventact.com/o/v2/agenda"
# The portrait EventAct shows for a speaker who uploaded none.
PLACEHOLDER_PORTRAIT = "images.eventact.com/eventact/participant.png"


def text(value):
    """A field that may hold HTML (`subTitle`, some titles) as plain text, or None."""
    if not value:
        return None
    value = re.sub(r"(?i)<br\s*/?>|</p>", "\n", value)
    value = html.unescape(re.sub(r"<[^>]+>", "", value))
    lines = [re.sub(r"\s+", " ", line).strip() for line in value.split("\n")]
    return "\n".join(line for line in lines if line) or None


def widget(page):
    """The programme page's embedded agenda widget -> {event, agenda, key}, or None.

    The key is the public API token the page itself hands every visitor's browser.
    """
    tag = re.search(r"<ea-program\b([^>]*)>", page)
    if not tag:
        return None
    attrs = dict(re.findall(r'(\w+)="([^"]*)"', tag.group(1)))
    if not (attrs.get("event", "").isdigit() and attrs.get("agenda", "").isdigit() and attrs.get("key")):
        return None
    return {"event": int(attrs["event"]), "agenda": int(attrs["agenda"]), "key": attrs["key"]}


def _iso_month_first(value):
    month, day, year = value.split("/")
    return "%04d-%02d-%02d" % (int(year), int(month), int(day))


def _iso_day_first(value):
    day, month, year = value.split(" ")[0].split("/")
    return "%04d-%02d-%02d" % (int(year), int(month), int(day))


def activities(timetable):
    """Every activity of the timetable, in its order, with one checked ISO date."""
    out = []
    for table in timetable["tables"]:
        day = _iso_month_first(table["date"])
        for activity in table["activities"]:
            own = _iso_day_first(activity["date"])
            if own != day:
                raise ValueError("activity %s: its date %s disagrees with its day table %s" % (activity["id"], own, day))
            out.append({
                "id": activity["id"],
                "title": text(activity["title"]),
                "type": activity["type"],
                "date": day,
                "start": activity["activityStartTime"],
                "end": activity["activityEndTime"],
                "halls": activity["halls"],
                "description": text(activity["description"]),
            })
    return out


def _portrait(person):
    logo = person.get("logo") or ""
    return logo if logo.startswith("http") and PLACEHOLDER_PORTRAIT not in logo else None


def session(answer):
    """A session answer -> its note, chairs, lectures with speakers, and a picture.

    The picture is the first real portrait among the presenting speakers, in
    lecture order (else any chair's): the only per-session image the
    programme shows. None when every speaker carries the placeholder.
    """
    lectures = []
    for lecture in answer.get("lectures") or []:
        institutes = {i["index"]: i.get("displayName") for i in lecture.get("institutes") or []}
        speakers = []
        for author in lecture.get("authors") or []:
            if not author.get("isPresenting"):
                continue
            where = [institutes.get(i) for i in author.get("instituteIndexs") or []]
            speakers.append({
                "name": text(author["displayName"]),
                "institute": next((w for w in where if w), None),
                "portrait": _portrait(author),
            })
        lectures.append({
            "id": lecture["lectureID"],
            "start": lecture["startTime"],
            "end": lecture["endTime"],
            "title": text(lecture["title"]),
            "notes": text(lecture.get("notes")),
            "speakers": speakers,
        })
    chairs = [
        {"name": text(c.get("displayName") or c.get("name")), "portrait": _portrait(c)}
        for c in answer.get("chairmen") or []
    ]
    portraits = [s["portrait"] for l in lectures for s in l["speakers"]] + [c["portrait"] for c in chairs]
    return {
        "note": text(answer.get("subTitle")),
        "chairs": chairs,
        "lectures": lectures,
        "image": next((p for p in portraits if p), None),
    }


def build(page_url, page, edition, fetch_json, fetch_many):
    """The edition's agenda: every activity, each with its session answer.

    `page` is the programme page's HTML; `fetch_json(url, headers)` one API
    answer, and `fetch_many(urls, headers)` several, in order.
    """
    agenda = widget(page or "")
    if agenda is None:
        raise ValueError("%s embeds no agenda widget" % page_url)
    headers = {"API-Token": agenda["key"]}
    timetable = fetch_json("%s/%d/%d/en/timetable" % (API, agenda["event"], agenda["agenda"]), headers)
    if (timetable.get("eventID"), timetable.get("agendaID")) != (agenda["event"], agenda["agenda"]):
        raise ValueError("the timetable answered for another agenda")
    rows = activities(timetable)
    answers = fetch_many(["%s/%d/%d/session" % (API, agenda["event"], row["id"]) for row in rows], headers)
    for row, answer in zip(rows, answers):
        if answer.get("sessionID") != row["id"]:
            raise ValueError("session %s answered as %r" % (row["id"], answer.get("sessionID")))
        row["session"] = session(answer)
    return {
        "site": page_url,
        "eventId": agenda["event"],
        "agendaId": agenda["agenda"],
        "activities": rows,
    }


def run(festival_dir, page_url, source_id, fetcher, edition_marker=None):
    """A festival's `fetch.py --edition <id>`: build from the live agenda, guard, write raw.

    `page_url(edition_id)` is the programme page; `edition_marker(page, edition_id)`,
    when given, says whether the page is the edition asked for, and a page it
    rejects writes nothing.
    """
    import os
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    import common
    import registry

    args = common.parse_args("Fetch an EventAct agenda into its raw folder.")
    festival = registry.load(festival_dir)
    edition = registry.edition(festival, args.edition)
    url = page_url(edition["id"])
    page = common.cached_page(registry.cache_dir(festival, edition["id"], source_id), url) or ""
    if edition_marker is not None and not edition_marker(page, edition["id"]):
        raise common.FetchRefused("%s is not edition %s's programme; nothing written" % (url, edition["id"]))
    try:
        programme = build(
            url, page, edition,
            lambda u, headers: common.get(u, headers=headers),
            lambda urls, headers: common.fetch_all(lambda u: common.get(u, headers=headers), urls),
        )
    except ValueError as error:
        raise common.FetchRefused("%s; nothing written" % error)
    common.guard_dates(edition, [a["date"] for a in programme["activities"]])
    common.write_raw(
        festival, edition["id"], source_id, {"programme.json": programme},
        fetcher=fetcher, fetcher_version=FETCHER_VERSION,
        urls=[url, API + "/<eventId>/<agendaId>/en/timetable", API + "/<eventId>/<sessionId>/session"],
        notes="The programme page embeds EventAct's agenda widget (event, agenda, public API token); "
              "the timetable gives every activity with its day, times, halls and EventAct type; each "
              "session answer gives its lectures, presenting speakers and their portraits "
              "(scraper/festivals/platforms/eventact.py).",
    )
    print("%d activities, %d lectures" % (
        len(programme["activities"]), sum(len(a["session"]["lectures"]) for a in programme["activities"]),
    ))


def selftest():
    # Shapes copied from the live API (AIS 2026, 2026-10-02), trimmed.
    page = '<h1>AIS 2026</h1><ea-program key="k1" event="37945" agenda="14755" lang="en"></ea-program>'
    assert widget(page) == {"event": 37945, "agenda": 14755, "key": "k1"}
    assert widget("<div>no agenda</div>") is None
    timetable = {"eventID": 37945, "agendaID": 14755, "tables": [{"date": "10/19/2026", "activities": [
        {"id": 70384, "title": "(MA-01) Peace &amp; Media", "description": "", "date": "19/10/2026 09:00:00",
         "activityStartTime": "09:00", "activityEndTime": "10:30", "type": 12, "halls": ["Hall 1"]},
    ]}]}
    answer = {"sessionID": 70384, "subTitle": None, "chairmen": [], "lectures": [{
        "lectureID": 207298, "startTime": "09:00", "endTime": "09:00", "title": "Counting\r\n\nDiversity",
        "authors": [
            {"displayName": "Aya Yadlin", "isPresenting": True, "instituteIndexs": [1],
             "logo": "https://images.eventact.com/eventact/participant.png"},
            {"displayName": "Oranit Klein-Shagrir", "isPresenting": False, "instituteIndexs": [2]},
        ],
        "institutes": [{"displayName": "Bar-Ilan University", "index": 1}],
    }]}
    seen = []

    def fetch_json(url, headers):
        seen.append((url, headers))
        return timetable

    def fetch_many(urls, headers):
        assert urls == ["https://api.eventact.com/o/v2/agenda/37945/70384/session"], urls
        return [answer]

    programme = build("https://program.test/en", page, {"id": "2026"}, fetch_json, fetch_many)
    assert seen == [("https://api.eventact.com/o/v2/agenda/37945/14755/en/timetable", {"API-Token": "k1"})], seen
    row = programme["activities"][0]
    assert (row["date"], row["start"], row["end"], row["title"]) == ("2026-10-19", "09:00", "10:30", "(MA-01) Peace & Media")
    lecture = row["session"]["lectures"][0]
    assert lecture["title"] == "Counting\nDiversity", lecture
    assert lecture["speakers"] == [{"name": "Aya Yadlin", "institute": "Bar-Ilan University", "portrait": None}]
    assert row["session"]["image"] is None

    wrong = dict(answer, sessionID=1)
    try:
        build("u", page, {"id": "2026"}, fetch_json, lambda urls, headers: [wrong])
    except ValueError:
        pass
    else:
        raise AssertionError("a session answering for another id must be refused")
    print("eventact platform selftest: ok")


if __name__ == "__main__":
    if sys.argv[1:] != ["--selftest"]:
        sys.exit("usage: eventact.py --selftest")
    selftest()
