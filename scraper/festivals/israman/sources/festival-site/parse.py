#!/usr/bin/env python3
"""Pure parsing of Challenge ISRAMAN's weekend schedule page (no network, no files).

israman.co.il's "לו"ז" page (`?page_id=313`) is an Elementor accordion: a
section per day, titled with its date ("יום רביעי 27.1.2027"), whose text is a
line per item, the time in bold before an en dash:

    <p><strong>16:00-19:00 &#8211;</strong> חלוקת ערכות משתתף במלון ישרוטל ספורט קלאב (1) …</p>

The times come in the page's own shapes: a range, typed in either order
("11:15 – 10:45" is 10:45 to 11:15, the right-to-left page reversing it); a
single time; an estimate ("11:00 משוער"); two ranges ("10:30 עד 12:45 | 15:00
עד 18:00"). Race day also carries the start-wave table: start, race, age group,
swim-cap and wristband colours. Sections without a date (the shuttle
timetables) are named and left unread.

This parser returns each day's lines and waves in the page's own words; what
is an event is the adapter's call.

    python3 scraper/festivals/israman/sources/festival-site/parse.py --selftest
"""

import html
import os
import re
import sys

SAMPLES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "samples")

_SECTION = re.compile(r'<div class="elementor-accordion-item">')
_TITLE = re.compile(r'<a class="elementor-accordion-title"[^>]*>(.*?)</a>', re.S)
_CONTENT = re.compile(r'<div id="elementor-tab-content-\d+" class="elementor-tab-content[^"]*"[^>]*>(.*)', re.S)
_DATE = re.compile(r"(\d{1,2})\.(\d{1,2})\.(\d{4})")
_TABLE = re.compile(r"<table\b.*?</table>", re.S | re.I)
_ROW = re.compile(r"<tr\b.*?</tr>", re.S | re.I)
_CELL = re.compile(r"<td\b.*?</td>", re.S | re.I)
_BREAK = re.compile(r"</(p|div|li|h[1-6])\s*>|<br\s*/?>|<hr\s*/?>", re.I)
_TAG = re.compile(r"<[^>]+>")
_TIME = r"\d{1,2}:\d{2}"
_RANGE = r"(%s)(?:\s*(?:-|–|עד)\s*(%s))?(\s*משוער)?" % (_TIME, _TIME)
_SPAN = r"%s(?:\s*(?:-|–|עד)\s*%s)?(?:\s*משוער)?" % (_TIME, _TIME)
_LEAD = re.compile(r"^(%s(?:\s*\|\s*%s)*)\s*–\s*(.*)$" % (_SPAN, _SPAN))
_ONE = re.compile(_RANGE)
WAVE_HEADER = ["זינוק", "מקצה", "קבוצת גיל", "צבע כובע שחייה", "צבע צמיד"]


def _lines(markup):
    text = html.unescape(_TAG.sub("", _BREAK.sub("\n", markup)))
    lines = (re.sub(r"\s+", " ", line).strip() for line in text.split("\n"))
    return [line for line in lines if line]


def _hhmm(value):
    hours, minutes = value.split(":")
    return "%02d:%s" % (int(hours), minutes)


def line(text):
    """"11:15 – 10:45 – תדריך …" -> {slots: [["10:45", "11:15"]], estimated: False, text: "תדריך …"}.

    A line with no time before its dash keeps all its text and no slots.
    """
    lead = _LEAD.match(text)
    if not lead:
        return {"slots": [], "estimated": False, "text": text}
    slots, estimated = [], False
    for part in lead.group(1).split("|"):
        found = _ONE.search(part)
        first, second = _hhmm(found.group(1)), found.group(2) and _hhmm(found.group(2))
        slots.append(sorted([first, second]) if second else [first, None])
        estimated = estimated or bool(found.group(3))
    return {"slots": slots, "estimated": estimated, "text": lead.group(2).strip()}


def waves(table):
    """The start-wave table -> [{start, race, group, cap, band}], refusing a table whose columns moved."""
    rows = [[" ".join(_lines(cell)) for cell in _CELL.findall(row)] for row in _ROW.findall(table)]
    rows = [row for row in rows if any(row)]
    if not rows or rows[0] != WAVE_HEADER:
        raise ValueError("the start table's columns are %r, not %r" % (rows[0] if rows else None, WAVE_HEADER))
    out = []
    for row in rows[1:]:
        if len(row) != len(WAVE_HEADER) or not re.match(r"^%s$" % _TIME, row[0]):
            raise ValueError("unreadable start-table row %r" % row)
        out.append({"start": _hhmm(row[0]), "race": row[1], "group": row[2], "cap": row[3], "band": row[4]})
    return out


def schedule(page):
    """The schedule page -> {days: [{date, title, lines, waves}], undated: [section title]}."""
    days, undated = [], []
    starts = [m.start() for m in _SECTION.finditer(page)]
    for n, start in enumerate(starts):
        section = page[start:starts[n + 1] if n + 1 < len(starts) else len(page)]
        title = " ".join(_lines(_TITLE.search(section).group(1)))
        content = _CONTENT.search(section).group(1)
        date = _DATE.search(title)
        if not date:
            undated.append(title)
            continue
        tables = _TABLE.findall(content)
        days.append({
            "date": "%s-%02d-%02d" % (date.group(3), int(date.group(2)), int(date.group(1))),
            "title": title,
            "lines": [line(text) for text in _lines(_TABLE.sub("\n", content))],
            "waves": [wave for table in tables for wave in waves(table)],
        })
    return {"days": days, "undated": undated}


def selftest():
    assert line("16:00-19:00 – חלוקת ערכות") == {"slots": [["16:00", "19:00"]], "estimated": False, "text": "חלוקת ערכות"}
    assert line("11:15 – 10:45 – תדריך 226 – אולם") == {"slots": [["10:45", "11:15"]], "estimated": False,
                                                        "text": "תדריך 226 – אולם"}
    assert line("12:00 – הדרכה") == {"slots": [["12:00", None]], "estimated": False, "text": "הדרכה"}
    assert line("11:00 משוער – הגעת המנצח") == {"slots": [["11:00", None]], "estimated": True, "text": "הגעת המנצח"}
    assert line("10:30 עד 12:45 | 15:00 עד 18:00 – שידור ישיר")["slots"] == [["10:30", "12:45"], ["15:00", "18:00"]]
    assert line('לו"ז הזנקות כמפורט בטבלה – הזנקות')["slots"] == []
    with open(os.path.join(SAMPLES, "schedule.html"), encoding="utf-8") as handle:
        page = handle.read()
    parsed = schedule(page)
    assert [d["date"] for d in parsed["days"]] == ["2027-01-27", "2027-01-28", "2027-01-29", "2027-01-30"], parsed["days"]
    assert parsed["undated"] == ['לו"ז הסעות אל נקודת T2', 'לו"ז הסעות בחזרה מנקודת T2'], parsed["undated"]
    assert [len(d["lines"]) for d in parsed["days"]] == [3, 12, 11, 4], [len(d["lines"]) for d in parsed["days"]]
    race_day = parsed["days"][2]
    assert len(race_day["waves"]) == 10, race_day["waves"]
    assert race_day["waves"][1] == {"start": "06:12", "race": "CHALLENGE ISRAMAN 226", "group": "AG 226",
                                    "cap": "GOLD", "band": "WHITE"}, race_day["waves"][1]
    ceremony = parsed["days"][3]["lines"][-1]
    assert ceremony == {"slots": [["11:00", "12:30"]], "estimated": False,
                        "text": "טקס סיום במלון ישרוטל רויאל גארדן אולם WOW"}, ceremony
    try:
        waves("<table><tr><td>שעה</td></tr></table>")
    except ValueError:
        pass
    else:
        raise AssertionError("a start table with other columns must be refused")
    print("israman festival-site parse selftest: ok (%d lines, %d waves)"
          % (sum(len(d["lines"]) for d in parsed["days"]), len(race_day["waves"])))


if __name__ == "__main__":
    if sys.argv[1:] != ["--selftest"]:
        sys.exit("usage: parse.py --selftest")
    selftest()
