#!/usr/bin/env python3
"""ISRA's EventAct agenda answers, read by the shared EventAct parser (no network, no files).

The parsing itself is scraper/festivals/platforms/eventact.py; this file keeps
the self-test over answers captured from ISRA's own agenda.

    python3 scraper/festivals/isra/sources/eventact-agenda/parse.py --selftest
"""

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SAMPLES = os.path.join(HERE, "samples")
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(HERE))), "platforms"))
from eventact import activities, session, text, widget


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
