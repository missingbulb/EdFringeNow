"""programme-pdf raw (`programme.json`) -> the Electricity & Energy convention's sessions, in Eilat's hotels.

Each cell of the frame programme is one session with its one slot, ending where
the day's next slot starts (the day's last has no printed end). A cell opens
with its code when it has one ("Workshop A", "Plenary Session 4", a track
session "WAM1"), names its chair, and ends with its room. A workshop's or a
track session's bold lines are all its title when there are at most three of
them; otherwise, and for a plenary, the title is the first bold line and the
lines it wraps or runs on into, and the bold lines after it are talks. The title
served is the code and the title together. Rooms are in three hotels: Herods
Boutique, Herods Palace and the Dan Eilat; a cell that names no room (an
evening show) has no venue. Registration, the exhibition, breaks and meals are
logistics; the evening entertainment is typed by its own name.
"""

import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "platforms"))
import pdf_grid

REGISTRATION = "https://reg.eventact.com//welcome?Form=in5cAAA&c=iJwg&Event=iSpMAAA&lang=en"
LOGISTICS = re.compile(r"^(Opening of Registration|Registration|Exhibition|Evening break|Coffee break|Lunch|Light lunch|Dinner)\b", re.I)
CODE = re.compile(r"^(Workshop [A-Z]|Plenary Session \d+|[WTF][AP]M ?\d+(?:[.\-]\d+)?)$")
CHAIR = re.compile(r"^Chair(?:man)?\s*:", re.I)
ROOM = re.compile(r"^\d?(Herods (?:Boutique|Palace)|Boutique|Dan Eilat)(?: Hotel)?\s*[,–-]\s*(.+)$")
VENUES = {"Herods Boutique": "herods-boutique", "Boutique": "herods-boutique",
          "Herods Palace": "herods-palace", "Dan Eilat": "dan-eilat"}
# The printed spellings of one Dan Eilat hall.
ROOM_NAMES = {"Tarshis": "Tarshish"}
SOCIAL = {"Beer evening": "other", "Keren Peles show hosts Shiri Maimon": "music",
          "Avi Nussbaum's stand-up show": "comedy"}


def _minutes(hhmm):
    hours, minutes = hhmm.split(":")
    return int(hours) * 60 + int(minutes)


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def _room(lines):
    """Strip the room off a cell's last line -> (venue id, room id, room name) or Nones."""
    found = ROOM.match(lines[-1]["text"]) if lines else None
    if not found:
        return None, None, None
    lines.pop()
    # "and Maintenance Herods / Boutique, Queens": the hotel's name broke over two lines.
    if found.group(1) == "Boutique" and lines and lines[-1]["text"].endswith(" Herods"):
        lines[-1] = dict(lines[-1], text=lines[-1]["text"][:-len(" Herods")])
    name = ROOM_NAMES.get(found.group(2).strip(), found.group(2).strip())
    venue = VENUES[found.group(1)]
    return venue, "%s-%s" % (venue, slug(name)), name


def adapt(source):
    raw = source.read("programme.json")
    partial = {"categories": {}, "venues": {}, "events": {}, "performances": {}, "skipped": []}
    columns = {}
    for cell in raw["sessions"]:
        lines = [line for paragraph in cell["paragraphs"] for line in paragraph]
        if LOGISTICS.match(lines[0]["text"]):
            partial["skipped"].append("%s %s %s (logistics)" % (cell["date"], cell["start"], lines[0]["text"]))
            continue
        venue, room, _ = _room(lines)
        code = lines.pop(0)["text"] if CODE.match(lines[0]["text"]) else None
        chair = [line for line in lines if CHAIR.match(line["text"])]
        lines = [line for line in lines if not CHAIR.match(line["text"])]
        bold_run = next((n for n, line in enumerate(lines) if not line["bold"]), len(lines))
        whole = code is not None and not code.startswith("Plenary") and bold_run <= 3
        title_lines = []
        while lines and lines[0]["bold"] and (whole or not title_lines or title_lines[-1]["full"]
                                               or title_lines[-1]["text"].endswith((",", "&", "-", ":"))):
            title_lines.append(lines.pop(0))
        title = pdf_grid.joined([dict(line, full=True) for line in title_lines]) if title_lines else None
        if code and title:
            title = "%s: %s" % (code, title)
        title = title or code
        if title is None:
            raise ValueError("a cell on %s at %s has no title" % (cell["date"], cell["start"]))
        blurb = [line["text"] for line in chair] + ([pdf_grid.joined(lines, "\n")] if lines else [])
        columns[(cell["date"], cell["start"])] = columns.get((cell["date"], cell["start"]), 0) + 1
        event_id = "%s-%s-%s" % (cell["date"], cell["start"].replace(":", ""),
                                 slug(code) if code else columns[(cell["date"], cell["start"])])
        if event_id in partial["events"]:
            raise ValueError("two sessions are both %s" % event_id)
        event = {
            "title": title,
            "titleLocal": None,
            "url": raw["pdf"],
            "categories": [],
            "blurb": "\n".join(blurb) or None,
            "durationMin": _minutes(cell["end"]) - _minutes(cell["start"]) if cell["end"] else None,
            "imageUrl": None,
        }
        if title in SOCIAL:
            event["genre"] = SOCIAL[title]
        partial["events"][event_id] = event
        if venue:
            partial["venues"].setdefault(venue, {})
        partial["performances"]["%s/%s/%s" % (event_id, cell["date"], cell["start"])] = {
            "eventId": event_id,
            "venueId": venue,
            "roomId": room,
            "date": cell["date"],
            "start": cell["start"],
            "ticketUrl": REGISTRATION,
            "free": False,
        }
    return partial
