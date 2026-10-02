"""congress-site raw (`programme.json`) -> the Israel Neurological Association conference's sessions, at Expo Tel Aviv.

The programme publishes sessions, not talks. Each cell is a session with its
one slot, except: "Parallel Scientific Sessions", a banner over the oral
sessions beneath it; a "Topic: …" cell, which names the topic of the plenary
in the cell above it in the same halls and joins that session's blurb; and
registration, coffee and lunch, which are logistics. A cell in one hall plays
in that room; one across several halls has no room.
"""

import re

VENUE = "expo-tel-aviv"
REGISTRATION = "https://israelneurocongress.com/%d7%94%d7%a8%d7%a9%d7%9e%d7%94-%d7%9c%d7%9b%d7%a0%d7%a1-%d7%94%d7%a9%d7%a0%d7%aa%d7%99-2026/"
BANNER = "Parallel Scientific Sessions"
LOGISTICS = re.compile(r"^(Gathering and Registration|Coffee Break|Lunch)\b")
TOPIC = re.compile(r"^Topic\s*:\s*(.+)$")


def _minutes(hhmm):
    hours, minutes = hhmm.split(":")
    return int(hours) * 60 + int(minutes)


def room_code(hall):
    """"Hall A3" -> "hall-a3", the room id the curated venue uses."""
    return re.sub(r"[^a-z0-9]+", "-", hall.lower()).strip("-")


def adapt(source):
    raw = source.read("programme.json")
    partial = {"categories": {}, "venues": {VENUE: {}}, "events": {}, "performances": {}, "skipped": []}
    previous = {}
    for cell in raw["cells"]:
        where = (cell["date"], tuple(cell["halls"]))
        if cell["text"] == BANNER:
            partial["skipped"].append("%s %s %s (a banner over the sessions below it)" % (cell["date"], cell["start"], cell["text"]))
            continue
        if LOGISTICS.match(cell["text"]):
            partial["skipped"].append("%s %s %s (logistics)" % (cell["date"], cell["start"], cell["text"]))
            continue
        topic = TOPIC.match(cell["text"])
        if topic:
            above = previous.get(where)
            if above is None or partial["events"][above]["blurb"]:
                raise ValueError("%r on %s has no session above it to name" % (cell["text"], cell["date"]))
            partial["events"][above]["blurb"] = cell["text"]
            continue
        room = room_code(cell["halls"][0]) if len(cell["halls"]) == 1 else None
        event_id = "%s-%s-%s" % (cell["date"], cell["start"].replace(":", ""), room or "all-halls")
        if event_id in partial["events"]:
            raise ValueError("two sessions are both %s" % event_id)
        partial["events"][event_id] = {
            "title": cell["text"],
            "titleLocal": None,
            "url": raw["page"],
            "categories": [],
            "blurb": None,
            "durationMin": _minutes(cell["end"]) - _minutes(cell["start"]),
            "imageUrl": None,
        }
        previous[where] = event_id
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
