"""festival-site raw (`programme.json`) -> Challenge ISRAMAN's weekend: races by start wave, briefings, the expo, ceremonies.

The schedule is a weekend's lines in Hebrew; this adapter is its vocabulary.
Each race start in the start-wave table is an event of its own (its race and
age group, with the swim cap and wristband that mark it), since a wave is what
an athlete or a spectator plans around. The briefings, the swim-course clinics,
the expo, the winners' estimated arrivals, the finish-line party, Saturday's
sea swim and the closing ceremony are events. What only moves athletes and
their kit (kit pickup, bike service and check-in, transition opening and
closing, shuttles, kit collection, lost property, the finish line's closing)
is logistics; the live television broadcast has no venue and the press
conference is for the press, so both are skipped too.

The schedule numbers its places: (1) Isrotel Sport Club, (2) the expo compound
in the Royal Garden's car park, where the winners arrive and so the finish
line, (3) Royal Beach. Saturday's swim names no place.
"""

import re

REGISTRATION = "https://israman.co.il/?page_id=33067"
SKIP = [
    (re.compile(r"^חלוקת ערכות"), "kit pickup"),
    (re.compile(r"^טיפולי אופניים"), "bike service"),
    (re.compile(r"^הכנסת אופניים"), "bike and bag check-in"),
    (re.compile(r"^(פתיחת|סגירת) שטח החלפה"), "transition area"),
    (re.compile(r'^לו"ז הזנקות'), "the start waves, read from the table"),
    (re.compile(r"^הסעות"), "shuttles"),
    (re.compile(r"^איסוף אופניים"), "kit collection"),
    (re.compile(r"^אבדות ומציאות"), "lost property"),
    (re.compile(r"^נעילת קו סיום"), "the finish line's closing time"),
    (re.compile(r"^שידור ישיר"), "a television broadcast, at no venue"),
    (re.compile(r"^מסיבת עיתונאים"), "for the press"),
]
_MAP_POINT = re.compile(r"\s*\(\d\)\s*$")


def _title_before(text, marker):
    return text.split(marker)[0].strip()


def _event(line, slot):
    """A schedule line -> (event id, title, genre, venue, room, free); None for a line no rule knows."""
    text = line["text"]
    if text.startswith("אקספו"):
        return "expo", "אקספו", "other", "royal-garden", "expo", None
    if text.startswith("תדריך"):
        return ("briefing-" + slot.replace(":", ""), _title_before(text, " במלון"), "talk",
                "royal-beach-hotel", "alon-ve-ela", None)
    if text.startswith("הדרכה וסימולציית מסלול השחייה"):
        return "swim-clinic", _title_before(text, " –"), "other", "royal-beach", None, "הדרכה חינם" in text
    if text.startswith("הגעת המנצח"):
        race = "226" if "226" in text else "113"
        return "winner-" + race, _MAP_POINT.sub("", text), "other", "royal-garden", "expo", True
    if text.startswith("מסיבת קו סיום"):
        return "finish-party", text, "other", "royal-garden", "expo", True
    if text.startswith("משחה"):
        return "red-sea-swim-cup", text, "other", None, None, None
    if text.startswith("טקס סיום"):
        return "closing-ceremony", "טקס סיום", "other", "royal-garden", "wow", None
    return None


def _minutes(hhmm):
    hours, minutes = hhmm.split(":")
    return int(hours) * 60 + int(minutes)


def _slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def adapt(source):
    raw = source.read("programme.json")
    partial = {"categories": {}, "venues": {}, "events": {}, "performances": {}, "skipped": []}
    lengths = {}

    def add(event_id, event, venue, room, date, slot, free, ticket_url=None):
        if event_id not in partial["events"]:
            partial["events"][event_id] = dict(event, url=raw["page"], categories=[], imageUrl=None)
        length = _minutes(slot[1]) - _minutes(slot[0]) if slot[1] else None
        lengths.setdefault(event_id, set()).add(length)
        if venue:
            partial["venues"].setdefault(venue, {})
        key = "%s/%s/%s" % (event_id, date, slot[0])
        if key in partial["performances"]:
            raise ValueError("two performances are both %s" % key)
        partial["performances"][key] = {
            "eventId": event_id, "venueId": venue, "roomId": room, "date": date, "start": slot[0],
            "ticketUrl": ticket_url, "free": free,
        }

    for day in raw["days"]:
        for line in day["lines"]:
            reason = next((why for pattern, why in SKIP if pattern.search(line["text"])), None)
            when = line["slots"][0][0] if line["slots"] else "--:--"
            if reason:
                partial["skipped"].append("%s %s %s (%s)" % (day["date"], when, line["text"], reason))
                continue
            if len(line["slots"]) != 1:
                raise ValueError("%s: %r has %d times; one is expected" % (day["date"], line["text"], len(line["slots"])))
            slot = line["slots"][0]
            known = _event(line, slot[0])
            if known is None:
                raise ValueError("%s: no rule knows the schedule line %r" % (day["date"], line["text"]))
            event_id, title, genre, venue, room, free = known
            blurb = line["text"] + (" (שעה משוערת)" if line["estimated"] else "")
            add(event_id, {"title": title, "titleLocal": None, "genre": genre, "blurb": blurb},
                venue, room, day["date"], slot, free)
        for wave in day["waves"]:
            event_id = "start-%s-%s" % (wave["start"].replace(":", ""), _slug(wave["group"]))
            add(event_id, {
                "title": "זינוק %s – %s" % (wave["race"], wave["group"]),
                "titleLocal": None,
                "genre": "other",
                "blurb": "צבע כובע שחייה: %s · צבע צמיד: %s" % (wave["cap"], wave["band"]),
            }, "royal-beach", None, day["date"], [wave["start"], None], False, REGISTRATION)
    for event_id, event in partial["events"].items():
        found = lengths[event_id]
        event["durationMin"] = found.pop() if len(found) == 1 else None
    return partial
