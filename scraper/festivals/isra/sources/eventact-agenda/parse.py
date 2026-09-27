#!/usr/bin/env python3
"""Pure parsing of the EventAct open API's agenda answers for ISRA (no network, no files).

Two answers are read. The agenda's `timetable` lists every activity by day with
its halls and type; a session's `session` answer lists its lectures, their
speakers and the speakers' portraits.

The timetable carries the day twice: the table's `date` (month-first,
"10/18/2026") and each activity's own `date` (day-first, "18/10/2026 08:00:00").
Its per-table `startDate` is the agenda's last day on every table, so it is
never read. The two readings must agree, or the activity is refused.

    python3 scraper/festivals/isra/sources/eventact-agenda/parse.py --selftest
"""

import html
import json
import os
import re
import sys

SAMPLES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "samples")
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


def _sample(name):
    with open(os.path.join(SAMPLES, name), encoding="utf-8") as handle:
        return json.load(handle)


def selftest():
    with open(os.path.join(SAMPLES, "programme-page.html"), encoding="utf-8") as handle:
        page = handle.read()
    assert widget(page) == {"event": 38706, "agenda": 14935, "key": "a02b4ae0c1c44c4c9a7e2f2d23d5dcde"}, widget(page)
    assert widget("<div>no agenda</div>") is None

    timetable = _sample("timetable.json")
    rows = activities(timetable)
    assert len(rows) == 37, len(rows)
    first = rows[0]
    assert (first["id"], first["date"], first["start"], first["end"], first["type"]) == (70911, "2026-10-18", "10:30", "11:30", 2), first
    assert first["title"] == "Gathering and Registration" and first["halls"] == ["Hall A", "Hall B", "Hall C"]
    assert first["description"] is None
    last = rows[-1]
    assert (last["id"], last["date"], last["start"], last["title"]) == (70950, "2026-10-20", "14:40", "Light Lunch"), last
    assert sorted({r["date"] for r in rows}) == ["2026-10-18", "2026-10-19", "2026-10-20"]
    assert len([r for r in rows if r["type"] == 12]) == 24

    bad = json.loads(json.dumps(timetable))
    bad["tables"][0]["activities"][0]["date"] = "19/10/2026 08:00:00"
    try:
        activities(bad)
    except ValueError:
        pass
    else:
        raise AssertionError("a disagreeing activity date must be refused")

    opening = session(_sample("session-70912.json"))
    assert opening["note"] is None and opening["chairs"] == []
    assert len(opening["lectures"]) == 6
    assert opening["lectures"][0]["title"] == "Opening" and opening["lectures"][0]["speakers"] == []
    top = opening["lectures"][1]
    assert (top["start"], top["end"], top["title"]) == ("11:40", "11:55", "Top 20 Papers in Radiology 2026")
    assert top["speakers"][0]["name"] == "Dr. Anat Ilvitzky"
    assert top["speakers"][0]["institute"] == "Rambam Healthcare Campus"
    assert opening["image"] == top["speakers"][0]["portrait"]
    assert opening["image"].startswith("https://files-cdn.eventact.com/FileView/36c4388d")
    assert opening["lectures"][-1]["notes"] == "Sponsored by: Mor Institute"

    debates = session(_sample("session-70928.json"))
    assert debates["note"] == "The session will be held in Hebrew."
    # The first speaker has only the placeholder; the second has a portrait.
    assert debates["lectures"][0]["speakers"][0]["portrait"] is None
    assert debates["image"] == debates["lectures"][1]["speakers"][0]["portrait"] is not None

    gathering = session(_sample("session-70911.json"))
    assert gathering["image"] is None and gathering["lectures"][0]["speakers"] == []

    assert text("CT &amp; Chronic") == "CT & Chronic"
    assert text("<p>a</p>\n<p>b</p>") == "a\nb"
    print("isra parse selftest: ok")


if __name__ == "__main__":
    if sys.argv[1:] != ["--selftest"]:
        sys.exit("usage: parse.py --selftest")
    selftest()
