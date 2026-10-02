"""programme-pdf raw (`programme.json`) -> ICISA's sessions, in the halls of the David InterContinental.

Each cell of the programme grid is one session with its one time slot. Its
leading bold lines name it (the shared pdf_grid wording joins a track to its
title: "Brain: Mind Matters: …"); what follows (the moderator, then a
paragraph per talk, its last line the speaker) is the blurb. A cell in one hall plays in
that room; one across every hall (a plenary, the opening, the general
assembly) has no room. Registration, breaks and meals are logistics.
"""

import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "platforms"))
import pdf_grid

VENUE = "david-intercontinental"
REGISTRATION = "https://icisa2026-reg.forms-wizard.biz/users/new"
LOGISTICS = re.compile(r"^(Registration, Gathering|Coffee Break|Lunch)\b")


def _minutes(hhmm):
    hours, minutes = hhmm.split(":")
    return int(hours) * 60 + int(minutes)


def adapt(source):
    raw = source.read("programme.json")
    partial = {"categories": {}, "venues": {VENUE: {}}, "events": {}, "performances": {}, "skipped": []}
    for cell in raw["sessions"]:
        title, rest = pdf_grid.heading(cell["paragraphs"][0])
        if title is None:
            raise ValueError("a cell on %s at %s has no bold heading" % (cell["date"], cell["start"]))
        title = title.rstrip(":").strip()
        if LOGISTICS.match(title):
            partial["skipped"].append("%s %s %s (logistics)" % (cell["date"], cell["start"], title))
            continue
        blurb = [pdf_grid.joined(rest, " · ")] if rest else []
        blurb += [pdf_grid.joined(paragraph, speaker_last=True) for paragraph in cell["paragraphs"][1:]]
        room = "hall-" + cell["halls"][0].split()[-1].lower() if len(cell["halls"]) == 1 else None
        event_id = "%s-%s-%s" % (cell["date"], cell["start"].replace(":", ""), room or "all-halls")
        if event_id in partial["events"]:
            raise ValueError("two sessions start at %s %s in %s" % (cell["date"], cell["start"], room or "all halls"))
        partial["events"][event_id] = {
            "title": title,
            "titleLocal": None,
            "url": raw["pdf"],
            "categories": [],
            "blurb": "\n".join(blurb) or None,
            "durationMin": _minutes(cell["end"]) - _minutes(cell["start"]),
            "imageUrl": None,
        }
        partial["performances"]["%s/%s/%s" % (event_id, cell["date"], cell["start"])] = {
            "eventId": event_id,
            "venueId": VENUE,
            "roomId": room,
            "date": cell["date"],
            "start": cell["start"],
            "ticketUrl": REGISTRATION,
            "free": False,
        }
    return partial
